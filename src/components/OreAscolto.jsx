import { formattaOreAscolto } from '../lib/oreAscolto.js'

export default function OreAscolto({ minuti }) {
  const testo = formattaOreAscolto(minuti)
  return (
    <p
      className="ore-ascolto"
      aria-label={`${testo} di pratica`}
    >
      <span className="ore-ascolto-valore">{testo}</span>
      <span className="ore-ascolto-label">Pratica</span>
    </p>
  )
}
