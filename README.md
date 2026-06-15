# Cortex — The Memory Layer for Your AI

> You read a brilliant article at 11pm. You watch a YouTube deep-dive on a topic you've been obsessing over. You paste notes from a meeting into a doc somewhere. Three weeks later, you're in a conversation and you *know* you have something relevant saved — but you can't find it. You search your bookmarks, your notes app, your browser history. Nothing surfaces what you actually need.
>
> That's the problem Cortex was built to solve.

---

## The Problem

We are living through an information explosion. Every day, knowledge workers, researchers, developers, and curious people consume dozens of articles, videos, papers, and notes. The tools we use to save this information — bookmarks, highlights, note apps, read-later lists — are fundamentally keyword-based. They require you to remember *exactly* what you're looking for to find it.

But human memory doesn't work that way. You remember *ideas*, not exact phrases. You remember *concepts*, not filenames. You remember that something was *related* to what you're working on now — not the precise words the author used.

The result: a graveyard of saved content that you never revisit, because retrieval is too painful to bother with.

**Existing solutions fall short:**
- Bookmarks have no intelligence — they're just links
- Note apps like Notion or Obsidian need manual tagging and organization to be useful
- Services like Readwise are read-only surfaces — you can't *ask* your saved content questions
- AI assistants like ChatGPT have no memory of what *you* specifically have read and saved

There was no tool that let you throw in content from anywhere — articles, YouTube transcripts, PDFs, raw notes — and then have a conversation with all of it as a unified knowledge base.

---

## The Solution: Cortex

Cortex is a **personal second brain** built on top of a full Retrieval-Augmented Generation (RAG) pipeline. It lets you:

1. **Save anything** — paste a URL (article, YouTube video, or PDF link), upload a PDF file, or write a note directly
2. **Search semantically** — not by keyword, but by meaning. Ask "what did I read about transformer attention?" and get relevant chunks back even if you never used those exact words
3. **Ask questions** — type a natural language question and get a streamed, cited answer generated from *your* saved content specifically
4. **Use it inside Claude** — an MCP server exposes Cortex as a tool, so you can search and save your second brain mid-conversation without leaving Claude Desktop
5. **Save from your browser** — a Chrome extension lets you capture any page with a single click while browsing

Everything runs locally. No subscription. No data sent to a third party except the LLM inference call. Your knowledge base is yours.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                                                                       │
│   ┌─────────────────────┐          ┌──────────────────────┐         │
│   │   React Frontend     │          │   Chrome Extension   │         │
│   │   (Vite, port 5173) │          │   (Manifest v3)      │         │
│   │                     │          │                      │         │
│   │  • Save URLs/Notes  │          │  • One-click save    │         │
│   │  • Upload PDFs      │          │  • Active tab URL    │         │
│   │  • Semantic search  │          │  • Status feedback   │         │
│   │  • Ask Cortex (RAG) │          └──────────┬───────────┘         │
│   │  • Library view     │                     │                     │
│   └──────────┬──────────┘                     │                     │
│              │  HTTP / SSE                    │ HTTP                │
└──────────────┼────────────────────────────────┼─────────────────────┘
               │                                │
┌──────────────▼────────────────────────────────▼─────────────────────┐
│                        FASTAPI BACKEND  (port 8000)                  │
│                                                                       │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│   │  ingest.py   │   │   search.py  │   │       rag.py         │   │
│   │              │   │              │   │                      │   │
│   │ • URL fetch  │   │ • Embed query│   │ • Retrieve top-5     │   │
│   │ • YouTube    │   │ • Cosine sim │   │ • Build context      │   │
│   │   transcript │   │ • Qdrant     │   │ • Stream via Groq    │   │
│   │ • PDF extract│   │   query      │   │ • SSE events         │   │
│   │ • Note ingest│   │              │   │   (source/chunk/done)│   │
│   │ • Chunking   │   └──────┬───────┘   └──────────────────────┘   │
│   │ • Embedding  │          │                                        │
│   │ • Dedup check│          │                                        │
│   └──────┬───────┘          │                                        │
│          │                  │                                        │
└──────────┼──────────────────┼────────────────────────────────────────┘
           │                  │
           │   Vector upsert  │   Vector query
           ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    QDRANT VECTOR DB  (port 6333)                      │
