const BASE = 'http://localhost:8000'

// Throws { duplicate: true, title } for 409, Error for other failures
async function _handleIngestResponse(res) {
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}))
    const err = new Error('duplicate')
    err.duplicate = true
    err.title = body.detail?.title || 'this item'
    throw err
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Ingest failed')
  }
  return res.json()
}

export async function ingestUrl(url) {
  const res = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return _handleIngestResponse(res)
}

export async function ingestNote(title, text) {
  const res = await fetch(`${BASE}/ingest/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  })
  return _handleIngestResponse(res)
}

export async function ingestFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/ingest/file`, { method: 'POST', body: form })
  return _handleIngestResponse(res)
}

export async function searchCortex(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || 'Search failed')
  }
  return res.json()
}

export async function fetchItems() {
  const res = await fetch(`${BASE}/items`)
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json()
}

export async function deleteItem(url) {
  const res = await fetch(`${BASE}/items/${encodeURIComponent(url)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete item')
  return res.json()
}

/**
 * Streams an SSE response from /ask.
 * Calls onEvent({ type, ...payload }) for each SSE message.
 * type is one of: "source" | "chunk" | "done"
 */
export async function askCortex(question, onEvent) {
  const res = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || 'Ask failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete last line
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          onEvent(JSON.parse(line.slice(6)))
        } catch { /* skip malformed */ }
      }
    }
  }
}
