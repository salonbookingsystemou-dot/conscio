import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts'
import { ASSE_GRAFICO, COLORI, COLORI_STRUMENTO } from '../../../lib/colori.js'
import { calcolaKpi, esportaAggregati } from '../../../lib/cicli.js'

// Metadata per la lettura intuitiva dei questionari (nessuna interpretazione clinica).
const INFO_STRUMENTO = {
  'PSS-10': { sottotitolo: 'stress percepito', verso: 'Più a destra = più stress percepito', colore: COLORI_STRUMENTO['PSS-10'] },
  'FFMQ-I': { sottotitolo: 'consapevolezza', verso: 'Più a destra = più consapevolezza', colore: COLORI_STRUMENTO['FFMQ-I'] }
}

const FFMQ_SOTTOSCALE_INFO = [
  { chiave: 'osservare', label: 'Osservare' },
  { chiave: 'descrivere', label: 'Descrivere' },
  { chiave: 'agire_con_consapevolezza', label: 'Agire con consapevolezza' },
  { chiave: 'non_giudicare', label: 'Non giudicare' },
  { chiave: 'non_reagire', label: 'Non reagire' }
]

const ORDINE_TP = { T0: 0, T1: 1, T2: 2, T3: 3 }

function percentoNelRange(valore, min, max) {
  if (![valore, min, max].every(Number.isFinite) || max <= min) return 0
  return Math.max(0, Math.min(100, Math.round(((valore - min) / (max - min)) * 100)))
}

const COLORE_SINGOLO = COLORI_STRUMENTO.singolo
const PASSI_ZOOM = 4

// Al passo massimo la scala stringe attorno ai valori registrati, senza mai tagliarne uno.
function dominioZoom({ min, max, codici, dati }, passo) {
  const valori = dati.flatMap(riga => codici.map(c => riga[c]).filter(Number.isFinite))
  if (passo === 0 || valori.length === 0) return [min, max]
  const margine = Math.max(1, Math.round((max - min) * 0.05))
  const basso = Math.max(min, Math.min(...valori) - margine)
  const alto = Math.min(max, Math.max(...valori) + margine)
  const t = passo / PASSI_ZOOM
  return [Math.floor(min + (basso - min) * t), Math.ceil(max - (max - alto) * t)]
}

function taccheDominio([da, a]) {
  const passo = Math.max(1, Math.ceil((a - da) / 4))
  const tacche = []
  for (let v = da; v < a; v += passo) tacche.push(v)
  tacche.push(a)
  return tacche
}

// Traiettorie individuali (linee sottili) + media in evidenza, per un singolo strumento.
function GraficoStrumento({ strumento }) {
  const { nome, min, max, codici, dati, colore } = strumento
  const info = INFO_STRUMENTO[nome] || {}
  const [zoom, setZoom] = useState(0)
  const dominio = useMemo(() => dominioZoom(strumento, zoom), [strumento, zoom])
  const ticks = zoom === 0 ? [min, Math.round((min + max) / 2), max] : taccheDominio(dominio)
  return (
    <div className="dash-q-strumento-grafico">
      <div className="dash-q-strumento-testa">
        <span className="dash-q-nome">{nome}</span>
        {info.sottotitolo && <span className="dash-q-sub">· {info.sottotitolo}</span>}
        <div className="dash-q-zoom" role="group" aria-label={`Zoom sulla scala di ${nome}`}>
          <button
            type="button"
            aria-label="Riduci zoom"
            disabled={zoom === 0}
            onClick={() => setZoom(z => Math.max(0, z - 1))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Aumenta zoom"
            disabled={zoom === PASSI_ZOOM}
            onClick={() => setZoom(z => Math.min(PASSI_ZOOM, z + 1))}
          >
            +
          </button>
          {zoom > 0 && (
            <button type="button" className="dash-q-zoom-reset" onClick={() => setZoom(0)}>
              Scala intera
            </button>
          )}
        </div>
      </div>
      <div className="grafico-box">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dati} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={ASSE_GRAFICO.griglia} strokeDasharray="3 3" />
            <XAxis dataKey="timepoint" tick={{ fill: ASSE_GRAFICO.testo, fontSize: 12 }} />
            <YAxis
              domain={dominio}
              ticks={ticks}
              allowDataOverflow
              tick={{ fill: ASSE_GRAFICO.testo, fontSize: ASSE_GRAFICO.fontSize }}
              width={38}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {codici.map(c => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                name={c}
                stroke={COLORE_SINGOLO}
                strokeWidth={1.5}
                dot={{ r: 3, fill: COLORE_SINGOLO }}
                legendType="none"
                connectNulls
              />
            ))}
            <Line
              type="monotone"
              dataKey="__media"
              name="Media"
              stroke={colore}
              strokeWidth={2.8}
              dot={{ r: 4, fill: colore }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="dash-q-verso">
        Linee sottili = singoli partecipanti; linea in evidenza = media. {info.verso}
        {zoom > 0 && ` · Scala ingrandita: ${dominio[0]}–${dominio[1]} (range completo ${min}–${max}).`}
      </p>
    </div>
  )
}

