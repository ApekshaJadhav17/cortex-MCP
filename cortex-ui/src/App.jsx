import { useState, useEffect, useCallback, useRef } from 'react'
import { ingestUrl, ingestNote, ingestFile, searchCortex, fetchItems, deleteItem, askCortex } from './api.js'
import './App.css'

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function Spinner() {
  return <span className="spinner" aria-label="Loading" />
}

const BADGE_LABEL = { youtube: 'YouTube', article: 'Article', pdf: 'PDF' }

function Badge({ type }) {
  return (
    <span className={`badge badge-${type}`}>
      {BADGE_LABEL[type] ?? type}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function getFavicon(url) {
  try {
    const { origin } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`
  } catch {
    return null
  }
}

export default function App() {
  const [saveTab, setSaveTab] = useState('url') // 'url' | 'note'
  const [ingestInput, setIngestInput] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const fileInputRef = useRef(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const searchDebounce = useRef(null)

  const [askInput, setAskInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [askAnswer, setAskAnswer] = useState('')
  const [askSources, setAskSources] = useState([])
  const answerRef = useRef(null)

  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [deletingUrl, setDeletingUrl] = useState(null)

  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchItems()
      setItems(data)
    } catch {
      // silently ignore on initial load
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleIngest(e) {
    e.preventDefault()
    const url = ingestInput.trim()
    if (!url) return
    setIngesting(true)
    try {
      const result = await ingestUrl(url)
      addToast(`Saved "${result.title}" — ${result.chunks_stored} chunks`, 'success')
      setIngestInput('')
      loadItems()
    } catch (err) {
      if (err.duplicate) {
        addToast(`Already in your brain: "${err.title}"`, 'info')
      } else {
        addToast(err.message, 'error')
      }
    } finally {
      setIngesting(false)
    }
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    setIngesting(true)
    try {
      const result = await ingestFile(file)
      addToast(`Saved "${result.title}" — ${result.chunks_stored} chunks`, 'success')
      setPdfFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadItems()
    } catch (err) {
      if (err.duplicate) {
        addToast(`Already in your brain: "${err.title}"`, 'info')
      } else {
        addToast(err.message, 'error')
      }
      setPdfFile(null)
    } finally {
      setIngesting(false)
    }
  }

  function handleSearchInput(e) {
    const val = e.target.value
    setSearchInput(val)
    clearTimeout(searchDebounce.current)
    if (!val.trim()) {
      setSearchResults(null)
      return
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchCortex(val.trim())
        setSearchResults(data.results)
      } catch (err) {
        addToast(err.message, 'error')
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  async function handleNote(e) {
    e.preventDefault()
    if (!noteTitle.trim() || !noteText.trim()) return
    setIngesting(true)
    try {
      const result = await ingestNote(noteTitle.trim(), noteText.trim())
      addToast(`Saved note "${result.title}" — ${result.chunks_stored} chunks`, 'success')
      setNoteTitle('')
      setNoteText('')
      loadItems()
    } catch (err) {
      if (err.duplicate) {
        addToast(`Already saved: "${err.title}"`, 'info')
      } else {
        addToast(err.message, 'error')
      }
    } finally {
      setIngesting(false)
    }
  }

  async function handleAsk(e) {
    e.preventDefault()
    const question = askInput.trim()
    if (!question) return
    setAsking(true)
    setAskAnswer('')
    setAskSources([])
    try {
      await askCortex(question, (event) => {
        if (event.type === 'source') {
          setAskSources(prev => [...prev, event])
        } else if (event.type === 'chunk') {
          setAskAnswer(prev => prev + event.content)
          answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        } else if (event.type === 'error') {
          addToast(event.message, 'error')
          setAsking(false)
        } else if (event.type === 'done') {
          setAsking(false)
        }
      })
    } catch (err) {
      addToast(err.message, 'error')
      setAsking(false)
    }
  }

  async function handleDelete(url) {
    setDeletingUrl(url)
    try {
      await deleteItem(url)
      setItems(prev => prev.filter(i => i.url !== url))
      addToast('Item removed', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setDeletingUrl(null)
    }
  }

  return (
    <div className="app">
      <Toast toasts={toasts} />

      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🧠</span>
            <span className="logo-text">Cortex</span>
          </div>
          <p className="tagline">The memory layer for your AI</p>
        </div>
      </header>

      <main className="main">
        {/* Save Section */}
        <section className="section">
          <h2 className="section-title">Save to Cortex</h2>

          <div className="save-tabs">
            <button
              className={`save-tab${saveTab === 'url' ? ' save-tab--active' : ''}`}
              onClick={() => setSaveTab('url')}
              type="button"
            >URL</button>
            <button
              className={`save-tab${saveTab === 'note' ? ' save-tab--active' : ''}`}
              onClick={() => setSaveTab('note')}
              type="button"
            >Note</button>
          </div>

          {saveTab === 'url' && (
            <>
              <form className="ingest-form" onSubmit={handleIngest}>
                <input
                  className="input"
                  type="url"
                  placeholder="Paste any article, YouTube, or PDF URL…"
                  value={ingestInput}
                  onChange={e => setIngestInput(e.target.value)}
                  disabled={ingesting}
                  required
                />
                <button className="btn btn-primary" type="submit" disabled={ingesting}>
                  {ingesting && !pdfFile ? <><Spinner /> Saving…</> : 'Save'}
                </button>
              </form>
              <div className="pdf-upload">
                <label className={`pdf-label${ingesting && pdfFile ? ' pdf-label--loading' : ''}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    disabled={ingesting}
                    hidden
                  />
                  {ingesting && pdfFile
                    ? <><Spinner /> Saving {pdfFile.name}…</>
                    : <><span className="pdf-icon">📄</span> Upload a PDF</>}
                </label>
              </div>
            </>
          )}

          {saveTab === 'note' && (
            <form className="note-form" onSubmit={handleNote}>
              <input
                className="input"
                type="text"
                placeholder="Title"
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                disabled={ingesting}
                required
              />
              <textarea
                className="input textarea"
                placeholder="Write your note, paste markdown, jot down an idea…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                disabled={ingesting}
                rows={6}
                required
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={ingesting || !noteTitle.trim() || !noteText.trim()}
              >
                {ingesting ? <><Spinner /> Saving…</> : 'Save Note'}
              </button>
            </form>
          )}
        </section>

        {/* Search Section */}
        <section className="section">
          <h2 className="section-title">Search your brain</h2>
          <div className="search-wrap">
            <input
              className="input"
              type="text"
              placeholder="What do you want to recall?"
              value={searchInput}
              onChange={handleSearchInput}
            />
            {searching && <span className="search-spinner"><Spinner /></span>}
          </div>

          {searchResults !== null && (
            <div className="results">
              {searchResults.length === 0 ? (
                <p className="empty-msg">No results found for "{searchInput}"</p>
              ) : (
                searchResults.map((r, i) => (
                  <div key={i} className="result-card">
                    <div className="result-header">
                      <span className="result-title">
                        <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                      </span>
                      <Badge type={r.source_type} />
                    </div>
                    <div className="result-meta">
                      <span className="muted">{formatDate(r.date_saved)}</span>
                      <span className="score muted">score: {r.score}</span>
                    </div>
                    <p className="result-text">{r.text.slice(0, 320)}{r.text.length > 320 ? '…' : ''}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Ask Section */}
        <section className="section">
          <h2 className="section-title">Ask Cortex</h2>
          <form className="ingest-form" onSubmit={handleAsk}>
            <input
              className="input"
              type="text"
              placeholder="Ask anything about your saved content…"
              value={askInput}
              onChange={e => setAskInput(e.target.value)}
              disabled={asking}
            />
            <button className="btn btn-primary" type="submit" disabled={asking || !askInput.trim()}>
              {asking ? <><Spinner /> Thinking…</> : 'Ask'}
            </button>
          </form>

          {(askAnswer || askSources.length > 0) && (
            <div className="ask-response">
              {askSources.length > 0 && (
                <div className="ask-sources">
                  <span className="ask-sources-label">Sources</span>
                  {askSources.map((s, i) => (
                    <a
                      key={i}
                      className="ask-source-chip"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      title={s.title}
                    >
                      <Badge type={s.source_type} />
                      <span className="ask-source-title">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
              {askAnswer && (
                <div className="ask-answer" ref={answerRef}>
                  {askAnswer}
                  {asking && <span className="cursor-blink">▋</span>}
                </div>
              )}
              {asking && !askAnswer && (
                <div className="ask-thinking"><Spinner /> <span className="muted">Reading your brain…</span></div>
              )}
            </div>
          )}
        </section>

        {/* Saved Items Section */}
        <section className="section">
          <h2 className="section-title">Saved items <span className="count">{items.length}</span></h2>
          {loadingItems ? (
            <div className="loading-row"><Spinner /> <span className="muted">Loading…</span></div>
          ) : items.length === 0 ? (
            <p className="empty-msg">Nothing saved yet. Paste a URL above to get started.</p>
          ) : (
            <ul className="items-list">
              {items.map(item => (
                <li key={item.url} className="item-row">
                  <div className="item-favicon">
                    <img
                      src={getFavicon(item.url)}
                      alt=""
                      width={16}
                      height={16}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  </div>
                  <div className="item-info">
                    <a className="item-title" href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <div className="item-meta">
                      <Badge type={item.source_type} />
                      <span className="muted">{formatDate(item.date_saved)}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Delete"
                    onClick={() => handleDelete(item.url)}
                    disabled={deletingUrl === item.url}
                  >
                    {deletingUrl === item.url ? <Spinner /> : '✕'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
