import { etichettaGiorno, formatISODate, parseISODate } from '../lib/date.js'
import { SCALA_MINUTI } from '../lib/storico.js'
import { TONI, etichettaTono } from '../lib/tono.js'
import TonoIcon from './TonoIcon.jsx'

const LEGENDA = ['piacevole', 'neutro', 'spiacevole'].map(id => TONI.find(t => t.id === id))

function ChipTono({ tono }) {
  return (
    <span className={`tono-mini is-${tono}`}>
      <TonoIcon id={tono} className="tono-mini-segno" />
      {etichettaTono(tono)}
    </span>
  )
}

function elencoNomi(voci) {
  return voci.map(v => (v.n > 1 ? `${v.nome} (${v.n} volte)` : v.nome)).join(', ')
}

function testoPratiche(giorno) {
  const parti = []
  if (giorno.formali.length > 0) parti.push(elencoNomi(giorno.formali))
  if (giorno.informali.length > 0) {
    const informali = elencoNomi(giorno.informali)
    parti.push(parti.length > 0 ? `informale: ${informali}` : `Informale: ${informali}`)
  }
  if (!giorno.nota && giorno.formali.length > 0) parti.push('nessuna nota')
  return parti.join(' · ')
}

function intervalloSettimana(giorni) {
  const ultimo = giorni[0].data
  const primo = giorni[giorni.length - 1].data
  const fmt = { day: 'numeric', month: 'short' }
  if (primo.getTime() === ultimo.getTime()) return primo.toLocaleDateString('it-IT', fmt)
  if (primo.getMonth() === ultimo.getMonth()) {
    return `${primo.getDate()}–${ultimo.toLocaleDateString('it-IT', fmt)}`
  }
  return `${primo.toLocaleDateString('it-IT', fmt)} – ${ultimo.toLocaleDateString('it-IT', fmt)}`
}

function DataGiorno({ data }) {
  return (
    <time className="storico-data" dateTime={formatISODate(data)} aria-label={etichettaGiorno(data)}>
      <span className="storico-num" aria-hidden="true">{data.getDate()}</span>
      <span className="storico-dow" aria-hidden="true">
        {data.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}
      </span>
    </time>
  )
}

function Giornata({ giorno }) {
  if (giorno.vuoto) {
    return (
      <li className="storico-giorno is-vuoto">
        <DataGiorno data={giorno.data} />
        <p className="storico-vuoto-testo">Nessuna pratica registrata</p>
      </li>
    )
  }

  const larghezza = Math.min(giorno.minuti, SCALA_MINUTI) / SCALA_MINUTI * 100
  const pratiche = testoPratiche(giorno)

  return (
    <li className="storico-giorno">
      <DataGiorno data={giorno.data} />
      <div className="storico-corpo">
        <div className="storico-riga">
          <div className="storico-pista" aria-hidden="true">
            {!giorno.soloInformale && giorno.minuti > 0 && (
              <div
                className={`storico-barra is-${giorno.tono || 'nd'}`}
                style={{ width: `${larghezza}%` }}
              />
            )}
          </div>
          <span className="storico-min">{giorno.minuti > 0 ? `${giorno.minuti} min` : '—'}</span>
          {giorno.soloInformale ? (
            <span className="tono-mini is-nd">Solo informale</span>
          ) : giorno.tono ? (
            <ChipTono tono={giorno.tono} />
          ) : (
            <span className="tono-mini is-nd">Tono non indicato</span>
          )}
        </div>
        {giorno.nota && <p className="storico-nota">«{giorno.nota}»</p>}
        {pratiche && <p className="storico-pratiche">{pratiche}</p>}
      </div>
    </li>
  )
}

function titoloSettimana(gruppo) {
  if (gruppo.chiave === 'prima') return { titolo: 'Prima dell’inizio del percorso', tema: null }
  if (gruppo.numero == null) return null
  return { titolo: `Settimana ${gruppo.numero}`, tema: gruppo.tema }
}

export default function StoricoGiornate({ settimane, minutiTotali, giorniPratica, giorniTrascorsi, inizio }) {
  const dataInizio = parseISODate(inizio)

  return (
    <div className="storico">
      <div className="storico-contatori">
        <div className="storico-contatore">
          <p className="storico-contatore-valore">
            {minutiTotali} <span>min</span>
          </p>
          <p className="storico-contatore-testo">di meditazione dall’inizio del percorso</p>
        </div>
        <div className="storico-contatore">
          <p className="storico-contatore-valore">
            {giorniPratica} <span>{giorniPratica === 1 ? 'giorno' : 'giorni'}</span>
          </p>
          <p className="storico-contatore-testo">
            {giorniTrascorsi == null
              ? 'di pratica'
              : `di pratica, su ${giorniTrascorsi} dall’inizio del percorso`}
          </p>
        </div>
      </div>

      <ul className="storico-legenda" aria-label="Legenda del tono">
        {LEGENDA.map(t => (
          <li key={t.id}>
            <span className={`storico-legenda-barra is-${t.id}`} aria-hidden="true" />
            <ChipTono tono={t.id} />
          </li>
        ))}
        <li>
          <span className="storico-legenda-barra is-nd" aria-hidden="true" />
          <span className="tono-mini is-nd">Tono non indicato</span>
        </li>
      </ul>
      <p className="storico-scala">
        La barra è il tempo di meditazione del giorno (scala fino a {SCALA_MINUTI} min).
      </p>

      {settimane.map(gruppo => {
        const testa = titoloSettimana(gruppo)
        return (
          <section className="storico-settimana" key={gruppo.chiave}>
            {testa && (
              <header className="storico-settimana-testa">
                <h3>
                  <span className="storico-settimana-numero">{testa.titolo}</span>
                  {testa.tema && <span className="storico-settimana-tema"> · {testa.tema}</span>}
                </h3>
                <span className="storico-settimana-date">{intervalloSettimana(gruppo.giorni)}</span>
              </header>
            )}
            <ul className="storico-giorni">
              {gruppo.giorni.map(g => <Giornata key={g.iso} giorno={g} />)}
            </ul>
          </section>
        )
      })}

      {dataInizio && (
        <p className="storico-fine">
          Inizio del percorso · {dataInizio.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </p>
      )}
    </div>
  )
}
