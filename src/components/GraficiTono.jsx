import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { riepilogoTonoPerCodice, serieTonoGiornaliera } from '../lib/tono.js'

const COLORI = {
  media: '#24312C',
  prima: '#A8763E',
  piacevole: '#4B6B57',
  neutro: '#8A8F88',
  spiacevole: '#A8763E'
}

function etichettaAsse(v) {
  if (v === 1) return 'Piacevole'
  if (v === 0) return 'Neutro'
  if (v === -1) return 'Spiacevole'
  return ''
}

function TooltipTono({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="grafico-tip">
      <p>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey}>
          {p.name}: {typeof p.value === 'number' ? p.value : '—'}
        </p>
      ))}
    </div>
  )
}

function GraficoLinea({ dati, linee }) {
  return (
    <div className="grafico-box">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={dati} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#DAD9CE" strokeDasharray="3 3" />
          <XAxis dataKey="data" tick={{ fill: '#5B665F', fontSize: 12 }} />
          <YAxis
            domain={[-1, 1]}
            ticks={[-1, 0, 1]}
            tickFormatter={etichettaAsse}
            tick={{ fill: '#5B665F', fontSize: 11 }}
            width={78}
          />
          <Tooltip content={<TooltipTono />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {linee.map(l => (
            <Line
              key={l.dataKey}
              type="monotone"
              dataKey={l.dataKey}
              name={l.name}
              stroke={l.stroke}
              strokeWidth={2.2}
              strokeDasharray={l.tratteggio}
              dot={{ r: 4, fill: l.stroke }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function GraficiTono({ sessioni, ambito }) {
  const [codice, setCodice] = useState('')
  const gruppo = useMemo(() => serieTonoGiornaliera(sessioni, 'tono_dopo'), [sessioni])
  const persone = useMemo(() => riepilogoTonoPerCodice(sessioni, 'tono_dopo'), [sessioni])
  const delCodice = useMemo(
    () => sessioni.filter(s => s.codice_partecipante === codice),
    [sessioni, codice]
  )
  const singoloDopo = useMemo(() => serieTonoGiornaliera(delCodice, 'tono_dopo'), [delCodice])
  const singoloPrima = useMemo(() => serieTonoGiornaliera(delCodice, 'tono_prima'), [delCodice])

  const singoloUnito = useMemo(() => {
    const mappa = new Map()
    for (const g of singoloDopo) {
      mappa.set(g.iso, { iso: g.iso, data: g.data, dopo: g.media })
    }
    for (const g of singoloPrima) {
      const prev = mappa.get(g.iso) || { iso: g.iso, data: g.data }
      prev.prima = g.media
      mappa.set(g.iso, prev)
    }
    return [...mappa.values()].sort((a, b) => a.iso.localeCompare(b.iso))
  }, [singoloDopo, singoloPrima])

  useEffect(() => {
    if (!codice && persone[0]) setCodice(persone[0].codice)
    if (codice && persone.length && !persone.some(p => p.codice === codice)) {
      setCodice(persone[0].codice)
    }
  }, [codice, persone])

  const nGruppo = gruppo.reduce((acc, g) => acc + g.n, 0)
  const mediaGruppo = nGruppo
    ? Math.round((gruppo.reduce((acc, g) => acc + g.somma, 0) / nGruppo) * 100) / 100
    : null

  return (
    <div className="card">
      <h3>Andamento del tono (solo codice)</h3>
      <p className="disclaimer">
        Scala del tono: spiacevole −1, neutro 0, piacevole +1. Media giornaliera del
        «dopo». Numeri grezzi, senza interpretazione clinica. Nessuna email.
        {ambito
          ? ` Ambito: ${ambito}.`
          : ' Apri un ciclo sopra per restringere i grafici a quei codici.'}
      </p>

      {gruppo.length === 0 ? (
        <p>Nessun tono ancora registrato.</p>
      ) : (
        <>
          <p className="hint">
            {ambito ? `${ambito} · ` : ''}
            Gruppo · {nGruppo} {nGruppo === 1 ? 'osservazione' : 'osservazioni'}
            {mediaGruppo != null && ` · media ${mediaGruppo}`}
          </p>
          <h4 className="grafico-titolo">Gruppo — media del tono dopo</h4>
          <GraficoLinea
            dati={gruppo}
            linee={[{ dataKey: 'media', name: 'Media gruppo', stroke: COLORI.media }]}
          />
          <h4 className="grafico-titolo">Gruppo — composizione per giorno</h4>
          <div className="grafico-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gruppo} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#DAD9CE" strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fill: '#5B665F', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#5B665F', fontSize: 12 }} width={28} />
                <Tooltip content={<TooltipTono />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="spiacevole" name="Spiacevole" stackId="t" fill={COLORI.spiacevole} />
                <Bar dataKey="neutro" name="Neutro" stackId="t" fill={COLORI.neutro} />
                <Bar dataKey="piacevole" name="Piacevole" stackId="t" fill={COLORI.piacevole} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {persone.length > 0 && (
            <div className="riepilogo-tono">
              {persone.map(p => (
                <p key={p.codice}>
                  <span className="badge">{p.codice}</span>
                  {' '}media {p.media} · n {p.n}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {persone.length > 0 && (
        <>
          <h4 className="grafico-titolo">Singolo partecipante</h4>
          <div className="chip-riga" style={{ marginBottom: 12 }}>
            {persone.map(p => (
              <button
                key={p.codice}
                type="button"
                className={`chip${codice === p.codice ? ' is-on' : ''}`}
                onClick={() => setCodice(p.codice)}
              >
                {p.codice}
              </button>
            ))}
          </div>
          {singoloUnito.length === 0 ? (
            <p>Nessun tono per questo codice.</p>
          ) : (
            <GraficoLinea
              dati={singoloUnito}
              linee={[
                { dataKey: 'dopo', name: 'Dopo', stroke: COLORI.media },
                ...(singoloPrima.length
                  ? [{ dataKey: 'prima', name: 'All’inizio', stroke: COLORI.prima, tratteggio: '5 4' }]
                  : [])
              ]}
            />
          )}
        </>
      )}
    </div>
  )
}
