import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'
import Marchio from './Marchio.jsx'
import { apriInvitoHome, appGiaInHome } from '../lib/invitoHome.js'
import RuotaTonalita from './RuotaTonalita.jsx'
import OreAscolto from './OreAscolto.jsx'
import useVetrinaAperta from '../lib/useVetrinaAperta.js'

export default function Nav() {
  const { facilitatore } = useAuth()
  const {
    codice,
    registrato,
    minutiAscolto,
    esci: esciPartecipante,
    onboardingCompleto,
    percorsoPronto,
    caricamento
  } = usePartecipante()
  const { pathname } = useLocation()
  // Le pagine della lettera hanno il guscio di Ascolta: solo il logo, senza menu.
  const paginaAscolta = pathname === '/ascolta' || pathname.startsWith('/ascolta/') || pathname.startsWith('/lettera/')
  const [aperto, setAperto] = useState(false)
  const menuId = useId()
  const vetrinaAperta = useVetrinaAperta()

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

  const voceAscolta = vetrinaAperta
    ? <NavLink to="/ascolta" onClick={chiudi}>E se ti fermassi un momento?</NavLink>
    : null

  const barraBassa = registrato && percorsoPronto

  const vociPrimarie = registrato && onboardingCompleto && (
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

  const voci = facilitatore ? (
    <>
      {voceAscolta}
      <NavLink to="/admin/cicli" onClick={chiudi}>Area facilitatore</NavLink>
    </>
  ) : registrato ? (
    <>
      {voceAscolta}
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
      <NavLink to="/segnala" onClick={chiudi}>Segnala un problema</NavLink>
      <button type="button" onClick={() => { chiudi(); esciPartecipante() }}>Esci</button>
    </>
  ) : (
    <>
      {voceAscolta}
      <NavLink to="/iscrizione" onClick={chiudi}>Iscrizione</NavLink>
      <NavLink to="/entra" onClick={chiudi}>Entra</NavLink>
      <NavLink to="/segnala" onClick={chiudi}>Segnala un problema</NavLink>
      <span className="nav-sep" aria-hidden="true" />
      <NavLink to="/accedi" onClick={chiudi} className="nav-secondaria">
        Area facilitatore
      </NavLink>
    </>
  )

  return (
    <header className={`topbar${aperto ? ' is-open' : ''}${paginaAscolta ? ' is-solo-logo' : ''}`}>
      <div className="topbar-riga">
        <Link to="/" className="brand" aria-label="Conscio, pagina iniziale" onClick={chiudi}>
          {/* In «E se ti fermassi un momento?» solo il segno; altrove segno e scritta. */}
          {paginaAscolta
            ? <Marchio variante="segno" altezza={32} decorativo className="brand-segno" />
            : <Marchio variante="orizzontale" altezza={28} decorativo className="brand-marchio" />}
        </Link>
        {/* In «E se ti fermassi un momento?» l'unica azione è l'invito al percorso; chi è già iscritto non lo vede.
            Si aspetta di sapere se c'è un codice, così il link non compare e poi sparisce. */}
        {paginaAscolta && !caricamento && !registrato && (
          <Link to="/iscrizione" className="topbar-percorso">Inizia il percorso</Link>
        )}
        {paginaAscolta ? null : (
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
        )}
      </div>
      {paginaAscolta ? null : (
      <>
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
      </>
      )}
    </header>
  )
}
