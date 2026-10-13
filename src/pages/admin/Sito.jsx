import { Link } from 'react-router-dom'
import EditorSplash from '../../components/EditorSplash.jsx'
import EditorVetrina from '../../components/EditorVetrina.jsx'
import { EMAIL_CONTATTO, STRUMENTI } from '../../lib/contatti.js'

export default function Sito() {
  return (
    <>
      <header className="dash-panel-testa">
        <div>
          <h1>Sito</h1>
          <p className="lead">Frase di apertura, vetrina Ascolta e limiti d’uso dei dati.</p>
        </div>
        <div className="dash-panel-azioni">
          <Link className="btn btn-ghost" to="/ascolta" target="_blank" rel="noopener noreferrer">
            Apri Ascolta
          </Link>
        </div>
      </header>
      <EditorSplash />
      <EditorVetrina />
      <div className="card">
        <h3>Uso dei dati e dei punteggi</h3>
        <p>
          I totali PSS-10 e FFMQ-I sono numeri grezzi sul range dello strumento.
          Non sono una valutazione clinica. Non usarli per triage, esclusione,
          «rischio» o consiglio terapeutico. Lo screening resta idoneo / in
          valutazione / da ricontattare.
        </p>
        <p className="hint">
          Richieste di accesso, correzione o cancellazione: {EMAIL_CONTATTO}, con il
          codice. Per ritirare una persona usa «Ritira» nella scheda Iscritti del suo ciclo. Fonti:{' '}
          {STRUMENTI.map(s => s.nome).join(', ')}.
        </p>
        <p className="hint">
          <Link to="/documenti/uso-punteggi">Protocollo uso punteggi</Link>
          {' · '}
          <Link to="/documenti/diritti">Procedura diritti</Link>
        </p>
      </div>
    </>
  )
}
