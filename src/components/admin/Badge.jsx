// Stato a pillola con il punto colorato (classi .controllo-stato in styles/admin.css).
// tono: 'ok' | 'attenzione' | 'errore'
export default function Badge({ tono, children }) {
  return (
    <span className={`controllo-stato is-${tono}`}>
      <span className="controllo-stato-punto" aria-hidden="true" />
      {children}
    </span>
  )
}