│                    Docker container: cortex-qdrant                    │
│                    Collection: cortex  │  Dimensions: 384             │
│                    Distance: Cosine    │  Embedder: all-MiniLM-L6-v2  │
└──────────────────────────────────────────────────────────────────────┘

           ┌──────────────────────────────────────────┐
           │           MCP SERVER (stdio)              │
           │           mcp_server.py                  │
           │                                          │
           │  Tools exposed to Claude Desktop:        │
           │  • search_cortex(query)                  │
           │  • save_to_cortex(url)                   │
           │  • save_note_to_cortex(title, text)      │
           │  • list_cortex()                         │
           └──────────────────────────────────────────┘

                                    ┌─────────────────┐
                          LLM call  │   Groq Cloud     │
                         ──────────►│  llama-3.3-70b  │
                                    │  (streaming)     │
                                    └─────────────────┘
```

---

## How It Works — The Full Pipeline

### Step 1: Ingestion

When you submit a URL or file, Cortex figures out what kind of content it is and fetches it appropriately.

**Articles** are fetched using `trafilatura`, a library purpose-built for extracting clean article text from web pages — stripping ads, navigation, comments, and boilerplate. It also extracts the page title from metadata.

**YouTube videos** are handled by extracting the video ID from the URL, fetching the transcript via `youtube-transcript-api`, and retrieving the title via YouTube's oEmbed endpoint. This means you can save a 3-hour lecture and query its content without ever watching it.

**PDFs** are supported both via URL (the backend fetches and parses it) and via direct file upload from the UI. Text extraction is handled by `pymupdf` (PyMuPDF / fitz), which reliably handles multi-page documents and reads embedded metadata for the title.

**Notes** are saved directly — no fetching required. The title is slugified into a `note://` URI scheme so it integrates cleanly with the rest of the storage model.

**Duplicate detection** happens before any fetching. Qdrant is queried for an existing record with the same URL, and if one exists, a `DuplicateError` is raised immediately — saving API calls and giving the user specific feedback ("Already in your brain: *[title]*").

### Step 2: Chunking

Once the raw text is extracted, it's split into overlapping chunks of 500 words with a 50-word overlap between adjacent chunks. Overlap ensures that ideas that span a chunk boundary aren't lost — the context bleeds across.

Each chunk is prefixed with its source metadata before embedding:

```
Source: How Transformers Work
Type: article
Date: 2024-11-12T10:32:00

The attention mechanism allows the model to weigh...
```

This prefix means the embedding captures not just the content but context about *what kind of thing this is* — which subtly improves retrieval.

### Step 3: Embedding

Chunks are encoded using `sentence-transformers` with the `all-MiniLM-L6-v2` model. This model produces 384-dimensional dense vectors and runs entirely locally — no API call, no cost, no data leaving your machine.

Each chunk gets a unique Qdrant point ID derived from an MD5 hash of the source URL plus the chunk index, making upserts idempotent and collision-resistant. The full payload stored alongside each vector includes the title, URL, source type, date saved, chunk index, and the original chunk text.

### Step 4: Semantic Search

When you search, your query is embedded using the same model, producing a 384-dimensional vector. Qdrant performs a cosine similarity search across all stored vectors and returns the top-K most semantically similar chunks.

Cosine similarity measures the angle between vectors in high-dimensional space — meaning two chunks can be considered "similar" even if they share no words in common, as long as they represent related ideas. This is what makes semantic search fundamentally different from keyword search.

### Step 5: RAG — Asking Cortex

When you ask a question, the following sequence happens:

1. The question is semantically searched against your knowledge base (top 5 chunks)
2. Sources are immediately emitted as SSE events so the frontend can render source chips before the answer starts streaming
3. The top chunks are assembled into a context block, labeled and separated
4. The context + question are sent to Groq's `llama-3.3-70b-versatile` model via LangChain
5. The model streams its response back token by token
6. Each token is wrapped in an SSE `chunk` event and sent to the frontend in real time
7. A final `done` event closes the stream

The system prompt explicitly instructs the model to answer *only* from the provided context and to cite sources as `[1]`, `[2]`, etc. — preventing hallucination and grounding every answer in things you actually saved.

