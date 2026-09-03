import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import CalendarioPratica from '../components/CalendarioPratica.jsx'
import GraficoAndamentoPratica from '../components/GraficoAndamentoPratica.jsx'

export default function LogPratica() {
  const { codice, registrato } = usePartecipante()
  const [storico, setStorico] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [giornoAttivo, setGiornoAttivo] = useState(null)
  const [errore, setErrore] = useState(null)
  const [caricato, setCaricato] = useState(false)

  async function caricaStorico(codicePulito) {
    const [{ data, error }, { data: cicloData, error: cicloErrore }] = await Promise.all([
      supabase.rpc('log_pratica_del_partecipante', { p_codice: codicePulito }),
      supabase.rpc('ciclo_del_partecipante', { p_codice: codicePulito })
    ])
    if (error || cicloErrore) return false
    setStorico(data || [])
    setCiclo(cicloData || null)
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

  const visibili = giornoAttivo
    ? storico.filter(r => String(r.data).slice(0, 10) === giornoAttivo)
    : storico

  return (
    <div>
      <h2>Storico di pratica</h2>
      <p className="lead">
        Il diario della settimana sta in{' '}
        <Link to="/programma">Settimana</Link>, sotto ogni pratica.
        Qui vedi l’andamento del tono nel tempo, collegato alle sessioni.
      </p>
      <Disclaimer />

      {!registrato && (
        <ChiediCodice titolo="Per vedere lo storico di un partecipante, inserisci il codice." />
      )}
      {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}

      {caricato && (
        <>
          <div className="card">
            <CalendarioPratica
              inizio={ciclo?.data_inizio}
              fine={ciclo?.data_fine}
              sessioni={storico}
              giornoAttivo={giornoAttivo}
              onGiorno={iso => {
                setGiornoAttivo(prev => (prev === iso ? null : iso))
              }}
            />
          </div>
          <div className="card">
            <h3>
              {giornoAttivo
                ? `Andamento del ${new Date(`${giornoAttivo}T12:00:00`).toLocaleDateString('it-IT')}`
                : 'Andamento del tono'}
            </h3>
            {giornoAttivo && (
              <p className="hint">
                <button type="button" className="btn btn-ghost" onClick={() => setGiornoAttivo(null)}>
                  Mostra tutto il percorso
                </button>
              </p>
            )}
            {visibili.length === 0 ? (
              <p>{giornoAttivo ? 'Nessuna sessione in questo giorno.' : 'Nessuna sessione ancora registrata.'}</p>
            ) : (
              <GraficoAndamentoPratica sessioni={visibili} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
