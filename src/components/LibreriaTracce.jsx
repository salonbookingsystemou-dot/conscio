import { useState } from 'react'
import DialogConferma from './DialogConferma.jsx'
import CardTracciaAudio from './CardTracciaAudio.jsx'
import {
  creaTraccia,
  eliminaTraccia,
  leggiTestoCard,
  messaggioErroreTraccia,
  rinominaTraccia,
  sostituisciFileTraccia,
  titoloDaNomeFile
} from '../lib/tracce'

export default function LibreriaTracce({
  tracce,
  usi,
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
    const n = usi[traccia.id] || 0
    if (n > 0) {
      onErrore(new Error('TRACCIA_IN_USO'))
      return
    }
    setDaEliminare(traccia)
  }

  async function confermaElimina() {
    const traccia = daEliminare
    if (!traccia) return
    const n = usi[traccia.id] || 0
    onErrore(null)
    try {
      await eliminaTraccia(traccia, n)
      setDaEliminare(null)
      await onAggiorna()
    } catch (err) {
      setDaEliminare(null)
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
                        disabled={n > 0}
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
  return (
    <select
      id={id}
      className="lezioni-selettore-traccia"
      value={valore || ''}
      onChange={e => onCambia(e.target.value || null)}
      aria-label="Traccia dalla libreria"
    >
      <option value="">{etichettaVuoto}</option>
      {tracce.map(t => (
        <option key={t.id} value={t.id}>
          {t.titolo}
          {Number.isFinite(t.durata_minuti) && t.durata_minuti > 0 ? ` (${t.durata_minuti} min)` : ''}
        </option>
      ))}
    </select>
  )
}