```
User question: "What did I read about attention mechanisms?"

→ Semantic search returns 5 chunks from saved articles/videos
→ Groq receives: [system prompt] + [labeled context] + [question]
→ Streams: "Attention mechanisms [1] allow the model to..."
→ Frontend renders answer word by word with blinking cursor
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend framework | FastAPI | Async-native, automatic OpenAPI docs, streaming response support |
| Vector database | Qdrant | Local/self-hostable, fast cosine search, rich filtering, Docker-ready |
| Embedding model | `all-MiniLM-L6-v2` | 384 dims, runs locally, excellent speed/quality tradeoff for semantic search |
| LLM inference | Groq + `llama-3.3-70b` | Fastest available inference API, free tier, strong instruction following |
| LLM orchestration | LangChain | Clean streaming chain abstraction with `StrOutputParser` |
| Article extraction | trafilatura | Purpose-built for clean web text extraction, handles boilerplate removal |
| PDF parsing | PyMuPDF (fitz) | Fast, reliable multi-page PDF text + metadata extraction |
| YouTube | youtube-transcript-api | Fetches transcript directly without YouTube Data API quota |
| HTTP client | httpx | Async-capable, used for PDF URL fetching and YouTube oEmbed |
| Frontend | React + Vite | Fast dev experience, minimal bundle |
| Browser extension | Chrome Manifest v3 | One-click save from any tab |
| MCP server | `mcp` SDK | Exposes Cortex as tools to Claude Desktop |
| DB transport | Qdrant Python client v1.18+ | `query_points()` API, cosine similarity search |

---

## Project Structure

```
cortex/
├── backend/
│   ├── main.py           # FastAPI app — route definitions
│   ├── ingest.py         # Content fetching, chunking, embedding, storage
│   ├── search.py         # Semantic search against Qdrant
│   ├── rag.py            # RAG pipeline — context assembly + Groq streaming
│   ├── mcp_server.py     # MCP server exposing Cortex as Claude Desktop tools
│   ├── requirements.txt  # Python dependencies
│   ├── .env              # Secrets (gitignored)
│   └── .env.example      # Template for required environment variables
│
├── cortex-ui/
│   ├── src/
│   │   ├── App.jsx       # Main UI — all four sections (save, search, ask, library)
│   │   ├── api.js        # Fetch wrappers for all backend endpoints
│   │   ├── App.css       # Dark-themed component styles
│   │   └── main.jsx      # React entry point
│   ├── index.html
│   └── vite.config.js
│
├── cortex-extension/
│   ├── manifest.json     # Chrome Manifest v3 config
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # One-click save logic
│   └── icons/            # Extension icons (16, 48, 128px)
│
└── .gitignore
```

---

## API Reference

All endpoints are served by the FastAPI backend on `http://localhost:8000`. Interactive docs available at `http://localhost:8000/docs`.

### `GET /health`
Returns server status. Used to confirm the backend is reachable.

```json
{ "status": "ok" }
```

---

### `POST /ingest`
Save a URL (article, YouTube video, or PDF link) to Cortex.

**Request:**
```json
{ "url": "https://example.com/article" }
```

**Response:**
```json
{
  "title": "How Transformers Work",
  "url": "https://example.com/article",
  "source_type": "article",
  "chunks_stored": 14,
  "date_saved": "2024-11-12T10:32:00.000000"
}
```

**Errors:**
- `409` — Already saved. Body includes `{ "already_saved": true, "title": "..." }`
- `422` — Could not extract text from URL
- `500` — Fetch or storage failure

---

### `POST /ingest/note`
Save a plain-text or markdown note directly.

**Request:**
```json
{ "title": "Meeting notes — Q4 planning", "text": "Key decisions were..." }
```

**Response:** Same shape as `/ingest`.

---

### `POST /ingest/file`
Upload a PDF file for ingestion. Accepts `multipart/form-data` with a `file` field.

**Response:** Same shape as `/ingest`. Source type will be `"pdf"`.

---

### `GET /search?q={query}`
Perform semantic search across your knowledge base.

**Response:**
```json
{
  "query": "attention mechanisms",
  "results": [
    {
      "score": 0.8741,
      "title": "How Transformers Work",
      "url": "https://example.com/article",
      "source_type": "article",
      "date_saved": "2024-11-12T10:32:00",
      "chunk_index": 3,
      "text": "The attention mechanism allows the model to..."
    }
  ]
}
```

---

### `POST /ask`
Ask a question against your saved content. Returns a **Server-Sent Events** stream.

**Request:**
```json
{ "question": "What have I saved about RAG pipelines?" }
```

**SSE Event types:**

```
data: {"type": "source", "title": "...", "url": "...", "source_type": "...", "score": 0.87}

data: {"type": "chunk", "content": "Based on your saved content, "}

data: {"type": "chunk", "content": "RAG pipelines work by..."}

data: {"type": "done"}
```

Sources are emitted first, before the answer starts streaming, so the frontend can render them immediately.

---

### `GET /items`
Returns all saved items (deduplicated, sorted newest first).

```json
[
  {
    "title": "How Transformers Work",
    "url": "https://example.com/article",
    "source_type": "article",
    "date_saved": "2024-11-12T10:32:00"
  }
]
```

