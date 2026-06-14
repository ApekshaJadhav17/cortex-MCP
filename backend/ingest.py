import hashlib
from datetime import datetime
from urllib.parse import urlparse, parse_qs

import fitz  # pymupdf
import httpx
import trafilatura
from youtube_transcript_api import YouTubeTranscriptApi
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import os
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "cortex"
EMBED_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

_embedder = None
_qdrant = None


class DuplicateError(Exception):
    def __init__(self, title: str):
        self.title = title
        super().__init__(f"Already saved: {title}")


def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def get_qdrant():
    global _qdrant
    if _qdrant is None:
        client = QdrantClient(url=QDRANT_URL)
        _ensure_collection(client)
        _qdrant = client
    else:
        _ensure_collection(_qdrant)
    return _qdrant


def _ensure_collection(client: QdrantClient):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )


# ── Duplicate detection ────────────────────────────────────────────────────────

def is_duplicate(url: str) -> bool:
    try:
        qdrant = get_qdrant()
        result = qdrant.count(
            collection_name=COLLECTION_NAME,
            count_filter=Filter(must=[FieldCondition(key="url", match=MatchValue(value=url))]),
        )
        return result.count > 0
    except Exception:
        return False


# ── YouTube ────────────────────────────────────────────────────────────────────

def _extract_youtube_id(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        return parse_qs(parsed.query).get("v", [None])[0]
    if parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")
    return None


def _youtube_title_via_oembed(url: str) -> str:
    try:
        resp = httpx.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.json().get("title", "")
    except Exception:
        pass
    return ""


def _fetch_youtube(url: str) -> tuple[str, str]:
    video_id = _extract_youtube_id(url)
    if not video_id:
        raise ValueError(f"Cannot extract YouTube video ID from {url}")
    title = _youtube_title_via_oembed(url) or f"YouTube Video ({video_id})"
    transcript = YouTubeTranscriptApi().fetch(video_id)
    text = " ".join(snippet.text for snippet in transcript)
    return title, text


# ── PDF ────────────────────────────────────────────────────────────────────────

def _is_pdf_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf")


def _extract_pdf_text(data: bytes) -> tuple[str, str]:
    doc = fitz.open(stream=data, filetype="pdf")
    title = doc.metadata.get("title", "").strip() or ""
    pages = [page.get_text() for page in doc]
    text = "\n".join(pages)
    return title, text


def _fetch_pdf_from_url(url: str) -> tuple[str, str]:
    resp = httpx.get(url, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    title, text = _extract_pdf_text(resp.content)
    if not title:
        title = url.split("/")[-1].replace(".pdf", "") or url
    if not text.strip():
        raise ValueError("Could not extract text from PDF")
    return title, text


def ingest_pdf_bytes(data: bytes, filename: str) -> dict:
    """Entry point for file-upload ingestion."""
    url = f"pdf://{filename}"
    if is_duplicate(url):
        title, _ = _extract_pdf_text(data)
        raise DuplicateError(title or filename.replace(".pdf", ""))
    title, text = _extract_pdf_text(data)
    if not title:
        title = filename.replace(".pdf", "")
    if not text.strip():
        raise ValueError("Could not extract text from PDF")
    return _store(url=url, title=title, text=text, source_type="pdf")


# ── Article ────────────────────────────────────────────────────────────────────

def _fetch_article(url: str) -> tuple[str, str]:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError(f"Failed to fetch URL: {url}")
    text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
    if not text:
        raise ValueError(f"Could not extract text from {url}")
    meta = trafilatura.extract_metadata(downloaded)
    title = (meta.title if meta and meta.title else url)
    return title, text


# ── Chunking ───────────────────────────────────────────────────────────────────

def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    tokens = text.split()
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunks.append(" ".join(tokens[start:end]))
        if end == len(tokens):
            break
        start += chunk_size - overlap
    return chunks


# ── Storage ────────────────────────────────────────────────────────────────────

def _store(url: str, title: str, text: str, source_type: str) -> dict:
    chunks = _chunk_text(text)
    date_saved = datetime.utcnow().isoformat()
    embedder = get_embedder()
    qdrant = get_qdrant()

    prefixed = [
        f"Source: {title}\nType: {source_type}\nDate: {date_saved}\n\n{chunk}"
        for chunk in chunks
    ]
    vectors = embedder.encode(prefixed, show_progress_bar=False).tolist()

    base_id = int(hashlib.md5(url.encode()).hexdigest(), 16) % (10 ** 15)
    points = [
        PointStruct(
            id=base_id + i,
            vector=vectors[i],
            payload={
                "title": title,
                "url": url,
                "source_type": source_type,
                "date_saved": date_saved,
                "chunk_index": i,
                "text": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

    return {
        "title": title,
        "url": url,
        "source_type": source_type,
        "chunks_stored": len(chunks),
        "date_saved": date_saved,
    }


# ── Public entry points ────────────────────────────────────────────────────────

def ingest_note(title: str, text: str) -> dict:
    """Save a plain-text / markdown note directly (no URL required)."""
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    url = f"note://{slug}"
    if is_duplicate(url):
        raise DuplicateError(title)
    if not text.strip():
        raise ValueError("Note text cannot be empty")
    return _store(url=url, title=title, text=text, source_type="note")


def ingest_url(url: str) -> dict:
    if is_duplicate(url):
        # Fetch existing title for the error message
        qdrant = get_qdrant()
        records, _ = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(must=[FieldCondition(key="url", match=MatchValue(value=url))]),
            limit=1,
            with_payload=True,
            with_vectors=False,
        )
        existing_title = records[0].payload.get("title", url) if records else url
        raise DuplicateError(existing_title)

    if _extract_youtube_id(url):
        title, text = _fetch_youtube(url)
        source_type = "youtube"
    elif _is_pdf_url(url):
        title, text = _fetch_pdf_from_url(url)
        source_type = "pdf"
    else:
        title, text = _fetch_article(url)
        source_type = "article"

    return _store(url=url, title=title, text=text, source_type=source_type)


def delete_url(url: str):
    qdrant = get_qdrant()
    qdrant.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[FieldCondition(key="url", match=MatchValue(value=url))]
        ),
    )


def list_items() -> list[dict]:
    qdrant = get_qdrant()
    seen_urls: set[str] = set()
    items: list[dict] = []
    offset = None

    while True:
        records, offset = qdrant.scroll(
            collection_name=COLLECTION_NAME,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for record in records:
            p = record.payload
            if p["url"] not in seen_urls:
                seen_urls.add(p["url"])
                items.append({
                    "title": p["title"],
                    "url": p["url"],
                    "source_type": p["source_type"],
                    "date_saved": p["date_saved"],
                })
        if offset is None:
            break

    items.sort(key=lambda x: x["date_saved"], reverse=True)
    return items
