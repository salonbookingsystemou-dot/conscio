import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AdminDialogo from './AdminDialogo.jsx'
import {
  caricaSfondoLocale,
  cercaSfondi,
  confermaSfondoRemoto,
  nomeFacilitatore,
  preparaVideo
} from '../lib/sfondoVetrina.js'

const FONTI = [
  ['caricato', 'Dal telefono'],
  ['unsplash', 'Unsplash'],
  ['pexels', 'Pexels']
]

export default function ScegliSfondo({ onChiudi, onConferma }) {
  const [fonte, setFonte] = useState('caricato')
  const [tipo, setTipo] = useState('foto')
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState([])
  const [scelto, setScelto] = useState(null)
  const [autore, setAutore] = useState('')
  const [linkAutore, setLinkAutore] = useState('')
  const [fuoco, setFuoco] = useState('centro')
  const [consenso, setConsenso] = useState(false)
  const [anteprima, setAnteprima] = useState('')
  const [file, setFile] = useState(null)
  const posterRef = useRef(null)
  const [stato, setStato] = useState('')
  const [errore, setErrore] = useState('')

  useEffect(() => {
    nomeFacilitatore().then(nome => {
      if (nome) setAutore(nome)
    }).catch(() => {})
  }, [])

  useEffect(() => () => {
    if (anteprima.startsWith('blob:')) URL.revokeObjectURL(anteprima)
  }, [anteprima])

  function cambiaFonte(prossima) {
    setFonte(prossima)
    setScelto(null)
    setRisultati([])
    setErrore('')
    if (prossima === 'unsplash') setTipo('foto')
  }

  async function cerca(e) {
    e.preventDefault()
    const parola = query.trim()
    if (!parola) return
    setStato('cerca')
    setErrore('')
    setScelto(null)
    try {
      const dati = await cercaSfondi(fonte, tipo, parola)
      setRisultati(dati.risultati || [])
      if (!(dati.risultati || []).length) setErrore('Nessuno sfondo con queste parole.')
    } catch (err) {
      setRisultati([])
      setErrore(err.message || 'Ricerca non riuscita.')
    } finally {
      setStato('')
    }
  }

  async function scegliFile(evento) {
    const prossimo = evento.target.files?.[0]
    evento.target.value = ''
    if (!prossimo) return
    if (anteprima.startsWith('blob:')) URL.revokeObjectURL(anteprima)
    setFile(prossimo)
    posterRef.current = null
    setConsenso(false)
    setErrore('')
    setStato('prepara')
    setAnteprima('')
    try {
      if (prossimo.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(prossimo.name)) {
        const { poster } = await preparaVideo(prossimo)
        posterRef.current = poster
        setAnteprima(URL.createObjectURL(poster))
        setTipo('video')
      } else {
        setAnteprima(URL.createObjectURL(prossimo))
        setTipo('foto')
      }
    } catch (err) {
      setFile(null)
      setErrore(err.message || 'File non utilizzabile.')
    } finally {
      setStato('')
    }
  }

  async function conferma() {
    setErrore('')
    setStato('salva')
    try {
      if (fonte === 'caricato') {
        if (!file) throw new Error('Scegli una foto o un video.')
        if (!autore.trim()) throw new Error('Indica chi ha realizzato lo sfondo.')
        if (!consenso) throw new Error('Serve la conferma sul permesso d’uso.')
        const caricato = await caricaSfondoLocale(file, posterRef.current)
        onConferma({
          ...caricato,
          sfondo_autore: autore.trim(),
          sfondo_autore_link: linkAutore.trim(),
          sfondo_fuoco: fuoco
        })
        return
      }
      if (!scelto) throw new Error('Scegli uno sfondo dalla ricerca.')
      if (fonte === 'unsplash') {
        await confermaSfondoRemoto({
          fonte: 'unsplash',
          tipo: 'foto',
          id: scelto.id,
          downloadLocation: scelto.downloadLocation
        })
        onConferma({
          sfondo_tipo: 'foto',
          sfondo_fonte: 'unsplash',
          sfondo_url: scelto.url,
          sfondo_poster_url: scelto.posterUrl || scelto.url,
          sfondo_fonte_id: scelto.id,
          sfondo_autore: scelto.autore,
          sfondo_autore_link: scelto.autoreLink || '',
          sfondo_fuoco: fuoco
        })
        return
      }
      const salvato = await confermaSfondoRemoto({
        fonte: 'pexels',
        tipo,
        id: scelto.id,
        url: scelto.url,
        posterUrl: scelto.posterUrl
      })
      onConferma({
        sfondo_tipo: salvato.sfondo_tipo || tipo,
        sfondo_fonte: 'pexels',
        sfondo_url: salvato.sfondo_url,
        sfondo_poster_url: salvato.sfondo_poster_url,
        sfondo_fonte_id: salvato.sfondo_fonte_id || scelto.id,
        sfondo_autore: scelto.autore,
        sfondo_autore_link: scelto.autoreLink || '',
        sfondo_fuoco: fuoco
      })
    } catch (err) {
      setErrore(err.message || 'Non sono riuscito a usare questo sfondo.')
      setStato('')
    }
  }

  const occupato = stato === 'cerca' || stato === 'prepara' || stato === 'salva'

  return createPortal(
    <AdminDialogo titolo="Scegli lo sfondo" className="is-vetrina" onChiudi={() => !occupato && onChiudi()}>
      <div className="vetrina-fonti" role="group" aria-label="Origine dello sfondo">
        {FONTI.map(([id, etichetta]) => (
          <button
            key={id}
            type="button"
            className={fonte === id ? 'btn is-piccolo' : 'btn btn-ghost is-piccolo'}
            aria-pressed={fonte === id}
            onClick={() => cambiaFonte(id)}
          >
            {etichetta}
          </button>
        ))}
      </div>

      {fonte === 'caricato' ? (
        <div className="vetrina-blocco">
          <label className="btn btn-tonal">
            {stato === 'prepara' ? 'Preparazione…' : 'Scegli foto o video'}
            <input
              className="visually-hidden"
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              onChange={scegliFile}
              disabled={occupato}
            />
          </label>
          <p className="hint">
            Foto fino a 10 MB, ridotta a 1440 pixel. Video fra 10 e 60 secondi, fino a 50 MB, in loop e senza audio. L’anteprima è anche la copertina.
          </p>
          {anteprima && (
            <img className="vetrina-anteprima" src={anteprima} alt="" />
          )}
          <div className="field">
            <label htmlFor="sfondo-autore">Autore</label>
            <input id="sfondo-autore" value={autore} onChange={e => setAutore(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sfondo-link">Link dell’autore, se c’è</label>
            <input
              id="sfondo-link"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={linkAutore}
              onChange={e => setLinkAutore(e.target.value)}
            />
          </div>
          <label className="vetrina-spunta">
            <input type="checkbox" checked={consenso} onChange={e => setConsenso(e.target.checked)} />
            <span>L’ho realizzato io o ho il permesso di usarlo; nessuna persona riconoscibile senza consenso.</span>
          </label>
        </div>
      ) : (
        <form onSubmit={cerca}>
          {fonte === 'unsplash' ? (
            <p className="hint">Unsplash ha solo foto. Il file resta sui loro server e va citato.</p>
          ) : (
            <div className="vetrina-fonti" role="group" aria-label="Foto o video">
              {['foto', 'video'].map(voce => (
                <button
                  key={voce}
                  type="button"
                  className={tipo === voce ? 'btn is-piccolo' : 'btn btn-ghost is-piccolo'}
                  aria-pressed={tipo === voce}
                  onClick={() => { setTipo(voce); setScelto(null); setRisultati([]) }}
                >
                  {voce === 'foto' ? 'Foto' : 'Video'}
                </button>
              ))}
            </div>
          )}
          <div className="field">
            <label htmlFor="sfondo-query">Parole</label>
            <input
              id="sfondo-query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="es. foresta, respiro, luce"
            />
          </div>
          <button className="btn" type="submit" disabled={occupato || !query.trim()}>
            {stato === 'cerca' ? 'Ricerca…' : 'Cerca'}
          </button>
          {risultati.length > 0 && (
            <div className="vetrina-griglia-sfondi">
              {risultati.map(voce => (
                <button
                  key={voce.id}
                  type="button"
                  className={`vetrina-sfondo-scelta${scelto?.id === voce.id ? ' is-scelto' : ''}`}
                  aria-pressed={scelto?.id === voce.id}
                  onClick={() => setScelto(voce)}
                >
                  <img src={voce.anteprimaUrl} alt="" />
                  <span>{voce.autore}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      )}

      <div className="field">
        <label htmlFor="sfondo-fuoco">Punto di inquadratura</label>
        <select id="sfondo-fuoco" value={fuoco} onChange={e => setFuoco(e.target.value)}>
          <option value="centro">Centro</option>
          <option value="alto">Alto</option>
          <option value="basso">Basso</option>
        </select>
      </div>

      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      <div className="dialogo-azioni">
        <button type="button" className="btn" disabled={occupato} onClick={conferma}>
          {stato === 'salva' ? 'Salvataggio…' : 'Usa come sfondo'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={occupato} onClick={onChiudi}>
          Annulla
        </button>
      </div>
    </AdminDialogo>,
    document.body
  )
}
