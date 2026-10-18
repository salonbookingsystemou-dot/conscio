import { Link } from 'react-router-dom'
import { SITO_HANUMAN } from '../lib/contatti.js'
import Marchio from './Marchio.jsx'

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
        <Link to="/segnala">Segnala un problema</Link>
      </p>
    </footer>
  )
}
