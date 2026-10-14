// Script e audio dei paragrafi di una traccia generata.
// Il testo sta sulla riga `tracce.generazione`. I campioni stanno nel bucket
// privato bozze-voce, solo per il facilitatore: non è la traccia che ascolta
// il partecipante e non entra nella sua cache.

import { comprimiPcm, decomprimiPcm } from './pcmBozza.js'
import {
  idBozzaValido,
  nomeFileBozza,
  normalizzaRicetta,
  ricettaDaStato
} from './ricettaVoce.js'
import { supabase } from './supabaseClient.js'

export const AUDIO_PARAGRAFO_MAX = 50 * 1024 * 1024
const BUCKET = 'bozze-voce'

function testoErrore(error) {
  return `${error?.code || ''} ${error?.message || ''} ${error?.statusCode || ''} ${error?.details || ''} ${error?.hint || ''}`
}

function colonnaGenerazioneAssente(error) {
  return /generazione/i.test(testoErrore(error)) && /42703|PGRST204|schema cache/i.test(testoErrore(error))
}

function oggettoAssente(error) {
  return /not found|non trovato|404/i.test(testoErrore(error))
}

function archivioAssente(error) {
  return /bucket not found|bozze-voce/i.test(testoErrore(error))
}

function percorso(tracciaId, id, formato) {
  return `${tracciaId}/${nomeFileBozza(id, formato)}`
}

async function elencaNomi(tracciaId) {
  const nomi = []
  const pagina = 100
  for (let offset = 0; offset < 1000; offset += pagina) {
    const { data, error } = await supabase.storage.from(BUCKET).list(tracciaId, {
      limit: pagina,
      offset
    })
    if (error) throw error
    const pezzi = data || []
    for (const file of pezzi) {
      if (file?.name && !file.name.endsWith('/')) nomi.push(file.name)
    }
    if (pezzi.length < pagina) break
  }
  return nomi
}

export async function leggiScriptTraccia(tracciaId) {
  if (!idBozzaValido(tracciaId)) return { disponibile: true, ricetta: null }
  const { data, error } = await supabase
    .from('tracce')
    .select('generazione')
    .eq('id', tracciaId)
    .maybeSingle()
  if (error && colonnaGenerazioneAssente(error)) return { disponibile: false, ricetta: null }
  if (error) throw error
  return { disponibile: true, ricetta: normalizzaRicetta(data?.generazione) }
}

export async function caricaAudioParagrafi(tracciaId, paragrafi) {
  const coda = [...paragrafi]
  const out = new Array(coda.length)
  let indice = 0
  async function uno() {
    while (indice < coda.length) {
      const i = indice
      indice += 1
      out[i] = await audioDi(tracciaId, coda[i])
    }
  }
  const lavoratori = Math.min(3, coda.length)
  await Promise.all(Array.from({ length: lavoratori }, uno))
  return out
}

async function audioDi(tracciaId, paragrafo) {
  if (!paragrafo.audioFormato) {
    return { ...paragrafo, audio: null, audioSalvato: false, audioMancante: false }
  }
  try {
    const audio = await scarica(tracciaId, paragrafo.id, paragrafo.audioFormato)
    if (!audio) {
      return { ...paragrafo, audio: null, audioSalvato: false, audioMancante: true, audioFormato: null }
    }
    return { ...paragrafo, audio, audioSalvato: true, audioMancante: false }
  } catch {
    return { ...paragrafo, audio: null, audioSalvato: false, audioMancante: true, audioFormato: null }
  }
}

async function scarica(tracciaId, id, formato) {
  const { data, error } = await supabase.storage.from(BUCKET).download(percorso(tracciaId, id, formato))
  if (error && oggettoAssente(error)) return null
  if (error) throw error
  const buf = new Uint8Array(await data.arrayBuffer())
  return decomprimiPcm(buf, formato)
}

export async function salvaScriptTraccia(tracciaId, stato, onAvanzamento) {
  if (!idBozzaValido(tracciaId)) throw new Error('SCRIPT_NON_SALVATO')
  const formatoNuovo = typeof CompressionStream === 'undefined' ? 'pcm' : 'gzip'
  const daCaricare = (stato?.paragrafi || []).filter(p => (
    p?.audio?.length && !p.audioSalvato && String(p.testo || '').trim() && idBozzaValido(p.id)
  ))
  const omessi = new Set()
  const caricati = []
  for (let i = 0; i < daCaricare.length; i += 1) {
    onAvanzamento?.({ fatto: i, totale: daCaricare.length })
    const paragrafo = daCaricare[i]
    const compresso = await comprimiPcm(paragrafo.audio)
    if (!compresso || compresso.bytes.byteLength > AUDIO_PARAGRAFO_MAX) {
      omessi.add(paragrafo.id)
      continue
    }
    const formato = compresso.formato || formatoNuovo
    const path = percorso(tracciaId, paragrafo.id, formato)
    const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([compresso.bytes], {
      type: formato === 'gzip' ? 'application/gzip' : 'application/octet-stream'
    }), {
      upsert: true,
      contentType: formato === 'gzip' ? 'application/gzip' : 'application/octet-stream'
    })
    if (error && archivioAssente(error)) throw new Error('GENERAZIONE_ASSENTE')
    if (error) throw new Error('SCRIPT_NON_SALVATO')
    caricati.push(path)
  }
  onAvanzamento?.({ fatto: daCaricare.length, totale: daCaricare.length })

  const ricetta = ricettaDaStato(stato, { omessi, formatoNuovo })
  if (ricetta.paragrafi.length === 0) throw new Error('SCRIPT_VUOTO')
  const { error } = await supabase.from('tracce').update({ generazione: ricetta }).eq('id', tracciaId)
  if (error && colonnaGenerazioneAssente(error)) {
    if (caricati.length) await supabase.storage.from(BUCKET).remove(caricati)
    throw new Error('GENERAZIONE_ASSENTE')
  }
  if (error) throw new Error('SCRIPT_NON_SALVATO')

  const tieni = new Set()
  for (const p of ricetta.paragrafi) {
    if (!p.audio) continue
    tieni.add(nomeFileBozza(p.id, p.audio))
  }
  try {
    const presenti = await elencaNomi(tracciaId)
    const via = presenti.filter(nome => !tieni.has(nome)).map(nome => `${tracciaId}/${nome}`)
    if (via.length) await supabase.storage.from(BUCKET).remove(via)
  } catch {
    /* lo script è già scritto: i file di troppo si tolgono al salvataggio successivo */
  }
  return { omessi: [...omessi], formato: formatoNuovo }
}

export async function eliminaBozzeVoce(tracciaId) {
  if (!idBozzaValido(tracciaId)) return
  try {
    const nomi = await elencaNomi(tracciaId)
    if (nomi.length === 0) return
    await supabase.storage.from(BUCKET).remove(nomi.map(nome => `${tracciaId}/${nome}`))
  } catch {
    /* la traccia si elimina anche se restano le bozze */
  }
}
