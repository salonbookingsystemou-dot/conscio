import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'

export default function Avvisi() {
  const { codice, registrato } = usePartecipante()
  const [lista, setLista] = useState([])
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    if (!registrato || !codice) return undefined
    setErrore(null)
    setInvio(true)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setInvio(false)
      return undefined
    }
    supabase.rpc('comunicazioni_del_partecipante', { p_codice: codice }).then(({ data, error }) => {
      if (error) {
        setErrore(error.message?.includes('CODICE_NON_TROVATO')
          ? 'Codice non riconosciuto.'
          : 'Non è stato possibile caricare gli avvisi.')
      } else {
        setLista(data || [])
      }
      setInvio(false)
    })
    return undefined
  }, [registrato, codice])

  return (
    <div>
      <h2>Avvisi</h2>
      <p className="lead">Promemoria e annunci del tuo ciclo, in ordine di tempo. Il follow-up T3 è segnalato.</p>
      {!registrato && (
        <ChiediCodice titolo="Per vedere gli avvisi di un partecipante, inserisci il codice." />
      )}
      {invio && <StatoAttesa etichetta="Caricamento degli avvisi…" />}
      {errore && <p className="campo-errore" role="alert">{errore}</p>}
      {registrato && !invio && lista.length === 0 && !errore && (
        <StatoVuoto titolo="Nessun avviso">
          Non ci sono messaggi per il tuo ciclo, per ora.
        </StatoVuoto>
      )}
      {lista.map(c => (
        <div className="card" key={c.id || `${c.oggetto}-${c.data_invio}`}>
          <h3>
            {c.oggetto || c.tipo}{' '}
            {c.tipo === 'reminder_t3' && <span className="badge">T3</span>}
          </h3>
          <p className="hint">{c.data_invio ? new Date(c.data_invio).toLocaleDateString('it-IT') : ''}</p>
          {c.testo && <p style={{ whiteSpace: 'pre-wrap' }}>{c.testo}</p>}
        </div>
      ))}
    </div>
  )
}
