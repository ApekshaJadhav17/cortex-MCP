"""
Cortex MCP Server — exposes Cortex as an MCP tool provider.

Run standalone:  python /absolute/path/to/mcp_server.py
Or via Claude Desktop config (see README).
"""
import sys
import os

# Ensure imports resolve regardless of working directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env from the backend directory
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from ingest import ingest_url, ingest_note, list_items
from search import search as cortex_search

server = Server("cortex")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_cortex",
            description="Search your Cortex second brain for relevant information.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"}
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="save_to_cortex",
            description="Save a URL (article, YouTube video, or PDF) to your Cortex second brain.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to save"}
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="save_note_to_cortex",
            description="Save a plain-text note or thought to your Cortex second brain.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short title for the note"},
                    "text":  {"type": "string", "description": "The note content"},
                },
                "required": ["title", "text"],
            },
        ),
        Tool(
            name="list_cortex",
            description="List all items saved in your Cortex second brain.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_cortex":
        results = cortex_search(arguments.get("query", ""))
        if not results:
            return [TextContent(type="text", text="No results found.")]
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(
                f"[{i}] {r['title']} ({r['source_type'].upper()})\n"
                f"URL: {r['url']}\n"
                f"Score: {r['score']}\n"
                f"Saved: {r['date_saved'][:10]}\n"
                f"{r['text'][:400]}\n"
            )
        return [TextContent(type="text", text="\n---\n".join(lines))]

    elif name == "save_to_cortex":
        result = ingest_url(arguments.get("url", ""))
        return [TextContent(
            type="text",
            text=f"Saved '{result['title']}' — {result['chunks_stored']} chunks stored.",
        )]

    elif name == "save_note_to_cortex":
        result = ingest_note(arguments.get("title", ""), arguments.get("text", ""))
        return [TextContent(
            type="text",
            text=f"Note '{result['title']}' saved — {result['chunks_stored']} chunks stored.",
        )]

    elif name == "list_cortex":
        items = list_items()
        if not items:
            return [TextContent(type="text", text="No items saved yet.")]
        lines = [
            f"- {item['title']} ({item['source_type'].upper()}) — {item['date_saved'][:10]}\n  {item['url']}"
            for item in items
        ]
        return [TextContent(type="text", text="\n".join(lines))]

    return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
