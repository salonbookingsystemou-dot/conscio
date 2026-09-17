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
    codice,
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

    // Porta in cima la pagina così il menu aperto è interamente visibile (soprattutto su mobile).
    window.scrollTo({ top: 0, behavior: 'smooth' })

    function suTasto(e) {
      if (e.key === 'Escape') setAperto(false)
    }

    document.addEventListener('keydown', suTasto)
    // Blocca lo scroll di sfondo solo dopo che l'animazione verso l'alto è partita,
    // così non interrompe lo scroll automatico.
    const precedente = document.body.style.overflow
    const bloccaScroll = setTimeout(() => {
      document.body.style.overflow = 'hidden'
    }, 320)

    return () => {
      clearTimeout(bloccaScroll)
      document.removeEventListener('keydown', suTasto)
      document.body.style.overflow = precedente
    }
  }, [aperto])

  function chiudi() {
    setAperto(false)
  }

  const barraBassa = facilitatore || (registrato && percorsoPronto)

  const vociPrimarie = (facilitatore || (registrato && onboardingCompleto)) && (
    <>
      <NavLink className="nav-primaria" to="/questionari" onClick={chiudi}>Questionari</NavLink>
      {barraBassa && (
        <>
          <NavLink className="nav-primaria" to="/programma" onClick={chiudi}>Settimana</NavLink>
          <NavLink className="nav-primaria" to="/pratica" onClick={chiudi}>Storico</NavLink>
          <NavLink className="nav-primaria" to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
        </>
      )}
    </>
  )

  const voci = dentro ? (
    <>
      {facilitatore ? (
        <>
          <NavLink to="/dashboard" onClick={chiudi}>Cicli</NavLink>
          <NavLink to="/percorso" onClick={chiudi}>Percorso</NavLink>
          <NavLink to="/libreria" onClick={chiudi}>Libreria</NavLink>
          <NavLink to="/comunicazioni" onClick={chiudi}>Avvisi</NavLink>
          <button type="button" onClick={() => { chiudi(); esci() }}>Esci</button>
        </>
      ) : (
        <>
          {!onboardingCompleto && (
            <NavLink to="/onboarding" onClick={chiudi}>Primo accesso</NavLink>
          )}
          {vociPrimarie}
          <span className="nav-sep nav-sep-dopo-primarie" aria-hidden="true" />
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
          <NavLink to="/dati" onClick={chiudi}>I tuoi dati</NavLink>
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
          <div className="nav-tonalita-desktop">
            <RuotaTonalita variante="compatta" />
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
        {registrato && !facilitatore && codice && (
          <p className="nav-identita">
            <span>Il tuo codice</span>
            <strong>{codice.trim().toUpperCase()}</strong>
          </p>
        )}
        {voci}
        <div className="nav-tonalita">
          <RuotaTonalita variante="piena" />
        </div>
      </nav>
    </header>
  )
}
