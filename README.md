# Cortex — Your Personal Knowledge Base, Wired Directly Into Claude

> Imagine you're mid-conversation with Claude. You're researching a topic, asking questions, going deep. And Claude says: *"I don't have enough context on this."*
>
> But you do. You've saved a dozen articles on it. You've watched the YouTube lectures. You have PDFs, notes, highlights — weeks of accumulated understanding sitting in a tool Claude can't see.
>
> What if Claude could search your personal knowledge base the same way it uses any other tool? What if your second brain was a live service that Claude could query mid-conversation, on demand, without you copy-pasting anything?
>
> That's exactly what Cortex does.

---

## What Is Cortex?

Cortex is a **personal second brain built as an MCP service** — a local RAG (Retrieval-Augmented Generation) system that you can feed with articles, YouTube transcripts, PDFs, and notes, and then expose directly to Claude Desktop as a set of native tools.

The result: Claude can search your saved knowledge, save new things to it, and ground its answers in what *you* specifically have read and curated — not its general training data, not the internet, but your personal, private knowledge base.

It also ships with a full React web UI and a Chrome extension for building up that knowledge base in the first place. But the MCP integration is the core of what makes this different.

---

## The Problem

We are living through an information explosion. Every day, knowledge workers, researchers, and developers consume dozens of articles, videos, papers, and notes. The tools we use to save this content — bookmarks, highlights, read-later lists — are fundamentally keyword-based. They require you to remember *exactly* what you're looking for.

But that's not the hard part. The hard part is this:

**Your AI assistant has no idea any of it exists.**

Claude, ChatGPT, Gemini — all of them are powerful reasoners with enormous general knowledge. But they have no access to the articles you specifically curated, the lectures you took notes on, or the PDFs you marked up. Every conversation starts from zero. You are constantly re-explaining context that you've already read and processed. The AI is brilliant but blind to your personal knowledge.

**Existing solutions don't solve this:**
- Bookmarks and note apps (Notion, Obsidian) have no AI interface — they're search tools, not reasoning tools
- Services like Readwise surface highlights but don't let you *query* them
- RAG demos exist everywhere, but they're standalone apps — disconnected from the AI tools you actually use
- Nobody has made their second brain a *live service that their AI can call*

---

## The Solution

Cortex bridges the gap by implementing the **Model Context Protocol (MCP)** — an open standard that lets AI models call external tools and services natively. By running Cortex as an MCP server, Claude Desktop gains four new capabilities at the tool level:

- `search_cortex` — semantically search your knowledge base for anything relevant to what Claude is currently thinking about
- `save_to_cortex` — save a URL (article, YouTube video, PDF) to your knowledge base without leaving the conversation
- `save_note_to_cortex` — save a thought, insight, or note Claude helped you produce
- `list_cortex` — see everything currently in your knowledge base

Claude decides when to call these tools the same way it decides to run code or search the web. You don't have to trigger anything manually. You just ask a question, and if the answer lives in your Cortex, Claude finds it.

---

## MCP Integration — The Core Differentiator

Most second-brain tools are closed loops. You save things into them. You search things in them. The AI lives elsewhere. There is a wall between your curated knowledge and your AI assistant, and you are the one who has to manually carry information across that wall — by copy-pasting, summarising, or re-explaining.

Cortex tears down that wall.

### How It Works

The MCP server (`backend/mcp_server.py`) runs as a local `stdio`-based process. Claude Desktop spawns it on startup and maintains a live connection to it for the duration of the session. When Claude determines that a tool call would help it answer a question better, it calls the tool, receives the result, and uses it to inform its response — all within the same conversational turn.

```
You:    "Explain how attention in transformers works, based on what I've saved."

Claude: [internally calls search_cortex("attention mechanism transformers")]
        [receives 5 chunks from your saved articles and lecture transcripts]
        [generates answer grounded in your specific saved content]

Claude: "Based on the articles you've saved — particularly the Illustrated
         Transformer and the Andrej Karpathy lecture — attention works by..."
```

The answer isn't from Claude's training data. It's from your library. Claude is the reasoning engine; Cortex is the memory.

### Real Conversation Examples

