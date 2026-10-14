import { Link } from 'react-router-dom'
import EditorSplash from '../../components/EditorSplash.jsx'
import EditorVetrina from '../../components/EditorVetrina.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
import { AreaPrincipale, PannelloSupporto } from '../../components/admin/Pannelli.jsx'
import { EMAIL_CONTATTO, STRUMENTI } from '../../lib/contatti.js'

export default function Sito() {
  return (
    <PaginaAdmin
      titolo="Sito"
      meta="Frase di apertura, vetrina Ascolta e limiti d’uso dei dati."
      azione={(
        <Link className="btn btn-ghost" to="/ascolta" target="_blank" rel="noopener noreferrer">
          Apri Ascolta
        </Link>
      )}
      layout="supporto"
    >
      <AreaPrincipale>
        <EditorSplash />
        <EditorVetrina />
      </AreaPrincipale>
      {/* EditorSplash non ha ancora un'anteprima: il pannello tiene la nota sull'uso dei dati. */}
      <PannelloSupporto etichetta="Uso dei dati e dei punteggi">
        <h2 className="pannello-supporto-titolo">Uso dei dati e dei punteggi</h2>
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
      </PannelloSupporto>
    </PaginaAdmin>
  )
}
