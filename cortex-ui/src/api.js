const BASE = 'http://localhost:8000'

function getToken() {
  return localStorage.getItem('cortex_token') ?? ''
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${getToken()}`, ...extra }
}

function handleUnauth(res) {
  if (res.status === 401) {
    localStorage.removeItem('cortex_token')
    window.location.reload()
  }
}

export async function loginUser(password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Wrong password')
  }
  return res.json()
}

async function _handleIngestResponse(res) {
  handleUnauth(res)
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}))
    const err = new Error('duplicate')
    err.duplicate = true
    err.title = body.detail?.title || 'this item'
    throw err
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Ingest failed')
  }
  return res.json()
}

export async function ingestUrl(url) {
  const res = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url }),
  })
  return _handleIngestResponse(res)
}

export async function ingestNote(title, text) {
  const res = await fetch(`${BASE}/ingest/note`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, text }),
  })
  return _handleIngestResponse(res)
}

export async function ingestFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/ingest/file`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  return _handleIngestResponse(res)
}

export async function searchCortex(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  })
  handleUnauth(res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Search failed' }))
    throw new Error(body.detail || 'Search failed')
  }
  return res.json()
}

export async function fetchItems() {
  const res = await fetch(`${BASE}/items`, { headers: authHeaders() })
  handleUnauth(res)
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json()
}

export async function deleteItem(url) {
  const res = await fetch(`${BASE}/items/${encodeURIComponent(url)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  handleUnauth(res)
  if (!res.ok) throw new Error('Failed to delete item')
  return res.json()
}

export async function askCortex(question, onEvent) {
  const res = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  })
  handleUnauth(res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Ask failed' }))
    throw new Error(body.detail || 'Ask failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { onEvent(JSON.parse(line.slice(6))) } catch { }
      }
    }
  }
}
