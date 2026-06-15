const API = 'http://localhost:8000'

// ── DOM refs ──────────────────────────────────────────────────────────────────

const loginForm   = document.getElementById('login-form')
const loginPass   = document.getElementById('login-password')
const loginBtn    = document.getElementById('login-btn')
const loginErr    = document.getElementById('login-error')
const saveBtn     = document.getElementById('save-btn')
const pageTitle   = document.getElementById('page-title')
const pageUrl     = document.getElementById('page-url')
const recentList  = document.getElementById('recent-list')
const footerCount = document.getElementById('footer-count')
const logoutBtn   = document.getElementById('logout-btn')
const openAppBtn  = document.getElementById('open-app-btn')

let currentUrl = null
let token      = null

// ── View switching ────────────────────────────────────────────────────────────

function showView(name) {
  ['view-loading', 'view-login', 'view-main'].forEach(id => {
    document.getElementById(id).classList.remove('active')
  })
  document.getElementById('view-' + name).classList.add('active')
}

// ── Storage (guarded against missing chrome API) ──────────────────────────────

async function storageGet(key) {
  try {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  } catch { return null }
}

function storageSet(key, value) {
  try { chrome.storage.local.set({ [key]: value }) } catch { /* ignore */ }
}

function storageRemove(key) {
  try { chrome.storage.local.remove(key) } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra }
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : str
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const BADGE_LABELS = { youtube: 'YouTube', article: 'Article', pdf: 'PDF', note: 'Note' }
const BADGE_CLASS  = { youtube: 'badge-youtube', article: 'badge-article', pdf: 'badge-pdf', note: 'badge-note' }

function isTokenValid(t) {
  if (!t) return false
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    return Date.now() / 1000 < payload.exp
  } catch { return false }
}

// ── Render helpers (DOM-only — no innerHTML with event handlers) ───────────────

function renderRecent(items) {
  recentList.innerHTML = ''
  const recent = items.slice(0, 5)

  if (recent.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-recent'
    empty.textContent = 'Nothing saved yet.'
    recentList.appendChild(empty)
    return
  }

  recent.forEach(item => {
    const a = document.createElement('a')
    a.className = 'recent-item'
    a.href = item.url
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.title = item.title

    // Favicon
    const fav = faviconUrl(item.url)
    if (fav) {
      const img = document.createElement('img')
      img.width  = 13
      img.height = 13
      img.style.cssText = 'flex-shrink:0;border-radius:3px;opacity:0.7;display:none'
      img.addEventListener('load',  () => { img.style.display = '' })
      img.addEventListener('error', () => { img.style.display = 'none' })
      img.src = fav
      a.appendChild(img)
    }

    // Badge
    const badge = document.createElement('span')
    badge.className = `badge ${BADGE_CLASS[item.source_type] ?? 'badge-article'}`
    badge.textContent = BADGE_LABELS[item.source_type] ?? item.source_type
    a.appendChild(badge)

    // Title
    const titleEl = document.createElement('span')
    titleEl.className = 'recent-title'
    titleEl.textContent = truncate(item.title, 42)
    a.appendChild(titleEl)

    // Date
    const dateEl = document.createElement('span')
    dateEl.className = 'recent-date'
    dateEl.textContent = formatDate(item.date_saved)
    a.appendChild(dateEl)

    recentList.appendChild(a)
  })
}

function renderFooter(total) {
  footerCount.innerHTML = ''
  const count = document.createElement('span')
  count.textContent = String(total)
  footerCount.appendChild(count)
  footerCount.appendChild(
    document.createTextNode(` item${total !== 1 ? 's' : ''} in your brain`)
  )
}

function setSaveState(state, text) {
  saveBtn.className = `save-btn${state ? ' ' + state : ''}`
  saveBtn.disabled  = state !== ''
  saveBtn.textContent = text
  if (state === '') saveBtn.disabled = false
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function doLogin(password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Wrong password')
  }
  const data = await res.json()
  return data.token
}

