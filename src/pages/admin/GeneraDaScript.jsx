import { useEffect, useMemo, useRef, useState } from 'react'
import StatoAttesa from '../../components/StatoAttesa.jsx'
import { durataMp3 } from '../../lib/audioMp3'
import { rifinisciVoce, unisciPcm, wavDa } from '../../lib/rifinisciVoce'
import { preparaMp3 } from '../../lib/tracciaFinale'
import {
  MODELLI,
  MODELLO_PREDEFINITO,
  dividiScript,
  elencaVociJson,
  generaPezzo,
  modelloDaId,
  spezzaTesto,
  STABILITA_MAX,
  STABILITA_MIN,
  STABILITA_PASSO,
  stabilitaDi,
  stabilitaPerModello,
  stabilitaPredefinitaDi,
  stimaGenerazione,
  VELOCITA_MAX,
  VELOCITA_MIN,
  VELOCITA_PASSO,
  velocitaDi,
  velocitaPerModello
} from '../../lib/generaVoce'
import { caricaAudioParagrafi, leggiScriptTraccia, salvaScriptTraccia } from '../../lib/scriptTraccia'
import { AUDIO_MAX, creaTraccia, messaggioErroreTraccia, sostituisciFileTraccia } from '../../lib/tracce'

// Gli ID delle richieste a ElevenLabs valgono 2 ore: oltre, l’aggancio non regge.
// Con un margine, i paragrafi più vecchi di 110 minuti non si agganciano più.
const AGGANCIO_VALIDO_MS = 110 * 60 * 1000

function aggancioValido(paragrafo, adesso = Date.now()) {
  const t = Date.parse(paragrafo.generatoIl || '')
  return Number.isFinite(t) && adesso - t < AGGANCIO_VALIDO_MS
}

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
    obsoleto: false,
    agganciato: null,
    generatoIl: null
  }
}

