import { useState } from 'react'
import { Link } from 'react-router-dom'
import EditorSplash, { AnteprimaSplash } from '../../components/EditorSplash.jsx'
import EditorVetrina from '../../components/EditorVetrina.jsx'
import PaginaAdmin from '../../components/admin/PaginaAdmin.jsx'
import { AreaPrincipale, PannelloSupporto } from '../../components/admin/Pannelli.jsx'

const ANTEPRIME = [
  { id: 'splash', etichetta: 'Prima schermata' },
  { id: 'ascolta', etichetta: 'Ascolta' }
]

// La pagina Ascolta vera, nello stesso indirizzo dell'app: l'anteprima è com'è pubblicata.
const URL_ASCOLTA = `${window.location.href.split('#')[0]}#/ascolta`

export default function Sito() {
  const [splash, setSplash] = useState({ frase: '', cta: '' })
  const [anteprima, setAnteprima] = useState('splash')
  const [versioneAscolta, setVersioneAscolta] = useState(0)

  function vetrinaSalvata() {
    setVersioneAscolta(v => v + 1)
    setAnteprima('ascolta')
  }

  return (
    <PaginaAdmin
      titolo="Sito"
      meta="La prima schermata e la pagina pubblica Ascolta."
      azione={(
        <Link className="btn btn-ghost" to="/ascolta" target="_blank" rel="noopener noreferrer">
          Apri Ascolta
        </Link>
      )}
      layout="supporto"
    >
      <AreaPrincipale>
        <EditorSplash onCambio={setSplash} />
        <EditorVetrina onSalvata={vetrinaSalvata} />
      </AreaPrincipale>
      <PannelloSupporto etichetta="Anteprima">
        <div className="filtri-chip" role="group" aria-label="Quale anteprima">
          {ANTEPRIME.map(a => (
            <button
              key={a.id}
              type="button"
              className="chip"
              aria-pressed={anteprima === a.id}
              onClick={() => setAnteprima(a.id)}
            >
              {a.etichetta}
            </button>
          ))}
        </div>
        {anteprima === 'splash' ? (
          <AnteprimaSplash frase={splash.frase} cta={splash.cta} />
        ) : (
          <>
            <div className="anteprima-telefono">
              <iframe
                key={versioneAscolta}
                src={URL_ASCOLTA}
                title="Anteprima della pagina Ascolta"
                loading="lazy"
              />
            </div>
            <p className="hint">
              La pagina com’è pubblicata, a larghezza di telefono. Si aggiorna quando salvi la vetrina.
            </p>
          </>
        )}
      </PannelloSupporto>
    </PaginaAdmin>
  )
}
