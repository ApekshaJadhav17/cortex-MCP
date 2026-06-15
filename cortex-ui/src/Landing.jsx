import { motion } from 'framer-motion'
import Logo from './Logo'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2v11M10 13l-3-3M10 13l3-3" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 15h14" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Save anything',
    desc: 'Articles, YouTube transcripts, PDFs, and raw notes — chunked, embedded, and stored locally on your machine. No cloud. No limits.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="6" stroke="#D97757" strokeWidth="1.6"/>
        <path d="M13.5 13.5L17 17" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Semantic search',
    desc: 'Search by meaning, not keywords. Finds what you saved even when you can\'t remember the exact words you read.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 6h12M4 10h8M4 14h5" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="16" cy="14" r="2.5" fill="#D97757" opacity="0.3" stroke="#D97757" strokeWidth="1.2"/>
        <path d="M15 14h2M16 13v2" stroke="#D97757" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Ask Cortex',
    desc: 'Ask natural language questions and get streamed, cited answers generated directly from your saved content — not the internet.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="7" height="10" rx="1.5" stroke="#D97757" strokeWidth="1.5"/>
        <rect x="11" y="5" width="7" height="10" rx="1.5" stroke="#D97757" strokeWidth="1.5"/>
        <path d="M9 10h2" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Native MCP tools',
    desc: 'Exposed as tools inside Claude Desktop via the Model Context Protocol. Claude searches your brain mid-conversation — automatically.',
  },
]

const DEMO_LINES = [
  { type: 'user',   text: 'What did I save about attention mechanisms?' },
  { type: 'tool',   text: 'search_cortex("attention mechanisms")' },
  { type: 'result', text: '5 chunks matched across 3 saved items' },
  { type: 'claude', text: 'Based on the articles you\'ve saved — particularly the Illustrated Transformer and your Karpathy lecture notes — attention works by computing a weighted sum of value vectors...' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
}

export default function Landing({ onLaunch }) {
  return (
    <div className="landing">
      {/* Ambient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Nav */}
      <nav className="l-nav">
        <div className="l-nav-inner">
          <div className="l-nav-logo">
            <Logo size={22} />
            <span className="l-nav-wordmark">Cortex</span>
          </div>
          <button className="l-btn-primary" onClick={onLaunch}>
            Launch App →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="l-hero">
        <motion.div
          className="l-hero-inner"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div className="l-hero-logo" variants={fadeUp}>
            <div className="l-hero-logo-glow" />
            <Logo size={64} />
          </motion.div>

          <motion.h1 className="l-hero-title" variants={fadeUp}>
            Your knowledge base,<br />wired into Claude.
          </motion.h1>

          <motion.p className="l-hero-sub" variants={fadeUp}>
            Save articles, YouTube videos, PDFs, and notes. Search them
            semantically. Ask questions and get cited answers — all available
            as native tools inside Claude Desktop via MCP.
          </motion.p>

          <motion.div className="l-hero-actions" variants={fadeUp}>
            <button className="l-btn-primary l-btn-lg" onClick={onLaunch}>
              Launch App →
            </button>
            <a
              className="l-btn-ghost"
              href="https://github.com/ApekshaJadhav17/cortex-MCP"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </a>
          </motion.div>

          <motion.div className="l-hero-badges" variants={fadeUp}>
            <span className="l-badge">Runs locally</span>
            <span className="l-badge">Free &amp; open source</span>
            <span className="l-badge">MCP-native</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="l-section">
        <div className="l-container">
          <motion.div
            className="l-features"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} className="l-feature-card" variants={fadeUp}>
                <div className="l-feature-icon">{f.icon}</div>
                <h3 className="l-feature-title">{f.title}</h3>
                <p className="l-feature-desc">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* MCP section */}
      <section className="l-section">
        <div className="l-container">
          <motion.div
            className="l-mcp"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div className="l-mcp-text" variants={fadeUp}>
              <span className="l-eyebrow">The MCP advantage</span>
              <h2 className="l-section-title">Claude can reach into your brain.</h2>
              <p className="l-section-desc">
                Most second-brain tools are closed loops — you save things in,
                you search things in them. Your AI lives elsewhere, blind to
                everything you've curated.
              </p>
              <p className="l-section-desc">
                Cortex implements the Model Context Protocol, exposing your
                knowledge base as native tools Claude Desktop can call
                mid-conversation — without you copy-pasting a thing.
              </p>
              <div className="l-mcp-tools">
                {['search_cortex', 'save_to_cortex', 'save_note_to_cortex', 'list_cortex'].map(t => (
                  <span key={t} className="l-tool-chip">{t}()</span>
                ))}
              </div>
            </motion.div>

            <motion.div className="l-mcp-demo" variants={fadeUp}>
              <div className="l-demo-header">
                <div className="l-demo-dot" />
                <div className="l-demo-dot" />
                <div className="l-demo-dot" />
                <span className="l-demo-title">Claude Desktop</span>
              </div>
              <div className="l-demo-body">
                {DEMO_LINES.map((line, i) => (
                  <div key={i} className={`l-demo-line l-demo-${line.type}`}>
                    {line.type === 'user' && (
                      <><span className="l-demo-label">You</span><span>{line.text}</span></>
                    )}
                    {line.type === 'tool' && (
                      <><span className="l-demo-label l-demo-label--tool">Tool</span><code>{line.text}</code></>
                    )}
                    {line.type === 'result' && (
                      <span className="l-demo-result">↳ {line.text}</span>
                    )}
                    {line.type === 'claude' && (
                      <><span className="l-demo-label l-demo-label--claude">Claude</span><span>{line.text}</span></>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="l-section l-cta-section">
        <div className="l-container">
          <motion.div
            className="l-cta"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <Logo size={40} />
            <h2 className="l-cta-title">Start building your second brain.</h2>
            <p className="l-section-desc">
              Everything runs on your machine. Your knowledge stays private.
            </p>
            <button className="l-btn-primary l-btn-lg" onClick={onLaunch}>
              Launch App →
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-inner">
            <div className="l-nav-logo">
              <Logo size={18} />
              <span className="l-nav-wordmark">Cortex</span>
            </div>
            <span className="l-footer-note">Local · Private · Open Source</span>
            <a
              className="l-footer-link"
              href="https://github.com/ApekshaJadhav17/cortex-MCP"
              target="_blank"
              rel="noreferrer"
            >
              GitHub →
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