// Barra orizzontale min→max con un pallino per ogni timepoint compilato.
function BarraRange({ min, max, marker }) {
  return (
    <div className="q-scala">
      <span className="q-scala-cap">{min}</span>
      <div className="q-track">
        {marker.map(m => (
          <span
            key={m.etichetta}
            className="q-marker"
            style={{ left: `${m.percento}%` }}
            title={`${m.etichetta}: ${m.valore} su ${max}`}
          >
            <span className="q-marker-tp">{m.etichetta}</span>
          </span>
        ))}
      </div>
      <span className="q-scala-cap">{max}</span>
    </div>
  )
}

function SchedaCodice({ part }) {
  const sintesi = part.strumenti
    .map(str => {
      const valide = str.righe.filter(r => r.punteggio?.totale != null)
      const ultimo = valide[valide.length - 1]
      if (!ultimo) return null
      const nome = str.nome === 'FFMQ-I' ? 'FFMQ' : str.nome
      return `${nome} ${ultimo.punteggio.totale}/${ultimo.punteggio.max ?? '—'}`
    })
    .filter(Boolean)
  return (
    <details className="card dash-q-card">
      <summary className="dash-q-testa">
        <span className="badge">{part.codice}</span>
        {sintesi.length > 0 && <span className="dash-q-sintesi">{sintesi.join(' · ')}</span>}
        <span className="dash-q-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="dash-q-corpo">
        {part.strumenti.map(str => {
          const info = INFO_STRUMENTO[str.nome] || {}
          const righeValide = str.righe.filter(r => r.punteggio?.totale != null)
          const base = righeValide[0]?.punteggio
          const min = base?.min ?? 0
          const max = base?.max ?? 100
          const marker = righeValide.map(r => ({
            etichetta: r.timepoint,
            valore: r.punteggio.totale,
            percento: r.punteggio.orientamento?.percento ?? percentoNelRange(r.punteggio.totale, min, max)
          }))
          const ffmqUltimo = str.nome === 'FFMQ-I'
            ? [...righeValide].reverse().find(r => r.punteggio?.orientamentiSottoscale)
            : null
          return (
            <div key={str.nome} className="dash-q-strumento">
              <div className="dash-q-strumento-testa">
                <span className="dash-q-nome">{str.nome}</span>
                {info.sottotitolo && <span className="dash-q-sub">· {info.sottotitolo}</span>}
              </div>
              {marker.length > 0 ? (
                <>
                  <BarraRange min={min} max={max} marker={marker} />
                  <div className="dash-q-valori">
                    {marker.map(m => (
                      <span key={m.etichetta} className="dash-q-valore">
                        <strong>{m.etichetta}</strong> {m.valore}
                        <span className="dash-q-frazione">/{max}</span>
                      </span>
                    ))}
                  </div>
                  {info.verso && <p className="dash-q-verso">{info.verso}</p>}
                  {ffmqUltimo && (
                    <div className="dash-q-sottoscale">
                      <p className="dash-q-sottoscale-tit">Sottoscale ({ffmqUltimo.timepoint})</p>
                      {FFMQ_SOTTOSCALE_INFO.map(s => {
                        const valore = ffmqUltimo.punteggio[s.chiave]
                        const or = ffmqUltimo.punteggio.orientamentiSottoscale?.[s.chiave]
                        if (valore == null) return null
                        return (
                          <div key={s.chiave} className="dash-q-sottoscala">
                            <span className="dash-q-sottoscala-nome">{s.label}</span>
                            <div className="q-track q-track-sm">
                              <span
                                className="q-marker"
                                style={{ left: `${or?.percento ?? 0}%` }}
                                title={`${s.label}: ${valore}`}
                              />
                            </div>
                            <span className="dash-q-sottoscala-val">{valore}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="hint">Compilazione incompleta.</p>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}

export default function Questionari() {
  const { ciclo, cicli, iscrizioni, tutteIscrizioni, punteggi, log } = useOutletContext()
  const [search, setSearch] = useSearchParams()
  const tutti = search.get('tutti') === '1'

  const codiciCiclo = useMemo(
    () => new Set(iscrizioni.map(i => i.utenti?.codice_partecipante).filter(Boolean)),
    [iscrizioni]
  )
  const punteggiVista = useMemo(
    () => (tutti ? punteggi : punteggi.filter(p => codiciCiclo.has(p.codice))),
    [punteggi, tutti, codiciCiclo]
  )

  // Raggruppa per codice → strumento → timepoint (ordinati), per la vista a schede.
  const raggruppati = useMemo(() => {
    const perCodice = new Map()
    for (const p of punteggiVista) {
      if (!perCodice.has(p.codice)) perCodice.set(p.codice, new Map())
      const strumenti = perCodice.get(p.codice)
      if (!strumenti.has(p.questionario)) strumenti.set(p.questionario, [])
      strumenti.get(p.questionario).push(p)
    }
    return [...perCodice.entries()].map(([codice, strumenti]) => ({
      codice,
      strumenti: [...strumenti.entries()].map(([nome, righe]) => ({
        nome,
        righe: righe.slice().sort((a, b) => (ORDINE_TP[a.timepoint] ?? 9) - (ORDINE_TP[b.timepoint] ?? 9))
      }))
    }))
  }, [punteggiVista])

  // Traiettorie individuali per strumento (punteggi grezzi sul range dello strumento).
  const andamento = useMemo(() => {
    const perStrumento = new Map()
    for (const p of punteggiVista) {
      const tot = p.punteggio?.totale
      if (!Number.isFinite(tot)) continue
      if (!perStrumento.has(p.questionario)) {
        perStrumento.set(p.questionario, {
          nome: p.questionario,
          min: p.punteggio?.min ?? 0,
          max: p.punteggio?.max ?? 100,
          codici: new Set(),
          perTp: new Map()
        })
      }
      const s = perStrumento.get(p.questionario)
      s.codici.add(p.codice)
      if (!s.perTp.has(p.timepoint)) s.perTp.set(p.timepoint, new Map())
      s.perTp.get(p.timepoint).set(p.codice, tot)
    }
    return [...perStrumento.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(s => {
        const codici = [...s.codici].sort()
        const dati = [...s.perTp.entries()]
          .sort((a, b) => (ORDINE_TP[a[0]] ?? 9) - (ORDINE_TP[b[0]] ?? 9))
          .map(([timepoint, perCodice]) => {
            const riga = { timepoint }
            let somma = 0
            let n = 0
            for (const c of codici) {
              if (perCodice.has(c)) {
                riga[c] = perCodice.get(c)
                somma += perCodice.get(c)
                n += 1
              }
            }
            riga.__media = n ? Math.round((somma / n) * 10) / 10 : null
            riga.__n = n
            return riga
          })
        return { ...s, codici, dati, colore: INFO_STRUMENTO[s.nome]?.colore || COLORI.moss }
      })
  }, [punteggiVista])

  function esporta() {
    const logVista = tutti ? log : log.filter(l => codiciCiclo.has(l.codice_partecipante))
    esportaAggregati({
      ciclo: tutti ? null : ciclo,
      kpi: calcolaKpi(tutti ? tutteIscrizioni : iscrizioni, cicli, punteggiVista),
      punteggi: punteggiVista,
      logN: logVista.length
    })
  }

  function cambiaVista(tuttiICicli) {
    const prossima = new URLSearchParams(search)
    if (tuttiICicli) prossima.set('tutti', '1')
    else prossima.delete('tutti')
    setSearch(prossima, { replace: true })
  }

  return (
    <>
      <header className="dash-panel-testa">
        <div>
          <h2>Questionari</h2>
          <p className="lead">
            Totali grezzi per codice, senza interpretazione clinica.
            {tutti ? ' Tutti i cicli insieme.' : ` Solo «${ciclo.nome_ciclo}».`}
          </p>
        </div>
        <div className="dash-panel-azioni">
          <label className="vetrina-spunta">
            <input type="checkbox" checked={tutti} onChange={e => cambiaVista(e.target.checked)} />
            <span>Tutti i cicli</span>
          </label>
          <button className="btn btn-ghost" type="button" onClick={esporta}>Esporta aggregati</button>
        </div>
      </header>

      {raggruppati.length === 0 && (
        <div className="card">
          <p>
            {tutti
              ? 'Nessuna compilazione ancora registrata.'
              : 'Nessuna compilazione ancora registrata in questo ciclo.'}
          </p>
        </div>
      )}

      {andamento.length > 0 && (
        <div className="card dash-q-gruppo">
          <div className="dash-q-strumento-testa">
            <span className="dash-q-nome">Andamento del gruppo</span>
            <span className="dash-q-sub">· traiettorie individuali e media, per strumento</span>
          </div>
          {andamento.map(s => (
            <GraficoStrumento key={s.nome} strumento={s} />
          ))}
        </div>
      )}

      <div className="dash-q-lista">
        {raggruppati.map(part => <SchedaCodice key={part.codice} part={part} />)}
      </div>

      <p className="dash-nota-privacy">
        Le risposte ai questionari sono consultabili solo in forma aggregata e per codice
        partecipante. Nessuna schermata associa un codice a un nome.
      </p>
    </>
  )
}
