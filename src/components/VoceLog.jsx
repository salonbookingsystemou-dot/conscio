import TonoMini from './TonoMini.jsx'

function etichettaTipo(tipo) {
  if (tipo === 'informale') return 'Informale'
  if (tipo === 'formale') return 'Formale'
  if (tipo === 'a_casa') return 'A casa'
  if (tipo === 'body_scan') return 'Body scan'
  if (tipo === 'seduta') return 'Meditazione seduta'
  if (tipo === 'yoga') return 'Yoga consapevole'
  if (tipo === 'altro') return 'Altro'
  return tipo || null
}

function codiceDi(riga) {
  return riga.codice_partecipante || riga.codice || null
}

export default function VoceLog({ riga }) {
  const data = new Date(riga.data).toLocaleDateString('it-IT')
  const attivita = riga.esercizio || etichettaTipo(riga.tipo)
  const nota = (riga.note || '').trim()

  return (
    <article className="voce-log">
      <header className="voce-log-testata">
        <time dateTime={String(riga.data).slice(0, 10)}>{data}</time>
        <span className="voce-log-durata">{riga.durata_minuti} min</span>
        <TonoMini riga={riga} />
      </header>
      {riga.numero_settimana ? (
        <p className="voce-log-settimana">Settimana {riga.numero_settimana}</p>
      ) : null}
      {attivita ? <p className="voce-log-attivita">{attivita}</p> : null}
      {nota ? <p className="voce-log-nota">{nota}</p> : null}
    </article>
  )
}

export function ElencoLog({ righe, raggruppaCodice = false }) {
  if (!righe?.length) return null

  if (!raggruppaCodice) {
    return (
      <div className="elenco-log">
        {righe.map((riga, idx) => (
          <VoceLog key={riga.id || `${riga.data}-${idx}`} riga={riga} />
        ))}
      </div>
    )
  }

  const gruppi = []
  const indice = new Map()
  for (const riga of righe) {
    const codice = codiceDi(riga) || '—'
    if (!indice.has(codice)) {
      indice.set(codice, gruppi.length)
      gruppi.push({ codice, righe: [] })
    }
    gruppi[indice.get(codice)].righe.push(riga)
  }

  return (
    <div className="elenco-log">
      {gruppi.map(gruppo => (
        <section className="log-gruppo" key={gruppo.codice}>
          <h4 className="log-gruppo-codice">
            <span className="badge">{gruppo.codice}</span>
          </h4>
          {gruppo.righe.map((riga, idx) => (
            <VoceLog key={riga.id || `${gruppo.codice}-${riga.data}-${idx}`} riga={riga} />
          ))}
        </section>
      ))}
    </div>
  )
}
