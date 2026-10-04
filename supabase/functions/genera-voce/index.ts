// Edge Function: genera audio con ElevenLabs per il facilitatore.
// Secret: ELEVENLABS_API_KEY
// Distribuisci: supabase functions deploy genera-voce

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'x-request-id'
}

const MODELLI = new Set([
  'eleven_multilingual_v2',
  'eleven_v3',
  'eleven_flash_v2_5'
])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function messaggioEleven(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const rec = body as {
      detail?: { status?: unknown, message?: unknown } | string
      message?: unknown
    }
    const detail = rec.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (detail && typeof detail === 'object') {
      const stato = typeof detail.status === 'string' ? detail.status : ''
      if (stato === 'quota_exceeded') return 'Crediti ElevenLabs esauriti.'
      if (stato === 'voice_not_found') return 'Questa voce non è nel tuo account ElevenLabs.'
      if (typeof detail.message === 'string' && detail.message.trim()) return detail.message
    }
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message
  }
  if (status === 401) return 'La chiave ElevenLabs non è valida.'
  if (status === 429) return 'Troppe richieste a ElevenLabs. Riprova tra un attimo.'
  return `ElevenLabs ha risposto ${status}`
}

async function leggiErrore(res: Response) {
  const testo = await res.text()
  try {
    return { testo, body: JSON.parse(testo) }
  } catch {
    return { testo, body: null }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ errore: 'METODO', messaggio: 'Metodo non valido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ errore: 'NON_AUTORIZZATO', messaggio: 'Serve l’accesso del facilitatore.' }, 401)

  const chiave = Deno.env.get('ELEVENLABS_API_KEY') || ''
  if (!chiave) {
    return json({
      errore: 'CHIAVE_MANCANTE',
      messaggio: 'Manca la chiave ElevenLabs sul server (secret ELEVENLABS_API_KEY).'
    }, 500)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: isFac } = await supabase.rpc('is_facilitatore')
  if (!isFac) return json({ errore: 'NON_AUTORIZZATO', messaggio: 'Serve l’accesso del facilitatore.' }, 401)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ errore: 'CORPO_NON_VALIDO', messaggio: 'Richiesta non valida.' }, 400)
  }

  if (corpo.azione === 'voci') return elencaVoci(chiave)
  if (corpo.azione === 'paragrafo') return generaParagrafo(chiave, corpo)
  return json({ errore: 'AZIONE', messaggio: 'Azione non riconosciuta.' }, 400)
})

async function elencaVoci(chiave: string) {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': chiave }
  })
  if (!res.ok) {
    const { body } = await leggiErrore(res)
    return json({ errore: 'ELEVENLABS', messaggio: messaggioEleven(body, res.status) }, res.status)
  }
  const data = await res.json() as { voices?: Array<Record<string, unknown>> }
  const voci = (data.voices || []).map(v => {
    const labels = (v.labels && typeof v.labels === 'object') ? v.labels as Record<string, unknown> : {}
    const lingua = `${labels.language || ''} ${labels.accent || ''} ${labels.locale || ''}`.toLowerCase()
    return {
      id: String(v.voice_id || ''),
      nome: String(v.name || 'Voce'),
      anteprima: typeof v.preview_url === 'string' ? v.preview_url : '',
      italiana: /ital|it\b|it-/.test(lingua)
    }
  }).filter(v => /^[A-Za-z0-9]{8,40}$/.test(v.id))
  voci.sort((a, b) => {
    if (a.italiana !== b.italiana) return a.italiana ? -1 : 1
    return a.nome.localeCompare(b.nome, 'it')
  })
  return json({ voci })
}

