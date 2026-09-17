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

function idTracciaDaUrl(urlAudio) {
  const m = String(urlAudio || '').match(/\/libreria\/([0-9a-f-]{8,})\./i)
  return m?.[1] || null
}

function urlPubblicoStorage(path) {
  const { data } = supabase.storage.from('tracce-audio').getPublicUrl(path)
  return data?.publicUrl || null
}

export function urlTestoCardDaAudio(urlAudio, tracciaId) {
  const id = tracciaId || idTracciaDaUrl(urlAudio)
  if (!id) return null
  return urlPubblicoStorage(`libreria/${id}.card.mp3`)
}

function urlTestoCardAlternativi(urlAudio, tracciaId) {
  const id = tracciaId || idTracciaDaUrl(urlAudio)
  const daAudio = urlTestoCardDaAudio(urlAudio, id)
  const vecchioTxt = id ? urlPubblicoStorage(`libreria/${id}.card.txt`) : null
  return [...new Set([daAudio, vecchioTxt].filter(Boolean))]
}

export async function pubblicaTestoCard(tracciaId, testo) {
  if (!tracciaId) return false
  const path = `libreria/${tracciaId}.card.mp3`
  const pulito = String(testo || '').trim()
  if (!pulito) {
    await supabase.storage.from('tracce-audio').remove([
      path,
      `libreria/${tracciaId}.card.txt`
    ])
    return true
  }
  const blob = new Blob([pulito], { type: 'audio/mpeg' })
  const { error } = await supabase.storage.from('tracce-audio').upload(path, blob, {
    upsert: true,
    contentType: 'audio/mpeg',
    cacheControl: '60'
  })
  return !error
}

export async function leggiTestoCard(traccia) {
  const daDb = String(traccia?.descrizione || '').trim()
  if (daDb) return daDb
  const urls = urlTestoCardAlternativi(traccia?.url, traccia?.id)
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const testo = String(await res.text()).trim()
      if (testo) return testo
    } catch {
      /* prova il successivo */
    }
  }
  return ''
}

export function urlTracciaDi(riga, libreria = []) {
  if (riga?.traccia_id) {
    const inLibreria = libreria.find(t => t.id === riga.traccia_id)
    if (inLibreria?.url) return inLibreria.url
  }
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
  return Promise.all(lista.map(async t => {
    if (String(t.descrizione || '').trim()) return t
    const testo = await leggiTestoCard({ ...t, descrizione: '' })
    return testo ? { ...t, descrizione: testo } : t
  }))
}

export async function usiTracce() {
  const [{ data: esercizi }, { data: lezioni }] = await Promise.all([
    supabase.from('esercizi').select('traccia_id').not('traccia_id', 'is', null),
    supabase.from('lezioni').select('traccia_id').not('traccia_id', 'is', null)
  ])
  const conteggi = {}
  for (const riga of [...(esercizi || []), ...(lezioni || [])]) {
    if (!riga.traccia_id) continue
    conteggi[riga.traccia_id] = (conteggi[riga.traccia_id] || 0) + 1
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
    const ok = await pubblicaTestoCard(data.id, testo)
    if (!ok) throw new Error('TESTO_NON_SALVATO')
    data = { ...data, descrizione: testo }
  }
  return data
}

export async function rinominaTraccia(id, titolo, descrizione) {
  const pulito = String(titolo || '').trim()
  if (!pulito) throw new Error('TITOLO_VUOTO')
  const patch = {
    titolo: pulito,
    descrizione: String(descrizione || '').trim() || null
  }
  let { error } = await supabase.from('tracce').update(patch).eq('id', id)
  if (error && colonnaDescrizioneMancante(error)) {
    const replica = await supabase.from('tracce').update({ titolo: pulito }).eq('id', id)
    error = replica.error
  }
  if (error) throw error
  const testo = String(descrizione || '').trim()
  const ok = await pubblicaTestoCard(id, testo)
  if (testo && !ok) throw new Error('TESTO_NON_SALVATO')
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
  const { error } = await supabase.from('tracce').update({
    url: pub.publicUrl,
    storage_path: path,
    durata_minuti: minuti || traccia.durata_minuti || null
  }).eq('id', traccia.id)
  if (error) throw error
  if (pub.publicUrl !== traccia.url) {
    await Promise.all([
      supabase.from('esercizi').update({ traccia_audio: pub.publicUrl }).eq('traccia_id', traccia.id),
      supabase.from('lezioni').update({ traccia_audio: pub.publicUrl }).eq('traccia_id', traccia.id)
    ])
  }
}

export async function eliminaTraccia(traccia, usi = 0) {
  if (usi > 0) throw new Error('TRACCIA_IN_USO')
  if (traccia.storage_path) {
    await supabase.storage.from('tracce-audio').remove([traccia.storage_path])
  }
  const { error } = await supabase.from('tracce').delete().eq('id', traccia.id)
  if (error) throw error
}

export function messaggioErroreTraccia(err) {
  const codice = err?.message
  if (codice === 'AUDIO_TROPPO_GRANDE') return 'La traccia deve pesare al massimo 50 MB.'
  if (codice === 'TRACCIA_IN_USO') return 'Scollega la traccia dalle pratiche prima di eliminarla.'
  if (codice === 'TITOLO_VUOTO') return 'Il titolo della traccia non può essere vuoto.'
  if (codice === 'TESTO_NON_SALVATO') {
    return 'Il titolo è stato salvato, ma il testo della card no. Riprova tra un attimo.'
  }
  return 'Non è stato possibile aggiornare la libreria tracce.'
}
