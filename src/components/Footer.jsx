import { ORGANIZZAZIONE } from '../lib/contatti.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-nome">{ORGANIZZAZIONE.nome}</p>
        <p className="site-footer-desc">{ORGANIZZAZIONE.descrizione}</p>
        <p className="site-footer-indirizzo">
          {ORGANIZZAZIONE.via}
          <br />
          {ORGANIZZAZIONE.citta}
        </p>
      </div>
    </footer>
  )
}
