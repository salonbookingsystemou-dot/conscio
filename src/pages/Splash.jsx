import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePartecipante } from '../lib/partecipante.jsx'
import { leggiSplash, SPLASH_DEFAULT } from '../lib/splash.js'
import iconaConscio from '../assets/icona-conscio.png'

export default function Splash() {
  const { facilitatore } = useAuth()
  const { registrato } = usePartecipante()
  const [testo, setTesto] = useState(SPLASH_DEFAULT)

  useEffect(() => {
    let vivo = true
    leggiSplash().then(dati => {
      if (vivo) setTesto(dati)
    })
    return () => { vivo = false }
  }, [])

  const destinazione = facilitatore ? '/dashboard' : registrato ? '/programma' : '/iscrizione'

  return (
    <main className="splash">
      <img className="splash-icona" src={iconaConscio} alt="" />
      <p className="splash-marca">Percorso MBSR</p>
      <span className="splash-linea" aria-hidden="true" />
      <h1 className="splash-frase">{testo.frase}</h1>
      <div className="splash-cta">
        <Link className="btn" to={destinazione}>{testo.cta}</Link>
        {!facilitatore && !registrato && (
          <p className="splash-secondario">
            <Link to="/entra">Ho già un codice</Link>
          </p>
        )}
      </div>
    </main>
  )
}
