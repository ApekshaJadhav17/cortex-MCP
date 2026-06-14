const API = 'http://localhost:8000'

const btn = document.getElementById('save-btn')
const urlDisplay = document.getElementById('url-display')
const statusEl = document.getElementById('status')

let currentUrl = null

// ── Init: get current tab URL ─────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  currentUrl = tab?.url ?? null
  const unsaveable = !currentUrl ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://') ||
    currentUrl.startsWith('about:')

  if (unsaveable) {
    urlDisplay.textContent = 'Cannot save this page'
    urlDisplay.classList.add('muted')
    setStatus('Open a regular web page to save it.', '')
    return
  }

  urlDisplay.textContent = currentUrl
  urlDisplay.classList.remove('muted')
  btn.disabled = false
})

// ── Save ──────────────────────────────────────────────────────────────────────

btn.addEventListener('click', async () => {
  if (!currentUrl) return
  setLoading(true)

  try {
    const res = await fetch(`${API}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl }),
    })

    if (res.status === 409) {
      const body = await res.json()
      setDone('duplicate', `Already saved: "${body.detail?.title ?? 'this page'}"`)
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = typeof body.detail === 'string' ? body.detail : 'Ingest failed'
      setDone('error', msg)
      return
    }

    const data = await res.json()
    setDone('saved', `Saved "${truncate(data.title, 40)}" — ${data.chunks_stored} chunks`)
  } catch (err) {
    if (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
      setDone('error', 'Cannot reach Cortex — is the backend running?')
    } else {
      setDone('error', err.message)
    }
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function setLoading(on) {
  btn.disabled = on
  btn.className = ''
  btn.innerHTML = on
    ? '<span class="spinner"></span> Saving…'
    : 'Save to Cortex'
  if (on) setStatus('', '')
}

function setDone(state, message) {
  btn.disabled = false
  const labels = { saved: '✓ Saved', duplicate: 'Already saved', error: 'Failed' }
  btn.textContent = labels[state] ?? 'Save to Cortex'
  btn.className = state === 'saved' ? 'saved' : state === 'duplicate' ? 'duplicate' : 'error'
  const cls = state === 'saved' ? 'ok' : state === 'duplicate' ? 'info' : 'err'
  setStatus(message, cls)

  // Reset button after 3 s
  setTimeout(() => {
    btn.className = ''
    btn.textContent = 'Save to Cortex'
    btn.disabled = false
    setStatus('', '')
  }, 3000)
}

function setStatus(msg, cls) {
  statusEl.textContent = msg
  statusEl.className = `status${cls ? ' ' + cls : ''}`
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str
}
