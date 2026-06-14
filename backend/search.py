from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
import os
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "cortex"
EMBED_MODEL = "all-MiniLM-L6-v2"
TOP_K = 5

_embedder = None
_qdrant = None


def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def get_qdrant():
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(url=QDRANT_URL)
    return _qdrant


def search(query: str, top_k: int = TOP_K) -> list[dict]:
    embedder = get_embedder()
    qdrant = get_qdrant()

    query_vector = embedder.encode(query, show_progress_bar=False).tolist()
    response = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=top_k,
        with_payload=True,
    )

    results = []
    for hit in response.points:
        p = hit.payload
        results.append({
            "score": round(hit.score, 4),
            "title": p.get("title", ""),
            "url": p.get("url", ""),
            "source_type": p.get("source_type", ""),
            "date_saved": p.get("date_saved", ""),
            "chunk_index": p.get("chunk_index", 0),
            "text": p.get("text", ""),
        })
    return results
