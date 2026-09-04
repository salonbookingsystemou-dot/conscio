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

export async function elencaTracce() {
  const { data, error } = await supabase
    .from('tracce')
    .select('id, titolo, url, storage_path, durata_minuti, creato_il')
    .order('titolo', { ascending: true })
  if (error) throw error
  return data || []
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

export async function creaTraccia(file, { titolo, durataMinuti } = {}) {
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
  const { data, error } = await supabase.from('tracce').insert({
    id,
    titolo: (titolo || titoloDaNomeFile(file.name)).trim() || 'Traccia',
    url: pub.publicUrl,
    storage_path: path,
    durata_minuti: minuti || null
  }).select('id, titolo, url, storage_path, durata_minuti, creato_il').single()
  if (error) throw error
  return data
}

export async function rinominaTraccia(id, titolo) {
  const pulito = String(titolo || '').trim()
  if (!pulito) throw new Error('TITOLO_VUOTO')
  const { error } = await supabase.from('tracce').update({ titolo: pulito }).eq('id', id)
  if (error) throw error
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
  return 'Non è stato possibile aggiornare la libreria tracce.'
}