**You've saved research papers on a topic and want to go deeper:**
```
You:   "What's the difference between RLHF and DPO? Use my saved notes."

Claude: [calls search_cortex("RLHF DPO comparison")]
        [retrieves chunks from your saved papers]
        "From the papers you saved: RLHF requires a separate reward model
         trained on human preference data, while DPO..."
```

**You encounter a new article mid-conversation and want to capture it:**
```
You:   "Save this for me: https://arxiv.org/abs/2310.06825"

Claude: [calls save_to_cortex("https://arxiv.org/abs/2310.06825")]
        "Saved 'Mistral 7B' — 18 chunks stored. It's in your Cortex now."
```

**You want to know what you already know:**
```
You:   "What do I have saved on vector databases?"

Claude: [calls search_cortex("vector databases")]
        "You have 3 items on this: a Qdrant architecture deep-dive,
         a comparison of Pinecone vs Weaviate vs pgvector, and your
         notes from a system design interview you did last month."
```

**You want Claude to help write a note and then save it:**
```
You:   "Summarise what we just discussed about chunking strategies
        and save it as a note."

Claude: [generates summary]
        [calls save_note_to_cortex("Chunking Strategies", "...summary...")]
        "Saved as a note — 3 chunks stored."
```

### Why MCP and Not a Custom Plugin or API Call?

MCP is an open protocol designed specifically for this: connecting AI models to external tools with a standardised interface. Building on MCP means:

- **No custom integration code in the model** — Claude natively understands how to call MCP tools, inspect results, and incorporate them into its reasoning
- **Tool calling is autonomous** — Claude decides when to call `search_cortex` based on the conversation, without you prompting it every time
- **Composable** — Cortex tools can be used alongside other MCP servers (filesystem, GitHub, web search) in the same session, and Claude can chain them

This is the difference between building a demo and building a service. Cortex is not a standalone app that you have to switch to. It's infrastructure that plugs into the AI tool you're already using.

### Setup

Add this block to your Claude Desktop config:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop. A tools icon will appear in the chat input. Cortex tools (`search_cortex`, `save_to_cortex`, `save_note_to_cortex`, `list_cortex`) will be listed there — and Claude will call them automatically when relevant.

> **Note:** The MCP server reads the same Qdrant collection as the web UI and backend. Anything you save via the web app or Chrome extension is immediately searchable through Claude, and vice versa. It's one knowledge base with multiple ingestion surfaces.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT SURFACES                                   │
│                                                                               │
│  ┌──────────────────────┐   ┌────────────────────┐   ┌─────────────────┐   │
│  │    Claude Desktop     │   │   React Frontend   │   │ Chrome Extension│   │
│  │                      │   │   (Vite, :5173)    │   │  (Manifest v3)  │   │
│  │  Calls MCP tools:    │   │                    │   │                 │   │
│  │  • search_cortex     │   │  • Save URLs/Notes │   │  • One-click    │   │
│  │  • save_to_cortex    │   │  • Upload PDFs     │   │    save current │   │
│  │  • save_note_to_     │   │  • Semantic search │   │    tab to brain │   │
│  │    cortex            │   │  • Ask (RAG/SSE)   │   │                 │   │
│  │  • list_cortex       │   │  • Library view    │   │                 │   │
│  └──────────┬───────────┘   └────────┬───────────┘   └────────┬────────┘   │
│             │ stdio (MCP)            │ HTTP / SSE             │ HTTP       │
└─────────────┼────────────────────────┼────────────────────────┼────────────┘
              │                        │                        │
    ┌─────────▼────────┐               │                        │
    │   mcp_server.py  │               │                        │
    │   (MCP handler)  │               │                        │
    │                  │               │                        │
    │  Imports ingest  ├───────────────▼────────────────────────▼────────────┐
    │  and search      │            FASTAPI BACKEND  (port 8000)              │
    │  directly        │                                                       │
    └──────────────────┘  ┌─────────────┐  ┌────────────┐  ┌──────────────┐ │
                          │  ingest.py  │  │  search.py │  │    rag.py    │ │
                          │             │  │            │  │              │ │
                          │ URL → fetch │  │ embed query│  │ top-5 chunks │ │
                          │ YouTube     │  │ cosine sim │  │ Groq stream  │ │
                          │ transcript  │  │ Qdrant     │  │ SSE events   │ │
                          │ PDF extract │  │ query      │  │              │ │
                          │ Note ingest │  └──────┬─────┘  └──────────────┘ │
                          │ Chunk+embed │         │                           │
                          │ Dedup check │         │                           │
                          └──────┬──────┘         │                           │
                                 │                │                           │
                          └──────┼────────────────┼───────────────────────────┘
                                 │                │
                     ┌───────────▼────────────────▼──────────────┐
                     │         QDRANT VECTOR DB  (port 6333)      │
                     │         Docker: cortex-qdrant              │
                     │                                            │
                     │  Collection : cortex                       │
                     │  Dimensions : 384                          │
                     │  Distance   : Cosine                       │
                     │  Embedder   : all-MiniLM-L6-v2 (local)    │
                     └────────────────────────────────────────────┘

                                          ┌────────────────────┐
                               LLM call   │    Groq Cloud       │
                              ───────────►│  llama-3.3-70b      │
                              (rag.py     │  (streaming, fast)  │
                               only)      └────────────────────┘
