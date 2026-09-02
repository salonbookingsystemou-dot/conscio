const TESTO_PREDEFINITO = (
  <>
    Questo percorso prevede una pratica di meditazione sulla consapevolezza
    a scopo educativo e divulgativo
    e non sostituisce un percorso terapeutico o una presa in carico psicologica.
    In caso di difficoltà cliniche in corso, ti invitiamo a rivolgerti a un professionista sanitario.
  </>
)

export default function Disclaimer({ children }) {
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
    </aside>
  )
}
