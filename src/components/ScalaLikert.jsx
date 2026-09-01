import { LIKERT } from '../lib/scoring'

export default function ScalaLikert({ item, valore, onChange, disabilitato }) {
  const opzioni = LIKERT[item.scala] || []

  return (
    <fieldset className="item-block item-singola">
      <legend>{item.testo}</legend>
      <div className="likert-btns" role="radiogroup" aria-label="Scala di risposta">
        {opzioni.map(o => (
          <button
            key={o.valore}
            type="button"
            role="radio"
            aria-checked={valore === o.valore}
            className={`likert-btn${valore === o.valore ? ' is-on' : ''}`}
            disabled={disabilitato}
            onClick={() => onChange(item.id, o.valore)}
          >
            <span className="likert-num">{o.valore}</span>
            <span className="likert-lab">{o.etichetta}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
