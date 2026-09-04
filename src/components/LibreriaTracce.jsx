import { useState } from 'react'
import {
  creaTraccia,
  eliminaTraccia,
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
  const [modificaId, setModificaId] = useState(null)
  const [titoloModifica, setTitoloModifica] = useState('')

  async function suCarica(file) {
    if (!file) return
    onErrore(null)
    setCaricamentoId('nuova')
    try {
      await creaTraccia(file, { titolo: titoloNuovo || titoloDaNomeFile(file.name) })
      setTitoloNuovo('')
      await onAggiorna()
    } catch (err) {
      onErrore(err)
    } finally {
      setCaricamentoId(null)
    }
  }

  async function suRinomina(traccia) {
    onErrore(null)
    try {
      await rinominaTraccia(traccia.id, titoloModifica)
      setModificaId(null)
      await onAggiorna()
    } catch (err) {
      onErrore(err)
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
    if (!confirm(`Eliminare «${traccia.titolo}» dalla libreria?`)) return
    onErrore(null)
    try {
      await eliminaTraccia(traccia, n)
      await onAggiorna()
    } catch (err) {
      onErrore(err)
    }
  }

  return (
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
        className="lezioni-libreria-carica"
        onSubmit={e => e.preventDefault()}
      >
        <div className="field">
          <label htmlFor="titolo-traccia-nuova">Titolo (facoltativo)</label>
          <input
            id="titolo-traccia-nuova"
            value={titoloNuovo}
            onChange={e => setTitoloNuovo(e.target.value)}
            placeholder="es. Body scan 45'"
          />
        </div>
        <label className="btn lezioni-file-btn">
          {caricamentoId === 'nuova' ? 'Caricamento…' : 'Carica in libreria'}
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
                  <div className="lezioni-edit-ex">
                    <input
                      value={titoloModifica}
                      onChange={e => setTitoloModifica(e.target.value)}
                      aria-label="Titolo traccia"
                    />
                    <div className="azioni">
                      <button className="btn" type="button" onClick={() => suRinomina(t)}>
                        Salva
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setModificaId(null)}>
                        Annulla
                      </button>
                    </div>
                  </div>
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
                    </div>
                    <audio className="player-audio" controls src={t.url} preload="metadata">
                      Il browser non riproduce questa traccia.
                    </audio>
                    <div className="lezioni-ex-azioni">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setModificaId(t.id)
                          setTitoloModifica(t.titolo)
                        }}
                      >
                        Titolo
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
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}

export function SelettoreTraccia({
  valore,
  tracce,
  onCambia,
  etichettaVuoto
}) {
  return (
    <select
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
