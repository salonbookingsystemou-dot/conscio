import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import iconaConscio from '../assets/icona-conscio.png'
import { useAuth } from '../lib/auth.jsx'
import { contaDaFare, osservaDaFare } from '../lib/cicli.js'
import BarraVoci from './BarraVoci.jsx'

function IconaCicli() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 9.5h15M9 3.8v3.4M15 3.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconaTracce() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 10v4M9 7v10M13 4.5v15M17 8v8M21 11v2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconaComunicazioni() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconaSito() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function useDaFare() {
  const { pathname } = useLocation()
  const [numero, setNumero] = useState(0)

  useEffect(() => {
    let vivo = true
    const aggiorna = () => {
      contaDaFare().then(n => { if (vivo) setNumero(n) }).catch(() => {})
    }
    aggiorna()
    const smetti = osservaDaFare(aggiorna)
    return () => {
      vivo = false
      smetti()
    }
  }, [pathname])

  return numero
}

export default function AdminChrome() {
  const { esci } = useAuth()
  const daFare = useDaFare()

  const voci = [
    { to: '/admin/cicli', label: 'Cicli', Icona: IconaCicli, badge: daFare },
    { to: '/admin/tracce', label: 'Tracce', Icona: IconaTracce },
    { to: '/admin/comunicazioni', label: 'Comunicazioni', Icona: IconaComunicazioni },
    { to: '/admin/sito', label: 'Sito', Icona: IconaSito }
  ]

  return (
    <div className="admin-app">
      <header className="admin-top">
        <Link to="/admin/cicli" className="admin-brand">
          <img className="brand-mark" src={iconaConscio} alt="" />
          Conscio
          <span className="admin-brand-ruolo">Facilitatore</span>
        </Link>
        <nav className="admin-pills" aria-label="Area facilitatore">
          {voci.map(v => (
            <NavLink key={v.to} to={v.to}>
              {v.label}
              {v.badge > 0 && (
                <>
                  <span className="admin-conteggio" aria-hidden="true">{v.badge}</span>
                  <span className="visually-hidden">, {v.badge} da fare</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="admin-esci" onClick={esci}>Esci</button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
      <BarraVoci voci={voci} etichetta="Area facilitatore" className="is-facilitatore" />
    </div>
  )
}

/** Larghezza del contenuto, scelta per rotta. */
export function PaginaAdmin({ ampia = false }) {
  return (
    <div className={`admin-pagina${ampia ? ' is-ampia' : ''}`}>
      <Outlet />
    </div>
  )
}
