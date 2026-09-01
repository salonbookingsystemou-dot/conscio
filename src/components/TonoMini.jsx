import { testoTonoRiga } from '../lib/tono.js'
import TonoIcon from './TonoIcon.jsx'

export default function TonoMini({ riga }) {
  const testo = testoTonoRiga(riga)
  if (!testo) return null
  const id = riga.tono_dopo || riga.tono_prima
  return (
    <span className={`tono-mini is-${id}`}>
      <TonoIcon id={id} className="tono-mini-segno" />
      {testo}
    </span>
  )
}