```

**One knowledge base, three entry points.** Whether you save content through the React UI, the Chrome extension, or by telling Claude to save it via MCP — it all lands in the same Qdrant collection. And it's all immediately searchable from any surface.

---

## How It Works — The Full Pipeline

### Step 1: Ingestion

When you submit a URL or file, Cortex detects the content type and fetches it accordingly.

**Articles** are fetched using `trafilatura` — a library purpose-built for extracting clean main text from web pages, stripping ads, navigation, sidebars, and boilerplate. It also extracts the page title from metadata.

**YouTube videos** are handled by extracting the video ID from the URL, fetching the full transcript via `youtube-transcript-api`, and fetching the title via YouTube's oEmbed endpoint. You can save a 3-hour lecture and query its content without ever watching it.

**PDFs** are supported both via URL (the backend fetches and parses it) and via direct file upload through the UI. Text extraction uses `pymupdf` (PyMuPDF / fitz), which handles multi-page documents reliably and reads embedded metadata for the title.

**Notes** are saved directly — no fetching. The title is slugified into a `note://` URI so it fits cleanly into the unified storage model.

**Duplicate detection** runs before any fetch. Qdrant is queried for an existing record with the same URL. If found, a `DuplicateError` is raised immediately — no wasted API calls, and the user gets specific feedback ("Already in your brain: *[title]*").

### Step 2: Chunking

Raw text is split into overlapping 500-word chunks with a 50-word overlap between adjacent chunks. Overlap ensures ideas that span a chunk boundary aren't severed — the tail of one chunk bleeds into the head of the next.

Each chunk is prefixed with its source metadata before embedding:

```
Source: How Transformers Work
Type: article
Date: 2024-11-12T10:32:00

The attention mechanism allows the model to weigh...
```

This prefix means the embedding captures context about *what kind of thing this is and where it came from* — which improves retrieval quality across diverse content types.

### Step 3: Embedding

Chunks are encoded with `sentence-transformers` using `all-MiniLM-L6-v2`. This model produces 384-dimensional dense vectors and runs entirely locally — no API call, no cost, no data leaving your machine for the embedding step.

Each chunk gets a Qdrant point ID derived from an MD5 hash of the source URL plus its chunk index, making upserts deterministic and collision-resistant. The stored payload alongside each vector includes the title, URL, source type, date saved, chunk index, and original chunk text.

### Step 4: Semantic Search

At query time, the search string is embedded using the same model. Qdrant performs a cosine similarity search across all stored vectors and returns the top-K most semantically related chunks.

Cosine similarity measures the angle between vectors — two chunks can match even if they share no words, as long as they represent related ideas. This is what makes the difference between finding something and not finding it when you can't remember the exact phrasing.

### Step 5: RAG — Asking Cortex

When you ask a question (via the web UI, or when Claude calls the search tool):

