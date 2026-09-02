import { Link } from 'react-router-dom'

function IconaGdpr() {
  return (
    <svg className="avviso-dati-icona" viewBox="0 0 48 48" aria-hidden="true">
      {/* Scudo */}
      <path
        d="M24 4.5 L39.5 11.2 V22.5 C39.5 32.2 33.2 39.4 24 43.2 C14.8 39.4 8.5 32.2 8.5 22.5 V11.2 Z"
        fill="#fff"
        stroke="#3D4A66"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M24 7.2 L36.2 12.4 V22.5 C36.2 30.4 31.1 36.5 24 39.8 C16.9 36.5 11.8 30.4 11.8 22.5 V12.4 Z"
        fill="#F3F5F8"
      />
      {/* GDPR */}
      <text
        x="24"
        y="22"
        textAnchor="middle"
        fill="#3D4A66"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.4"
      >
        GDPR
      </text>
      {/* Lucchetto */}
      <path
        d="M19.2 27.2 V24.4 C19.2 21.7 21.3 19.6 24 19.6 C26.7 19.6 28.8 21.7 28.8 24.4 V27.2"
        fill="none"
        stroke="#3D4A66"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="17.2" y="26.4" width="13.6" height="10.2" rx="2.2" fill="#4B6B57" />
      <circle cx="24" cy="30.6" r="1.35" fill="#fff" />
      <rect x="23.35" y="30.6" width="1.3" height="3.1" rx="0.5" fill="#fff" />
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
        <p className="avviso-dati-titolo">Dati del percorso in forma pseudonimizzata</p>
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
