import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { pulisciAscoltoLocale } from '../lib/ascolto.js'
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
  const { codice, registrato, aggiornaPercorso, aggiornaAscolto } = usePartecipante()
  const conferma = useRef(null)
  const [invio, setInvio] = useState(false)
  const [resetInvio, setResetInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [pacchetto, setPacchetto] = useState(null)
  const [confermaAperta, setConfermaAperta] = useState(false)
  const [resetOk, setResetOk] = useState(false)

  useEffect(() => {
    const el = conferma.current
    if (!el) return
    if (confermaAperta && !el.open) el.showModal()
    if (!confermaAperta && el.open) el.close()
  }, [confermaAperta])

  useEffect(() => {
    if (!confermaAperta) return undefined
    const precedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedente
    }
  }, [confermaAperta])

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

  async function resettaDati() {
    if (!codice) return
    setErrore(null)
    setResetOk(false)
    setResetInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setResetInvio(false)
      setConfermaAperta(false)
      return
    }
    const { error } = await supabase.rpc('resetta_dati_del_partecipante', {
      p_codice: codice.trim()
    })
    setResetInvio(false)
    setConfermaAperta(false)
    if (error) {
      const testo = error.message || ''
      setErrore(
        testo.includes('TROPPI_TENTATIVI')
          ? 'Hai già chiesto un reset di recente. Riprova più tardi o scrivi a ' + EMAIL_CONTATTO + '.'
          : 'Non è stato possibile azzerare i dati. Riprova o scrivi a ' + EMAIL_CONTATTO + '.'
      )
      return
    }
    pulisciAscoltoLocale(codice)
    setPacchetto(null)
    setResetOk(true)
    await Promise.all([aggiornaPercorso(codice), aggiornaAscolto(codice)])
  }

  return (
    <div>
      <h2>I tuoi dati</h2>
      <p className="lead">
        Qui eserciti accesso e portabilità: scarichi ciò che è collegato al tuo codice.
        Puoi anche azzerare questionari, diario e onboarding.
      </p>
      <Disclaimer />

      {!registrato && (
        <ChiediCodice titolo="Per scaricare i tuoi dati, inserisci il codice partecipante." />
      )}

      {registrato && (
        <>
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
            {pacchetto && (
              <p className="hint">
                File scaricato. Codice {pacchetto.codice}. Se non lo vedi, controlla la cartella Download.
              </p>
            )}
          </div>

          <div className="card card-dati-pericolo">
            <h3>Reset</h3>
            <p>
              Cancella questionari, diario di pratica e onboarding legati al tuo codice.
              Restano codice, email, consensi e iscrizione. L’operazione non si può annullare.
            </p>
            <div className="azioni">
              <button
                className="btn btn-ghost btn-ciclo-elimina"
                type="button"
                disabled={resetInvio}
                onClick={() => {
                  setErrore(null)
                  setConfermaAperta(true)
                }}
              >
                Resetta tutti i miei dati
              </button>
            </div>
            {resetOk && (
              <p className="hint hint-ok" role="status">
                Dati azzerati. Puoi ricominciare onboarding e questionari con lo stesso codice.
              </p>
            )}
          </div>
        </>
      )}

      {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}

      <p className="hint">
        Per correzione, limitazione o cancellazione completa del record scrivi a {EMAIL_CONTATTO}
        {' '}(email + codice). Puoi anche revocare i consensi: il Modulo B non tocca la
        partecipazione; il Modulo A significa uscire dal percorso.
      </p>

      <dialog
        ref={conferma}
        className="dialog-conferma"
        onClose={() => setConfermaAperta(false)}
        onCancel={e => {
          e.preventDefault()
          if (!resetInvio) setConfermaAperta(false)
        }}
        onClick={e => {
          if (e.target === conferma.current && !resetInvio) setConfermaAperta(false)
        }}
      >
        <h3>Resetta tutti i miei dati?</h3>
        <p>
          Stai per cancellare questionari, diario di pratica e risposte di onboarding.
          Codice, email e posto nel ciclo restano. Non si può tornare indietro.
        </p>
        <div className="azioni">
          <button
            className="btn btn-ghost btn-ciclo-elimina"
            type="button"
            disabled={resetInvio}
            onClick={resettaDati}
          >
            {resetInvio ? 'Reset in corso…' : 'Sì, resetta i dati'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={resetInvio}
            onClick={() => setConfermaAperta(false)}
          >
            Annulla
          </button>
        </div>
      </dialog>
    </div>
  )
}
