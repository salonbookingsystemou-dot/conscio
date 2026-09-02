import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'
import iconaConscio from '../assets/icona-conscio.png'
import { apriInvitoHome, appGiaInHome } from '../lib/invitoHome.js'
import RuotaTonalita from './RuotaTonalita.jsx'
import OreAscolto from './OreAscolto.jsx'

export default function Nav() {
  const { facilitatore, esci } = useAuth()
  const {
    registrato,
    minutiAscolto,
    esci: esciPartecipante,
    onboardingCompleto,
    percorsoPronto
  } = usePartecipante()
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

  const vociPartecipante = facilitatore ? null : (
    <>
      {!onboardingCompleto && (
        <NavLink to="/onboarding" onClick={chiudi}>Primo accesso</NavLink>
      )}
      {onboardingCompleto && (
        <NavLink to="/questionari" onClick={chiudi}>Questionari</NavLink>
      )}
      {percorsoPronto && (
        <>
          <NavLink to="/programma" onClick={chiudi}>Settimana</NavLink>
          <NavLink to="/pratica" onClick={chiudi}>Storico</NavLink>
          <NavLink to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
        </>
      )}
    </>
  )

  const voci = dentro ? (
    <>
      {facilitatore ? (
        <>
          <NavLink to="/questionari" onClick={chiudi}>Questionari</NavLink>
          <NavLink to="/programma" onClick={chiudi}>Settimana</NavLink>
          <NavLink to="/pratica" onClick={chiudi}>Storico</NavLink>
          <NavLink to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
          <span className="nav-sep" aria-hidden="true" />
          <NavLink to="/dashboard" onClick={chiudi}>Cicli</NavLink>
          <NavLink to="/lezioni" onClick={chiudi}>Lezioni</NavLink>
          <button type="button" onClick={() => { chiudi(); esci() }}>Esci</button>
        </>
      ) : (
        <>
          {vociPartecipante}
          <span className="nav-sep" aria-hidden="true" />
          {!appGiaInHome() && (
            <button
              type="button"
              onClick={() => {
                chiudi()
                apriInvitoHome()
              }}
            >
              Installa app
            </button>
          )}
          <button type="button" onClick={() => { chiudi(); esciPartecipante() }}>Esci</button>
        </>
      )}
    </>
  ) : (
    <>
      <NavLink to="/iscrizione" onClick={chiudi}>Iscrizione</NavLink>
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
        <Link to="/" className="brand" onClick={chiudi}>
          <img className="brand-mark" src={iconaConscio} alt="" />
          Percorso MBSR
        </Link>
        <div className="topbar-azioni">
          {registrato && <OreAscolto minuti={minutiAscolto} />}
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
        <div className="nav-tonalita">
          <RuotaTonalita variante="piena" />
        </div>
      </nav>
    </header>
  )
}