async function generaParagrafo(chiave: string, corpo: Record<string, unknown>) {
  const testo = typeof corpo.testo === 'string' ? corpo.testo.trim() : ''
  const voceId = typeof corpo.voceId === 'string' ? corpo.voceId : ''
  const modello = typeof corpo.modello === 'string' ? corpo.modello : ''
  if (!testo) return json({ errore: 'TESTO_VUOTO', messaggio: 'Il paragrafo è vuoto.' }, 400)
  if (testo.length > 10000) {
    return json({ errore: 'TESTO_TROPPO_LUNGO', messaggio: 'Un paragrafo supera i 10.000 caratteri.' }, 400)
  }
  if (!MODELLI.has(modello)) {
    return json({ errore: 'MODELLO_NON_VALIDO', messaggio: 'Modello non riconosciuto.' }, 400)
  }
  if (!/^[A-Za-z0-9]{8,40}$/.test(voceId)) {
    return json({ errore: 'VOCE_MANCANTE', messaggio: 'Scegli una voce.' }, 400)
  }

  const precedenti = Array.isArray(corpo.precedenti)
    ? corpo.precedenti
      .filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(id))
      .slice(-3)
    : []
  const seedGrezzo = corpo.seed
  const seedNum = typeof seedGrezzo === 'number'
    ? seedGrezzo
    : (typeof seedGrezzo === 'string' && seedGrezzo.trim() !== '' ? Number(seedGrezzo) : NaN)
  const seed = Number.isInteger(seedNum) && seedNum >= 0 && seedNum <= 4294967295 ? seedNum : null
  const velocitaLetta = leggiVelocita(corpo.velocita)
  if (!velocitaLetta.ok) {
    return json({
      errore: 'VELOCITA_NON_VALIDA',
      messaggio: 'La velocità del parlato va da 0,70 a 1,20.'
    }, 400)
  }
  const velocita = velocitaLetta.valore

  const payload: Record<string, unknown> = {
    text: testo,
    model_id: modello,
    language_code: 'it'
  }
  if (modello !== 'eleven_v3') {
    payload.voice_settings = {
      stability: 0.62,
      similarity_boost: 0.8,
      style: 0,
      use_speaker_boost: true,
      speed: velocita
    }
    if (precedenti.length) payload.previous_request_ids = precedenti
  } else if (velocita !== 1) {
    payload.voice_settings = { speed: velocita }
  }
  if (seed != null) payload.seed = seed

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voceId}?output_format=mp3_44100_128`
  const res = await inviaConRipiego(chiave, url, payload)
  if (!res.ok) {
    const { body } = await leggiErrore(res)
    const status = res.status === 401 || res.status === 429 ? res.status : 502
    return json({ errore: 'ELEVENLABS', messaggio: messaggioEleven(body, res.status) }, status)
  }

  const audio = await res.arrayBuffer()
  const requestId = res.headers.get('request-id') || ''
  return new Response(audio, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'audio/mpeg',
      'x-request-id': requestId
    }
  })
}

function leggiVelocita(grezzo: unknown): { ok: true, valore: number } | { ok: false } {
  if (grezzo == null || grezzo === '') return { ok: true, valore: 1 }
  const n = typeof grezzo === 'number' ? grezzo : (typeof grezzo === 'string' ? Number(grezzo) : NaN)
  if (!Number.isFinite(n)) return { ok: false }
  const arrotondata = Math.round(n * 100) / 100
  if (arrotondata < 0.7 || arrotondata > 1.2) return { ok: false }
  return { ok: true, valore: arrotondata }
}

async function inviaConRipiego(chiave: string, url: string, payload: Record<string, unknown>) {
  const res = await invia(chiave, url, payload)
  if (res.ok || res.status !== 400) return res
  const { testo, body } = await leggiErrore(res)
  const msg = `${testo} ${JSON.stringify(body || {})}`.toLowerCase()
  const prossimo: Record<string, unknown> = { ...payload }
  let cambiato = false
  if (/previous_request|previous_text|next_text/.test(msg) && prossimo.previous_request_ids) {
    delete prossimo.previous_request_ids
    cambiato = true
  }
  if (/\bseed\b/.test(msg) && prossimo.seed != null) {
    delete prossimo.seed
    cambiato = true
  }
  if (/language_code/.test(msg) && prossimo.language_code) {
    delete prossimo.language_code
    cambiato = true
  }
  const settings = payload.voice_settings
  const settingsObj = settings && typeof settings === 'object'
    ? settings as Record<string, unknown>
    : null
  const velocitaRichiesta = settingsObj && typeof settingsObj.speed === 'number'
    ? settingsObj.speed
    : null
  // La velocità resta: se il modello la rifiuta, l'errore arriva al facilitatore.
  if (/voice_settings/.test(msg) && settingsObj && !/\bspeed\b/.test(msg)) {
    if (velocitaRichiesta == null) {
      delete prossimo.voice_settings
      cambiato = true
    } else if (Object.keys(settingsObj).some(k => k !== 'speed')) {
      prossimo.voice_settings = { speed: velocitaRichiesta }
      cambiato = true
    }
  }
  const haAltriCampi = payload.seed != null
    || Boolean(payload.previous_request_ids)
    || Boolean(payload.language_code)
    || (settingsObj != null && Object.keys(settingsObj).some(k => k !== 'speed'))
  if (!cambiato && haAltriCampi) {
    const ridotto: Record<string, unknown> = { text: payload.text, model_id: payload.model_id }
    if (velocitaRichiesta != null) ridotto.voice_settings = { speed: velocitaRichiesta }
    return inviaConRipiego(chiave, url, ridotto)
  }
  if (!cambiato) {
    return new Response(testo, { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  return inviaConRipiego(chiave, url, prossimo)
}

function invia(chiave: string, url: string, payload: Record<string, unknown>) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': chiave,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify(payload)
  })
}
