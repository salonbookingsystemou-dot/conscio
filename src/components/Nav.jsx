import { useEffect, useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'

export default function Nav() {
  const { facilitatore, esci } = useAuth()
  const { registrato, esci: esciPartecipante } = usePartecipante()
  const { pathname } = useLocation()
  const [aperto, setAperto] = useState(false)
  const menuId = useId()
  const dentro = facilitatore || registrato

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

  const voci = dentro ? (
    <>
      <NavLink to="/questionari" onClick={chiudi}>Questionari</NavLink>
      <NavLink to="/programma" onClick={chiudi}>Settimana</NavLink>
      <NavLink to="/pratica" onClick={chiudi}>Storico</NavLink>
      <NavLink to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
      {facilitatore ? (
        <>
          <span className="nav-sep" aria-hidden="true" />
          <NavLink to="/dashboard" onClick={chiudi}>Cicli</NavLink>
          <NavLink to="/lezioni" onClick={chiudi}>Lezioni</NavLink>
          <button type="button" onClick={() => { chiudi(); esci() }}>Esci</button>
        </>
      ) : (
        <>
          <span className="nav-sep" aria-hidden="true" />
          <button type="button" onClick={() => { chiudi(); esciPartecipante() }}>Esci</button>
        </>
      )}
    </>
  ) : (
    <>
      <NavLink to="/" end onClick={chiudi}>Iscrizione</NavLink>
      <NavLink to="/entra" onClick={chiudi}>Entra</NavLink>
      <span className="nav-sep" aria-hidden="true" />
      <NavLink to="/accedi" onClick={chiudi} className="nav-secondaria">
        Area facilitatore
      </NavLink>
    </>
  )

  return (
    <header className={`topbar${aperto ? ' is-open' : ''}`}>
      <div className="topbar-riga">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Percorso MBSR
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={aperto}
          aria-controls={menuId}
          onClick={() => setAperto(v => !v)}
        >
          <span className="nav-toggle-barre" aria-hidden="true">
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
          className="nav-velo"
          aria-label="Chiudi il menu"
          onClick={chiudi}
        />
      )}
      <nav id={menuId} className="nav-links" aria-label="Sezioni del percorso">
        {voci}
      </nav>
    </header>
  )
}
