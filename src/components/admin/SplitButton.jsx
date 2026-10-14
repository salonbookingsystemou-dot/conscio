import { IconaGiu } from './IconeAdmin.jsx'
import MenuAzioni from './MenuAzioni.jsx'

/** Pulsante tonale diviso: azione principale + freccia che apre le varianti. */
export default function SplitButton({ etichetta, onClick, opzioni, disabled = false, etichettaMenu }) {
  return (
    <div className="split-button" role="group" aria-label={etichetta}>
      <button type="button" className="btn btn-tonal split-button-azione" onClick={onClick} disabled={disabled}>
        {etichetta}
      </button>
      <MenuAzioni
        voci={opzioni}
        renderPulsante={props => (
          <button
            type="button"
            className="btn btn-tonal split-button-freccia"
            aria-label={etichettaMenu || `Altre opzioni: ${etichetta}`}
            disabled={disabled}
            {...props}
          >
            <IconaGiu />
          </button>
        )}
      />
    </div>
  )
}
