import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import iconaConscio from '../assets/icona-conscio.png'
import { useAuth } from '../lib/auth.jsx'

export default function AdminChrome({ children, ampio = false }) {
  const { esci } = useAuth()

  useEffect(() => {
    document.body.classList.add('mbsr-theme')
    return () => document.body.classList.remove('mbsr-theme')
  }, [])

  return (
    <div className="mbsr-theme admin-app">
      <header className="admin-top">
        <Link to="/dashboard" className="admin-brand">
          <img className="brand-mark" src={iconaConscio} alt="" />
          Percorso MBSR
          <span className="admin-brand-ruolo">Admin</span>
        </Link>
        <div className="admin-top-destra">
          <nav className="admin-pills" aria-label="Area facilitatore">
            <NavLink to="/dashboard">Cicli</NavLink>
            <NavLink to="/percorso">Percorso</NavLink>
            <NavLink to="/libreria" end>Libreria tracce</NavLink>
            <NavLink to="/comunicazioni">Avvisi</NavLink>
          </nav>
          <button type="button" className="admin-esci" onClick={() => esci()}>
            Esci
          </button>
        </div>
      </header>
      <div className={`admin-main${ampio ? ' is-ampio' : ''}`}>{children}</div>
    </div>
  )
}
