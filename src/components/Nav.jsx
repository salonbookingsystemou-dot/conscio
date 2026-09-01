import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function Nav() {
  const { facilitatore, esci } = useAuth()

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Percorso MBSR
      </div>
      <div className="nav-links">
        <NavLink to="/" end>Iscrizione</NavLink>
        <NavLink to="/questionari">Questionari</NavLink>
        <NavLink to="/pratica">Pratica</NavLink>
        <NavLink to="/programma">Settimana</NavLink>
        <NavLink to="/comunicazioni">Avvisi</NavLink>
        {facilitatore && (
          <>
            <NavLink to="/dashboard">Cicli</NavLink>
            <NavLink to="/lezioni">Lezioni</NavLink>
            <button type="button" onClick={esci}>Esci</button>
          </>
        )}
        {!facilitatore && <NavLink to="/accedi">Area facilitatore</NavLink>}
      </div>
    </div>
  )
}
