import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import ConfineErrori from '../../components/ConfineErrori.jsx'
import StatoAttesa from '../../components/StatoAttesa.jsx'
import StatoVuoto from '../../components/StatoVuoto.jsx'
import { etichettaAvanzamento, etichettaPeriodo, etichettaStato } from '../../lib/cicli.js'
import useCiclo from '../../lib/useCiclo.js'

const SCHEDE = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'iscritti', label: 'Iscritti' },
  { id: 'programma', label: 'Programma' },
  { id: 'pratica', label: 'Pratica' },
  { id: 'questionari', label: 'Questionari' }
]

export default function Ciclo() {
  const { cicloId } = useParams()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const dati = useCiclo(cicloId)
  const { ciclo, cicli } = dati

  if (dati.caricamento) return <StatoAttesa etichetta="Carico il ciclo…" />

  if (!ciclo) {
    return (
      <div className="dash">
        <Link to="/admin/cicli" className="link-testuale dash-ciclo-indietro">← Cicli</Link>
        {dati.errore
          ? <p className="avviso-errore" role="alert">{dati.errore}</p>
          : <StatoVuoto titolo="Ciclo non trovato">Forse è stato eliminato. Scegline un altro dall’elenco dei cicli.</StatoVuoto>}
      </div>
    )
  }

  // Cambiando ciclo resta la stessa scheda (anche la stessa settimana nel Programma).
  function cambiaCiclo(id) {
    const coda = pathname.replace(/^\/admin\/cicli\/[^/]+/, '')
    navigate(`/admin/cicli/${id}${coda}${search}`)
  }

  return (
    <div className="dash ciclo-spazio">
      <Link to="/admin/cicli" className="link-testuale dash-ciclo-indietro">← Cicli</Link>

      <header className="dash-ciclo-hero">
        <div className="dash-ciclo-hero-testo">
          <div className="dash-ciclo-titolo">
            <h1>{ciclo.nome_ciclo}</h1>
            <span className={`badge badge-stato is-${ciclo.stato}`}>{etichettaStato(ciclo.stato)}</span>
          </div>
          <p className="dash-ciclo-meta">
            {etichettaPeriodo(ciclo.data_inizio, ciclo.data_fine)}
            <span aria-hidden="true"> · </span>
            {etichettaAvanzamento(ciclo).testo}
          </p>
        </div>
        {cicli.length > 1 && (
          <div className="selettore-ciclo ciclo-selettore">
            <label htmlFor="ciclo-selettore">Altro ciclo</label>
            <select id="ciclo-selettore" value={cicloId} onChange={e => cambiaCiclo(e.target.value)}>
              {cicli.map(c => (
                <option key={c.id} value={c.id}>{c.nome_ciclo} ({etichettaStato(c.stato)})</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <nav className="dash-tabs" role="tablist" aria-label="Sezioni del ciclo">
        {SCHEDE.map(s => (
          <NavLink
            key={s.id}
            to={`/admin/cicli/${cicloId}/${s.id}`}
            role="tab"
            aria-selected={pathname.startsWith(`/admin/cicli/${cicloId}/${s.id}`)}
            className={({ isActive }) => `dash-tab${isActive ? ' is-on' : ''}`}
          >
            {s.label}
          </NavLink>
        ))}
      </nav>

      {dati.errore && <p className="avviso-errore" role="alert">{dati.errore}</p>}

      <div className="dash-panel" role="tabpanel">
        <ConfineErrori key={pathname}>
          <Outlet context={dati} />
        </ConfineErrori>
      </div>
    </div>
  )
}