---

### `DELETE /items/{url}`
Remove all chunks associated with a URL from the vector store.

---

## Setup & Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop

### 1. Start the vector database

```bash
# First time only
docker run -d --name cortex-qdrant -p 6333:6333 qdrant/qdrant

# After first time
docker start cortex-qdrant

# Verify
curl http://localhost:6333/healthz
# → healthz check passed
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env and add your Groq API key
# Get one free at https://console.groq.com
```

`.env` contents:
```
GROQ_API_KEY=your_key_here
QDRANT_URL=http://localhost:6333
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

> On first run, `sentence-transformers` will download `all-MiniLM-L6-v2` (~90MB). This happens once and is cached locally.

### 4. Start the backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Verify: `http://localhost:8000/health` → `{"status": "ok"}`

Interactive API docs: `http://localhost:8000/docs`

### 5. Start the frontend

```bash
cd cortex-ui
npm install
npm run dev
```

Open `http://localhost:5173`

### 6. Install the Chrome extension (optional)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `cortex-extension/` folder
5. The Cortex brain icon appears in your toolbar

Click it on any article, video, or page to save it instantly.

---

## MCP Server — Use Cortex Inside Claude Desktop

The MCP server lets Claude Desktop search and save to your Cortex knowledge base as native tools during any conversation.

### Setup

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cortex": {
      "command": "python",
      "args": ["/absolute/path/to/cortex/backend/mcp_server.py"]
    }
  }
}
```

Restart Claude Desktop. You'll see a tools icon in the chat input — Cortex tools will appear there.

### Available tools

| Tool | Description |
|---|---|
| `search_cortex` | Semantic search across your saved knowledge base |
| `save_to_cortex` | Save a URL (article, YouTube, PDF) to your brain |
| `save_note_to_cortex` | Save a plain text note |
| `list_cortex` | List all saved items |

**Example:** While chatting with Claude, you can say *"Search my Cortex for anything about diffusion models"* — Claude will call `search_cortex` and ground its response in your actual saved content.

---

## Design Decisions & Tradeoffs

**Why Qdrant over Pinecone or Weaviate?**
Qdrant runs locally via Docker with zero configuration, has no API key, no usage limits, and a clean Python client. For a personal knowledge tool where the entire point is local ownership of your data, a self-hosted vector DB is the right default. Pinecone is excellent but introduces a dependency on an external service and a free tier limit.

**Why `all-MiniLM-L6-v2` over larger embedding models?**
It produces 384-dimensional vectors (vs 1536 for OpenAI's `text-embedding-3-small`), runs in milliseconds on CPU with no GPU required, and achieves competitive performance on semantic similarity benchmarks for general English text. For a personal knowledge base with hundreds to low thousands of chunks, it's the right tradeoff between speed, memory footprint, and quality.

**Why Groq for LLM inference?**
Groq's LPU hardware delivers token generation speeds of 500–800 tokens/second on `llama-3.3-70b` — making the streaming UX feel near-instant. It has a generous free tier. `llama-3.3-70b-versatile` follows system prompt instructions reliably, which matters for the "answer only from context" constraint.

**Why SSE for streaming instead of WebSockets?**
The ask flow is one-directional — server pushes chunks to the client. SSE is simpler than WebSockets for this pattern: no handshake upgrade, native browser support via `EventSource`, and easy to implement with FastAPI's `StreamingResponse`. The `X-Accel-Buffering: no` header disables Nginx proxy buffering so chunks arrive immediately.

**Why chunk overlap?**
Without overlap, an idea that happens to straddle a 500-word boundary gets cut in half — one half goes into chunk N, the other into chunk N+1. When either chunk is retrieved, the context is incomplete. A 50-word overlap means each chunk shares its tail with the next chunk's head, preserving continuity.

---

## What's Next

- **Sentence-aware chunking** — replace word-count splitting with boundary-aware splitting using `spacy` or `nltk` so chunks never cut mid-sentence
- **Re-ranking** — add a cross-encoder re-ranker pass over the top-K results before sending to the LLM, improving answer quality
- **Query observability** — log every question, which chunks were retrieved, and retrieval scores so you can evaluate whether the RAG is performing well
- **Pagination on `/items`** — the current implementation scrolls all Qdrant records into memory; add server-side pagination for larger knowledge bases
- **Deployment** — Qdrant Cloud + Railway/Render for the backend + Vercel for the frontend, making Cortex accessible from anywhere

---

## License

MIT
