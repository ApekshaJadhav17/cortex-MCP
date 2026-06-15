from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import require_auth, check_password, create_token
from ingest import ingest_url, ingest_pdf_bytes, ingest_note, delete_url, list_items, DuplicateError
from search import search as cortex_search
from rag import ask_stream

app = FastAPI(title="Cortex API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_auth = Depends(require_auth)


class IngestRequest(BaseModel):
    url: str


class AskRequest(BaseModel):
    question: str


class NoteRequest(BaseModel):
    title: str
    text: str


class LoginRequest(BaseModel):
    password: str


# ── Auth ───────────────────────────────────────────────────────────────────────

@app.post("/auth/login")
def login(req: LoginRequest):
    if not check_password(req.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": create_token()}


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Ingest ─────────────────────────────────────────────────────────────────────

@app.post("/ingest", dependencies=[_auth])
def ingest(req: IngestRequest):
    try:
        return ingest_url(req.url)
    except DuplicateError as e:
        raise HTTPException(status_code=409, detail={"already_saved": True, "title": e.title})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/note", dependencies=[_auth])
def ingest_note_endpoint(req: NoteRequest):
    try:
        return ingest_note(req.title.strip(), req.text.strip())
    except DuplicateError as e:
        raise HTTPException(status_code=409, detail={"already_saved": True, "title": e.title})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/file", dependencies=[_auth])
async def ingest_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are supported")
    try:
        data = await file.read()
        return ingest_pdf_bytes(data, file.filename)
    except DuplicateError as e:
        raise HTTPException(status_code=409, detail={"already_saved": True, "title": e.title})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Search ─────────────────────────────────────────────────────────────────────

@app.get("/search", dependencies=[_auth])
def search(q: str = Query(..., min_length=1)):
    try:
        return {"query": q, "results": cortex_search(q)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Items ──────────────────────────────────────────────────────────────────────

@app.get("/items", dependencies=[_auth])
def get_items():
    try:
        return list_items()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Ask ────────────────────────────────────────────────────────────────────────

@app.post("/ask", dependencies=[_auth])
def ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")
    return StreamingResponse(
        ask_stream(req.question),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


# ── Delete ─────────────────────────────────────────────────────────────────────

@app.delete("/items/{url:path}", dependencies=[_auth])
def remove_item(url: str):
    try:
        delete_url(url)
        return {"deleted": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