1. The question is semantically searched → top 5 chunks retrieved
2. **In the web UI:** sources are emitted immediately as SSE events so the UI renders source chips before the answer starts
3. The top chunks are assembled into a numbered context block
4. Context + question go to Groq's `llama-3.3-70b-versatile` via LangChain
5. The model streams its response token by token
6. The system prompt instructs the model to answer *only* from the provided context and cite sources as `[1]`, `[2]`, etc. — grounding the answer and preventing hallucination

```
Question: "What did I save about attention mechanisms?"

→ search_cortex retrieves 5 chunks from your saved articles/lectures
→ Groq receives: [system prompt] + [numbered context] + [question]
→ Streams: "Attention mechanisms [1] work by computing a weighted sum..."
→ Web UI renders word by word; Claude Desktop gets the full response
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **AI tool protocol** | MCP (`mcp` SDK) | Open standard for exposing services as AI-callable tools — Claude Desktop calls Cortex natively |
| Backend framework | FastAPI | Async-native, automatic OpenAPI docs, first-class `StreamingResponse` for SSE |
| Vector database | Qdrant | Self-hostable, fast cosine search, rich payload filtering, Docker-ready, no API key |
| Embedding model | `all-MiniLM-L6-v2` | 384 dims, runs fully locally on CPU, strong semantic similarity at minimal memory cost |
| LLM inference | Groq + `llama-3.3-70b` | 500–800 tok/s inference — makes streaming feel instant; generous free tier |
| LLM orchestration | LangChain | Clean streaming chain with `StrOutputParser`; swappable LLM backend |
| Article extraction | trafilatura | Purpose-built for clean web text; handles boilerplate removal better than BeautifulSoup |
| PDF parsing | PyMuPDF (fitz) | Fast multi-page text + metadata extraction; handles complex PDF layouts |
| YouTube | youtube-transcript-api | Fetches transcripts without YouTube Data API quota |
| HTTP client | httpx | Used for PDF URL fetching, YouTube oEmbed, and browser-header fallback fetching |
| Frontend | React + Vite | Minimal, fast dev experience; no unnecessary abstraction |
| Browser extension | Chrome Manifest v3 | One-click save from any browser tab |

---

## Project Structure

```
cortex/
├── backend/
│   ├── main.py           # FastAPI app — all route definitions
│   ├── ingest.py         # Content fetching, chunking, embedding, dedup, storage
│   ├── search.py         # Semantic search against Qdrant
│   ├── rag.py            # RAG pipeline — context assembly + Groq SSE streaming
│   ├── mcp_server.py     # MCP server — exposes Cortex as Claude Desktop tools
│   ├── requirements.txt  # Python dependencies
│   ├── .env              # Secrets — gitignored
│   └── .env.example      # Template for required environment variables
│
├── cortex-ui/
│   ├── src/
│   │   ├── App.jsx       # Main UI — save, search, ask, library
│   │   ├── api.js        # Fetch wrappers for all backend endpoints
│   │   ├── App.css       # Dark-themed component styles
│   │   └── main.jsx      # React entry point
│   ├── index.html
│   └── vite.config.js
│
├── cortex-extension/
│   ├── manifest.json     # Chrome Manifest v3
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # One-click save — posts active tab URL to /ingest
│   └── icons/
│
└── .gitignore
```

---

## API Reference

All endpoints served at `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.

### `GET /health`
```json
{ "status": "ok" }
```

### `POST /ingest`
Save a URL (article, YouTube, or PDF link).

**Request:** `{ "url": "https://..." }`

**Response:**
```json
{
  "title": "How Transformers Work",
  "url": "https://...",
  "source_type": "article",
  "chunks_stored": 14,
  "date_saved": "2024-11-12T10:32:00"
}
```
`409` if already saved (body: `{ "already_saved": true, "title": "..." }`).

### `POST /ingest/note`
**Request:** `{ "title": "...", "text": "..." }` — same response shape.

### `POST /ingest/file`
`multipart/form-data` with a `file` field. PDF only. Same response shape, `source_type: "pdf"`.

### `GET /search?q={query}`
```json
{
  "query": "attention mechanisms",
  "results": [
    {
      "score": 0.8741,
      "title": "How Transformers Work",
      "url": "https://...",
      "source_type": "article",
      "date_saved": "2024-11-12T10:32:00",
      "chunk_index": 3,
      "text": "The attention mechanism allows..."
    }
  ]
}
```

