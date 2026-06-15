import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ingestUrl, ingestNote, ingestFile, searchCortex, fetchItems, deleteItem, askCortex } from './api'
import Logo from './Logo'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).origin}&sz=32` }
  catch { return null }
}

const SOURCE_LABELS = { youtube: 'YouTube', article: 'Article', pdf: 'PDF', note: 'Note' }
const SOURCE_CLASS  = { youtube: 'badge-red', article: 'badge-purple', pdf: 'badge-yellow', note: 'badge-green' }

function Badge({ type }) {
  return <span className={`badge ${SOURCE_CLASS[type] ?? 'badge-purple'}`}>{SOURCE_LABELS[type] ?? type}</span>
}

function Spinner() { return <span className="spinner" /> }

// ── Toast ──────────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([])
  const id = useRef(0)
  const add = useCallback((message, type = 'success') => {
    const tid = ++id.current
    setToasts(p => [...p, { id: tid, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== tid)), 3600)
  }, [])
  return { toasts, add }
}

function Toasts({ toasts }) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' }
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.type}`}
            initial={{ opacity: 0, x: 40, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ duration: 0.22 }}
          >
            <span className="toast-icon">{icons[t.type]}</span>
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Save Panel ─────────────────────────────────────────────────────────────────

function SavePanel({ addToast, refreshItems }) {
  const [tab, setTab]           = useState('url')
  const [url, setUrl]           = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading]   = useState(false)
  const [pdfFile, setPdfFile]   = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  async function handleUrl(e) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    try {
      const r = await ingestUrl(url.trim())
      addToast(`Saved "${r.title}" — ${r.chunks_stored} chunks`, 'success')
      setUrl('')
      refreshItems()
    } catch (err) {
      err.duplicate ? addToast(`Already saved: "${err.title}"`, 'info') : addToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) return addToast('Only PDFs supported', 'error')
    setLoading(true); setPdfFile(file)
    try {
      const r = await ingestFile(file)
      addToast(`Saved "${r.title}" — ${r.chunks_stored} chunks`, 'success')
      refreshItems()
    } catch (err) {
      err.duplicate ? addToast(`Already saved: "${err.title}"`, 'info') : addToast(err.message, 'error')
    } finally {
      setLoading(false); setPdfFile(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleNote(e) {
    e.preventDefault()
    if (!noteTitle.trim() || !noteText.trim()) return
    setLoading(true)
    try {
      const r = await ingestNote(noteTitle.trim(), noteText.trim())
      addToast(`Saved note "${r.title}"`, 'success')
      setNoteTitle(''); setNoteText('')
      refreshItems()
    } catch (err) {
      err.duplicate ? addToast(`Already saved: "${err.title}"`, 'info') : addToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Save to Cortex</h2>
        <p className="panel-desc">Feed your second brain — articles, videos, PDFs, or raw thoughts</p>
      </div>

      <div className="seg-tabs">
        {[['url', 'URL / PDF'], ['note', 'Note']].map(([id, label]) => (
          <button key={id} className={`seg-tab ${tab === id ? 'seg-tab--active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'url' ? (
          <motion.div key="url" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <form className="input-row" onSubmit={handleUrl}>
              <input className="field" type="url" placeholder="Paste article, YouTube, or PDF URL…" value={url} onChange={e => setUrl(e.target.value)} disabled={loading} required />
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading && !pdfFile ? <><Spinner /> Saving…</> : 'Save'}
              </button>
            </form>

            <div
              className={`drop-zone ${dragOver ? 'drop-zone--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => !loading && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf" hidden onChange={e => handleFile(e.target.files[0])} />
              {loading && pdfFile
                ? <><Spinner /><span>Saving {pdfFile.name}…</span></>
                : <><span className="drop-icon">📄</span><span>Drop a PDF or click to upload</span></>
              }
            </div>
          </motion.div>
        ) : (
          <motion.div key="note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <form className="note-form" onSubmit={handleNote}>
              <input className="field" type="text" placeholder="Title" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} disabled={loading} required />
              <textarea className="field textarea" placeholder="Write your note, paste markdown, jot down an idea…" value={noteText} onChange={e => setNoteText(e.target.value)} disabled={loading} rows={7} required />
              <button className="btn-primary" type="submit" disabled={loading || !noteTitle.trim() || !noteText.trim()}>
                {loading ? <><Spinner /> Saving…</> : 'Save Note'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Search Panel ───────────────────────────────────────────────────────────────

function SearchPanel({ addToast }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState(null)
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (!val.trim()) { setResults(null); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const d = await searchCortex(val.trim())
        setResults(d.results)
      } catch (err) { addToast(err.message, 'error') }
      finally { setSearching(false) }
    }, 380)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Search your brain</h2>
        <p className="panel-desc">Semantic search — finds ideas, not just keywords</p>
      </div>

      <div className="search-wrap">
        <span className="search-icon">◎</span>
        <input className="field search-field" type="text" placeholder="What do you want to recall?" value={query} onChange={handleChange} />
        {searching && <span className="search-spinner"><Spinner /></span>}
      </div>

      <AnimatePresence mode="wait">
        {results !== null && (
          <motion.div key={query} className="results-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {results.length === 0 ? (
              <p className="empty">No results for "{query}"</p>
            ) : results.map((r, i) => (
              <motion.div
                key={i}
                className="result-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                whileHover={{ y: -2 }}
              >
                <div className="result-top">
                  <a className="result-title" href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                  <Badge type={r.source_type} />
                </div>
                <div className="result-meta">
                  <span className="muted-sm">{formatDate(r.date_saved)}</span>
                  <span className="score-pill">{Math.round(r.score * 100)}% match</span>
                </div>
                <p className="result-excerpt">{r.text.slice(0, 300)}{r.text.length > 300 ? '…' : ''}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Ask Panel ──────────────────────────────────────────────────────────────────

function AskPanel({ addToast }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer]     = useState('')
  const [sources, setSources]   = useState([])
  const [asking, setAsking]     = useState(false)
  const answerRef = useRef(null)

  async function handleAsk(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setAsking(true); setAnswer(''); setSources([])
    try {
      await askCortex(q, ev => {
        if (ev.type === 'source') setSources(p => [...p, ev])
        else if (ev.type === 'chunk') {
          setAnswer(p => p + ev.content)
          answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        else if (ev.type === 'error') { addToast(ev.message, 'error'); setAsking(false) }
        else if (ev.type === 'done') setAsking(false)
      })
    } catch (err) { addToast(err.message, 'error'); setAsking(false) }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Ask Cortex</h2>
        <p className="panel-desc">Answers grounded in your saved content — with citations</p>
      </div>

      <form className="input-row" onSubmit={handleAsk}>
        <input
          className="field"
          type="text"
          placeholder="Ask anything about your saved content…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={asking}
        />
        <button className="btn-primary" type="submit" disabled={asking || !question.trim()}>
          {asking ? <><Spinner /> Thinking…</> : 'Ask'}
        </button>
      </form>

      <AnimatePresence>
        {(answer || sources.length > 0 || asking) && (
          <motion.div
            className="ask-box"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {sources.length > 0 && (
              <div className="sources-bar">
                <span className="sources-label">Sources</span>
                {sources.map((s, i) => (
                  <a key={i} className="source-chip" href={s.url} target="_blank" rel="noreferrer" title={s.title}>
                    <Badge type={s.source_type} />
                    <span className="chip-title">{s.title}</span>
                  </a>
                ))}
              </div>
            )}

            {asking && !answer && (
              <div className="thinking-row">
                {[0, 1, 2].map(i => (
                  <span key={i} className="dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
                <span className="muted-sm">Reading your brain…</span>
              </div>
            )}

            {answer && (
              <div className="ask-answer" ref={answerRef}>
                {answer}
                {asking && <span className="cursor-blink">▋</span>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Library Panel ──────────────────────────────────────────────────────────────

function LibraryPanel({ items, loading, onDelete, addToast }) {
  const [deletingUrl, setDeletingUrl] = useState(null)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? items : items.filter(i => i.source_type === filter)
  const counts = ['all', 'article', 'youtube', 'pdf', 'note'].reduce((acc, f) => {
    acc[f] = f === 'all' ? items.length : items.filter(i => i.source_type === f).length
    return acc
  }, {})

  async function handleDelete(url) {
    setDeletingUrl(url)
    try { await onDelete(url); addToast('Removed', 'success') }
    catch (err) { addToast(err.message, 'error') }
    finally { setDeletingUrl(null) }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">
          Library <span className="count-chip">{items.length}</span>
        </h2>
        <p className="panel-desc">Everything saved to your second brain</p>
      </div>

      <div className="filter-tabs">
        {['all', 'article', 'youtube', 'pdf', 'note'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'filter-tab--active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {counts[f] > 0 && <span className="filter-count">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><Spinner /><span className="muted-sm">Loading your brain…</span></div>
      ) : filtered.length === 0 ? (
        <p className="empty">{filter === 'all' ? 'Nothing saved yet — start by pasting a URL.' : `No ${filter} items saved yet.`}</p>
      ) : (
        <motion.ul className="lib-grid" layout>
          <AnimatePresence>
            {filtered.map(item => (
              <motion.li
                key={item.url}
                className="lib-card"
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.14 } }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="lib-card-top">
                  <div className="lib-favicon">
                    <img src={getFavicon(item.url)} alt="" width={13} height={13} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <Badge type={item.source_type} />
                  <button
                    className="del-btn"
                    onClick={() => handleDelete(item.url)}
                    disabled={deletingUrl === item.url}
                    title="Remove"
                  >
                    {deletingUrl === item.url ? <Spinner /> : '✕'}
                  </button>
                </div>
                <a className="lib-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                <span className="muted-sm">{formatDate(item.date_saved)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  )
}

// ── Nav ────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'save',    label: 'Save',    icon: '⊕' },
  { id: 'search',  label: 'Search',  icon: '◎' },
  { id: 'ask',     label: 'Ask',     icon: '✦' },
  { id: 'library', label: 'Library', icon: '▤' },
]

const PANEL_TRANSITION = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('save')
  const { toasts, add: addToast } = useToasts()
  const [items, setItems]         = useState([])
  const [loadingItems, setLoadingItems] = useState(true)

  const loadItems = useCallback(async () => {
    try { setItems(await fetchItems()) }
    catch { /* silent */ }
    finally { setLoadingItems(false) }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleDelete(url) {
    await deleteItem(url)
    setItems(p => p.filter(i => i.url !== url))
  }

  return (
    <div className="dashboard">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo size={26} />
          <span className="sidebar-logo-text">Cortex</span>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? 'sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sidebar-tab-icon">{tab.icon}</span>
              <span className="sidebar-tab-label">{tab.label}</span>
              {tab.id === 'library' && items.length > 0 && (
                <span className="sidebar-count">{items.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={onLogout} title="Log out">
            <span>⏻</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={PANEL_TRANSITION}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            {activeTab === 'save'    && <SavePanel    addToast={addToast} refreshItems={loadItems} />}
            {activeTab === 'search'  && <SearchPanel  addToast={addToast} />}
            {activeTab === 'ask'     && <AskPanel     addToast={addToast} />}
            {activeTab === 'library' && <LibraryPanel items={items} loading={loadingItems} onDelete={handleDelete} addToast={addToast} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Toasts toasts={toasts} />
    </div>
  )
}
