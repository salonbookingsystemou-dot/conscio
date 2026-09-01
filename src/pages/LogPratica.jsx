import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { usePartecipante } from '../lib/partecipante.jsx'
import ChiediCodice from '../components/ChiediCodice.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import CampoNota from '../components/CampoNota.jsx'
import CalendarioPratica from '../components/CalendarioPratica.jsx'
import TonoEsperienza from '../components/TonoEsperienza.jsx'
import { ElencoLog } from '../components/VoceLog.jsx'
import { oggiLocaleISO } from '../lib/date.js'

const TIPI = [
  { id: 'body_scan', label: 'Body scan' },
  { id: 'seduta', label: 'Meditazione seduta' },
  { id: 'yoga', label: 'Yoga consapevole' },
  { id: 'informale', label: 'Pratica informale' },
  { id: 'altro', label: 'Altro' }
]

export default function LogPratica() {
  const { codice, registrato } = usePartecipante()
  const [form, setForm] = useState({
    data: oggiLocaleISO(),
    durata_minuti: 20,
    tipo: 'seduta',
    note: '',
    tono_prima: '',
    tono_dopo: ''
  })
  const [storico, setStorico] = useState([])
  const [ciclo, setCiclo] = useState(null)
  const [giornoAttivo, setGiornoAttivo] = useState(null)
  const [stato, setStato] = useState(null)
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

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(null)
    setStato('invio')
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      setStato(null)
      return
    }
    if (!form.note.trim()) {
      setErrore('La nota è necessaria per chiudere la sessione.')
      setStato(null)
      return
    }
    const { error } = await supabase.rpc('salva_log_pratica', {
      p_codice: codice,
      p_data: form.data,
      p_durata: Number(form.durata_minuti),
      p_note: form.note.trim() || null,
      p_tipo: form.tipo,
      p_tono_dopo: form.tono_dopo || null,
      p_tono_prima: form.tipo === 'informale' ? (form.tono_prima || null) : null
    })
    if (error) {
      setErrore(error.message?.includes('CODICE_NON_TROVATO')
        ? 'Codice non riconosciuto. Controlla e riprova.'
        : error.message?.includes('NOTA_MANCANTE')
          ? 'La nota è necessaria per chiudere la sessione.'
          : 'Non è stato possibile registrare la pratica. Riprova.')
      setStato(null)
      return
    }
    setForm({ ...form, note: '', tono_prima: '', tono_dopo: '' })
    setStato('ok')
    await caricaStorico(codice)
  }

  const visibili = giornoAttivo
    ? storico.filter(r => String(r.data).slice(0, 10) === giornoAttivo)
    : storico

  return (
    <div className="layout-due">
      <div>
        <h2>Storico di pratica</h2>
        <p className="lead">
          Il diario della settimana sta in{' '}
          <Link to="/programma">Settimana</Link>, sotto ogni pratica.
          Qui il calendario mostra i giorni con sessione e quelli senza. Puoi anche registrare qualcosa fuori programma.
        </p>
        <Disclaimer />

        {!registrato && (
          <ChiediCodice titolo="Per vedere lo storico di un partecipante, inserisci il codice." />
        )}
        {errore && !stato && <p style={{ color: 'var(--danger)' }}>{errore}</p>}

        {caricato && (
          <>
            <div className="card">
              <CalendarioPratica
                inizio={ciclo?.data_inizio}
                fine={ciclo?.data_fine}
                sessioni={storico}
                giornoAttivo={giornoAttivo}
                onGiorno={iso => {
                  setGiornoAttivo(prev => prev === iso ? null : iso)
                  setForm(f => ({ ...f, data: iso }))
                }}
              />
            </div>
            <div className="card">
              <h3>{giornoAttivo ? `Sessioni del ${new Date(giornoAttivo + 'T12:00:00').toLocaleDateString('it-IT')}` : 'Le tue sessioni'}</h3>
              {giornoAttivo && (
                <p className="hint">
                  <button type="button" className="btn btn-ghost" onClick={() => setGiornoAttivo(null)}>
                    Mostra tutte
                  </button>
                </p>
              )}
              {visibili.length === 0 && (
                <p>{giornoAttivo ? 'Nessuna sessione in questo giorno.' : 'Nessuna sessione ancora registrata.'}</p>
              )}
              <ElencoLog righe={visibili} />
            </div>
          </>
        )}

        {registrato && (
        <div className="card">
          <h3>Fuori programma</h3>
          <p className="hint">Solo se la pratica non corrisponde a un esercizio della settimana.</p>
          <form onSubmit={handleSubmit}>
            <div className="riga-due">
              <div className="field">
                <label htmlFor="data">Data</label>
                <input id="data" type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="durata">Minuti</label>
                <input
                  id="durata"
                  type="number"
                  min="1"
                  max="240"
                  required
                  value={form.durata_minuti}
                  onChange={e => setForm({ ...form, durata_minuti: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Tipo di pratica</label>
              <div className="chip-riga">
                {TIPI.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${form.tipo === t.id ? ' is-on' : ''}`}
                    onClick={() => setForm({ ...form, tipo: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {form.tipo === 'informale' && (
              <TonoEsperienza
                label="All’inizio"
                value={form.tono_prima}
                onChange={tono_prima => setForm({ ...form, tono_prima })}
                hint="Il tono di ciò che c’era, prima."
              />
            )}
            <TonoEsperienza
              label="Come ti senti dopo"
              value={form.tono_dopo}
              onChange={tono_dopo => setForm({ ...form, tono_dopo })}
              hint="Un tocco: piacevole, neutro o spiacevole. Non è un voto."
            />
            <CampoNota
              id="note"
              required
              label="Nota"
              value={form.note}
              onChange={note => setForm({ ...form, note })}
            />
            <button className="btn" type="submit" disabled={stato === 'invio' || !codice || !form.note.trim()}>
              {stato === 'invio' ? 'Salvataggio…' : 'Registra'}
            </button>
            {!form.note.trim() && <p className="hint">La nota è necessaria per chiudere la sessione.</p>}
            {stato === 'ok' && <p>Sessione registrata.</p>}
            {errore && stato && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>
        </div>
        )}
      </div>
      <aside>
        <div className="card card-lato">
          <h3>Come funziona il codice</h3>
          <p>Il log non porta il tuo nome. Solo il codice.</p>
          <p className="codice-esempio">{codice || 'MBSR-7K2Q'}</p>
        </div>
      </aside>
    </div>
  )
}
