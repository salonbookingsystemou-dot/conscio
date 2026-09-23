import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts'
import { coloreTono, contaSessioni, conteggioInformali, etichettaVolte, serieMinutiGiornalieri } from '../lib/tono.js'
import TonoIcon from './TonoIcon.jsx'

const RAGGIO = 13
const SPOSTA = 18
const ALTEZZA = 300
const LARGHEZZA_ASSE = 36
const ALTEZZA_ASSE_X = 36
const MARGINE = { top: 18, bottom: 4 }

function dominioMinuti(giorni, codici) {
  let max = 0
  for (const giorno of giorni) {
    if (Number.isFinite(giorno.media)) max = Math.max(max, giorno.media)
    for (const codice of codici) max = Math.max(max, Number(giorno[codice]) || 0)
  }
  if (max <= 0) return [0, 5]
  const passo = max <= 20 ? 5 : max <= 50 ? 10 : max <= 120 ? 20 : 50
  return [0, Math.ceil(max / passo) * passo]
}

function taccheMinuti([min, max]) {
  const passo = max <= 20 ? 5 : max <= 50 ? 10 : max <= 120 ? 20 : 50
  const tacche = []
  for (let valore = min; valore <= max; valore += passo) tacche.push(valore)
  return tacche
}

function TickGiorno({ x, y, payload }) {
  const testo = payload?.value
  if (!testo || /[\u200b\u200c]/.test(testo)) return null
  return (
    <text x={x} y={y} dy={14} textAnchor="middle" fill="#5B665F" fontSize={11}>
      {testo}
    </text>
  )
}

function CerchioTono({ cx, cy, payload, codice }) {
  const minuti = payload?.[codice]
  if (cx == null || cy == null || !(minuti > 0)) return null
  const tono = payload?.toni?.[codice]
  const presenti = Object.keys(payload?.toni || {}).filter(c => payload[c] > 0)
  const indice = Math.max(0, presenti.indexOf(codice))
  const x = cx + (indice - (presenti.length - 1) / 2) * SPOSTA
  const lato = RAGGIO * 2
  return (
    <g className="grafico-cerchio-tono">
      <TonoIcon
        id={tono}
        className="grafico-cerchio-volto"
        x={x - lato / 2}
        y={cy - lato / 2}
        width={lato}
        height={lato}
        color={coloreTono(tono)}
        pieno
      />
    </g>
  )
}

function LegendaTono() {
  return (
    <ul className="grafico-andamento-legenda">
      <li><TonoIcon id="piacevole" className="grafico-legenda-tono" color={coloreTono('piacevole')} pieno /> Piacevole</li>
      <li><TonoIcon id="neutro" className="grafico-legenda-tono" color={coloreTono('neutro')} pieno /> Neutro</li>
      <li><TonoIcon id="spiacevole" className="grafico-legenda-tono" color={coloreTono('spiacevole')} pieno /> Spiacevole</li>
      <li><span className="is-sconosciuto" /> Senza tono</li>
      <li><span className="is-media" /> Media del giorno</li>
    </ul>
  )
}

