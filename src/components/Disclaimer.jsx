import { useState } from 'react'

const CHIAVE = 'conscio-avvertenza-chiusa'

const TESTO_PREDEFINITO = (
  <>
    Questo percorso prevede una pratica di meditazione sulla consapevolezza
    a scopo educativo e divulgativo
    e non sostituisce un percorso terapeutico o una presa in carico psicologica.
    In caso di difficoltà cliniche in corso, ti invitiamo a rivolgerti a un professionista sanitario.
  </>
)

function giaChiusa() {
  try {
    return localStorage.getItem(CHIAVE) === '1'
  } catch {
    return false
  }
}

export default function Disclaimer({ children }) {
  const [chiuso, setChiuso] = useState(giaChiusa)

  if (chiuso) return null

  function chiudi() {
    try {
      localStorage.setItem(CHIAVE, '1')
    } catch {
      /* archivio non disponibile */
    }
    setChiuso(true)
  }

  return (
    <aside className="avvertenza" aria-label="Avvertenza sul percorso">
      <img
        className="avvertenza-icona"
        src={`${import.meta.env.BASE_URL}icona-avvertenza.png`}
        alt=""
        width={56}
        height={56}
        decoding="async"
      />
      <div className="avvertenza-testo">
        <p className="avvertenza-titolo">Avvertenza</p>
        <p>{children || TESTO_PREDEFINITO}</p>
      </div>
      <button
        type="button"
        className="avvertenza-chiudi"
        onClick={chiudi}
        aria-label="Chiudi avvertenza"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </aside>
  )
}
