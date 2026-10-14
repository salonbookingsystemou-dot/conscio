import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import ConfineErrori from '../../components/ConfineErrori.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
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

const INDIETRO = { a: '/admin/cicli', etichetta: 'Cicli' }

export default function Ciclo() {
  const { cicloId } = useParams()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const dati = useCiclo(cicloId)
  const { ciclo, cicli } = dati

  if (dati.caricamento) {
    return <PaginaAdmin titolo="Ciclo" indietro={INDIETRO} stato="attesa" statoTesto="Carico il ciclo…" />
  }

  if (!ciclo) {
    return (
      <PaginaAdmin titolo="Ciclo" indietro={INDIETRO} stato={dati.errore ? 'errore' : undefined} statoTesto={dati.errore}>
        <StatoVuoto titolo="Ciclo non trovato">Forse è stato eliminato. Scegline un altro dall’elenco dei cicli.</StatoVuoto>
      </PaginaAdmin>
    )
  }

  // Cambiando ciclo resta la stessa scheda (anche la stessa settimana nel Programma).
  function cambiaCiclo(id) {
    const coda = pathname.replace(/^\/admin\/cicli\/[^/]+/, '')
    navigate(`/admin/cicli/${id}${coda}${search}`)
  }

  return (
    <PaginaAdmin
      titolo={ciclo.nome_ciclo}
      indietro={INDIETRO}
      meta={(
        <>
          <span className={`badge badge-stato is-${ciclo.stato}`}>{etichettaStato(ciclo.stato)}</span>
          <span>
            {etichettaPeriodo(ciclo.data_inizio, ciclo.data_fine)}
            <span aria-hidden="true"> · </span>
            {etichettaAvanzamento(ciclo).testo}
          </span>
        </>
      )}
      contesto={cicli.length > 1 && (
        <div className="selettore-ciclo">
          <label htmlFor="ciclo-selettore">Altro ciclo</label>
          <select id="ciclo-selettore" value={cicloId} onChange={e => cambiaCiclo(e.target.value)}>
            {cicli.map(c => (
              <option key={c.id} value={c.id}>{c.nome_ciclo} ({etichettaStato(c.stato)})</option>
            ))}
          </select>
        </div>
      )}
      schede={SCHEDE.map(s => ({ a: `/admin/cicli/${cicloId}/${s.id}`, etichetta: s.label }))}
      etichettaSchede="Sezioni del ciclo"
    >
      {dati.errore && <p className="avviso-errore" role="alert">{dati.errore}</p>}
      <div className="dash dash-panel" role="tabpanel">
        <ConfineErrori key={pathname}>
          <Outlet context={dati} />
        </ConfineErrori>
      </div>
    </PaginaAdmin>
  )
}
