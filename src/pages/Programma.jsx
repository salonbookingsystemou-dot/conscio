import { useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import Disclaimer from '../components/Disclaimer.jsx'

export default function Programma() {
  const [codice, setCodice] = useState('')
  const [lezioni, setLezioni] = useState([])
  const [settimana, setSettimana] = useState(null)
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  async function carica(e) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return
    }
    const { data, error } = await supabase.rpc('programma_del_partecipante', {
      p_codice: codice.trim()
    })
    if (error || !data) {
      setErrore(error?.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto.'
        : 'Non è stato possibile caricare il programma.')
      setInvio(false)
      return
    }
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    setLezioni(payload.lezioni || [])
    setSettimana(payload.settimana_corrente)
    setInvio(false)
  }

  const corrente = lezioni.find(l => l.numero_settimana === settimana) || lezioni[0]

  return (
    <div>
      <h2>Questa settimana</h2>
      <p className="lead">Tema, pratiche formali e informali, esercizi da fare a casa. Solo lettura.</p>
      <Disclaimer />

      <form className="card" onSubmit={carica}>
        <div className="field">
          <label htmlFor="codice">Codice partecipante</label>
          <input
            id="codice"
            required
            value={codice}
            onChange={e => setCodice(e.target.value)}
            placeholder="es. MBSR-7K2Q"
          />
        </div>
        <button className="btn" type="submit" disabled={invio}>
          {invio ? 'Caricamento…' : 'Mostra il programma'}
        </button>
        {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
      </form>

      {lezioni.length > 0 && (
        <>
          <div className="chip-riga">
            {lezioni.map(l => (
              <button
                key={l.id || l.numero_settimana}
                type="button"
                className={`chip${(corrente && l.numero_settimana === corrente.numero_settimana) ? ' is-on' : ''}`}
                onClick={() => setSettimana(l.numero_settimana)}
              >
                {l.numero_settimana === 9 ? 'Intensiva' : `Sett. ${l.numero_settimana}`}
              </button>
            ))}
          </div>
          {corrente && (
            <div className="card">
              <h3>
                {corrente.numero_settimana === 9 ? 'Giornata intensiva' : `Settimana ${corrente.numero_settimana}`}
                {corrente.tema ? ` — ${corrente.tema}` : ''}
              </h3>
              {corrente.pratiche_formali && <p><strong>Formali.</strong> {corrente.pratiche_formali}</p>}
              {corrente.pratiche_informali && <p><strong>Informali.</strong> {corrente.pratiche_informali}</p>}
              {corrente.materiali && <p><strong>Materiali.</strong> {corrente.materiali}</p>}
              {(corrente.esercizi || []).length > 0 && (
                <ul>
                  {corrente.esercizi.map((ex, i) => (
                    <li key={ex.id || i}>{ex.tipo ? `${ex.tipo}: ` : ''}{ex.descrizione}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