function vocePredefinita(lista) {
  const dimitri = lista.find(v => v.nome.trim().toLowerCase() === 'dimitri grassi')
  return (dimitri || lista.find(v => v.italiana) || lista[0])?.id || ''
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

export default function GeneraDaScript({ sostituisci = null, onSalvata }) {
  const [titolo, setTitolo] = useState(sostituisci?.titolo || '')
  const [descrizione, setDescrizione] = useState('')
  const [modelloId, setModelloId] = useState(MODELLO_PREDEFINITO)
  const [voceId, setVoceId] = useState('')
  const [voci, setVoci] = useState([])
  const [vociPronte, setVociPronte] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [velocita, setVelocita] = useState(1)
  const [stabilita, setStabilita] = useState(() => stabilitaPredefinitaDi(modelloDaId(MODELLO_PREDEFINITO)))
  const [pausaPredefinita, setPausaPredefinita] = useState(10)
  const [script, setScript] = useState('')
  const [paragrafi, setParagrafi] = useState([])
  const [confermaDividi, setConfermaDividi] = useState(false)
  const [errore, setErrore] = useState(null)
  const [erroreVersione, setErroreVersione] = useState(0)
  const erroreNodo = useRef(null)
  const [avviso, setAvviso] = useState(null)
  const [aggancioPerso, setAggancioPerso] = useState(false)
  const [aggancioScaduto, setAggancioScaduto] = useState(false)
  const [occupato, setOccupato] = useState(null)
  const [avanzamento, setAvanzamento] = useState(null)
  const [inAscolto, setInAscolto] = useState(null)
  const [file, setFile] = useState(null)
  const [recupero, setRecupero] = useState(sostituisci?.id ? 'carico' : 'pronto')
  const [scriptSalvato, setScriptSalvato] = useState(false)
  const [scrittura, setScrittura] = useState(null)
  const creataRef = useRef(sostituisci)
  const abortRef = useRef(null)
  const ascoltoRef = useRef(null)
  const audioRef = useRef(null)
  const campioneRef = useRef(null)
  const velocitaRef = useRef(1)
  const fileUrlRef = useRef('')

  const modello = modelloDaId(modelloId)
  // v4 e V3 ignorano la velocità: per loro vale sempre 1, il cursore resta sul valore scelto per gli altri modelli.
  const velocitaAttiva = modello.velocita !== false
  const velocitaEffettiva = velocitaPerModello(modello, velocita)
  const stabilitaEffettiva = stabilitaPerModello(modello, stabilita)
  const voce = voci.find(v => v.id === voceId) || null
  const stima = useMemo(
    () => stimaGenerazione(paragrafi, modello, velocitaEffettiva),
    [paragrafi, modello, velocitaEffettiva]
  )
  const scriptDiverso = paragrafi.length > 0 && dividiScript(script).join('\n\n') !== firmaParagrafi(paragrafi)
  const pronti = paragrafi.filter(p => String(p.testo || '').trim() && compatibile(p, modelloId, voceId))
  const daFare = paragrafi.filter(p => vaRigenerato(p, modelloId, voceId, seed, velocitaEffettiva, stabilitaEffettiva))
  const puoGenerareTutto = Boolean(voceId) && (scriptDiverso || daFare.length > 0)
  const senzaAggancio = paragrafi.some(p => p.audio && p.agganciato === false)
  const italiane = voci.filter(v => v.italiana)
  const altre = voci.filter(v => !v.italiana)

  useEffect(() => {
    const controller = new AbortController()
    elencaVociJson(controller.signal)
      .then(lista => {
        setVoci(lista)
        setVociPronte(true)
        setVoceId(corrente => corrente || vocePredefinita(lista))
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        setVociPronte(true)
        mostraErrore(err?.message || 'Non è stato possibile leggere le voci.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!sostituisci?.id) return undefined
    let vivo = true
    leggiScriptTraccia(sostituisci.id)
      .then(async (esito) => {
        if (!vivo) return null
        if (!esito.disponibile || !esito.ricetta) return { ricetta: null, paragrafi: null }
        const paragrafiCaricati = await caricaAudioParagrafi(sostituisci.id, esito.ricetta.paragrafi)
        return { ricetta: esito.ricetta, paragrafi: paragrafiCaricati }
      })
      .then((esito) => {
        if (!vivo || !esito) return
        if (!esito.ricetta) {
          setScriptSalvato(false)
          setRecupero('pronto')
          return
        }
        const { ricetta, paragrafi: caricati } = esito
        setModelloId(ricetta.modello)
        if (ricetta.voceId) setVoceId(ricetta.voceId)
        setSeed(ricetta.variazione == null ? '' : ricetta.variazione)
        setVelocita(ricetta.velocita)
        velocitaRef.current = ricetta.velocita
        setStabilita(ricetta.stabilita ?? stabilitaPredefinitaDi(modelloDaId(ricetta.modello)))
        setPausaPredefinita(ricetta.pausaPredefinita)
        setParagrafi(caricati)
        setScript(firmaParagrafi(caricati))
        setScriptSalvato(true)
        setRecupero('pronto')
        const mancanti = caricati.filter(p => p.audioMancante).length
        if (mancanti > 0) {
          const quanti = mancanti === 1
            ? 'Non ho recuperato l’audio di un paragrafo: va rigenerato.'
            : `Non ho recuperato l’audio di ${mancanti} paragrafi: vanno rigenerati.`
          setAvviso(`${quanti} Gli altri sono pronti. Se è solo la rete, ricarica la pagina prima di generare tutto.`)
        }
      })
      .catch(() => {
        if (vivo) setRecupero('errore')
      })
    return () => { vivo = false }
  }, [sostituisci?.id])

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
        return {
          ...p,
          testo,
          audio: null,
          requestId: '',
          modello: '',
          voceId: '',
          obsoleto: false,
          seed: null,
          agganciato: null,
          generatoIl: null,
          audioSalvato: false,
          audioFormato: null,
          audioMancante: false
        }
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
    // Dopo l’ultimo paragrafo viene la campana: la pausa lì parte da zero.
    setParagrafi(blocchi.map((testo, i) => ({
      ...paragrafoVuoto(i === blocchi.length - 1 ? 0 : pausa),
      testo
    })))
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

  // Due paragrafi diventano uno: una generazione in meno, un confine in meno
  // in cui il tono può cambiare. Resta la pausa del secondo.
  function unisciAlSuccessivo(id) {
    const indice = paragrafi.findIndex(p => p.id === id)
    const corrente = paragrafi[indice]
    const dopo = paragrafi[indice + 1]
    if (!corrente || !dopo) return
    fermaAscolto()
    rilasciaFile()
    const testo = [corrente.testo, dopo.testo].map(t => String(t || '').trim()).filter(Boolean).join(' ')
    const prossima = []
    paragrafi.forEach((p, i) => {
      if (i === indice) prossima.push({ ...paragrafoVuoto(dopo.pausaDopo), id: corrente.id, testo })
      else if (i === indice + 1) return
      else if (modello.aggancia && i > indice && p.audio) prossima.push({ ...p, obsoleto: true })
      else prossima.push(p)
    })
    setParagrafi(prossima)
    setScript(firmaParagrafi(prossima))
  }

  async function generaUno(lista, id, signal) {
    const indice = lista.findIndex(p => p.id === id)
    const corrente = lista[indice]
    if (!corrente) return null
    const testo = String(corrente.testo || '').trim()
    if (!testo) throw new Error('Il paragrafo è vuoto.')
    if (!voceId) throw new Error('Scegli una voce.')
    const pezzi = spezzaTesto(testo, modello.max)
    let vicini = []
    if (modello.aggancia) {
      for (let i = 0; i < indice; i += 1) {
        const prima = lista[i]
        if (compatibile(prima, modelloId, voceId) && prima.requestId && !prima.obsoleto) {
          vicini.push(prima)
        }
      }
      vicini = vicini.slice(-3)
    }
    // Gli ID scaduti non si mandano: ElevenLabs li rifiuterebbe e la richiesta
    // ripartirebbe comunque senza aggancio.
    const adesso = Date.now()
    const validi = vicini.filter(p => aggancioValido(p, adesso))
    if (validi.length < vicini.length) setAggancioScaduto(true)
    const audioPezzi = []
    let requestId = ''
    let agganciato = true
    const catena = validi.map(p => p.requestId)
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
        velocita: velocitaEffettiva,
        stabilita: stabilitaEffettiva,
        signal
      })
      let rifinito
      try {
        rifinito = await rifinisciVoce(risultato.audio, risultato.formato)
      } catch {
        throw new Error('Non è stato possibile leggere l’audio di questo paragrafo.')
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
      : unisciPcm(audioPezzi)
    if (!agganciato) setAggancioPerso(true)
    return { audio, requestId, agganciato: modello.aggancia ? agganciato : null }
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
          velocita: velocitaEffettiva,
          stabilita: stabilitaEffettiva,
          agganciato: risultato.agganciato,
          generatoIl: new Date().toISOString(),
          obsoleto: false,
          audioSalvato: false,
          audioFormato: null,
          audioMancante: false
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
    setAggancioScaduto(false)
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
      const ultimo = i === blocchi.length - 1
      const esistente = esistenti[i]
      // L’ultimo di prima, se ora ne ha altri dopo e non aveva pausa, prende quella predefinita.
      const prima = esistente && i === esistenti.length - 1 && !ultimo && !normalizzaPausa(esistente.pausaDopo)
        ? { ...esistente, pausaDopo: pausa }
        : esistente
      const uguale = Boolean(prima) && String(prima.testo || '').trim() === testo
      if (!uguale) rotto = true
      if (uguale && !rotto) return prima
      if (uguale) {
        return modello.aggancia && prima.audio ? { ...prima, obsoleto: true } : prima
      }
      return {
        ...paragrafoVuoto(prima ? normalizzaPausa(prima.pausaDopo) : (ultimo ? 0 : pausa)),
        testo
      }
    })
  }

  // Con `daId` rigenera quel paragrafo e tutti i seguenti, anche se sono pronti
  // («Rigenera da qui», «Rigenera tutto»); senza, solo quelli da rifare.
  async function generaTutto(daId = null) {
    let lista = paragrafi
    if (dividiScript(script).join('\n\n') !== firmaParagrafi(paragrafi)) {
      lista = paragrafiDaScript(script, paragrafi)
      setParagrafi(lista)
      setScript(firmaParagrafi(lista))
    }
    const da = daId == null ? -1 : Math.max(0, lista.findIndex(p => p.id === daId))
    const daRigenerare = (p, i) => (
      (da >= 0 && i >= da && Boolean(String(p.testo || '').trim()))
      || vaRigenerato(p, modelloId, voceId, seed, velocitaEffettiva, stabilitaEffettiva)
    )
    const primo = lista.findIndex(daRigenerare)
    if (primo < 0) {
      rilasciaFile()
      return
    }
    // Con l’aggancio ogni paragrafo rigenerato rende obsoleti quelli già pronti
    // che lo seguono: vanno rifatti nello stesso giro, non lasciati in sospeso.
    const totale = lista.filter((p, i) => daRigenerare(p, i) || (
      modello.aggancia && i > primo && p.audio && String(p.testo || '').trim()
    )).length
    fermaAscolto()
    rilasciaFile()
    setErrore(null)
    setAvviso(null)
    setAggancioPerso(false)
    setAggancioScaduto(false)
    setOccupato('tutti')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      let fatto = 0
      for (let i = primo; i < lista.length; i += 1) {
        if (controller.signal.aborted) break
        const id = lista[i].id
        if (!daRigenerare(lista[i], i)) continue
        setAvanzamento({ fatto, totale })
        const risultato = await generaUno(lista, id, controller.signal)
        if (!risultato) break
        lista = applicaGenerato(lista, id, risultato)
        setParagrafi(lista)
        fatto += 1
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

  function riproduci(pcm, signal) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(wavDa(pcm))
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
        const pausa = normalizzaPausa(paragrafo.pausaDopo)
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
    const ritmo = () => (velocitaAttiva ? velocitaRef.current : 1)
    impostaRitmoCampione(audio, ritmo())
    audio.addEventListener('loadedmetadata', () => {
      if (campioneRef.current === audio) impostaRitmoCampione(audio, ritmo())
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
      const bytes = await preparaMp3(conTesto.map(p => ({
        pcm: p.audio,
        pausaDopo: normalizzaPausa(p.pausaDopo)
      })))
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

  function statoScript() {
    return {
      modelloId,
      voceId,
      velocita,
      stabilita,
      variazione: seed,
      pausaPredefinita,
      paragrafi
    }
  }

  function segnaAudioTenuto(esito) {
    const saltati = new Set(esito?.omessi || [])
    const formato = esito?.formato || 'gzip'
    setParagrafi(lista => lista.map(p => {
      if (!p.audio || saltati.has(p.id)) return p
      return {
        ...p,
        audioSalvato: true,
        audioFormato: p.audioSalvato ? (p.audioFormato || formato) : formato,
        audioMancante: false
      }
    }))
  }

  async function salvaSoloScript() {
    const traccia = creataRef.current
    if (!traccia?.id) return
    setErrore(null)
    setAvviso(null)
    setOccupato('script')
    try {
      const esito = await salvaScriptTraccia(traccia.id, statoScript(), setScrittura)
      segnaAudioTenuto(esito)
      setScriptSalvato(true)
      setAvviso(esito.omessi.length
        ? messaggioOmessi(esito.omessi.length, false)
        : 'Script salvato. Il file in libreria è ancora quello di prima.')
    } catch (err) {
      mostraErrore(messaggioScript(err, false))
    } finally {
      setScrittura(null)
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
    setAvviso(null)
    setOccupato('salva')
    let fileSalvato = false
    try {
      const mp3 = new File([file.blob], `${nome}.mp3`, { type: 'audio/mpeg' })
      const minuti = Number.isFinite(file.secondi) && file.secondi > 0
        ? Math.max(1, Math.round(file.secondi / 60))
        : undefined
      let traccia = creataRef.current
      if (traccia?.id) await sostituisciFileTraccia(traccia, mp3)
      else {
        traccia = await creaTraccia(mp3, { titolo: nome, descrizione, durataMinuti: minuti })
        creataRef.current = traccia
      }
      fileSalvato = true
      const esito = await salvaScriptTraccia(traccia.id, statoScript(), setScrittura)
      segnaAudioTenuto(esito)
      setScriptSalvato(true)
      setOccupato(null)
      setScrittura(null)
      if (esito.omessi.length) {
        setAvviso(messaggioOmessi(esito.omessi.length, true))
        return
      }
      onSalvata?.(traccia)
    } catch (err) {
      mostraErrore(fileSalvato ? messaggioScript(err, true) : messaggioErroreTraccia(err))
      setScrittura(null)
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
  const introduzione = !sostituisci
    ? 'Incolla lo script, scegli modello, voce e velocità del parlato, metti le pause tra i paragrafi. L’anteprima si ascolta qui; il file entra in libreria solo quando lo salvi. Lo script resta sulla traccia, così puoi rivederlo.'
    : scriptSalvato
      ? 'Testo, pause, voce e paragrafi già generati sono quelli salvati. Cambia una frase e rigenera solo i paragrafi segnati: se il modello aggancia la voce, si rifanno anche i successivi.'
      : 'Questa traccia non ha uno script salvato. Incollalo e generalo: al salvataggio restano sulla traccia il testo, le pause e i paragrafi già fatti.'

  if (recupero === 'carico') {
    return <StatoAttesa etichetta="Recupero lo script e i paragrafi già generati…" />
  }

  if (recupero === 'errore') {
    return (
      <p className="avviso-errore" role="alert">
        Non sono riuscito a leggere lo script salvato. Ricarica la pagina prima di modificare, così non viene sovrascritto.
      </p>
    )
  }

  return (
    <>
      <p className="hint">{introduzione}</p>

      {errore && <p ref={erroreNodo} className="avviso-errore" role="alert">{errore}</p>}
      {avviso && <p className="disclaimer" role="status">{avviso}</p>}
      {aggancioScaduto && (
        <div className="genera-avviso" role="status">
          <p className="disclaimer">
            L’aggancio con i paragrafi già pronti è scaduto. Per una voce uniforme rigenera dall’inizio.
          </p>
          <button
            type="button"
            className="btn btn-ghost is-piccolo"
            onClick={() => generaTutto(paragrafi[0]?.id)}
            disabled={Boolean(occupato) || !voceId}
          >
            Rigenera tutto
          </button>
        </div>
      )}
      {aggancioPerso && !senzaAggancio && (
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
              readOnly={Boolean(sostituisci)}
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
        {!sostituisci && (
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
        )}
        <div className="genera-campi">
          <div className="field">
            <label htmlFor="genera-modello">Modello</label>
            <select
              id="genera-modello"
              value={modelloId}
              onChange={e => {
                setModelloId(e.target.value)
                // Ogni modello parte dalla sua stabilità consigliata (v2 0,62, v4 0,85).
                setStabilita(stabilitaPredefinitaDi(modelloDaId(e.target.value)))
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
            <strong>{velocitaAttiva ? testoVelocita(velocita) : 'ritmo della voce'}</strong>
          </div>
          <input
            id="genera-velocita"
            type="range"
            min={VELOCITA_MIN}
            max={VELOCITA_MAX}
            step={VELOCITA_PASSO}
            value={velocitaAttiva ? velocita : 1}
            disabled={!velocitaAttiva}
            aria-describedby={velocitaAttiva ? undefined : 'genera-velocita-nota'}
            aria-valuetext={descrizioneVelocita(velocitaAttiva ? velocita : 1)}
            onChange={e => cambiaVelocita(e.target.value)}
          />
          <div className="genera-velocita-estremi" aria-hidden="true">
            <span>Più lenta</span>
            <span>Più rapida</span>
          </div>
          {!velocitaAttiva && (
            <p id="genera-velocita-nota" className="hint">
              Con {modello.nome} la velocità non si regola: ElevenLabs la ignora. Per il ritmo usa la punteggiatura
              (i puntini allungano le pause) e le pause tra i paragrafi.
            </p>
          )}
        </div>
        {stabilitaEffettiva != null && (
          <div className="field genera-velocita">
            <div className="genera-velocita-testa">
              <label htmlFor="genera-stabilita">Stabilità della voce</label>
              <strong>{testoStabilita(stabilitaEffettiva, modello)}</strong>
            </div>
            <input
              id="genera-stabilita"
              type="range"
              min={STABILITA_MIN}
              max={STABILITA_MAX}
              step={STABILITA_PASSO}
              value={stabilitaEffettiva}
              aria-describedby="genera-stabilita-nota"
              aria-valuetext={testoStabilita(stabilitaEffettiva, modello).replace(' · ', ', ')}
              onChange={e => {
                setStabilita(stabilitaDi(e.target.value, stabilitaPredefinitaDi(modello)))
                rilasciaFile()
              }}
            />
            <div className="genera-velocita-estremi" aria-hidden="true">
              <span>Più espressiva</span>
              <span>Più costante</span>
            </div>
            <p id="genera-stabilita-nota" className="hint">
              Più alta, il tono resta uguale da un paragrafo all’altro; a 1 può diventare piatto. Cambiandola, i paragrafi già fatti vanno rigenerati.
            </p>
          </div>
        )}
        <p className="genera-nota">
          {modello.nota} Le pause sono silenzio aggiunto qui e non consumano crediti.{' '}
          {velocitaAttiva && 'Il campione della voce si ascolta alla velocità scelta. '}
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
              const stessaVelocita = (p.velocita ?? 1) === velocitaEffettiva
              const stessaStabilita = stessaStabilitaDi(p, stabilitaEffettiva)
              const attivo = inAscolto?.id === p.id
              const ultimo = indice === paragrafi.length - 1
              return (
                <li key={p.id} className={attivo ? 'is-attivo' : undefined}>
                  <div className="genera-paragrafo">
                    <div className="genera-paragrafo-testa">
                      <p className="genera-kicker">Paragrafo {indice + 1}</p>
                      <p className="genera-meta">
                        {String(p.testo || '').trim().length} caratteri
                        {pronto && stessaVelocita && stessaStabilita ? ' · pronto' : ''}
                        {p.audio && !pronto ? ' · generato con un altro modello o un’altra voce' : ''}
                        {pronto && !stessaVelocita ? ' · generato a un’altra velocità' : ''}
                        {pronto && !stessaStabilita ? ' · generato con un’altra stabilità' : ''}
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
                      {pronto && p.agganciato === false && (
                        <>
                          <span className="badge genera-badge">Senza aggancio</span>
                          <button
                            type="button"
                            className="btn btn-text is-piccolo"
                            onClick={() => generaTutto(p.id)}
                            disabled={Boolean(occupato) || !voceId}
                          >
                            Rigenera da qui
                          </button>
                        </>
                      )}
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
                  <div className="genera-pausa">
                    <div className="genera-pausa-riga">
                    <div className="field">
                      <label htmlFor={`pausa-${p.id}`}>
                        {ultimo ? 'Pausa prima della campana (secondi)' : 'Pausa dopo (secondi)'}
                      </label>
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
                    {!ultimo && (
                      <button
                        type="button"
                        className="btn btn-text is-piccolo"
                        onClick={() => unisciAlSuccessivo(p.id)}
                        disabled={Boolean(occupato)}
                      >
                        Unisci al successivo
                      </button>
                    )}
                    </div>
                    {!ultimo && normalizzaPausa(p.pausaDopo) < 3 && (
                      <p className="genera-pausa-nota">
                        Una pausa breve si fa con i puntini nel testo: unendo i paragrafi la voce resta più uniforme.
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="genera-riepilogo">
            <p>
              {stima.caratteri.toLocaleString('it-IT')} caratteri · circa {stima.crediti.toLocaleString('it-IT')} crediti
              {' '}· voce {formattaMinuti(stima.minutiVoce)} · pause {formattaMinuti(stima.minutiPause)}
              {velocitaAttiva && <>{' '}· parlato {testoVelocita(velocita)}</>}
            </p>
            <p className="genera-nota">
              La stima della voce usa circa mille caratteri al minuto al ritmo normale{velocitaAttiva ? ', e segue la velocità scelta' : ''}. La durata vera si sente nell’anteprima.
            </p>
            {avanzamento && (
              <p role="status">Paragrafo {avanzamento.fatto + 1} di {avanzamento.totale}</p>
            )}
            {scrittura?.totale > 0 && (
              <p role="status">
                {scrittura.fatto < scrittura.totale
                  ? `Salvo l’audio del paragrafo ${scrittura.fatto + 1} di ${scrittura.totale}`
                  : 'Salvo lo script…'}
              </p>
            )}
            <div className="azioni">
              {generaInCorso ? (
                <button type="button" className="btn btn-ghost" onClick={interrompi}>Interrompi</button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => generaTutto()}
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
              {sostituisci && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={salvaSoloScript}
                  disabled={Boolean(occupato)}
                >
                  {occupato === 'script' ? 'Salvo lo script…' : 'Salva lo script'}
                </button>
              )}
            </div>
            {sostituisci && (
              <p className="genera-nota">
                «Salva lo script» tiene testo, pause e paragrafi già generati, senza cambiare il file che ascoltano i partecipanti.
              </p>
            )}
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
                  {occupato === 'salva' ? 'Salvo…' : sostituisci ? 'Sostituisci il file' : 'Salva in libreria'}
                </button>
                <p className="genera-nota">Con il file si salva anche lo script.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}

function messaggioScript(err, fileSalvato) {
  if (err?.message === 'GENERAZIONE_ASSENTE') {
    return fileSalvato
      ? 'Il file è in libreria, ma lo script non è stato salvato: manca l’aggiornamento del database. Quando c’è, salva di nuovo da questa pagina.'
      : 'Lo script non è stato salvato: manca l’aggiornamento del database.'
  }
  if (err?.message === 'SCRIPT_VUOTO') return 'Non c’è testo da salvare.'
  if (fileSalvato) return 'Il file è in libreria, ma lo script non è stato salvato. Riprova tra un attimo.'
  return 'Lo script non è stato salvato. Riprova tra un attimo.'
}

function messaggioOmessi(quanti, fileSalvato) {
  const quali = quanti === 1
    ? 'Un paragrafo era troppo lungo per tenere l’audio: la prossima volta va rigenerato.'
    : `${quanti} paragrafi erano troppo lunghi per tenere l’audio: la prossima volta vanno rigenerati.`
  return fileSalvato ? `File e script salvati. ${quali}` : `Script salvato. ${quali}`
}

function vaRigenerato(paragrafo, modelloId, voceId, seed, velocita, stabilita) {
  if (!String(paragrafo.testo || '').trim()) return false
  if (!compatibile(paragrafo, modelloId, voceId)) return true
  if (paragrafo.obsoleto) return true
  if ((paragrafo.velocita ?? 1) !== velocita) return true
  if (!stessaStabilitaDi(paragrafo, stabilita)) return true
  return (paragrafo.seed ?? null) !== semeDi(seed)
}

// I paragrafi generati prima del cursore (v4) o prima che v2 lo avesse non hanno
// la stabilità: valgono come la predefinita del loro modello (0,85 e 0,62).
function stessaStabilitaDi(paragrafo, stabilita) {
  if (stabilita == null) return true
  return (paragrafo.stabilita ?? stabilitaPredefinitaDi(modelloDaId(paragrafo.modello))) === stabilita
}

function testoStabilita(valore, modello) {
  const predefinita = stabilitaPredefinitaDi(modello)
  const n = stabilitaDi(valore, predefinita)
  const numero = n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n === predefinita ? `${numero} · consigliata` : numero
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
