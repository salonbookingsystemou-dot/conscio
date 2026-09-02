import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { EMAIL_CONTATTO } from '../lib/contatti.js'
import ChiediCodice from '../components/ChiediCodice.jsx'
import Disclaimer from '../components/Disclaimer.jsx'

function scaricaJson(nome, dati) {
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export default function IMieiDati() {
  const { codice, registrato } = usePartecipante()
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [pacchetto, setPacchetto] = useState(null)

  async function esporta() {
    if (!codice) return
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return
    }
    const { data, error } = await supabase.rpc('esporta_dati_del_partecipante', {
      p_codice: codice.trim()
    })
    setInvio(false)
    if (error || !data) {
      setErrore('Non è stato possibile preparare l’export. Riprova o scrivi a ' + EMAIL_CONTATTO + '.')
      return
    }
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    setPacchetto(payload)
    const stamp = new Date().toISOString().slice(0, 10)
    scaricaJson(`conscio-dati-${codice.trim()}-${stamp}.json`, payload)
  }

  return (
    <div>
      <h2>I tuoi dati</h2>
      <p className="lead">
        Qui eserciti accesso e portabilità: scarichi ciò che è collegato al tuo codice.
        Per correzione, limitazione o cancellazione scrivi a {EMAIL_CONTATTO}.
      </p>
      <Disclaimer />

      {!registrato && (
        <ChiediCodice titolo="Per scaricare i tuoi dati, inserisci il codice partecipante." />
      )}

      {registrato && (
        <div className="card">
          <h3>Export</h3>
          <p>
            Il file contiene email (se ancora presente), consensi, iscrizioni, risposte ai
            questionari e log di pratica. Non contiene dati di altre persone.
          </p>
          <div className="azioni">
            <button className="btn" type="button" disabled={invio} onClick={esporta}>
              {invio ? 'Preparazione…' : 'Scarica i miei dati'}
            </button>
            <Link className="btn btn-ghost" to="/documenti/diritti">
              Procedura diritti
            </Link>
          </div>
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          {pacchetto && (
            <p className="hint">
              File scaricato. Codice {pacchetto.codice}. Se non lo vedi, controlla la cartella Download.
            </p>
          )}
        </div>
      )}

      <p className="hint">
        La cancellazione la esegue chi conduce il percorso dopo tua richiesta scritta
        (email + codice). Puoi anche revocare i consensi: il Modulo B non tocca la
        partecipazione; il Modulo A significa uscire dal percorso.
      </p>
    </div>
  )
}
