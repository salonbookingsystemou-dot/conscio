import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { etichettaTono, serieSessioniTono } from '../lib/tono.js'

const COLORI = {
  linea: '#4B6B57',
  spiacevole: '#A8763E',
  neutro: '#8A8F88',
  piacevole: '#4B6B57'
}

function etichettaAsse(v) {
  if (v === 1) return 'Piacevole'
  if (v === 0) return 'Neutro'
  if (v === -1) return 'Spiacevole'
  return ''
}

function PuntoTono({ cx, cy, payload }) {
  if (cx == null || cy == null || !payload) return null
  const fill = COLORI[payload.tono] || COLORI.linea
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill={fill}
      stroke="#FBFAF6"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
    />
  )
}

function TooltipSessione({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="grafico-tip grafico-tip-sessione">
      <p className="grafico-tip-data">
        {new Date(`${p.iso}T12:00:00`).toLocaleDateString('it-IT', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })}
        {p.minuti ? ` · ${p.minuti} min` : ''}
      </p>
      <p className="grafico-tip-meta">
        {p.tipo}
        {p.settimana ? ` · settimana ${p.settimana}` : ''}
      </p>
      <p className="grafico-tip-tono">
        {etichettaTono(p.tono)}
        <span> · {p.momento}</span>
      </p>
      {p.nota
        ? <p className="grafico-tip-nota">{p.nota}</p>
        : <p className="grafico-tip-vuoto">Nessuna nota in questa sessione.</p>}
    </div>
  )
}

export default function GraficoAndamentoPratica({ sessioni }) {
  const dati = useMemo(() => serieSessioniTono(sessioni), [sessioni])
  const larghezza = Math.max(dati.length * 72, 280)

  if (dati.length === 0) {
    return (
      <p className="hint">
        Quando chiudi una pratica indicando come ti senti, qui compare l’andamento
        nel tempo. Tocca un punto per leggere la nota.
      </p>
    )
  }

  return (
    <div className="grafico-andamento">
      <p className="hint">
        Ogni punto è una sessione. Scorri in orizzontale e tocca un punto per la nota.
      </p>
      <div className="grafico-andamento-scorri">
        <div className="grafico-box" style={{ minWidth: larghezza, height: 248 }}>
          <ResponsiveContainer width="100%" height={248}>
            <LineChart data={dati} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid stroke="#DAD9CE" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="etichetta"
                tick={{ fill: '#5B665F', fontSize: 11 }}
                interval={0}
                height={36}
              />
              <YAxis
                domain={[-1.15, 1.15]}
                ticks={[-1, 0, 1]}
                tickFormatter={etichettaAsse}
                tick={{ fill: '#5B665F', fontSize: 11 }}
                width={78}
              />
              <Tooltip
                trigger="click"
                cursor={{ stroke: '#4B6B57', strokeDasharray: '4 4' }}
                content={<TooltipSessione />}
              />
              <Line
                type="monotone"
                dataKey="valore"
                stroke={COLORI.linea}
                strokeWidth={2.2}
                connectNulls
                isAnimationActive={false}
                dot={<PuntoTono />}
                activeDot={{ r: 9, stroke: '#FBFAF6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="grafico-andamento-legenda" aria-hidden="true">
        <li><span className="is-piacevole" /> Piacevole</li>
        <li><span className="is-neutro" /> Neutro</li>
        <li><span className="is-spiacevole" /> Spiacevole</li>
      </ul>
    </div>
  )
}
