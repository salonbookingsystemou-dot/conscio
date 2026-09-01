import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leggiSplash, salvaSplash, SPLASH_DEFAULT } from '../lib/splash.js'

export default function EditorSplash() {
  const [frase, setFrase] = useState(SPLASH_DEFAULT.frase)
  const [cta, setCta] = useState(SPLASH_DEFAULT.cta)
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    leggiSplash().then(dati => {
      setFrase(dati.frase)
      setCta(dati.cta)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setStato('invio')
    try {
      const salvato = await salvaSplash({ frase, cta })
      setFrase(salvato.frase)
      setCta(salvato.cta)
      setStato('ok')
    } catch {
      setErrore('Non è stato possibile salvare la frase.')
      setStato(null)
    }
  }

  return (
    <div className="card">
      <h3>Frase di apertura</h3>
      <p className="hint">
        Compare sulla prima schermata del sito, con una breve animazione e il pulsante per proseguire.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="splash-frase">Frase</label>
          <textarea
            id="splash-frase"
            rows={3}
            maxLength={280}
            required
            value={frase}
            onChange={e => { setFrase(e.target.value); setStato(null) }}
          />
        </div>
        <div className="field">
          <label htmlFor="splash-cta">Testo del pulsante</label>
          <input
            id="splash-cta"
            maxLength={40}
            required
            value={cta}
            onChange={e => { setCta(e.target.value); setStato(null) }}
          />
        </div>
        <div className="azioni">
          <button className="btn" type="submit" disabled={stato === 'invio'}>
            {stato === 'invio' ? 'Salvataggio…' : 'Salva frase'}
          </button>
          <Link className="btn btn-ghost" to="/" target="_blank" rel="noopener noreferrer">
            Vedi la schermata
          </Link>
        </div>
        {stato === 'ok' && <p className="hint">Frase aggiornata. Chi apre il sito la vede al prossimo caricamento.</p>}
        {errore && <p className="hint hint-errore">{errore}</p>}
      </form>
    </div>
  )
}
