import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import { costruisciStorico } from '../lib/storico.js'
import ChiediCodice from '../components/ChiediCodice.jsx'
import StatoAttesa from '../components/StatoAttesa.jsx'
import StatoVuoto from '../components/StatoVuoto.jsx'
import StoricoGiornate from '../components/StoricoGiornate.jsx'

function temiDaProgramma(data) {
  const payload = typeof data === 'string' ? JSON.parse(data) : data
  const temi = {}
  for (const lezione of payload?.lezioni || []) {
    const tema = String(lezione.tema || '').trim()
    if (tema) temi[lezione.numero_settimana] = tema
  }
  return temi
}

export default function LogPratica() {
  const { codice, registrato } = usePartecipante()
  const [storico, setStorico] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [temi, setTemi] = useState({})
  const [errore, setErrore] = useState(null)
  const [caricato, setCaricato] = useState(false)

  async function caricaStorico(codicePulito) {
    const [{ data, error }, { data: cicloData, error: cicloErrore }, { data: programma }] = await Promise.all([
      supabase.rpc('log_pratica_del_partecipante', { p_codice: codicePulito }),
      supabase.rpc('ciclo_del_partecipante', { p_codice: codicePulito }),
      supabase.rpc('programma_del_partecipante', { p_codice: codicePulito })
    ])
    if (error || cicloErrore) return false
    setStorico(data || [])
    setCiclo(cicloData || null)
    setTemi(programma ? temiDaProgramma(programma) : {})
    setCaricato(true)
    return true
  }

  useEffect(() => {
    if (!registrato || !codice) return undefined
    setErrore(null)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      return undefined
    }
    caricaStorico(codice).then(ok => {
      if (!ok) setErrore('Non è stato possibile caricare lo storico.')
    })
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrato, codice])

  const dati = useMemo(() => costruisciStorico(storico, ciclo, temi), [storico, ciclo, temi])

  return (
    <div>
      <h2>Storico di pratica</h2>
      <p className="lead">
        Una riga per ogni giorno del percorso, dalla più recente. Il diario si scrive in{' '}
        <Link to="/programma">Settimana</Link>, sotto ogni pratica.
      </p>

      {!registrato && (
        <ChiediCodice titolo="Per vedere lo storico di un partecipante, inserisci il codice." />
      )}
      {errore && <p className="campo-errore" role="alert">{errore}</p>}

      {registrato && !caricato && !errore && <StatoAttesa etichetta="Caricamento dello storico…" />}
      {caricato && (
        storico.length === 0 && dati.settimane.length === 0 ? (
          <StatoVuoto titolo="Diario ancora vuoto">
            Quando completi una pratica in Settimana, comparirà qui.
          </StatoVuoto>
        ) : (
          <StoricoGiornate {...dati} />
        )
      )}
    </div>
  )
}
