export default function Disclaimer({ children }) {
  return (
    <p className="disclaimer">
      {children || (
        <>
          Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca
          e non sostituisce un percorso terapeutico o una presa in carico psicologica.
          In caso di difficoltà cliniche in corso, ti invitiamo a rivolgerti a un professionista sanitario.
        </>
      )}
    </p>
  )
}
