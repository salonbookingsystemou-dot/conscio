import {
  addDays,
  etichettaGiorno,
  etichettaGiornoCorto,
  etichettaMese,
  formatISODate,
  maxDate,
  minDate,
  oggiLocaleISO,
  parseISODate,
  startOfWeekMonday
} from '../lib/date.js'

function aggregaGiorni(sessioni) {
  const mappa = new Map()
  for (const riga of sessioni || []) {
    const chiave = String(riga.data || '').slice(0, 10)
    if (!chiave) continue
    const prev = mappa.get(chiave) || { n: 0, minuti: 0 }
    prev.n += 1
    prev.minuti += Number(riga.durata_minuti) || 0
    mappa.set(chiave, prev)
  }
  return mappa
}

function statoGiorno({ iso, oggi, fatto, inizioCiclo, fineCiclo }) {
  if (fatto) return iso === oggi ? 'oggi-fatto' : 'fatto'
  const fuoriCiclo = (inizioCiclo && iso < inizioCiclo) || (fineCiclo && iso > fineCiclo)
  if (fuoriCiclo) return iso === oggi ? 'oggi' : 'fuori'
  if (iso === oggi) return 'oggi'
  if (iso > oggi) return 'futuro'
  return 'assente'
}

function etichettaStato(stato, info) {
  if (stato === 'fatto' || stato === 'oggi-fatto') {
    const sessioni = info.n === 1 ? '1 sessione' : `${info.n} sessioni`
    return `${sessioni}, ${info.minuti} min`
  }
  if (stato === 'oggi') return 'oggi, nessuna sessione ancora'
  if (stato === 'assente') return 'nessuna sessione'
  if (stato === 'futuro') return 'giorno ancora da fare'
  return 'fuori dal percorso'
}

export default function CalendarioPratica({
  inizio,
  fine,
  sessioni = [],
  titolo = 'Giorni di pratica',
  onGiorno,
  giornoAttivo,
  soloIntervallo = false
}) {
  const oggi = oggiLocaleISO()
  const inizioCiclo = inizio ? String(inizio).slice(0, 10) : null
  const fineCiclo = fine ? String(fine).slice(0, 10) : null
  const fatti = aggregaGiorni(sessioni)
  const dateLog = [...fatti.keys()].map(parseISODate).filter(Boolean)

  const partenza = soloIntervallo
    ? parseISODate(inizioCiclo)
    : minDate(parseISODate(inizioCiclo), parseISODate(oggi), ...dateLog)
  const arrivo = soloIntervallo
    ? parseISODate(fineCiclo)
    : maxDate(parseISODate(fineCiclo), parseISODate(oggi), ...dateLog)

  if (!partenza || !arrivo) return null

  const grigliaDa = soloIntervallo ? partenza : startOfWeekMonday(partenza)
  const grigliaA = soloIntervallo ? arrivo : addDays(startOfWeekMonday(arrivo), 6)
  const celle = []
  for (let d = grigliaDa; d <= grigliaA; d = addDays(d, 1)) {
    const iso = formatISODate(d)
    const info = fatti.get(iso) || { n: 0, minuti: 0 }
    const stato = statoGiorno({
      iso,
      oggi,
      fatto: info.n > 0,
      inizioCiclo,
      fineCiclo
    })
    celle.push({ data: new Date(d), iso, stato, info })
  }

  const settimane = []
  if (soloIntervallo) {
    settimane.push(celle)
  } else {
    for (let i = 0; i < celle.length; i += 7) settimane.push(celle.slice(i, i + 7))
  }

  const indiciTestata = soloIntervallo
    ? celle.map(c => (c.data.getDay() + 6) % 7)
    : [0, 1, 2, 3, 4, 5, 6]

  const trascorsi = celle.filter(c => (
    c.iso <= oggi &&
    (!inizioCiclo || c.iso >= inizioCiclo) &&
    (!fineCiclo || c.iso <= fineCiclo)
  ))
  const conPratica = trascorsi.filter(c => c.info.n > 0).length

  let meseCorrente = ''

  return (
    <div className="calendario-pratica">
      <div className="calendario-testa">
        <h3>{titolo}</h3>
        {trascorsi.length > 0 && (
          <p className="hint">
            {conPratica} {conPratica === 1 ? 'giorno' : 'giorni'} con pratica
            su {trascorsi.length} {trascorsi.length === 1 ? 'trascorso' : 'trascorsi'}
          </p>
        )}
      </div>
      <div
        className="cal-settimana cal-testata"
        style={soloIntervallo ? { gridTemplateColumns: `repeat(${celle.length}, 1fr)` } : undefined}
        aria-hidden="true"
      >
        {indiciTestata.map((i, k) => (
          <span key={`${i}-${k}`}>{etichettaGiornoCorto(i)}</span>
        ))}
      </div>
      {settimane.map((riga, i) => {
        const primoDelMese = riga.find(c => c.data.getDate() === 1) || (i === 0 ? riga[0] : null)
        const mese = primoDelMese ? etichettaMese(primoDelMese.data) : ''
        const mostraMese = mese && mese !== meseCorrente
        if (mostraMese) meseCorrente = mese
        return (
          <div key={riga[0].iso}>
            {mostraMese && <p className="cal-mese">{mese}</p>}
            <div
              className="cal-settimana"
              style={soloIntervallo ? { gridTemplateColumns: `repeat(${riga.length}, 1fr)` } : undefined}
            >
              {riga.map(cella => {
                const attivo = giornoAttivo === cella.iso
                const cliccabile = Boolean(onGiorno)
                const Tag = cliccabile ? 'button' : 'div'
                return (
                  <Tag
                    key={cella.iso}
                    type={cliccabile ? 'button' : undefined}
                    className={`cal-giorno is-${cella.stato}${attivo ? ' is-attivo' : ''}`}
                    title={`${etichettaGiorno(cella.data)}: ${etichettaStato(cella.stato, cella.info)}`}
                    aria-label={`${etichettaGiorno(cella.data)}: ${etichettaStato(cella.stato, cella.info)}`}
                    aria-pressed={cliccabile ? attivo : undefined}
                    onClick={cliccabile ? () => onGiorno(cella.iso) : undefined}
                  >
                    <span className="cal-num">{cella.data.getDate()}</span>
                    {cella.info.n > 1 && <span className="cal-piu">{cella.info.n}</span>}
                  </Tag>
                )
              })}
            </div>
          </div>
        )
      })}
      <ul className="cal-legenda">
        <li><span className="cal-punto is-fatto" /> Sessione registrata</li>
        <li><span className="cal-punto is-assente" /> Nessuna sessione</li>
        <li><span className="cal-punto is-futuro" /> Ancora da fare</li>
      </ul>
    </div>
  )
}
