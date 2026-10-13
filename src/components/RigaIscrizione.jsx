import { ESITI, MODALITA, eIdoneo, eRemoto, eRitirato, faseIdoneo } from '../lib/cicli.js'

function StatoPercorso({ iscrizione, timepoints, ciclo }) {
  if (!eIdoneo(iscrizione)) return null
  const fase = faseIdoneo(iscrizione, timepoints, ciclo)
  return (
    <span className={`dash-stato is-${fase.tono}`} title={fase.dettaglio}>
      <span className="dash-stato-dot" aria-hidden="true" />
      {fase.etichetta}
    </span>
  )
}

/**
 * Una iscrizione con le sue azioni. Con `cicli` (iscrizione senza ciclo) mostra
 * «Collega a un ciclo» al posto della modalità.
 */
export default function RigaIscrizione({
  iscrizione: i,
  timepoints,
  ciclo,
  cicli,
  notifiche = [],
  onEsito,
  onModalita,
  onAssegna,
  onRitira
}) {
  const codice = i.utenti?.codice_partecipante
  const libera = Boolean(cicli)
  const ritirato = eRitirato(i)
  return (
    <li className={`dash-iscrizione${libera ? ' is-libera' : ''}${ritirato ? ' is-ritirato' : ''}`}>
      <div className="dash-iscrizione-persona">
        <span className="badge" title={i.utenti?.email || 'Nessuna email registrata'}>
          {codice || '—'}
        </span>
        {eRemoto(i) && <span className="badge badge-modalita is-remoto">remoto</span>}
        {ritirato
          ? <span className="badge badge-ritirato">ritirato</span>
          : <StatoPercorso iscrizione={i} timepoints={timepoints} ciclo={ciclo} />}
        {notifiche.map(n => (
          <span
            key={`${n.tipo}-${n.inviata_il}`}
            className="badge"
            title={n.inviata_il ? new Date(n.inviata_il).toLocaleDateString('it-IT') : ''}
          >
            {n.tipo === 'onboarding_senza_ascolto' ? 'avviso pratiche' : 'avviso onboarding'}
          </span>
        ))}
      </div>
      {ritirato ? (
        <p className="dash-iscrizione-ritirato">
          Ritirato · dati anonimi conservati a fini statistici
        </p>
      ) : (
        <>
          <label className="dash-iscrizione-esito">
            <select
              value={i.esito_screening || 'in_attesa'}
              onChange={e => onEsito(i, e.target.value)}
              aria-label={`Screening ${codice || ''}`}
            >
              {ESITI.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
          {libera ? (
            <label className="dash-iscrizione-esito">
              <select
                defaultValue=""
                onChange={e => e.target.value && onAssegna(i, e.target.value)}
                aria-label={`Collega ${codice || ''} a un ciclo`}
              >
                <option value="">Collega a un ciclo…</option>
                {cicli.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_ciclo}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="dash-iscrizione-esito">
              <select
                value={i.modalita_fruizione || 'presenza'}
                onChange={e => onModalita(i, e.target.value)}
                aria-label={`Modalità ${codice || ''}`}
              >
                {MODALITA.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="btn btn-ghost is-pericolo is-piccolo dash-iscrizione-azioni-ritira"
            onClick={() => onRitira(i)}
          >
            Ritira
          </button>
        </>
      )}
    </li>
  )
}
