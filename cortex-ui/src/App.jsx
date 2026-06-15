import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Landing from './Landing'
import Login from './Login'
import Dashboard from './Dashboard'

function isTokenValid(token) {
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() / 1000 < payload.exp
  } catch {
    return false
  }
}

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3 } }

export default function App() {
  const [view, setView] = useState(() => {
    const t = localStorage.getItem('cortex_token')
    return isTokenValid(t) ? 'dashboard' : 'landing'
  })

  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('cortex_token')
    return isTokenValid(t) ? t : null
  })

  function handleLogin(t) { setToken(t); setView('dashboard') }

  function handleLogout() {
    localStorage.removeItem('cortex_token')
    setToken(null)
    setView('landing')
  }

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' && (
        <motion.div key="landing" {...fade} style={{ height: '100%' }}>
          <Landing onLaunch={() => setView('login')} />
        </motion.div>
      )}
      {view === 'login' && (
        <motion.div key="login" {...fade} style={{ height: '100%' }}>
          <Login onLogin={handleLogin} />
        </motion.div>
      )}
      {view === 'dashboard' && (
        <motion.div key="dashboard" {...fade} style={{ height: '100%' }}>
          <Dashboard onLogout={handleLogout} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
