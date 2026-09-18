import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import iconaConscio from '../assets/icona-conscio.png'
import { useAuth } from '../lib/auth.jsx'

export default function AdminChrome({ children, ampio = false }) {
  const { esci } = useAuth()
  const { pathname } = useLocation()
  const [aperto, setAperto] = useState(false)
  const menuId = useId()

  useEffect(() => {
    document.body.classList.add('mbsr-theme')
    return () => document.body.classList.remove('mbsr-theme')
  }, [])

  useEffect(() => {
    setAperto(false)
  }, [pathname])

  useEffect(() => {
    if (!aperto) return undefined

    function suTasto(e) {
      if (e.key === 'Escape') setAperto(false)
    }

    document.addEventListener('keydown', suTasto)
    const precedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', suTasto)
      document.body.style.overflow = precedente
    }
  }, [aperto])

  function chiudi() {
    setAperto(false)
  }

  return (
    <div className="mbsr-theme admin-app">
      <header className={`admin-top${aperto ? ' is-open' : ''}`}>
        <div className="admin-top-riga">
          <Link to="/dashboard" className="admin-brand" onClick={chiudi}>
            <img className="brand-mark" src={iconaConscio} alt="" />
            Percorso MBSR
            <span className="admin-brand-ruolo">Admin</span>
          </Link>
          <button
            type="button"
            className="admin-toggle"
            aria-expanded={aperto}
            aria-controls={menuId}
            onClick={() => setAperto(v => !v)}
          >
            <span className="admin-toggle-barre" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {aperto ? 'Chiudi' : 'Menu'}
          </button>
        </div>
        {aperto && (
          <button
            type="button"
            className="admin-velo"
            aria-label="Chiudi il menu"
            onClick={chiudi}
          />
        )}
        <div className="admin-top-destra" id={menuId}>
          <nav className="admin-pills" aria-label="Area facilitatore">
            <NavLink to="/dashboard" onClick={chiudi}>Cicli</NavLink>
            <NavLink to="/percorso" onClick={chiudi}>Percorso</NavLink>
            <NavLink to="/libreria" end onClick={chiudi}>Libreria</NavLink>
            <NavLink to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
          </nav>
          <button
            type="button"
            className="admin-esci"
            onClick={() => {
              chiudi()
              esci()
            }}
          >
            Esci
          </button>
        </div>
      </header>
      <div className={`admin-main${ampio ? ' is-ampio' : ''}`}>{children}</div>
    </div>
  )
}
