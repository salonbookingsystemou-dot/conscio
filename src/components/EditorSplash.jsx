import { useEffect, useState } from 'react'
import { leggiSplash, salvaSplash, SPLASH_DEFAULT } from '../lib/splash.js'
import { useSnackbar } from './admin/Snackbar.jsx'
import Marchio from './Marchio.jsx'

/** Frase e pulsante della prima schermata. `onCambio` riceve il testo mentre si scrive, per l'anteprima. */
export default function EditorSplash({ onCambio }) {
  const [frase, setFrase] = useState(SPLASH_DEFAULT.frase)
  const [cta, setCta] = useState(SPLASH_DEFAULT.cta)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState(null)
  const { mostra } = useSnackbar()

  useEffect(() => {
    leggiSplash().then(dati => {
      setFrase(dati.frase)
      setCta(dati.cta)
    })
  }, [])

  useEffect(() => {
    onCambio?.({ frase, cta })
  }, [frase, cta, onCambio])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setSalvando(true)
    try {
      const salvato = await salvaSplash({ frase, cta })
      setFrase(salvato.frase)
      setCta(salvato.cta)
      mostra({ testo: 'Frase aggiornata: si vede al prossimo caricamento del sito' })
    } catch {
      setErrore('Non è stato possibile salvare la frase.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="card">
      <h3>Frase di apertura</h3>
      <p className="hint">La prima schermata del sito, prima del codice. L’anteprima è a destra.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="splash-frase">Frase</label>
          <textarea
            id="splash-frase"
            rows={3}
            maxLength={280}
            required
            value={frase}
            onChange={e => setFrase(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="splash-cta">Testo del pulsante</label>
          <input
            id="splash-cta"
            maxLength={40}
            required
            value={cta}
            onChange={e => setCta(e.target.value)}
          />
        </div>
        {errore && <p className="avviso-errore" role="alert">{errore}</p>}
        <div className="azioni">
          <button className="btn" type="submit" disabled={salvando}>
            {salvando ? 'Salvataggio…' : 'Salva frase'}
          </button>
        </div>
      </form>
    </section>
  )
}

/** Anteprima statica della prima schermata, nel pannello di supporto. */
export function AnteprimaSplash({ frase, cta }) {
  return (
    <div className="anteprima-splash" aria-label="Anteprima della prima schermata">
      <span className="anteprima-splash-marca"><Marchio variante="verticale" altezza={64} decorativo /></span>
      <span className="anteprima-splash-linea" aria-hidden="true" />
      <p className="anteprima-splash-frase">{frase || 'La frase di apertura'}</p>
      <span className="btn anteprima-splash-cta">{cta || 'Prosegui'}</span>
      <span className="anteprima-splash-secondario">Ho già un codice</span>
    </div>
  )
}