### `POST /ask` — Server-Sent Events stream
**Request:** `{ "question": "..." }`

```
data: {"type": "source", "title": "...", "url": "...", "source_type": "...", "score": 0.87}
data: {"type": "chunk", "content": "Based on your saved content, "}
data: {"type": "chunk", "content": "attention works by..."}
data: {"type": "done"}
```

Sources are emitted before the answer starts streaming so the UI can render them immediately.

### `GET /items`
All saved items, deduplicated, newest first.

### `DELETE /items/{url}`
Removes all vector chunks for the given URL.

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

# Subsequent starts
docker start cortex-qdrant

# Verify
curl http://localhost:6333/healthz   # → healthz check passed
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Add your Groq API key — free at https://console.groq.com
```

```
GROQ_API_KEY=your_key_here
QDRANT_URL=http://localhost:6333
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

> `sentence-transformers` downloads `all-MiniLM-L6-v2` (~90MB) on first run. Cached after that.

### 4. Start the backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 5. Start the frontend

```bash
cd cortex-ui && npm install && npm run dev
```

Open `http://localhost:5173`.

### 6. Connect to Claude Desktop (MCP)

Add to your Claude Desktop config:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

Restart Claude Desktop. Claude will now have access to `search_cortex`, `save_to_cortex`, `save_note_to_cortex`, and `list_cortex` as native tools in every conversation.

### 7. Install the Chrome extension (optional)

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `cortex-extension/`
3. Brain icon appears in toolbar — click to save any page

---

## Design Decisions & Tradeoffs

**Why MCP over a custom Claude plugin or a plain REST API the user manually calls?**
MCP is an open standard with native Claude Desktop support. Claude decides when to call a tool based on conversational context — the user doesn't have to prompt it every time. A plain REST API would require you to manually copy-paste content into Claude. An MCP service means Claude reaches for your knowledge base the same way it reaches for any other capability.

**Why Qdrant over Pinecone or pgvector?**
Qdrant runs locally via Docker with no API key, no usage limits, and a clean Python client. For a personal knowledge tool where the entire point is local ownership of data, self-hosted is the right default. Pinecone is excellent for production multi-tenant deployments — not for this.

**Why `all-MiniLM-L6-v2` over OpenAI embeddings?**
It produces 384-dimensional vectors vs 1536 for `text-embedding-3-small`, runs in milliseconds on CPU, and achieves competitive semantic similarity performance for general English. For a personal knowledge base with thousands (not billions) of chunks, it's the correct tradeoff between speed, memory footprint, cost, and quality.

**Why Groq for LLM inference?**
Groq's LPU hardware delivers 500–800 tokens/second on `llama-3.3-70b` — making streaming responses feel near-instant. It has a generous free tier and `llama-3.3-70b-versatile` follows the "answer only from context" system prompt reliably, which is critical for a grounded RAG system.

**Why SSE instead of WebSockets for streaming?**
The ask flow is one-directional: server pushes tokens to client. SSE is simpler than WebSockets for this — no handshake upgrade, native browser support, straightforward with FastAPI's `StreamingResponse`. The `X-Accel-Buffering: no` header prevents Nginx proxy buffering so chunks arrive immediately.

**Why chunk overlap?**
An idea that straddles a 500-word boundary gets split across chunk N and chunk N+1. Retrieving either chunk alone gives incomplete context. A 50-word overlap ensures each chunk's tail appears in the next chunk's head — ideas at boundaries survive retrieval.

---

## What's Next

- **Sentence-aware chunking** — replace word-count splitting with boundary-aware splitting (`spacy`/`nltk`) so chunks never cut mid-sentence
- **Cross-encoder re-ranking** — pass the top-K semantic results through a cross-encoder before the LLM call to improve answer quality
- **Query observability** — log every question, which chunks were retrieved, and their scores so retrieval quality can be evaluated and tuned
- **Full deployment** — Qdrant Cloud + Railway/Render backend + Vercel frontend, with the MCP server pointed at the remote Qdrant instance

---

## License

MIT
