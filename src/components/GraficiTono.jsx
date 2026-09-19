import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { coloreTono, conteggioInformali, etichettaTono, etichettaVolte, serieMinutiGiornalieri } from '../lib/tono.js'
import TonoIcon from './TonoIcon.jsx'

function BarraConTono({ x, y, width, height, fill, payload, codice }) {
  if (!(width > 0) || !(height > 0)) return null
  const tono = payload?.toni?.[codice]
  const lato = Math.max(12, Math.min(18, width + 2))
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2.5" fill={fill} />
      {tono && (
        <TonoIcon
          id={tono}
          className="grafico-barra-tono"
          x={x + width / 2 - lato / 2}
          y={y - lato - 3}
          width={lato}
          height={lato}
          color={coloreTono(tono)}
        />
      )}
    </g>
  )
}

function TooltipMinuti({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const riga = payload[0]?.payload
  const voci = payload.filter(p => p.dataKey !== 'media' && typeof p.value === 'number' && p.value > 0)
  const media = riga?.media
  return (
    <div className="grafico-tip grafico-tip-sessione">
      <p className="grafico-tip-data">{label}</p>
      {voci.length === 0 ? (
        <p className="grafico-tip-vuoto">Nessuna pratica in questo giorno.</p>
      ) : (
        voci.map(p => (
          <p key={p.dataKey} className="grafico-tip-utente">
            {riga?.toni?.[p.dataKey] ? (
              <TonoIcon
                id={riga.toni[p.dataKey]}
                className="grafico-tip-tono-icona"
                color={coloreTono(riga.toni[p.dataKey])}
              />
            ) : (
              <span className="grafico-tip-punto" style={{ background: coloreTono(riga?.toni?.[p.dataKey]) }} />
            )}
            <span className="badge">{p.dataKey}</span>
            {' '}
            {p.value} min
            {riga?.toni?.[p.dataKey] ? ` · ${etichettaTono(riga.toni[p.dataKey])}` : ''}
          </p>
        ))
      )}
      {media != null && (
        <p className="grafico-tip-media">Media · {media} min</p>
      )}
    </div>
  )
}

function LegendaTono() {
  return (
    <ul className="grafico-andamento-legenda">
      <li><TonoIcon id="piacevole" className="grafico-legenda-tono" color={coloreTono('piacevole')} /> Piacevole</li>
      <li><TonoIcon id="neutro" className="grafico-legenda-tono" color={coloreTono('neutro')} /> Neutro</li>
      <li><TonoIcon id="spiacevole" className="grafico-legenda-tono" color={coloreTono('spiacevole')} /> Spiacevole</li>
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
  const larghezza = Math.max(giorni.length * Math.max(56, codici.length * 16), 280)
  const nSessioni = (sessioni || []).filter(s => String(s.tipo || '').toLowerCase() !== 'informale').length
  const minutiTotali = giorni.reduce((acc, g) => (
    acc + codici.reduce((sum, codice) => sum + (Number(g[codice]) || 0), 0)
  ), 0)

  return (
    <>
    <div className="card">
      <h3>Minuti di pratica, giorno per giorno</h3>
      <p className="disclaimer">
        Ogni barra è un codice: l’altezza sono i minuti, il colore è il tono
        registrato quel giorno. La linea nera è la media dei minuti di chi ha
        praticato. Solo codice, nessuna email.
        {ambito
          ? ` Ambito: ${ambito}.`
          : ' Apri un ciclo dalla scheda Cicli per restringere i grafici.'}
      </p>

      {giorni.length === 0 ? (
        <p>Nessuna pratica ancora registrata.</p>
      ) : (
        <>
          <p className="hint">
            {ambito ? `${ambito} · ` : ''}
            {codici.length} {codici.length === 1 ? 'codice' : 'codici'}
            {' · '}
            {nSessioni} {nSessioni === 1 ? 'sessione' : 'sessioni'}
            {' · '}
            {minutiTotali} min in tutto
          </p>
          <div className="grafico-andamento-scorri">
            <div className="grafico-box" style={{ minWidth: larghezza, height: 292 }}>
              <ResponsiveContainer width="100%" height={292}>
                <ComposedChart data={giorni} margin={{ top: 26, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#DAD9CE" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="data"
                    tick={{ fill: '#5B665F', fontSize: 11 }}
                    interval={0}
                    height={36}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#5B665F', fontSize: 11 }}
                    width={36}
                    unit=""
                  />
                  <Tooltip content={<TooltipMinuti />} />
                  {codici.map(codice => (
                    <Bar
                      key={codice}
                      dataKey={codice}
                      name={codice}
                      maxBarSize={22}
                      isAnimationActive={false}
                      shape={props => <BarraConTono {...props} codice={codice} />}
                    >
                      {giorni.map((g, i) => (
                        <Cell
                          key={`${codice}-${g.iso}-${i}`}
                          fill={coloreTono(g.toni?.[codice])}
                        />
                      ))}
                    </Bar>
                  ))}
                  <Line
                    type="monotone"
                    dataKey="media"
                    name="Media"
                    stroke="#24312C"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#24312C', stroke: '#FBFAF6', strokeWidth: 1.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
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
