export default function IdentitaCodice({ codice, variante = 'compatta' }) {
  const testo = String(codice || '').trim().toUpperCase()
  if (!testo) return null

  if (variante === 'riga') {
    return (
      <p className="meta-riga">
        <span className="badge">Partecipante</span>
        <span className="esito-meta-codice">{testo}</span>
      </p>
    )
  }

  return (
    <p className="identita-codice" title={testo} aria-label={`Codice partecipante ${testo}`}>
      <span className="identita-codice-valore">{testo}</span>
      <span className="identita-codice-label">Codice</span>
    </p>
  )
}
