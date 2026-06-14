import json
import os
from typing import Iterator

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from search import search as cortex_search

load_dotenv()

MODEL = "llama-3.3-70b-versatile"

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are Cortex, the user's personal second brain assistant. "
        "Answer the question using ONLY the context passages below, which come from "
        "articles and videos the user has saved. Cite sources inline as [1], [2], etc. "
        "If the context is insufficient, say so honestly rather than guessing."
    )),
    ("human", (
        "Context passages:\n\n{context}\n\n"
        "Question: {question}"
    )),
])


def _build_context(results: list[dict]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        header = f"[{i}] {r['title']} ({r['source_type'].upper()}, {r['date_saved'][:10]})"
        parts.append(f"{header}\n{r['text']}")
    return "\n\n---\n\n".join(parts)


def ask_stream(question: str) -> Iterator[str]:
    """
    Yields SSE-formatted strings:
      data: {"type": "source", ...}\n\n
      data: {"type": "chunk", "content": "..."}\n\n
      data: {"type": "done"}\n\n
    """
    results = cortex_search(question, top_k=5)

    if not results:
        yield _sse({"type": "chunk", "content": "I don't have anything saved about that yet. Try ingesting some relevant URLs first."})
        yield _sse({"type": "done"})
        return

    # Emit sources up front so the UI can render them immediately
    for r in results:
        yield _sse({
            "type": "source",
            "title": r["title"],
            "url": r["url"],
            "source_type": r["source_type"],
            "score": r["score"],
        })

    context = _build_context(results)
    llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=MODEL,
        streaming=True,
        temperature=0.3,
    )
    chain = _PROMPT | llm | StrOutputParser()

    try:
        for chunk in chain.stream({"context": context, "question": question}):
            yield _sse({"type": "chunk", "content": chunk})
    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})

    yield _sse({"type": "done"})


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"