function ConteggioInformali({ sessioni, ambito }) {
  const gruppi = useMemo(() => conteggioInformali(sessioni), [sessioni])
  const totale = gruppi.reduce((acc, g) => acc + g.totale, 0)

  return (
    <div className="card">
      <h3>Pratiche informali, per volte</h3>
      <p className="disclaimer">
        Ogni spunta conta una volta, non minuti. Solo codice, nessuna email.
        {ambito
          ? ` Ambito: ${ambito}.`
          : ' Apri un ciclo dalla scheda Cicli per restringere i conteggi.'}
      </p>
      {gruppi.length === 0 ? (
        <p>Nessuna pratica informale ancora spuntata.</p>
      ) : (
        <>
          <p className="hint">
            {ambito ? `${ambito} · ` : ''}
            {gruppi.length} {gruppi.length === 1 ? 'codice' : 'codici'}
            {' · '}
            {etichettaVolte(totale)} in tutto
          </p>
          <div className="conteggio-informali">
            {gruppi.map(gruppo => (
              <section key={gruppo.codice} className="conteggio-informali-gruppo">
                <h4>
                  <span className="badge">{gruppo.codice}</span>
                </h4>
                <ul>
                  {gruppo.pratiche.map(p => (
                    <li key={p.nome}>
                      <span className="conteggio-informali-nome">«{p.nome}»</span>
                      <span className="conteggio-informali-n">{etichettaVolte(p.n)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function GraficiTono({ sessioni, ambito }) {
  const { giorni, codici } = useMemo(() => serieMinutiGiornalieri(sessioni), [sessioni])
  const giorniAsse = useMemo(() => {
    if (giorni.length === 0) return giorni
    const vuoto = { iso: '', media: null, toni: {}, informali: {} }
    return [{ ...vuoto, data: '\u200b' }, ...giorni, { ...vuoto, data: '\u200c' }]
  }, [giorni])
  const passo = Math.max(72, codici.length * 18)
  const larghezza = Math.max(giorniAsse.length * passo, 280)
  const dominio = useMemo(() => dominioMinuti(giorni, codici), [giorni, codici])
  const tacche = useMemo(() => taccheMinuti(dominio), [dominio])
  const nSessioni = contaSessioni(sessioni)
  const minutiTotali = giorni.reduce((acc, g) => (
    acc + codici.reduce((sum, codice) => sum + (Number(g[codice]) || 0), 0)
  ), 0)

  return (
    <>
    <div className="card">
      <h3>Minuti di pratica, giorno per giorno</h3>
      <p className="disclaimer">
        Ogni cerchio è un codice: l’altezza sono i minuti, il colore è il tono
        e la faccina sta dentro se è stato registrato. La linea nera è la media
        dei minuti di chi ha praticato. Solo codice, nessuna email.
        {ambito
          ? ` Ambito: ${ambito}.`
          : ' Apri un ciclo dalla scheda Cicli per restringere i grafici.'}
      </p>

      {giorni.length === 0 ? (
        <p>Nessuna pratica ancora registrata.</p>
      ) : (
        <>
          <ul className="grafico-stats">
            <li>
              <span className="grafico-stats-etichetta">{codici.length === 1 ? 'Praticante' : 'Praticanti'}</span>
              <strong className="grafico-stats-valore">{codici.length}</strong>
            </li>
            <li>
              <span className="grafico-stats-etichetta">{nSessioni === 1 ? 'Sessione' : 'Sessioni'}</span>
              <strong className="grafico-stats-valore">{nSessioni}</strong>
            </li>
            <li>
              <span className="grafico-stats-etichetta">Minuti totali</span>
              <strong className="grafico-stats-valore">{minutiTotali}</strong>
            </li>
          </ul>
          <div className="grafico-con-asse">
            <div className="grafico-asse-y" style={{ width: LARGHEZZA_ASSE + 1, height: ALTEZZA }} aria-hidden="true">
              <ComposedChart
                width={160}
                height={ALTEZZA}
                data={giorniAsse}
                margin={{ top: MARGINE.top, right: 0, left: 0, bottom: MARGINE.bottom }}
              >
                <XAxis dataKey="data" height={ALTEZZA_ASSE_X} tick={false} axisLine={false} tickLine={false} />
                <YAxis
                  domain={dominio}
                  ticks={tacche}
                  allowDecimals={false}
                  tick={{ fill: '#5B665F', fontSize: 11 }}
                  width={LARGHEZZA_ASSE}
                />
                <Line dataKey="media" stroke="none" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
              </ComposedChart>
            </div>
            <div className="grafico-andamento-scorri">
            <div className="grafico-box" style={{ minWidth: larghezza, height: ALTEZZA }}>
              <ResponsiveContainer width="100%" height={ALTEZZA}>
                <ComposedChart data={giorniAsse} margin={{ top: MARGINE.top, right: 20, left: 0, bottom: MARGINE.bottom }}>
                  <CartesianGrid stroke="#DAD9CE" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="data"
                    tick={TickGiorno}
                    interval={0}
                    height={ALTEZZA_ASSE_X}
                  />
                  <YAxis
                    hide
                    width={0}
                    domain={dominio}
                    ticks={tacche}
                    allowDecimals={false}
                  />
                  {codici.map(codice => (
                    <Line
                      key={codice}
                      dataKey={codice}
                      name={codice}
                      stroke="none"
                      strokeWidth={0}
                      legendType="none"
                      dot={props => <CerchioTono {...props} codice={codice} />}
                      activeDot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="media"
                    name="Media"
                    stroke="#24312C"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#24312C', stroke: '#FBFAF6', strokeWidth: 1.5 }}
                    activeDot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            </div>
          </div>
          <LegendaTono />
        </>
      )}
    </div>
    <ConteggioInformali sessioni={sessioni} ambito={ambito} />
    </>
  )
}
