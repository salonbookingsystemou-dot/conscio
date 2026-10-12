import { supabase, supabaseAnonKey, supabaseUrl } from './supabaseClient.js'

const LATO = 1440
const MAX_FOTO = 10 * 1024 * 1024
const MAX_VIDEO = 50 * 1024 * 1024

async function chiamaSfondi(corpo) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Configurazione del sito incompleta.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Serve l’accesso del facilitatore.')
  let risposta
  try {
    risposta = await fetch(`${supabaseUrl}/functions/v1/cerca-sfondi`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corpo)
    })
  } catch {
    throw new Error('Non sono riuscito a raggiungere il servizio degli sfondi.')
  }
  const payload = await risposta.json().catch(() => ({}))
  if (!risposta.ok || payload.errore) {
    if (payload.errore === 'CHIAVE_MANCANTE' && corpo.fonte === 'pexels') {
      throw new Error('Pexels non è collegato: le nuove chiavi sono sospese. Scarica il video e caricalo da «Dal telefono», con il nome di chi l’ha fatto.')
    }
    throw new Error(payload.messaggio || 'Ricerca non riuscita.')
  }
  return payload
}

export function cercaSfondi(fonte, tipo, query) {
  return chiamaSfondi({ azione: 'cerca', fonte, tipo, query })
}

export function confermaSfondoRemoto(corpo) {
  return chiamaSfondi({ azione: 'scegli', ...corpo })
}

function canvasDa(sorgente, larghezza, altezza) {
  const scala = Math.min(1, LATO / Math.max(larghezza, altezza))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(larghezza * scala))
  canvas.height = Math.max(1, Math.round(altezza * scala))
  const contesto = canvas.getContext('2d')
  contesto.drawImage(sorgente, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error('Non sono riuscito a preparare l’immagine.'))
      else resolve(blob)
    }, 'image/jpeg', 0.86)
  })
}

export async function preparaFoto(file) {
  if (file.size > MAX_FOTO) throw new Error('La foto supera i 10 MB.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Questo formato non si legge nel browser. Esporta la foto in JPEG.')
  }
  try {
    return await canvasDa(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close?.()
  }
}

export function preparaVideo(file) {
  if (file.size > MAX_VIDEO) return Promise.reject(new Error('Il video supera i 50 MB.'))
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    const chiudi = () => URL.revokeObjectURL(url)
    video.onerror = () => {
      chiudi()
      reject(new Error('Questo video non si legge nel browser.'))
    }
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration < 10 || video.duration > 60) {
        chiudi()
        reject(new Error('Il video deve durare fra 10 e 60 secondi.'))
        return
      }
      video.currentTime = Math.min(1, video.duration / 2)
    }
    video.onseeked = async () => {
      try {
        const poster = await canvasDa(video, video.videoWidth, video.videoHeight)
        chiudi()
        resolve({ poster })
      } catch (err) {
        chiudi()
        reject(err)
      }
    }
    video.src = url
  })
}

async function caricaBlob(percorso, blob, contentType) {
  const { error } = await supabase.storage.from('sfondi-vetrina').upload(percorso, blob, {
    contentType,
    upsert: false
  })
  if (error) throw new Error('Non sono riuscito a salvare lo sfondo.')
  return supabase.storage.from('sfondi-vetrina').getPublicUrl(percorso).data.publicUrl
}

export async function caricaSfondoLocale(file, posterPronto = null) {
  const id = crypto.randomUUID()
  if (file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name)) {
    const poster = posterPronto || (await preparaVideo(file)).poster
    const quicktime = file.type === 'video/quicktime' || /\.mov$/i.test(file.name)
    const estensione = quicktime ? 'mov' : 'mp4'
    const tipo = quicktime ? 'video/quicktime' : 'video/mp4'
    const url = await caricaBlob(`caricati/${id}.${estensione}`, file, tipo)
    const posterUrl = await caricaBlob(`caricati/${id}-poster.jpg`, poster, 'image/jpeg')
    return {
      sfondo_tipo: 'video',
      sfondo_fonte: 'caricato',
      sfondo_url: url,
      sfondo_poster_url: posterUrl,
      sfondo_fonte_id: `caricati/${id}`
    }
  }
  const foto = await preparaFoto(file)
  const url = await caricaBlob(`caricati/${id}.jpg`, foto, 'image/jpeg')
  return {
    sfondo_tipo: 'foto',
    sfondo_fonte: 'caricato',
    sfondo_url: url,
    sfondo_poster_url: url,
    sfondo_fonte_id: `caricati/${id}`
  }
}

export async function nomeFacilitatore() {
  const { data } = await supabase.auth.getSession()
  const utente = data.session?.user
  const meta = utente?.user_metadata || {}
  return meta.nome || meta.full_name || String(utente?.email || '').split('@')[0].replace(/[._-]+/g, ' ')
}
