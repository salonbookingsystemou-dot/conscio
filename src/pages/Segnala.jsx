import SegnalaProblema from '../components/SegnalaProblema.jsx'

export default function Segnala() {
  return (
    <div>
      <h2>Segnala un problema</h2>
      <p className="lead">
        Qualcosa non funziona come dovrebbe, o hai trovato un errore? Scrivici cosa è successo:
        la segnalazione arriva a chi gestisce l’app.
      </p>
      <div className="card">
        <SegnalaProblema />
      </div>
    </div>
  )
}
