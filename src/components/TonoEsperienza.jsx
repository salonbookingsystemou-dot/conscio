import { useId } from 'react'
import { TONI } from '../lib/tono.js'
import TonoIcon from './TonoIcon.jsx'

export default function TonoEsperienza({
  label,
  value,
  onChange,
  hint
}) {
  const titoloId = useId()
  return (
    <div className="field tono-campo">
      <p className="tono-label" id={titoloId}>{label}</p>
      <div className="tono-riga" role="radiogroup" aria-labelledby={titoloId}>
        {TONI.map(t => {
          const on = value === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`tono-scelta is-${t.id}${on ? ' is-on' : ''}`}
              onClick={() => onChange(on ? '' : t.id)}
            >
              <TonoIcon id={t.id} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
