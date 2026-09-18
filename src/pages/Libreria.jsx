import { useEffect, useMemo, useRef, useState } from 'react'
import CardTracciaAudio from '../components/CardTracciaAudio.jsx'
import {
  collegamentiTracce,
  creaTraccia,
  elencaTracce,
  eliminaTraccia,
  leggiTestoCard,
  messaggioErroreTraccia,
  rinominaTraccia,
  sostituisciFileTraccia,
  titoloDaNomeFile
} from '../lib/tracce'

function etichettaCollegamento(voce) {
  const n = Number(voce?.numeroSettimana)
  const sett = n === 9 ? 'Intensiva' : `Settimana ${n || '?'}`
  return `${sett} → ${voce?.descrizione || 'pratica'}`
}

function durataBreve(minuti) {
  if (!Number.isFinite(minuti) || minuti <= 0) return null
  return `${minuti} min`
}

function IconaLente() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function IconaPiu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconaAscolto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.4 6.2v11.6c0 .72.78 1.16 1.4.79l9.1-5.8a.92.92 0 0 0 0-1.58l-9.1-5.8a.92.92 0 0 0-1.4.79z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconaMatita() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.8 16.4 15.6 5.6a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3L7.6 19.2 4 20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconaSostituisci() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 7h8.5a3.5 3.5 0 0 1 0 7H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 4.8 7 7l2.5 2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M17 17H8.5a3.5 3.5 0 0 1 0-7H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M14.5 19.2 17 17l-2.5-2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconaCestino() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h14M9.2 8V6.4A1.4 1.4 0 0 1 10.6 5h2.8a1.4 1.4 0 0 1 1.4 1.4V8M16.2 8v10.2a1.4 1.4 0 0 1-1.4 1.4H9.2a1.4 1.4 0 0 1-1.4-1.4V8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Libreria() {
  const [tracce, setTracce] = useState([])
  const [collegamenti, setCollegamenti] = useState({})
  const [ricerca, setRicerca] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [occupato, setOccupato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const [titoloForm, setTitoloForm] = useState('')
  const [descrizioneForm, setDescrizioneForm] = useState('')
  const fileNuovo = useRef(null)
  const fileSostituisci = useRef(null)
  const daSostituire = useRef(null)

  async function carica() {
    try {
      const [lista, mappa] = await Promise.all([elencaTracce(), collegamentiTracce()])
      setTracce(lista)
      setCollegamenti(mappa)
      setErrore(null)
    } catch {
      setErrore('Non è stato possibile leggere la libreria tracce.')
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => {
    carica()
  }, [])

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase()
    if (!q) return tracce
    return tracce.filter(t => String(t.titolo || '').toLowerCase().includes(q))
  }, [tracce, ricerca])

  function apriCarica() {
    setErrore(null)
    setTitoloForm('')
    setDescrizioneForm('')
    setDialogo({ tipo: 'carica' })
  }

  async function apriModifica(traccia) {
    setErrore(null)
    const testo = await leggiTestoCard(traccia)
    setTitoloForm(traccia.titolo || '')
    setDescrizioneForm(testo || traccia.descrizione || '')
    setDialogo({ tipo: 'modifica', traccia })
  }

  function chiediElimina(traccia) {
    const usi = collegamenti[traccia.id] || []
    if (usi.length > 0) {
      setDialogo({ tipo: 'bloccata', traccia, usi })
      return
    }
    setDialogo({ tipo: 'elimina', traccia })
  }

  async function confermaCarica(file) {
    if (!file) return
    setOccupato('carica')
    setErrore(null)
    try {
      await creaTraccia(file, {
        titolo: titoloForm || titoloDaNomeFile(file.name),
        descrizione: descrizioneForm
      })
      setDialogo(null)
      await carica()
    } catch (err) {
      setErrore(messaggioErroreTraccia(err))
    } finally {
      setOccupato(null)
    }
  }

  async function confermaModifica() {
    const traccia = dialogo?.traccia
    if (!traccia) return
    setOccupato('modifica')
    setErrore(null)
    try {
      await rinominaTraccia(traccia.id, titoloForm, descrizioneForm)
      setDialogo(null)
      await carica()
    } catch (err) {
      setErrore(messaggioErroreTraccia(err))
    } finally {
      setOccupato(null)
    }
  }

  async function confermaElimina() {
    const traccia = dialogo?.traccia
    if (!traccia) return
    const usi = collegamenti[traccia.id] || []
    if (usi.length > 0) {
      setDialogo({ tipo: 'bloccata', traccia, usi })
      return
    }
    setOccupato('elimina')
    setErrore(null)
    try {
      await eliminaTraccia(traccia)
      setDialogo(null)
      await carica()
    } catch (err) {
      if (err?.message === 'TRACCIA_IN_USO') {
        setDialogo({ tipo: 'bloccata', traccia, usi: err.collegamenti || [] })
      } else {
        setErrore(messaggioErroreTraccia(err))
        setDialogo(null)
      }
    } finally {
      setOccupato(null)
    }
  }

  async function suSostituisci(file) {
    const traccia = daSostituire.current
    daSostituire.current = null
    if (!file || !traccia) return
    setOccupato(traccia.id)
    setErrore(null)
    try {
      await sostituisciFileTraccia(traccia, file)
      await carica()
    } catch (err) {
      setErrore(messaggioErroreTraccia(err))
    } finally {
      setOccupato(null)
    }
  }

  return (
    <>
      <header className="admin-page-head">
        <h1>Libreria tracce</h1>
        <p>
          Carica e gestisci i file audio. Il collegamento alle pratiche vive qui, con un conteggio reale — non più un abbinamento per nome.
        </p>
      </header>

      <div className="admin-toolbar">
        <label className="admin-cerca">
          <IconaLente />
          <span className="visually-hidden">Cerca traccia</span>
          <input
            type="search"
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            placeholder="Cerca una traccia…"
          />
        </label>
        <button type="button" className="admin-btn-primario" onClick={apriCarica}>
          <IconaPiu />
          Carica traccia
        </button>
      </div>

      {errore && <p className="admin-alert" role="alert">{errore}</p>}

      <section className="admin-card" aria-label="Elenco tracce">
        {caricamento ? (
          <p className="admin-card-vuota">Caricamento della libreria…</p>
        ) : filtrate.length === 0 ? (
          <p className="admin-card-vuota">
            {tracce.length === 0
              ? 'Nessuna traccia ancora. Carica il primo file per renderlo disponibile ovunque.'
              : 'Nessuna traccia corrisponde alla ricerca.'}
          </p>
        ) : (
          <ul className="admin-lista">
            {filtrate.map(t => {
              const usi = collegamenti[t.id] || []
              const collegata = usi.length > 0
              const minuti = durataBreve(t.durata_minuti)
              return (
                <li key={t.id} className="admin-riga">
                  <div className="admin-riga-testi">
                    <p className="admin-riga-titolo">
                      <strong>{t.titolo}</strong>
                      {minuti && <span className="admin-riga-durata"> · {minuti}</span>}
                    </p>
                    <p className={`admin-riga-stato${collegata ? ' is-on' : ''}`}>
                      <span className="admin-stato-dot" aria-hidden="true" />
                      {collegata ? (
                        <span>Collegata a: {usi.map(etichettaCollegamento).join(', ')}</span>
                      ) : (
                        <em>Non collegata a nessuna pratica</em>
                      )}
                    </p>
                  </div>
                  <div className="admin-riga-azioni">
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label={`Ascolta traccia ${t.titolo}`}
                      title="Ascolta traccia"
                      disabled={!t.url}
                      onClick={() => setDialogo({ tipo: 'ascolta', traccia: t })}
                    >
                      <IconaAscolto />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label={`Modifica traccia ${t.titolo}`}
                      title="Modifica traccia"
                      onClick={() => apriModifica(t)}
                    >
                      <IconaMatita />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label={`Sostituisci file ${t.titolo}`}
                      title="Sostituisci file"
                      disabled={occupato === t.id}
                      onClick={() => {
                        daSostituire.current = t
                        fileSostituisci.current?.click()
                      }}
                    >
                      <IconaSostituisci />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn is-danger"
                      aria-label={`Elimina traccia ${t.titolo}`}
                      title="Elimina traccia"
                      onClick={() => chiediElimina(t)}
                    >
                      <IconaCestino />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <input
        ref={fileSostituisci}
        type="file"
        accept="audio/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          suSostituisci(file)
        }}
      />
      <input
        ref={fileNuovo}
        type="file"
        accept="audio/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          confermaCarica(file)
        }}
      />

      {dialogo?.tipo === 'ascolta' && (
        <AdminDialogo
          titolo="Ascolta"
          className="is-ascolto"
          onChiudi={() => setDialogo(null)}
        >
          <CardTracciaAudio
            src={dialogo.traccia.url}
            titolo={dialogo.traccia.titolo}
            descrizione={dialogo.traccia.descrizione}
            etichettaDurata={
              Number.isFinite(dialogo.traccia.durata_minuti) && dialogo.traccia.durata_minuti > 0
                ? (dialogo.traccia.durata_minuti === 1 ? '1 minuto' : `${dialogo.traccia.durata_minuti} minuti`)
                : 'Audio'
            }
            anteprima
          />
          <div className="admin-dialogo-azioni">
            <button type="button" className="admin-btn-ghost" onClick={() => setDialogo(null)}>
              Chiudi
            </button>
          </div>
        </AdminDialogo>
      )}

      {dialogo?.tipo === 'carica' && (
        <AdminDialogo
          titolo="Carica traccia"
          onChiudi={() => occupato !== 'carica' && setDialogo(null)}
        >
          <div className="admin-field">
            <label htmlFor="nuova-traccia-titolo">Titolo</label>
            <input
              id="nuova-traccia-titolo"
              value={titoloForm}
              onChange={e => setTitoloForm(e.target.value)}
              placeholder="es. Body Scan"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="nuova-traccia-testo">Testo sotto il titolo nella card</label>
            <textarea
              id="nuova-traccia-testo"
              rows={3}
              value={descrizioneForm}
              onChange={e => setDescrizioneForm(e.target.value)}
              placeholder="Facoltativo"
            />
          </div>
          <div className="admin-dialogo-azioni">
            <button
              type="button"
              className="admin-btn-primario"
              disabled={occupato === 'carica'}
              onClick={() => fileNuovo.current?.click()}
            >
              {occupato === 'carica' ? 'Caricamento…' : 'Scegli il file audio'}
            </button>
            <button type="button" className="admin-btn-ghost" disabled={occupato === 'carica'} onClick={() => setDialogo(null)}>
              Annulla
            </button>
          </div>
        </AdminDialogo>
      )}

      {dialogo?.tipo === 'modifica' && (
        <AdminDialogo
          titolo="Modifica traccia"
          onChiudi={() => occupato !== 'modifica' && setDialogo(null)}
        >
          <div className="admin-field">
            <label htmlFor="modifica-traccia-titolo">Titolo</label>
            <input
              id="modifica-traccia-titolo"
              value={titoloForm}
              onChange={e => setTitoloForm(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="modifica-traccia-testo">Testo sotto il titolo nella card</label>
            <textarea
              id="modifica-traccia-testo"
              rows={3}
              value={descrizioneForm}
              onChange={e => setDescrizioneForm(e.target.value)}
              placeholder="Facoltativo"
            />
          </div>
          <div className="admin-dialogo-azioni">
            <button
              type="button"
              className="admin-btn-primario"
              disabled={occupato === 'modifica'}
              onClick={confermaModifica}
            >
              {occupato === 'modifica' ? 'Salvataggio…' : 'Salva'}
            </button>
            <button type="button" className="admin-btn-ghost" disabled={occupato === 'modifica'} onClick={() => setDialogo(null)}>
              Annulla
            </button>
          </div>
        </AdminDialogo>
      )}

      {dialogo?.tipo === 'elimina' && (
        <AdminDialogo
          titolo="Eliminare dalla libreria?"
          onChiudi={() => occupato !== 'elimina' && setDialogo(null)}
        >
          <p>Eliminare «{dialogo.traccia.titolo}» dalla libreria? Il file verrà rimosso.</p>
          <div className="admin-dialogo-azioni">
            <button
              type="button"
              className="admin-btn-pericolo"
              disabled={occupato === 'elimina'}
              onClick={confermaElimina}
            >
              {occupato === 'elimina' ? 'Eliminazione…' : 'Elimina traccia'}
            </button>
            <button type="button" className="admin-btn-ghost" disabled={occupato === 'elimina'} onClick={() => setDialogo(null)}>
              Annulla
            </button>
          </div>
        </AdminDialogo>
      )}

      {dialogo?.tipo === 'bloccata' && (
        <AdminDialogo titolo="Traccia ancora collegata" onChiudi={() => setDialogo(null)}>
          <p>
            Non puoi eliminare «{dialogo.traccia.titolo}»: è ancora collegata a
            {dialogo.usi.length === 1 ? ' questa pratica:' : ' queste pratiche:'}
          </p>
          <ul className="admin-elenco-usi">
            {dialogo.usi.map((voce, i) => (
              <li key={voce.esercizioId || voce.lezioneId || i}>
                {etichettaCollegamento(voce)}
              </li>
            ))}
          </ul>
          <div className="admin-dialogo-azioni">
            <button type="button" className="admin-btn-primario" onClick={() => setDialogo(null)}>
              Ho capito
            </button>
          </div>
        </AdminDialogo>
      )}
    </>
  )
}

function AdminDialogo({ titolo, children, onChiudi, className }) {
  const el = useRef(null)

  useEffect(() => {
    const dialog = el.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={el}
      className={['mbsr-theme admin-dialogo', className].filter(Boolean).join(' ')}
      onClose={onChiudi}
      onCancel={e => {
        e.preventDefault()
        onChiudi()
      }}
      onClick={e => {
        if (e.target === el.current) onChiudi()
      }}
    >
      <h2>{titolo}</h2>
      {children}
    </dialog>
  )
}
