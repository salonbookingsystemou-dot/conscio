export default function StatoAttesa({ etichetta = 'Caricamento…' }) {
  return (
    <p className="stato-attesa" role="status" aria-live="polite">
      <span className="stato-attesa-anello" aria-hidden="true" />
      {etichetta}
    </p>
  )
}
