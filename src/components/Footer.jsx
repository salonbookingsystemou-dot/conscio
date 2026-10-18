import { Link } from 'react-router-dom'
import { SITO_HANUMAN } from '../lib/contatti.js'
import Marchio from './Marchio.jsx'

function IconaBug() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.9 1.9M16 2l-1.9 1.9" />
      <path d="M9 7.1V6a3 3 0 0 1 6 0v1.1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9M6.5 9C4.6 8.8 3 7.2 3 5.2M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  )
}

// Stessa firma delle email ai partecipanti (supabase/functions/_shared/firmaEmail.ts).
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-firma">
        <Marchio variante="orizzontale" altezza={28} />
        <p>
          Conscio è un progetto dell’Associazione ADS Hanuman, Via San Leonardo 14, Ariano Irpino (AV) —{' '}
          <a href={SITO_HANUMAN} target="_blank" rel="noopener noreferrer">hanumanstudio.it</a>
          {' '}— tutti i diritti sono riservati
        </p>
      </div>
      <p className="site-footer-nome">
        <Link to="/segnala" className="site-footer-segnala">
          <IconaBug />
          Segnala un problema
        </Link>
      </p>
    </footer>
  )
}
