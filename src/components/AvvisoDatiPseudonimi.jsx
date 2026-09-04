import { Link } from 'react-router-dom'

function IconaGdpr() {
  return (
    <svg className="avviso-dati-icona" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 5.2 39 12.2v11c0 9.2-6.4 16.2-15 20-8.6-3.8-15-10.8-15-20v-11Z"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 22.4v-3.1a4.8 4.8 0 0 1 9.6 0v3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="16.6" y="22.2" width="14.8" height="12.2" rx="2.6" fill="currentColor" />
      <circle cx="24" cy="27.2" r="1.45" fill="#fff" />
      <rect x="23.25" y="27.2" width="1.5" height="3.4" rx="0.6" fill="#fff" />
    </svg>
  )
}

/**
 * Avviso sul trattamento dei dati di percorso in forma pseudonimizzata
 * (codice partecipante), allineato all’informativa art. 13 GDPR.
 */
export default function AvvisoDatiPseudonimi() {
  return (
    <aside className="avviso-dati" aria-label="Trattamento dei dati del percorso">
      <span className="avviso-dati-mark" aria-hidden="true">
        <IconaGdpr />
      </span>
      <div className="avviso-dati-testo">
        <p className="avviso-dati-titolo">Come tuteliamo il tuo anonimato</p>
        <p>
          Le informazioni che inserisci nell’applicazione (risposte, annotazioni di pratica,
          spunte e ascolti) sono trattate per le finalità di ricerca del percorso e
          associate al tuo <strong>codice partecipante</strong>, non al nominativo.
          In questo modo i dati di percorso risultano <strong>pseudonimizzati</strong>
          {' '}ai sensi del Regolamento (UE) 2016/679 (GDPR): senza le informazioni di
          collegamento tenute separatamente, non consentono di identificarti direttamente
          nelle analisi e nelle viste di ricerca.
        </p>
        <p>
          Conserva il codice in modo riservato. I dettagli su base giuridica, tempi di
          conservazione e diritti dell’interessato sono nell’
          <Link to="/documenti/informativa">informativa sul trattamento dei dati</Link>
          {' '}(art. 13 GDPR).
        </p>
      </div>
    </aside>
  )
}
