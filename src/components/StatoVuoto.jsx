export default function StatoVuoto({ titolo, children }) {
  return (
    <div className="stato-vuoto" role="status">
      {titolo && <p className="stato-vuoto-titolo">{titolo}</p>}
      {children && <p className="stato-vuoto-testo">{children}</p>}
    </div>
  )
}
