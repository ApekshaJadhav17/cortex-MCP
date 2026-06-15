import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ParticleField from './ParticleField'
import { loginUser } from './api'
import Logo from './Logo'

const SUBTITLE = 'The memory layer for your AI.'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    let i = 0
    const delay = setTimeout(() => {
      const t = setInterval(() => {
        i++
        setTyped(SUBTITLE.slice(0, i))
        if (i >= SUBTITLE.length) clearInterval(t)
      }, 48)
      return () => clearInterval(t)
    }, 900)
    return () => clearTimeout(delay)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const { token } = await loginUser(password)
      localStorage.setItem('cortex_token', token)
      onLogin(token)
    } catch (err) {
      setError(err.message || 'Wrong password')
      setPassword('')
      setShake(true)
      setTimeout(() => setShake(false), 650)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <ParticleField />
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={
          shake
            ? { opacity: 1, scale: 1, y: 0, x: [-10, 10, -7, 7, -4, 4, 0] }
            : { opacity: 1, y: 0, scale: 1, x: 0 }
        }
        transition={
          shake
            ? { x: { duration: 0.5 }, default: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
            : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <motion.div
          className="login-logo"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div className="login-logo-glow" />
          <Logo size={44} />
        </motion.div>

        <motion.h1
          className="login-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          CORTEX
        </motion.h1>

        <motion.p
          className="login-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {typed}
          {typed.length < SUBTITLE.length && (
            <span className="cursor-blink">▋</span>
          )}
          {typed.length === SUBTITLE.length && (
            <span style={{ opacity: 0 }}>▋</span>
          )}
        </motion.p>

        <motion.form
          className="login-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className={`login-field ${error ? 'login-field--error' : ''}`}>
            <span className="login-field-icon">⬡</span>
            <input
              className="login-input"
              type="password"
              placeholder="Enter your passphrase"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              disabled={loading}
              autoFocus
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                className="login-error"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
              >
                ✕ {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            className="login-btn"
            type="submit"
            disabled={loading || !password}
            whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(124,58,237,0.6)' }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? (
              <><span className="spinner" /> Entering…</>
            ) : (
              <>Enter Cortex <span className="btn-arrow">→</span></>
            )}
          </motion.button>
        </motion.form>

        <motion.p
          className="login-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          Set <code>CORTEX_PASSWORD</code> in <code>backend/.env</code>
        </motion.p>
      </motion.div>
    </div>
  )
}
