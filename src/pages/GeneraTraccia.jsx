import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { concatenaConPause, durataMp3 } from '../lib/audioMp3'
import { rifinisciMp3 } from '../lib/rifinisciVoce'
import {
  MODELLI,
  dividiScript,
  elencaVociJson,
  generaPezzo,
  modelloDaId,
  spezzaTesto,
  stimaGenerazione,
  VELOCITA_MAX,
  VELOCITA_MIN,
  VELOCITA_PASSO,
  velocitaDi
} from '../lib/generaVoce'
import { AUDIO_MAX, creaTraccia, messaggioErroreTraccia } from '../lib/tracce'

function nuovoId() {
  return crypto.randomUUID()
}

function paragrafoVuoto(pausaDopo) {
  return {
    id: nuovoId(),
    testo: '',
    pausaDopo,
    audio: null,
    requestId: '',
    modello: '',
    voceId: '',
    obsoleto: false
  }
}

function compatibile(paragrafo, modelloId, voceId) {
  return Boolean(
    paragrafo.audio
    && paragrafo.modello === modelloId
    && paragrafo.voceId === voceId
  )
}

function firmaParagrafi(lista) {
  return (lista || [])
    .map(p => String(p.testo || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function semeDi(valore) {
  const n = Number(valore)
  return Number.isInteger(n) && n >= 0 && n <= 4294967295 ? n : null
}

function formattaMinuti(minuti) {
  if (!Number.isFinite(minuti) || minuti <= 0) return '0 min'
  if (minuti < 1) return `${Math.max(1, Math.round(minuti * 60))} s`
  const arrotondati = Math.round(minuti * 10) / 10
  return `${arrotondati} min`
}

export default function GeneraTraccia() {
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [modelloId, setModelloId] = useState(MODELLI[0].id)
  const [voceId, setVoceId] = useState('')
  const [voci, setVoci] = useState([])
  const [vociPronte, setVociPronte] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [velocita, setVelocita] = useState(1)
  const [pausaPredefinita, setPausaPredefinita] = useState(10)
  const [script, setScript] = useState('')
  const [paragrafi, setParagrafi] = useState([])
  const [confermaDividi, setConfermaDividi] = useState(false)
  const [errore, setErrore] = useState(null)
  const [erroreVersione, setErroreVersione] = useState(0)
  const erroreNodo = useRef(null)
  const [avviso, setAvviso] = useState(null)
  const [aggancioPerso, setAggancioPerso] = useState(false)
  const [occupato, setOccupato] = useState(null)
  const [avanzamento, setAvanzamento] = useState(null)
  const [inAscolto, setInAscolto] = useState(null)
  const [file, setFile] = useState(null)
  const abortRef = useRef(null)
  const ascoltoRef = useRef(null)
  const audioRef = useRef(null)
  const campioneRef = useRef(null)
  const velocitaRef = useRef(1)
  const fileUrlRef = useRef('')

  const modello = modelloDaId(modelloId)
  const voce = voci.find(v => v.id === voceId) || null
  const stima = useMemo(
    () => stimaGenerazione(paragrafi, modello, velocita),
    [paragrafi, modello, velocita]
  )
  const scriptDiverso = paragrafi.length > 0 && dividiScript(script).join('\n\n') !== firmaParagrafi(paragrafi)
  const pronti = paragrafi.filter(p => String(p.testo || '').trim() && compatibile(p, modelloId, voceId))
  const daFare = paragrafi.filter(p => vaRigenerato(p, modelloId, voceId, seed, velocita))
  const puoGenerareTutto = Boolean(voceId) && (scriptDiverso || daFare.length > 0)
  const italiane = voci.filter(v => v.italiana)
  const altre = voci.filter(v => !v.italiana)

  useEffect(() => {
    const controller = new AbortController()
    elencaVociJson(controller.signal)
      .then(lista => {
        setVoci(lista)
        setVociPronte(true)
        setVoceId(corrente => corrente || lista.find(v => v.italiana)?.id || lista[0]?.id || '')
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        setVociPronte(true)
        mostraErrore(err?.message || 'Non è stato possibile leggere le voci.')
      })
    return () => controller.abort()
  }, [])

  function mostraErrore(testo) {
    setErrore(testo)
    setErroreVersione(n => n + 1)
  }

  useEffect(() => {
    if (!errore) return
    erroreNodo.current?.scrollIntoView({ block: 'center' })
  }, [errore, erroreVersione])

  useEffect(() => () => {
    ascoltoRef.current?.abort()
    audioRef.current?.pause()
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
  }, [])

  function rilasciaFile() {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
    fileUrlRef.current = ''
    setFile(null)
  }

  function fermaAscolto() {
    ascoltoRef.current?.abort()
    ascoltoRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    campioneRef.current = null
    setInAscolto(null)
  }

  function aggiornaParagrafo(id, patch) {
    rilasciaFile()
    setParagrafi(lista => lista.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  function cambiaTesto(id, testo) {
    const indice = paragrafi.findIndex(p => p.id === id)
    rilasciaFile()
    const prossima = paragrafi.map((p, i) => {
      if (p.id === id) {
        return { ...p, testo, audio: null, requestId: '', modello: '', voceId: '', obsoleto: false, seed: null }
      }
      if (modello.aggancia && indice >= 0 && i > indice && p.audio) {
        return { ...p, obsoleto: true }
      }
      return p
    })
    setParagrafi(prossima)
    setScript(firmaParagrafi(prossima))
  }

  function applicaDivisione() {
    const blocchi = dividiScript(script)
    if (blocchi.length === 0) {
      mostraErrore('Incolla lo script. Una riga vuota separa i paragrafi.')
      return
    }
    fermaAscolto()
    rilasciaFile()
    const pausa = normalizzaPausa(pausaPredefinita)
    setParagrafi(blocchi.map(testo => ({ ...paragrafoVuoto(pausa), testo })))
    setConfermaDividi(false)
    setErrore(null)
    setAvviso(null)
  }

  function chiediDivisione() {
    if (paragrafi.some(p => p.audio)) {
      setConfermaDividi(true)
      return
    }
    applicaDivisione()
  }

  async function generaUno(lista, id, signal) {
    const indice = lista.findIndex(p => p.id === id)
    const corrente = lista[indice]
    if (!corrente) return null
    const testo = String(corrente.testo || '').trim()
    if (!testo) throw new Error('Il paragrafo è vuoto.')
    if (!voceId) throw new Error('Scegli una voce.')
    const pezzi = spezzaTesto(testo, modello.max)
    const precedenti = []
    if (modello.aggancia) {
      for (let i = 0; i < indice; i += 1) {
        const prima = lista[i]
        if (compatibile(prima, modelloId, voceId) && prima.requestId && !prima.obsoleto) {
          precedenti.push(prima.requestId)
        }
      }
    }
    const audioPezzi = []
    let requestId = ''
    let agganciato = true
    const catena = precedenti.slice(-3)
    const dopo = String(lista[indice + 1]?.testo || '').trim()
    for (let n = 0; n < pezzi.length; n += 1) {
      if (signal?.aborted) return null
      const risultato = await generaPezzo({
        testo: pezzi[n],
        voceId,
        modello: modelloId,
        precedenti: modello.aggancia ? catena : [],
        successivo: modello.aggancia ? (pezzi[n + 1] || dopo) : '',
        seed,
        velocita,
        signal
      })
      let rifinito
      try {
        rifinito = await rifinisciMp3(risultato.audio)
      } catch {
        throw new Error('Non è stato possibile allineare il volume di questo paragrafo.')
      }
      audioPezzi.push(rifinito)
      if (risultato.aggancioPerso) agganciato = false
      if (risultato.requestId) {
        catena.push(risultato.requestId)
        if (catena.length > 3) catena.shift()
        requestId = risultato.requestId
      }
    }
    const audio = audioPezzi.length === 1
      ? audioPezzi[0]
      : await concatenaConPause(audioPezzi, [])
    if (!agganciato) setAggancioPerso(true)
    return { audio, requestId }
  }

  function applicaGenerato(lista, id, risultato) {
    const indice = lista.findIndex(p => p.id === id)
    return lista.map((p, i) => {
      if (p.id === id) {
        return {
          ...p,
          audio: risultato.audio,
          requestId: risultato.requestId,
          modello: modelloId,
          voceId,
          seed: semeDi(seed),
          velocita,
          obsoleto: false
        }
      }
      if (modello.aggancia && indice >= 0 && i > indice && p.audio) {
        return { ...p, obsoleto: true }
      }
      return p
    })
  }

  async function generaParagrafo(id) {
    fermaAscolto()
    rilasciaFile()
    setErrore(null)
    setAvviso(null)
    setAggancioPerso(false)
    setOccupato(id)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const risultato = await generaUno(paragrafi, id, controller.signal)
      if (risultato) setParagrafi(applicaGenerato(paragrafi, id, risultato))
    } catch (err) {
      if (err?.name !== 'AbortError') mostraErrore(err?.message || 'Non è stato possibile generare l’audio.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setOccupato(null)
    }
  }

  function paragrafiDaScript(testoScript, esistenti) {
    const blocchi = dividiScript(testoScript)
    const pausa = normalizzaPausa(pausaPredefinita)
    let rotto = false
    return blocchi.map((testo, i) => {
      const prima = esistenti[i]
      const uguale = Boolean(prima) && String(prima.testo || '').trim() === testo
      if (!uguale) rotto = true
      if (uguale && !rotto) return prima
      if (uguale) {
        return modello.aggancia && prima.audio ? { ...prima, obsoleto: true } : prima
      }
      return {
        ...paragrafoVuoto(prima ? normalizzaPausa(prima.pausaDopo) : pausa),
        testo
      }
    })
  }

  async function generaTutto() {
    let lista = paragrafi
    if (dividiScript(script).join('\n\n') !== firmaParagrafi(paragrafi)) {
      lista = paragrafiDaScript(script, paragrafi)
      setParagrafi(lista)
      setScript(firmaParagrafi(lista))
    }
    const ids = lista.filter(p => vaRigenerato(p, modelloId, voceId, seed, velocita)).map(p => p.id)
    if (ids.length === 0) {
      rilasciaFile()
      return
    }
    fermaAscolto()
    rilasciaFile()
    setErrore(null)
    setAvviso(null)
    setAggancioPerso(false)
    setOccupato('tutti')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for (let n = 0; n < ids.length; n += 1) {
        if (controller.signal.aborted) break
        setAvanzamento({ fatto: n, totale: ids.length })
        const risultato = await generaUno(lista, ids[n], controller.signal)
        if (!risultato) break
        lista = applicaGenerato(lista, ids[n], risultato)
        setParagrafi(lista)
      }
    } catch (err) {
      if (err?.name !== 'AbortError') mostraErrore(err?.message || 'Non è stato possibile generare l’audio.')
    } finally {
      setAvanzamento(null)
      if (abortRef.current === controller) abortRef.current = null
      setOccupato(null)
    }
  }

  function interrompi() {
    abortRef.current?.abort()
  }

  function riproduci(bytes, signal) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      const audio = new Audio(url)
      audioRef.current = audio
      let chiuso = false
      const chiudi = (erroreAudio) => {
        if (chiuso) return
        chiuso = true
        URL.revokeObjectURL(url)
        if (audioRef.current === audio) audioRef.current = null
        if (erroreAudio) reject(erroreAudio)
        else resolve()
      }
      signal.addEventListener('abort', () => {
        audio.pause()
        chiudi()
      }, { once: true })
      audio.onended = () => chiudi()
      audio.onerror = () => chiudi(new Error('Non riesco a riprodurre questo pezzo.'))
      audio.play().catch(err => chiudi(err))
    })
  }

  function attendi(ms, signal, onTick) {
    return new Promise(resolve => {
      const inizio = Date.now()
      const timer = window.setInterval(() => {
        const restanti = Math.max(0, ms - (Date.now() - inizio))
        onTick(restanti)
        if (restanti <= 0) {
          window.clearInterval(timer)
          resolve()
        }
      }, 200)
      signal.addEventListener('abort', () => {
        window.clearInterval(timer)
        resolve()
      }, { once: true })
    })
  }

  async function ascoltaDa(indice) {
    fermaAscolto()
    const controller = new AbortController()
    ascoltoRef.current = controller
    setErrore(null)
    try {
      for (let i = indice; i < paragrafi.length; i += 1) {
        if (controller.signal.aborted) return
        const paragrafo = paragrafi[i]
        if (!String(paragrafo.testo || '').trim()) continue
        if (!compatibile(paragrafo, modelloId, voceId)) {
          mostraErrore(`Il paragrafo ${i + 1} non è ancora generato con questo modello e questa voce.`)
          return
        }
        setInAscolto({ id: paragrafo.id, pausa: false })
        await riproduci(paragrafo.audio, controller.signal)
        if (controller.signal.aborted) return
        const pausa = i < paragrafi.length - 1 ? normalizzaPausa(paragrafo.pausaDopo) : 0
        if (pausa > 0) {
          setInAscolto({ id: paragrafo.id, pausa: true, restanti: pausa })
          await attendi(pausa * 1000, controller.signal, restanti => {
            setInAscolto({ id: paragrafo.id, pausa: true, restanti: Math.ceil(restanti / 1000) })
          })
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') mostraErrore(err?.message || 'Non riesco a riprodurre l’anteprima.')
    } finally {
      if (ascoltoRef.current === controller) {
        ascoltoRef.current = null
        setInAscolto(null)
      }
    }
  }

  function ascoltaCampione() {
    if (!voce?.anteprima) return
    fermaAscolto()
    const audio = new Audio(voce.anteprima)
    impostaRitmoCampione(audio, velocitaRef.current)
    audio.addEventListener('loadedmetadata', () => {
      if (campioneRef.current === audio) impostaRitmoCampione(audio, velocitaRef.current)
    })
    audio.onended = () => {
      if (campioneRef.current === audio) campioneRef.current = null
    }
    audioRef.current = audio
    campioneRef.current = audio
    audio.play().catch(() => mostraErrore('Non riesco a riprodurre il campione della voce.'))
  }

  async function preparaFile() {
    if (daFare.length > 0) {
      mostraErrore('Genera tutti i paragrafi con il modello e la voce scelti prima di preparare il file.')
      return
    }
    fermaAscolto()
    setErrore(null)
    setOccupato('file')
    try {
      const conTesto = paragrafi.filter(p => String(p.testo || '').trim())
      const bytes = await concatenaConPause(
        conTesto.map(p => p.audio),
        conTesto.map(p => normalizzaPausa(p.pausaDopo))
      )
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      if (blob.size > AUDIO_MAX) {
        mostraErrore('Il file supera i 50 MB della libreria. Accorcia le pause o dividi lo script in due tracce.')
        return
      }
      rilasciaFile()
      const url = URL.createObjectURL(blob)
      fileUrlRef.current = url
      const secondi = durataMp3(bytes)
      setFile({
        blob,
        url,
        secondi,
        obsoleti: conTesto.some(p => p.obsoleto)
      })
    } catch {
      mostraErrore('Non è stato possibile unire i paragrafi in un unico file.')
    } finally {
      setOccupato(null)
    }
  }

  async function salva() {
    if (!file?.blob) return
    const nome = titolo.trim()
    if (!nome) {
      mostraErrore('Scrivi il titolo con cui la traccia compare in libreria.')
      return
    }
    setErrore(null)
    setOccupato('salva')
    try {
      const mp3 = new File([file.blob], `${nome}.mp3`, { type: 'audio/mpeg' })
      const minuti = Number.isFinite(file.secondi) && file.secondi > 0
        ? Math.max(1, Math.round(file.secondi / 60))
        : undefined
      await creaTraccia(mp3, { titolo: nome, descrizione, durataMinuti: minuti })
      setAvviso('Traccia salvata in libreria.')
    } catch (err) {
      mostraErrore(messaggioErroreTraccia(err))
    } finally {
      setOccupato(null)
    }
  }

  function cambiaVelocita(valore) {
    const prossima = velocitaDi(valore)
    velocitaRef.current = prossima
    setVelocita(prossima)
    rilasciaFile()
    if (campioneRef.current) impostaRitmoCampione(campioneRef.current, prossima)
  }

  const generaInCorso = occupato === 'tutti' || paragrafi.some(p => occupato === p.id)

  return (
    <>
      <header className="admin-page-head">
        <h1>Genera traccia</h1>
        <p>
          Incolla lo script, scegli modello, voce e velocità del parlato, metti le pause tra i paragrafi.
          L’anteprima si ascolta qui; il file entra in libreria solo quando lo salvi.
        </p>
      </header>

      {errore && <p ref={erroreNodo} className="avviso-errore" role="alert">{errore}</p>}
      {avviso && (
        <p className="disclaimer" role="status">
          {avviso} <Link to="/libreria">Apri la libreria</Link>
        </p>
      )}
      {aggancioPerso && (
        <p className="disclaimer" role="status">
          ElevenLabs non ha accettato l’aggancio con i paragrafi vicini: in almeno un paragrafo il tono può cambiare. Rigeneralo per riprovare.
        </p>
      )}

      <section className="card">
        <div className="genera-campi">
          <div className="field">
            <label htmlFor="genera-titolo">Titolo in libreria</label>
            <input
              id="genera-titolo"
              value={titolo}
              onChange={e => setTitolo(e.target.value)}
              maxLength={140}
            />
          </div>
          <div className="field">
            <label htmlFor="genera-pausa">Pausa predefinita (secondi)</label>
            <input
              id="genera-pausa"
              type="number"
              min="0"
              max="300"
              step="1"
              value={pausaPredefinita}
              onChange={e => setPausaPredefinita(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="genera-card">Testo della card</label>
          <textarea
            id="genera-card"
            rows={2}
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
            placeholder="Quello che il partecipante legge sulla pratica. Non viene pronunciato."
          />
        </div>
        <div className="genera-campi">
          <div className="field">
            <label htmlFor="genera-modello">Modello</label>
            <select
              id="genera-modello"
              value={modelloId}
              onChange={e => {
                setModelloId(e.target.value)
                rilasciaFile()
              }}
            >
              {MODELLI.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="genera-voce">Voce</label>
            <select
              id="genera-voce"
              value={voceId}
              onChange={e => {
                setVoceId(e.target.value)
                rilasciaFile()
              }}
              disabled={voci.length === 0}
            >
              {!vociPronte && <option value="">Caricamento voci…</option>}
              {vociPronte && voci.length === 0 && <option value="">Nessuna voce disponibile</option>}
              {italiane.length > 0 && (
                <optgroup label="Italiano">
                  {italiane.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </optgroup>
              )}
              {altre.length > 0 && (
                <optgroup label={italiane.length ? 'Altre' : 'Voci'}>
                  {altre.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        <div className="field genera-velocita">
          <div className="genera-velocita-testa">
            <label htmlFor="genera-velocita">Velocità del parlato</label>
            <strong>{testoVelocita(velocita)}</strong>
          </div>
          <input
            id="genera-velocita"
            type="range"
            min={VELOCITA_MIN}
            max={VELOCITA_MAX}
            step={VELOCITA_PASSO}
            value={velocita}
            aria-valuetext={descrizioneVelocita(velocita)}
            onChange={e => cambiaVelocita(e.target.value)}
          />
          <div className="genera-velocita-estremi" aria-hidden="true">
            <span>Più lenta</span>
            <span>Più rapida</span>
          </div>
        </div>
        <p className="genera-nota">
          {modello.nota} Le pause sono silenzio aggiunto qui e non consumano crediti.
          Il campione della voce si ascolta alla velocità scelta.
          Ogni paragrafo esce col volume allineato. La chiusura non copre l’ultima parola.
          Nel file entra solo quando generi: i paragrafi già fatti restano com’erano finché non li rigeneri.
        </p>
        <div className="genera-strumenti">
          <div className="field genera-seed">
            <label htmlFor="genera-seed">Variazione</label>
            <input
              id="genera-seed"
              type="number"
              min="0"
              max="4294967295"
              step="1"
              value={seed}
              onChange={e => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost is-piccolo"
            onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
          >
            Altra variazione
          </button>
          <button
            type="button"
            className="btn btn-ghost is-piccolo"
            onClick={ascoltaCampione}
            disabled={!voce?.anteprima}
          >
            Ascolta il campione
          </button>
        </div>
      </section>

      <section className="card">
        <div className="field">
          <label htmlFor="genera-script">Script</label>
          <textarea
            id="genera-script"
            rows={10}
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="Incolla il testo. Lascia una riga vuota tra un paragrafo e l’altro."
          />
        </div>
        {confermaDividi ? (
          <div className="genera-conferma">
            <p>Dividere di nuovo cancella l’audio già generato.</p>
            <div className="azioni">
              <button type="button" className="btn" onClick={applicaDivisione}>Dividi comunque</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfermaDividi(false)}>Annulla</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn" onClick={chiediDivisione} disabled={Boolean(occupato)}>
            Dividi in paragrafi
          </button>
        )}
      </section>

      {paragrafi.length > 0 && (
        <section className="card is-lista" aria-label="Paragrafi">
          <ul className="genera-lista">
            {paragrafi.map((p, indice) => {
              const pronto = compatibile(p, modelloId, voceId)
              const stessaVelocita = (p.velocita ?? 1) === velocita
              const attivo = inAscolto?.id === p.id
              return (
                <li key={p.id} className={attivo ? 'is-attivo' : undefined}>
                  <div className="genera-paragrafo">
                    <div className="genera-paragrafo-testa">
                      <p className="genera-kicker">Paragrafo {indice + 1}</p>
                      <p className="genera-meta">
                        {String(p.testo || '').trim().length} caratteri
                        {pronto && stessaVelocita ? ' · pronto' : ''}
                        {p.audio && !pronto ? ' · generato con un altro modello o un’altra voce' : ''}
                        {pronto && !stessaVelocita ? ' · generato a un’altra velocità' : ''}
                        {p.obsoleto && pronto ? ' · la voce precedente è cambiata' : ''}
                        {attivo && inAscolto.pausa ? ` · pausa ${inAscolto.restanti}s` : ''}
                        {attivo && !inAscolto.pausa ? ' · in ascolto' : ''}
                      </p>
                    </div>
                    <textarea
                      rows={4}
                      value={p.testo}
                      aria-label={`Testo del paragrafo ${indice + 1}`}
                      disabled={Boolean(occupato)}
                      onChange={e => cambiaTesto(p.id, e.target.value)}
                    />
                    <div className="azioni">
                      <button
                        type="button"
                        className="btn is-piccolo"
                        onClick={() => generaParagrafo(p.id)}
                        disabled={Boolean(occupato) || !String(p.testo || '').trim() || !voceId}
                      >
                        {occupato === p.id ? 'Genero…' : pronto ? 'Rigenera' : 'Genera'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost is-piccolo"
                        onClick={() => ascoltaDa(indice)}
                        disabled={!pronto || Boolean(occupato)}
                      >
                        Ascolta da qui
                      </button>
                      {paragrafi.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost is-piccolo"
                          onClick={() => {
                            fermaAscolto()
                            rilasciaFile()
                            const indice = paragrafi.findIndex(voce => voce.id === p.id)
                            const prossima = paragrafi
                              .filter(voce => voce.id !== p.id)
                              .map((voce, i) => (
                                modello.aggancia && i >= indice && voce.audio
                                  ? { ...voce, obsoleto: true }
                                  : voce
                              ))
                            setParagrafi(prossima)
                            setScript(firmaParagrafi(prossima))
                          }}
                          disabled={Boolean(occupato)}
                        >
                          Togli
                        </button>
                      )}
                    </div>
                  </div>
                  {indice < paragrafi.length - 1 && (
                    <div className="genera-pausa">
                      <div className="field">
                        <label htmlFor={`pausa-${p.id}`}>Pausa dopo (secondi)</label>
                        <input
                          id={`pausa-${p.id}`}
                          type="number"
                          min="0"
                          max="300"
                          step="1"
                          value={p.pausaDopo}
                          onChange={e => {
                            rilasciaFile()
                            aggiornaParagrafo(p.id, { pausaDopo: e.target.value })
                          }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="genera-riepilogo">
            <p>
              {stima.caratteri.toLocaleString('it-IT')} caratteri · circa {stima.crediti.toLocaleString('it-IT')} crediti
              {' '}· voce {formattaMinuti(stima.minutiVoce)} · pause {formattaMinuti(stima.minutiPause)}
              {' '}· parlato {testoVelocita(velocita)}
            </p>
            <p className="genera-nota">
              La stima della voce usa circa mille caratteri al minuto al ritmo normale, e segue la velocità scelta. La durata vera si sente nell’anteprima.
            </p>
            {avanzamento && (
              <p role="status">Paragrafo {avanzamento.fatto + 1} di {avanzamento.totale}</p>
            )}
            <div className="azioni">
              {generaInCorso ? (
                <button type="button" className="btn btn-ghost" onClick={interrompi}>Interrompi</button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={generaTutto}
                  disabled={!puoGenerareTutto || Boolean(occupato)}
                  title={puoGenerareTutto ? undefined : 'Nessuna modifica rispetto all’audio già generato.'}
                >
                  Genera tutto
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => ascoltaDa(0)}
                disabled={pronti.length === 0 || daFare.length > 0 || Boolean(occupato) || inAscolto}
              >
                Ascolta tutto
              </button>
              {inAscolto && (
                <button type="button" className="btn btn-ghost" onClick={fermaAscolto}>Ferma</button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={preparaFile}
                disabled={daFare.length > 0 || pronti.length === 0 || Boolean(occupato)}
              >
                {occupato === 'file' ? 'Preparo il file…' : 'Prepara il file'}
              </button>
            </div>
            {file && (
              <div className="genera-file">
                {file.obsoleti && (
                  <p className="genera-nota">
                    Un paragrafo è stato generato prima di un cambiamento a monte. Se senti un salto, rigenera i paragrafi segnati e prepara di nuovo il file.
                  </p>
                )}
                <audio className="genera-player" controls src={file.url} preload="metadata" />
                <p className="genera-meta">
                  File da salvare
                  {Number.isFinite(file.secondi) ? ` · ${formattaMinuti(file.secondi / 60)}` : ''}
                  {' '}· {Math.round(file.blob.size / (1024 * 1024) * 10) / 10} MB
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={salva}
                  disabled={occupato === 'salva' || !titolo.trim()}
                >
                  {occupato === 'salva' ? 'Salvo…' : 'Salva in libreria'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}

function vaRigenerato(paragrafo, modelloId, voceId, seed, velocita) {
  if (!String(paragrafo.testo || '').trim()) return false
  if (!compatibile(paragrafo, modelloId, voceId)) return true
  if (paragrafo.obsoleto) return true
  if ((paragrafo.velocita ?? 1) !== velocita) return true
  return (paragrafo.seed ?? null) !== semeDi(seed)
}

function impostaRitmoCampione(audio, valore) {
  const ritmo = velocitaDi(valore)
  audio.preservesPitch = true
  audio.webkitPreservesPitch = true
  audio.playbackRate = ritmo
}

function testoVelocita(valore) {
  const n = velocitaDi(valore)
  const numero = n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n === 1) return `${numero} · normale`
  return numero
}

function descrizioneVelocita(valore) {
  const n = velocitaDi(valore)
  const numero = n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n === 1) return `${numero}, ritmo normale`
  if (n < 1) return `${numero}, più lenta del ritmo normale`
  return `${numero}, più rapida del ritmo normale`
}

function normalizzaPausa(valore) {
  const n = Number(valore)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(300, Math.round(n))
}
