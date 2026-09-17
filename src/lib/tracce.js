import { supabase } from './supabaseClient'

export const AUDIO_MAX = 50 * 1024 * 1024

export function estensioneAudio(nome) {
  const pezzo = (nome || '').split('.').pop()
  return (pezzo || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
}

export function titoloDaNomeFile(nome) {
  const base = String(nome || '').replace(/\.[^.]+$/, '')
  const pulito = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return pulito || 'Traccia'
}

function decodificaCard(valore) {
  const raw = String(valore || '')
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function urlAudioSenzaTesto(url) {
  const raw = String(url || '')
  try {
    const u = new URL(raw)
    u.hash = ''
    u.searchParams.delete('card')
    return u.href
  } catch {
    return raw.split('#')[0].replace(/([?&])card=[^&]*/g, '').replace(/[?&]$/, '')
  }
}

export function testoDaUrlAudio(url) {
  const raw = String(url || '')
  const hash = raw.match(/#card=([^#]*)/)
  if (hash) return decodificaCard(hash[1])
  try {
    const q = new URL(raw).searchParams.get('card')
    if (q) return q
  } catch {
    const query = raw.match(/[?&]card=([^&#]*)/)
    if (query) return decodificaCard(query[1])
  }
  return ''
}

export function urlConTestoCard(url, testo) {
  const pulito = String(testo || '').trim()
  const base = urlAudioSenzaTesto(url)
  if (!base) return ''
  if (!pulito) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}card=${encodeURIComponent(pulito)}`
}

export async function leggiTestoCard(traccia) {
  const daDb = String(traccia?.descrizione || '').trim()
  if (daDb) return daDb
  return testoDaUrlAudio(traccia?.url)
}

async function sincronizzaUrlCollegamenti(tracciaId, urlVecchio, urlNuovo) {
  if (!tracciaId || !urlNuovo) return
  const precedenti = [...new Set(
    [urlVecchio, urlAudioSenzaTesto(urlVecchio)].filter(Boolean)
  )]
  await Promise.all([
    supabase.from('esercizi').update({ traccia_audio: urlNuovo }).eq('traccia_id', tracciaId),
    supabase.from('lezioni').update({ traccia_audio: urlNuovo }).eq('traccia_id', tracciaId),
    ...precedenti.flatMap(url => [
      supabase.from('esercizi').update({ traccia_audio: urlNuovo }).eq('traccia_audio', url),
      supabase.from('lezioni').update({ traccia_audio: urlNuovo }).eq('traccia_audio', url)
    ])
  ])
}

async function scriviUrlConTesto(tracciaId, urlCorrente, testo) {
  const urlNuovo = urlConTestoCard(urlCorrente, testo)
  const patch = {
    url: urlNuovo,
    descrizione: String(testo || '').trim() || null
  }
  let { error } = await supabase.from('tracce').update(patch).eq('id', tracciaId)
  if (error && colonnaDescrizioneMancante(error)) {
    const replica = await supabase.from('tracce').update({ url: urlNuovo }).eq('id', tracciaId)
    error = replica.error
  }
  if (error) throw error
  await sincronizzaUrlCollegamenti(tracciaId, urlCorrente, urlNuovo)
  return urlNuovo
}

export async function pubblicaTestoCard(tracciaId, testo) {
  if (!tracciaId) return false
  const { data, error } = await supabase.from('tracce').select('url').eq('id', tracciaId).single()
  if (error || !data?.url) return false
  try {
    await scriviUrlConTesto(tracciaId, data.url, testo)
    return true
  } catch {
    return false
  }
}

export function trovaTracciaDi(riga, libreria = []) {
  if (riga?.traccia_id) {
    const trovata = libreria.find(t => t.id === riga.traccia_id)
    if (trovata) return trovata
  }
  const url = urlAudioSenzaTesto(riga?.traccia_audio)
  if (!url) return null
  return libreria.find(t => urlAudioSenzaTesto(t.url) === url) || null
}

export function urlTracciaDi(riga, libreria = []) {
  const inLibreria = trovaTracciaDi(riga, libreria)
  if (inLibreria?.url) return inLibreria.url
  return riga?.traccia_audio || ''
}

export async function durataFileAudio(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    const chiudi = minuti => {
      URL.revokeObjectURL(url)
      resolve(minuti)
    }
    audio.onloadedmetadata = () => {
      const sec = Number(audio.duration)
      const min = Number.isFinite(sec) && sec > 0 ? Math.max(1, Math.round(sec / 60)) : null
      chiudi(min)
    }
    audio.onerror = () => chiudi(null)
    audio.src = url
  })
}

const COLONNE_TRACCIA = 'id, titolo, descrizione, url, storage_path, durata_minuti, creato_il'
const COLONNE_TRACCIA_BASE = 'id, titolo, url, storage_path, durata_minuti, creato_il'

function colonnaDescrizioneMancante(error) {
  const msg = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  return /descrizione|42703|PGRST204/i.test(msg)
}

export async function elencaTracce() {
  const prima = await supabase
    .from('tracce')
    .select(COLONNE_TRACCIA)
    .order('titolo', { ascending: true })
  let lista
  if (!prima.error) {
    lista = prima.data || []
  } else if (colonnaDescrizioneMancante(prima.error)) {
    const { data, error } = await supabase
      .from('tracce')
      .select(COLONNE_TRACCIA_BASE)
      .order('titolo', { ascending: true })
    if (error) throw error
    lista = (data || []).map(t => ({ ...t, descrizione: null }))
  } else {
    throw prima.error
  }
  return lista.map(t => {
    const testo = String(t.descrizione || '').trim() || testoDaUrlAudio(t.url)
    return testo ? { ...t, descrizione: testo } : t
  })
}

function primo(valore) {
  return Array.isArray(valore) ? valore[0] : valore
}

export function etichettaCollegamentoTraccia(voce) {
  const n = Number(voce?.numeroSettimana)
  const sett = n === 9 ? 'Intensiva' : `Settimana ${n || '?'}`
  const pratica = voce?.descrizione || 'pratica'
  return voce?.cicloNome
    ? `${sett} (${voce.cicloNome}) → ${pratica}`
    : `${sett} → ${pratica}`
}

export async function collegamentiTracce() {
  const [{ data: esercizi, error: errE }, { data: lezioni, error: errL }] = await Promise.all([
    supabase
      .from('esercizi')
      .select('id, descrizione, tipo, traccia_id, lezioni(numero_settimana, cicli(nome_ciclo))')
      .not('traccia_id', 'is', null),
    supabase
      .from('lezioni')
      .select('id, numero_settimana, tema, traccia_id, cicli(nome_ciclo)')
      .not('traccia_id', 'is', null)
  ])
  if (errE) throw errE
  if (errL) throw errL

  const mappa = {}
  const aggiungi = (tracciaId, voce) => {
    if (!tracciaId) return
    if (!mappa[tracciaId]) mappa[tracciaId] = []
    mappa[tracciaId].push(voce)
  }

  for (const e of esercizi || []) {
    const lezione = primo(e.lezioni)
    const ciclo = primo(lezione?.cicli)
    aggiungi(e.traccia_id, {
      tipo: 'pratica',
      esercizioId: e.id,
      descrizione: e.descrizione,
      numeroSettimana: lezione?.numero_settimana,
      cicloNome: ciclo?.nome_ciclo || ''
    })
  }
  for (const l of lezioni || []) {
    const ciclo = primo(l.cicli)
    aggiungi(l.traccia_id, {
      tipo: 'settimana',
      lezioneId: l.id,
      descrizione: l.tema || 'audio della settimana',
      numeroSettimana: l.numero_settimana,
      cicloNome: ciclo?.nome_ciclo || ''
    })
  }
  return mappa
}

export async function usiTracce() {
  const mappa = await collegamentiTracce()
  const conteggi = {}
  for (const [id, lista] of Object.entries(mappa)) {
    conteggi[id] = lista.length
  }
  return conteggi
}

export async function creaTraccia(file, { titolo, descrizione, durataMinuti } = {}) {
  if (!file) throw new Error('FILE_MANCANTE')
  if (file.size > AUDIO_MAX) throw new Error('AUDIO_TROPPO_GRANDE')
  const id = crypto.randomUUID()
  const path = `libreria/${id}.${estensioneAudio(file.name)}`
  const { error: erroreUpload } = await supabase.storage.from('tracce-audio').upload(path, file, {
    upsert: false,
    contentType: file.type || 'audio/mpeg'
  })
  if (erroreUpload) throw erroreUpload
  const { data: pub } = supabase.storage.from('tracce-audio').getPublicUrl(path)
  const minuti = durataMinuti
    || await durataFileAudio(file).catch(() => null)
  const riga = {
    id,
    titolo: (titolo || titoloDaNomeFile(file.name)).trim() || 'Traccia',
    descrizione: String(descrizione || '').trim() || null,
    url: pub.publicUrl,
    storage_path: path,
    durata_minuti: minuti || null
  }
  let { data, error } = await supabase.from('tracce').insert(riga).select(COLONNE_TRACCIA).single()
  if (error && colonnaDescrizioneMancante(error)) {
    const { descrizione: _ignora, ...base } = riga
    const replica = await supabase.from('tracce').insert(base).select(COLONNE_TRACCIA_BASE).single()
    data = replica.data ? { ...replica.data, descrizione: null } : replica.data
    error = replica.error
  }
  if (error) throw error
  const testo = String(descrizione || '').trim()
  if (testo) {
    const urlNuovo = await scriviUrlConTesto(data.id, data.url, testo)
    data = { ...data, url: urlNuovo, descrizione: testo }
  }
  return data
}

export async function rinominaTraccia(id, titolo, descrizione) {
  const pulito = String(titolo || '').trim()
  if (!pulito) throw new Error('TITOLO_VUOTO')
  const testo = String(descrizione || '').trim()
  const { data: riga, error: erroreLettura } = await supabase
    .from('tracce')
    .select('url')
    .eq('id', id)
    .single()
  if (erroreLettura) throw erroreLettura
  const patchTitolo = { titolo: pulito }
  let { error } = await supabase.from('tracce').update(patchTitolo).eq('id', id)
  if (error) throw error
  const urlNuovo = await scriviUrlConTesto(id, riga?.url, testo)
  return { url: urlNuovo, descrizione: testo }
}

export async function sostituisciFileTraccia(traccia, file) {
  if (!file) throw new Error('FILE_MANCANTE')
  if (file.size > AUDIO_MAX) throw new Error('AUDIO_TROPPO_GRANDE')
  const ext = estensioneAudio(file.name)
  const path = traccia.storage_path && traccia.storage_path.startsWith('libreria/')
    ? traccia.storage_path
    : `libreria/${traccia.id}.${ext}`
  const { error: erroreUpload } = await supabase.storage.from('tracce-audio').upload(path, file, {
    upsert: true,
    contentType: file.type || 'audio/mpeg'
  })
  if (erroreUpload) throw erroreUpload
  const { data: pub } = supabase.storage.from('tracce-audio').getPublicUrl(path)
  const minuti = await durataFileAudio(file).catch(() => null)
  const testo = String(traccia.descrizione || '').trim() || testoDaUrlAudio(traccia.url)
  const { error } = await supabase.from('tracce').update({
    storage_path: path,
    durata_minuti: minuti || traccia.durata_minuti || null
  }).eq('id', traccia.id)
  if (error) throw error
  await scriviUrlConTesto(traccia.id, pub.publicUrl, testo)
}

function erroreTracciaInUso(collegamenti) {
  const err = new Error('TRACCIA_IN_USO')
  err.collegamenti = collegamenti || []
  return err
}

export async function eliminaTraccia(traccia) {
  const mappa = await collegamentiTracce()
  const usi = mappa[traccia.id] || []
  if (usi.length > 0) throw erroreTracciaInUso(usi)
  if (traccia.storage_path) {
    await supabase.storage.from('tracce-audio').remove([traccia.storage_path])
  }
  const { error } = await supabase.from('tracce').delete().eq('id', traccia.id)
  if (error?.code === '23503') throw erroreTracciaInUso(usi)
  if (error) throw error
}

export function messaggioErroreTraccia(err) {
  const codice = err?.message
  if (codice === 'AUDIO_TROPPO_GRANDE') return 'La traccia deve pesare al massimo 50 MB.'
  if (codice === 'TRACCIA_IN_USO') {
    const elenco = (err.collegamenti || []).map(etichettaCollegamentoTraccia)
    if (elenco.length === 0) {
      return 'Scollega la traccia dalle pratiche prima di eliminarla.'
    }
    return `Non puoi eliminare questa traccia: è ancora collegata a ${elenco.join('; ')}.`
  }
  if (codice === 'TITOLO_VUOTO') return 'Il titolo della traccia non può essere vuoto.'
  if (codice === 'TESTO_NON_SALVATO') {
    return 'Il titolo è stato salvato, ma il testo della card no. Riprova tra un attimo.'
  }
  return 'Non è stato possibile aggiornare la libreria tracce.'
}