async function fetchItems() {
  try {
    const res = await fetch(`${API}/items`, { headers: authHeaders() })
    if (res.status === 401) { handleUnauth(); return [] }
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

function handleUnauth() {
  storageRemove('cortex_token')
  token = null
  logoutBtn.style.display = 'none'
  showView('login')
  loginPass.focus()
}

// ── Main view ─────────────────────────────────────────────────────────────────

async function initMain() {
  logoutBtn.style.display = 'flex'
  showView('main')

  // Current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentUrl = tab?.url ?? null

  const unsaveable = !currentUrl
    || currentUrl.startsWith('chrome://')
    || currentUrl.startsWith('chrome-extension://')
    || currentUrl.startsWith('about:')
    || currentUrl.startsWith('edge://')

  if (unsaveable) {
    pageTitle.textContent = 'Cannot save this page'
    pageTitle.classList.add('muted')
    pageUrl.textContent = ''
    setSaveState('unsaveable', 'Cannot save this page')
    saveBtn.disabled = true
  } else {
    pageTitle.textContent = truncate(tab.title || currentUrl, 55)
    pageUrl.textContent   = currentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

    setSaveState('', 'Save to Cortex')
    saveBtn.disabled = false
  }

  // Fetch items
  const items = await fetchItems()
  renderRecent(items)
  renderFooter(items.length)

  // Check if already saved
  if (!unsaveable && items.some(i => i.url === currentUrl)) {
    setSaveState('duplicate', '✓ Already in your brain')
    saveBtn.disabled = true
  }

  // Save handler
  saveBtn.addEventListener('click', async () => {
    if (!currentUrl || saveBtn.disabled) return

    saveBtn.disabled = true
    const spinner = document.createElement('span')
    spinner.className = 'spinner'
    saveBtn.textContent = ''
    saveBtn.appendChild(spinner)
    saveBtn.appendChild(document.createTextNode(' Saving…'))

    try {
      const res = await fetch(`${API}/ingest`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: currentUrl }),
      })

      if (res.status === 401) { handleUnauth(); return }

      if (res.status === 409) {
        setSaveState('duplicate', '✓ Already in your brain')
        saveBtn.disabled = true
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = typeof body.detail === 'string' ? body.detail : 'Failed to save'
        setSaveState('error', '✕ ' + truncate(msg, 30))
        setTimeout(() => { setSaveState('', 'Save to Cortex'); saveBtn.disabled = false }, 3000)
        return
      }

      const data = await res.json()
      setSaveState('saved', `✓ Saved — ${data.chunks_stored} chunks`)
      saveBtn.disabled = true

      const updated = await fetchItems()
      renderRecent(updated)
      renderFooter(updated.length)

    } catch (err) {
      const msg = err.message?.includes('fetch') || err.message?.includes('Failed')
        ? 'Backend offline'
        : truncate(err.message, 30)
      setSaveState('error', '✕ ' + msg)
      setTimeout(() => { setSaveState('', 'Save to Cortex'); saveBtn.disabled = false }, 3000)
    }
  })
}

// ── Login ─────────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const password = loginPass.value.trim()
  if (!password) return

  loginBtn.disabled = true
  loginErr.textContent = ''

  const spinner = document.createElement('span')
  spinner.className = 'spinner'
  loginBtn.textContent = ''
  loginBtn.appendChild(spinner)
  loginBtn.appendChild(document.createTextNode(' Signing in…'))

  try {
    const t = await doLogin(password)
    token = t
    storageSet('cortex_token', t)
    loginPass.value = ''
    await initMain()
  } catch (err) {
    loginErr.textContent = err.message || 'Wrong password'
    loginPass.value = ''
    loginPass.focus()
    loginBtn.textContent = 'Enter Cortex'
  } finally {
    loginBtn.disabled = false
  }
})

// ── Logout ────────────────────────────────────────────────────────────────────

logoutBtn.addEventListener('click', () => {
  storageRemove('cortex_token')
  token = null
  logoutBtn.style.display = 'none'
  showView('login')
  loginPass.focus()
})

// ── Open app ──────────────────────────────────────────────────────────────────

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' })
})

// ── Boot ──────────────────────────────────────────────────────────────────────

;(async () => {
  showView('loading')
  token = await storageGet('cortex_token')

  if (isTokenValid(token)) {
    await initMain()
  } else {
    showView('login')
    loginPass.focus()
  }
})()
