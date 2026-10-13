import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import StatoAttesa from '../../components/StatoAttesa.jsx'
import { creaTraccia, elencaTracce, messaggioErroreTraccia, titoloDaNomeFile } from '../../lib/tracce.js'
import GeneraDaScript from './GeneraDaScript.jsx'

function CaricaFile({ onSalvata }) {
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [file, setFile] = useState(null)
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState(null)

  async function salva(e) {
    e.preventDefault()
    if (!file) {
      setErrore('Scegli il file audio.')
      return
    }
    setOccupato(true)
    setErrore(null)
    try {
      const traccia = await creaTraccia(file, {
        titolo: titolo || titoloDaNomeFile(file.name),
        descrizione
      })
      onSalvata(traccia)
    } catch (err) {
      setErrore(messaggioErroreTraccia(err))
      setOccupato(false)
    }
  }

  return (
    <form className="card" onSubmit={salva}>
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}
      <div className="field">
        <label htmlFor="nuova-file">File audio</label>
        <input
          id="nuova-file"
          type="file"
          accept="audio/*"
          onChange={e => {
            const scelto = e.target.files?.[0] || null
            setFile(scelto)
            if (scelto && !titolo) setTitolo(titoloDaNomeFile(scelto.name))
          }}
        />
        <p className="hint">Al massimo 50 MB. MP3 è il formato più leggero per chi ascolta da telefono.</p>
      </div>
      <div className="field">
        <label htmlFor="nuova-titolo">Titolo</label>
        <input id="nuova-titolo" value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="es. Body Scan" />
      </div>
      <div className="field">
        <label htmlFor="nuova-testo">Testo della card</label>
        <textarea
          id="nuova-testo"
          rows={3}
          value={descrizione}
          onChange={e => setDescrizione(e.target.value)}
          placeholder="Facoltativo"
        />
      </div>
      <div className="azioni">
        <button type="submit" className="btn" disabled={occupato}>
          {occupato ? 'Carico il file…' : 'Salva in libreria'}
        </button>
      </div>
    </form>
  )
}

export default function NuovaTraccia() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const modo = search.get('modo')
  const idSostituisci = modo === 'genera' ? search.get('sostituisci') : null
  const [daSostituire, setDaSostituire] = useState(undefined)
  const montato = useRef(true)

  useEffect(() => () => { montato.current = false }, [])

  useEffect(() => {
    if (!idSostituisci) {
      setDaSostituire(null)
      return
    }
    setDaSostituire(undefined)
    elencaTracce()
      .then(lista => { if (montato.current) setDaSostituire(lista.find(t => t.id === idSostituisci) || null) })
      .catch(() => { if (montato.current) setDaSostituire(null) })
  }, [idSostituisci])

  function apriSalvata(traccia) {
    navigate(`/admin/tracce?traccia=${traccia.id}`, { state: { controlla: true } })
  }

  const titoloPagina = idSostituisci ? 'Rigenera da script' : 'Nuova traccia'

  return (
    <>
      <Link
        to={idSostituisci ? `/admin/tracce?traccia=${idSostituisci}` : '/admin/tracce'}
        className="link-testuale dash-ciclo-indietro"
      >
        ← Tracce
      </Link>
      <header className="dash-panel-testa">
        <div>
          <h1>{titoloPagina}</h1>
          <p className="lead">
            {idSostituisci
              ? 'Il nuovo audio sostituisce il file della traccia. Titolo, testo, vetrina e collegamenti restano.'
              : 'Quando la salvi, la traccia si apre nella libreria e il controllo parte da solo.'}
          </p>
        </div>
      </header>

      {!idSostituisci && (
        <div className="filtri-chip" role="group" aria-label="Come vuoi creare la traccia">
          <Link
            className={`dash-tab${modo === 'carica' ? ' is-on' : ''}`}
            aria-current={modo === 'carica' ? 'page' : undefined}
            to="/admin/tracce/nuova?modo=carica"
            replace
          >
            Carica un file
          </Link>
          <Link
            className={`dash-tab${modo === 'genera' ? ' is-on' : ''}`}
            aria-current={modo === 'genera' ? 'page' : undefined}
            to="/admin/tracce/nuova?modo=genera"
            replace
          >
            Genera da script
          </Link>
        </div>
      )}

      {!modo && (
        <p className="hint">
          Carica un file se hai già la registrazione. Genera da script se vuoi una voce sintetica:
          incolli il testo, scegli la voce e le pause, ascolti l’anteprima e salvi.
        </p>
      )}

      {modo === 'carica' && <CaricaFile onSalvata={apriSalvata} />}

      {modo === 'genera' && (
        idSostituisci && daSostituire === undefined ? (
          <StatoAttesa etichetta="Leggo la traccia…" />
        ) : idSostituisci && !daSostituire ? (
          <p className="avviso-errore" role="alert">
            Questa traccia non è più in libreria. <Link to="/admin/tracce">Torna alle tracce</Link>
          </p>
        ) : (
          <GeneraDaScript
            key={idSostituisci || 'nuova'}
            sostituisci={daSostituire || null}
            onSalvata={apriSalvata}
          />
        )
      )}
    </>
  )
}
