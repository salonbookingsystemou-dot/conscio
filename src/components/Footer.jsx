import { Link } from 'react-router-dom'
import { ORGANIZZAZIONE } from '../lib/contatti.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <p className="site-footer-nome">
        <a
          href={ORGANIZZAZIONE.sito}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ORGANIZZAZIONE.nome}
        </a>
        <span aria-hidden="true"> · </span>
        <Link to="/segnala">Segnala un problema</Link>
      </p>
    </footer>
  )
}
