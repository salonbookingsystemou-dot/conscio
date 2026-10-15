import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { destinazionePartecipante, usePartecipante } from '../lib/partecipante.jsx'
import { leggiSplash, SPLASH_DEFAULT } from '../lib/splash.js'
import Marchio from '../components/Marchio.jsx'

export default function Splash() {
  const { facilitatore, caricamento: authLoad } = useAuth()
  const {
    registrato,
    caricamento,
    onboardingCompleto,
    t0Completo,
    percorsoPronto
  } = usePartecipante()
  const [testo, setTesto] = useState(SPLASH_DEFAULT)

  useEffect(() => {
    let vivo = true
    leggiSplash().then(dati => {
      if (vivo) setTesto(dati)
    })
    return () => { vivo = false }
  }, [])

  if (!authLoad && !caricamento) {
    if (facilitatore) return <Navigate to="/admin/cicli" replace />
    if (registrato) {
      const dove = percorsoPronto
        ? '/programma'
        : destinazionePartecipante({
          onboarding: onboardingCompleto,
          t0: t0Completo,
          pronto: percorsoPronto
        })
      return <Navigate to={dove} replace />
    }
  }

  const destinazione = '/iscrizione'

  return (
    <main className="splash">
      <div className="splash-icona">
        <Marchio variante="verticale" altezza={112} />
      </div>
      <span className="splash-linea" aria-hidden="true" />
      <h1 className="splash-frase">{testo.frase}</h1>
      <div className="splash-cta">
        <Link className="btn btn-avanti" to={destinazione}>{testo.cta}</Link>
        {!facilitatore && !registrato && (
          <p className="splash-secondario">
            <Link to="/entra">Ho già un codice</Link>
          </p>
        )}
      </div>
    </main>
  )
}
