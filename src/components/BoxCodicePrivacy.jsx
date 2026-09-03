import { Link } from 'react-router-dom'

const ESEMPIO = 'MBSR-7K2Q8N3P'

function IconaScudo() {
  return (
    <svg className="box-codice-privacy-icona" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 5 L38.5 11.4 V22.8 C38.5 32.2 32.4 39.1 24 42.8 C15.6 39.1 9.5 32.2 9.5 22.8 V11.4 Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M24 5 L38.5 11.4 V22.8 C38.5 32.2 32.4 39.1 24 42.8 C15.6 39.1 9.5 32.2 9.5 22.8 V11.4 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 24.2 V22 C19.4 19.5 21.5 17.5 24 17.5 C26.5 17.5 28.6 19.5 28.6 22 V24.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="17.6" y="23.6" width="12.8" height="9.4" rx="2" fill="currentColor" />
      <circle cx="24" cy="27.4" r="1.2" fill="#fff" />
      <rect x="23.4" y="27.4" width="1.2" height="2.8" rx="0.45" fill="#fff" />
    </svg>
  )
}

/**
 * Box di fiducia sul codice partecipante: stesso testo e stessa grafica
 * ovunque serva spiegare la pseudonimizzazione.
 */
export default function BoxCodicePrivacy({ esempio = ESEMPIO }) {
  return (
    <aside className="box-codice-privacy" aria-label="Come il codice tutela la privacy">
      <header className="box-codice-privacy-testa">
        <span className="box-codice-privacy-mark" aria-hidden="true">
          <IconaScudo />
        </span>
        <div>
          <p className="box-codice-privacy-kicker">Tutela della privacy</p>
          <h3>Ti riconosci con un codice, non con il nome</h3>
        </div>
      </header>
      <p>
        Questionari e diario di pratica sono legati al <strong>codice partecipante</strong>,
        non al tuo nominativo. È una <strong>pseudonimizzazione</strong>: nelle analisi
        e nelle viste di ricerca resta il codice, non chi sei.
      </p>
      <p className="box-codice-privacy-esempio-label">Esempio di codice</p>
      <p className="box-codice-privacy-esempio">
        <span className="box-codice-privacy-chiave" aria-hidden="true" />
        {esempio}
      </p>
      <p className="box-codice-privacy-chiusura">
        Solo tu sai a chi appartiene. Conservalo come una chiave.{' '}
        <Link to="/documenti/informativa">Informativa sui dati</Link>
      </p>
    </aside>
  )
}
