// Con `inline` sta dentro un pulsante o una riga di testo (span, anello più piccolo).
export default function StatoAttesa({ etichetta = 'Caricamento…', inline = false }) {
  const Tag = inline ? 'span' : 'p'
  return (
    <Tag className={`stato-attesa${inline ? ' is-inline' : ''}`} role="status" aria-live="polite">
      <span className="stato-attesa-anello" aria-hidden="true" />
      {etichetta}
    </Tag>
  )
}
