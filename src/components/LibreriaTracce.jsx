import { useEffect, useState } from 'react'
import DialogConferma from './DialogConferma.jsx'
import CardTracciaAudio from './CardTracciaAudio.jsx'
import {
  creaTraccia,
  elencaTracce,
  eliminaTraccia,
  etichettaCollegamentoTraccia,
  leggiTestoCard,
  messaggioErroreTraccia,
  rinominaTraccia,
  sostituisciFileTraccia,
  titoloDaNomeFile
} from '../lib/tracce'

export default function LibreriaTracce({
  tracce,
  usi,
  collegamenti = {},
  onAggiorna,
  onErrore,
  caricamentoId,
  setCaricamentoId
}) {
  const [titoloNuovo, setTitoloNuovo] = useState('')
  const [descrizioneNuova, setDescrizioneNuova] = useState('')
  const [modificaId, setModificaId] = useState(null)
  const [titoloModifica, setTitoloModifica] = useState('')
  const [descrizioneModifica, setDescrizioneModifica] = useState('')
  const [daEliminare, setDaEliminare] = useState(null)
  const [erroreElimina, setErroreElimina] = useState(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreForm, setErroreForm] = useState(null)

  async function suCarica(file) {
    if (!file) return
    onErrore(null)
    setCaricamentoId('nuova')
    try {
      await creaTraccia(file, {
        titolo: titoloNuovo || titoloDaNomeFile(file.name),
        descrizione: descrizioneNuova
      })
      setTitoloNuovo('')
      setDescrizioneNuova('')
      await onAggiorna()
    } catch (err) {
      onErrore(err)
    } finally {
      setCaricamentoId(null)
    }
  }

  async function suRinomina(traccia) {
    onErrore(null)
    setErroreForm(null)
    setSalvataggio(true)
    try {
      await rinominaTraccia(traccia.id, titoloModifica, descrizioneModifica)
      setModificaId(null)
      await onAggiorna()
    } catch (err) {
      setErroreForm(messaggioErroreTraccia(err))
      onErrore(err)
    } finally {
      setSalvataggio(false)
    }
  }

  async function suSostituisci(traccia, file) {
    if (!file) return
    onErrore(null)
    setCaricamentoId(traccia.id)
    try {
      await sostituisciFileTraccia(traccia, file)
      await onAggiorna()
    } catch (err) {
      onErrore(err)
    } finally {
      setCaricamentoId(null)
    }
  }

  async function suElimina(traccia) {
    const lista = collegamenti[traccia.id] || []
    if (lista.length > 0) {
      setErroreElimina({ titolo: traccia.titolo, collegamenti: lista })
      return
    }
    setErroreElimina(null)
    setDaEliminare(traccia)
  }

  async function confermaElimina() {
    const traccia = daEliminare
    if (!traccia) return
    onErrore(null)
    setErroreElimina(null)
    try {
      await eliminaTraccia(traccia)
      setDaEliminare(null)
      await onAggiorna()
    } catch (err) {
      setDaEliminare(null)
      if (err?.message === 'TRACCIA_IN_USO') {
        setErroreElimina({
          titolo: traccia.titolo,
          collegamenti: err.collegamenti || []
        })
      }
      onErrore(err)
    }
  }

  return (
    <>
    <details className="lezioni-libreria" open={tracce.length === 0}>
      <summary>
        Libreria tracce
        <span className="lezioni-libreria-count">{tracce.length}</span>
      </summary>
      <p className="hint">
        Carica ogni file una volta. Poi collegalo alle pratiche di qualsiasi settimana o ciclo.
        Sostituire il file aggiorna tutti i collegamenti.
      </p>
      {erroreElimina && (
        <div className="mbsr-theme lezioni-errore-collegamenti" role="alert">
          <p>
            Non puoi eliminare «{erroreElimina.titolo}»: è ancora collegata a
            {erroreElimina.collegamenti.length === 1 ? ' questa pratica:' : ' queste pratiche:'}
          </p>
          <ul>
            {(erroreElimina.collegamenti.length > 0
              ? erroreElimina.collegamenti
              : [{ descrizione: 'una o più pratiche', numeroSettimana: null }]
            ).map((voce, i) => (
              <li key={voce.esercizioId || voce.lezioneId || i}>
                {etichettaCollegamentoTraccia(voce)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="lezioni-libreria-form"
        onSubmit={e => e.preventDefault()}
      >
        <div className="field">
          <label htmlFor="titolo-traccia-nuova">Titolo</label>
          <input
            id="titolo-traccia-nuova"
            value={titoloNuovo}
            onChange={e => setTitoloNuovo(e.target.value)}
            placeholder="es. Body Scan"
          />
        </div>
        <div className="field">
          <label htmlFor="descrizione-traccia-nuova">Testo sotto il titolo nella card</label>
          <textarea
            id="descrizione-traccia-nuova"
            value={descrizioneNuova}
            onChange={e => setDescrizioneNuova(e.target.value)}
            rows={2}
            placeholder="Facoltativo"
          />
        </div>
        <label className="btn lezioni-file-btn">
          {caricamentoId === 'nuova' ? 'Caricamento…' : 'Scegli il file audio'}
          <input
            type="file"
            accept="audio/*"
            hidden
            disabled={caricamentoId === 'nuova'}
            onChange={e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              suCarica(file)
            }}
          />
        </label>
      </form>

      {tracce.length === 0 ? (
        <p className="hint">Nessuna traccia ancora. Il primo upload la rende disponibile ovunque.</p>
      ) : (
        <ul className="lezioni-libreria-lista">
          {tracce.map(t => {
            const n = usi[t.id] || 0
            return (
              <li key={t.id} className="lezioni-libreria-riga">
                {modificaId === t.id ? (
                  <form
                    className="lezioni-libreria-form"
                    onSubmit={e => {
                      e.preventDefault()
                      suRinomina(t)
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`titolo-traccia-${t.id}`}>Titolo</label>
                      <input
                        id={`titolo-traccia-${t.id}`}
                        value={titoloModifica}
                        onChange={e => setTitoloModifica(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`testo-traccia-${t.id}`}>Testo sotto il titolo nella card</label>
                      <textarea
                        id={`testo-traccia-${t.id}`}
                        value={descrizioneModifica}
                        onChange={e => setDescrizioneModifica(e.target.value)}
                        rows={2}
                        placeholder="Facoltativo"
                      />
                    </div>
                    {erroreForm && (
                      <p className="campo-errore" role="alert">{erroreForm}</p>
                    )}
                    <div className="azioni">
                      <button className="btn" type="submit" disabled={salvataggio}>
                        {salvataggio ? 'Salvataggio…' : 'Salva'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={salvataggio}
                        onClick={() => setModificaId(null)}
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="lezioni-libreria-testi">
                      <strong>{t.titolo}</strong>
                      <p className="hint">
                        {[
                          Number.isFinite(t.durata_minuti) && t.durata_minuti > 0
                            ? `${t.durata_minuti} min`
                            : null,
                          n === 0 ? 'non collegata' : n === 1 ? '1 collegamento' : `${n} collegamenti`
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {n > 0 && (
                        <div className="mbsr-theme lezioni-libreria-collegamenti">
                          <span className="lezioni-libreria-collegamenti-kicker">Collegata a</span>
                          <ul>
                            {(collegamenti[t.id] || []).map((voce, i) => (
                              <li key={voce.esercizioId || voce.lezioneId || i}>
                                {etichettaCollegamentoTraccia(voce)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {t.descrizione ? (
                        <p className="lezioni-libreria-anteprima-testo">{t.descrizione}</p>
                      ) : null}
                    </div>
                    <div className="lezioni-pratica-azioni">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          setModificaId(t.id)
                          setTitoloModifica(t.titolo)
                          setDescrizioneModifica(t.descrizione || '')
                          leggiTestoCard(t).then(testo => {
                            setDescrizioneModifica(testo || t.descrizione || '')
                          })
                        }}
                      >
                        Modifica
                      </button>
                      <label className="btn btn-ghost lezioni-file-btn">
                        {caricamentoId === t.id ? 'Caricamento…' : 'Sostituisci file'}
                        <input
                          type="file"
                          accept="audio/*"
                          hidden
                          disabled={Boolean(caricamentoId)}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            suSostituisci(t, file)
                          }}
                        />
                      </label>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => suElimina(t)}
                      >
                        Elimina
                      </button>
                    </div>
                    <details className="lezioni-anteprima">
                      <summary>Ascolta l’anteprima</summary>
                      <CardTracciaAudio
                        src={t.url}
                        titolo={t.titolo}
                        descrizione={t.descrizione}
                        etichettaDurata={
                          Number.isFinite(t.durata_minuti) && t.durata_minuti > 0
                            ? (t.durata_minuti === 1 ? '1 minuto' : `${t.durata_minuti} minuti`)
                            : undefined
                        }
                        anteprima
                      />
                    </details>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </details>
    <DialogConferma
      aperto={!!daEliminare}
      titolo="Eliminare dalla libreria?"
      confermaEtichetta="Elimina traccia"
      pericolo
      onConferma={confermaElimina}
      onAnnulla={() => setDaEliminare(null)}
    >
      {daEliminare ? `Eliminare «${daEliminare.titolo}» dalla libreria?` : ''}
    </DialogConferma>
    </>
  )
}

export function SelettoreTraccia({
  id,
  valore,
  tracce,
  onCambia,
  etichettaVuoto
}) {
  const [live, setLive] = useState(tracce || [])

  useEffect(() => {
    setLive(tracce || [])
  }, [tracce])

  useEffect(() => {
    let vivo = true
    elencaTracce()
      .then(lista => {
        if (vivo) setLive(lista)
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  return (
    <select
      id={id}
      className="lezioni-selettore-traccia"
      value={valore || ''}
      onChange={e => onCambia(e.target.value || null)}
      aria-label="Traccia collegata"
    >
      <option value="">{etichettaVuoto}</option>
      {live.map(t => (
        <option key={t.id} value={t.id}>
          {t.titolo}
          {Number.isFinite(t.durata_minuti) && t.durata_minuti > 0 ? ` (${t.durata_minuti} min)` : ''}
        </option>
      ))}
    </select>
  )
}
