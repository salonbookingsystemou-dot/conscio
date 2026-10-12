// Ricerca sfondi per la vetrina, solo facilitatore.
// Secret: UNSPLASH_ACCESS_KEY, PEXELS_API_KEY
// Distribuisci: supabase functions deploy cerca-sfondi
//
// Unsplash (https://unsplash.com/documentation, linee guida luglio 2026):
// le foto si mostrano dall'URL restituito (hotlink, parametro ixid intatto).
// Alla scelta si chiama links.download_location. Demo: 50 richieste/ora;
// produzione: 1000/ora. Il download dell'immagine non conta nel tetto.
// Attribuzione con utm_source=conscio&utm_medium=referral.
// Unsplash non ha video.
//
// Pexels (https://www.pexels.com/api/documentation):
// 200 richieste/ora e 20.000/mese. La documentazione non chiede l'hotlink
// e i link video portano un token che può scadere: alla conferma il file
// viene copiato nel bucket sfondi-vetrina. In ricerca resta un link visibile a Pexels.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { scegliFileVideo } from '../_shared/scegliFileVideo.mjs'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const PER_PAGINA = 12
const MAX_FOTO = 10 * 1024 * 1024
const MAX_VIDEO = 50 * 1024 * 1024
const HOST_PEXELS = new Set([
  'images.pexels.com',
  'videos.pexels.com',
  'player.vimeo.com',
  'static-videos.pexels.com'
])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function utm(link: string): string {
  try {
    const u = new URL(link)
    if (u.protocol !== 'https:') return link
    u.searchParams.set('utm_source', 'conscio')
    u.searchParams.set('utm_medium', 'referral')
    return u.toString()
  } catch {
    return link
  }
}

function pagina(valore: unknown): number {
  const n = typeof valore === 'number' ? valore : Number(valore)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(n, 40)
}

function testo(valore: unknown, max: number): string {
  return typeof valore === 'string' ? valore.trim().slice(0, max) : ''
}

function hostConsentito(url: string, hostAmmessi: Set<string>): URL | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !hostAmmessi.has(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ errore: 'METODO', messaggio: 'Metodo non valido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ errore: 'NON_AUTORIZZATO', messaggio: 'Serve l’accesso del facilitatore.' }, 401)

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

  if (corpo.azione === 'cerca') return cerca(corpo)
  if (corpo.azione === 'scegli') return scegli(corpo)
  return json({ errore: 'AZIONE', messaggio: 'Azione non riconosciuta.' }, 400)
})

async function cerca(corpo: Record<string, unknown>) {
  const fonte = corpo.fonte === 'unsplash' || corpo.fonte === 'pexels' ? corpo.fonte : ''
  const tipo = corpo.tipo === 'foto' || corpo.tipo === 'video' ? corpo.tipo : ''
  const query = testo(corpo.query, 80)
  if (!fonte || !tipo || !query) {
    return json({ errore: 'RICHIESTA', messaggio: 'Servono fonte, tipo e una parola da cercare.' }, 400)
  }
  if (fonte === 'unsplash' && tipo === 'video') {
    return json({ errore: 'VIDEO_NON_DISPONIBILE', messaggio: 'Unsplash non ha video.' }, 400)
  }

  if (fonte === 'unsplash') return cercaUnsplash(query, pagina(corpo.pagina))
  return cercaPexels(tipo, query, pagina(corpo.pagina))
}

function chiaveUnsplash(): string {
  return (Deno.env.get('UNSPLASH_ACCESS_KEY') || '').trim().replace(/^Client-ID\s+/i, '')
}

async function messaggioUnsplash(res: Response): Promise<string> {
  let dettaglio = ''
  try {
    const data = await res.json() as { errors?: unknown }
    if (Array.isArray(data.errors)) {
      dettaglio = data.errors.filter((e) => typeof e === 'string').join(' ').slice(0, 180)
    }
  } catch { /* corpo non json */ }
  console.error('unsplash', res.status, dettaglio)
  if (res.status === 401) {
    return 'La chiave Unsplash non è valida. Nell’applicazione Unsplash copia Access Key, non Secret Key.'
  }
  if (dettaglio) return `Unsplash non ha risposto (${res.status}): ${dettaglio}`
  return `Unsplash non ha risposto (${res.status}).`
}

async function cercaUnsplash(query: string, pag: number) {
  const chiave = chiaveUnsplash()
  if (!chiave) {
    return json({
      errore: 'CHIAVE_MANCANTE',
      messaggio: 'Manca la chiave Unsplash sul server (secret UNSPLASH_ACCESS_KEY).'
    }, 500)
  }

  const qs = new URLSearchParams({
    query,
    page: String(pag),
    per_page: String(PER_PAGINA),
    orientation: 'portrait',
    content_filter: 'high'
  })
  const res = await fetch(`https://api.unsplash.com/search/photos?${qs}`, {
    headers: { Authorization: `Client-ID ${chiave}`, 'Accept-Version': 'v1' }
  })
  if (res.status === 429) {
    return json({ errore: 'LIMITE', messaggio: 'Unsplash ha raggiunto il limite di ricerche. Riprova più tardi.' }, 429)
  }
  if (!res.ok) return json({ errore: 'SERVIZIO', messaggio: await messaggioUnsplash(res) }, 502)

  const data = await res.json() as { results?: Array<Record<string, unknown>> }
  const risultati = (data.results || []).map((foto) => {
    const urls = oggetto(foto.urls)
    const links = oggetto(foto.links)
    const user = oggetto(foto.user)
    const userLinks = oggetto(user.links)
    const raw = stringa(urls.raw)
    const regular = stringa(urls.regular)
    const small = stringa(urls.small)
    return {
      id: stringa(foto.id),
      anteprimaUrl: small || regular,
      url: urlUnsplash(raw || regular),
      posterUrl: urlUnsplash(raw || regular),
      larghezza: numero(foto.width),
      altezza: numero(foto.height),
      autore: stringa(user.name),
      autoreLink: utm(stringa(userLinks.html)),
      paginaLink: utm(stringa(links.html)),
      downloadLocation: stringa(links.download_location)
    }
  }).filter((r) => r.id && r.url && r.downloadLocation)

  return json({ fonte: 'unsplash', tipo: 'foto', pagina: pag, risultati })
}

function urlUnsplash(raw: string): string {
  if (!raw) return ''
  try {
    const u = new URL(raw)
    u.searchParams.set('w', '1440')
    u.searchParams.set('fit', 'max')
    u.searchParams.set('q', '80')
    u.searchParams.set('auto', 'format')
    return u.toString()
  } catch {
    return raw
  }
}

async function cercaPexels(tipo: 'foto' | 'video', query: string, pag: number) {
  const chiave = Deno.env.get('PEXELS_API_KEY') || ''
  if (!chiave) {
    return json({
      errore: 'CHIAVE_MANCANTE',
      messaggio: 'Manca la chiave Pexels sul server (secret PEXELS_API_KEY).'
    }, 500)
  }

  const qs = new URLSearchParams({
    query,
    page: String(pag),
    per_page: String(PER_PAGINA),
    orientation: 'portrait'
  })
  const percorso = tipo === 'video' ? 'videos/search' : 'search'
  const res = await fetch(`https://api.pexels.com/v1/${percorso}?${qs}`, {
    headers: { Authorization: chiave }
  })
  if (res.status === 429) {
    return json({ errore: 'LIMITE', messaggio: 'Pexels ha raggiunto il limite di ricerche. Riprova più tardi.' }, 429)
  }
  if (!res.ok) return json({ errore: 'SERVIZIO', messaggio: 'Pexels non ha risposto.' }, 502)

  const data = await res.json() as Record<string, unknown>
  const risultati = tipo === 'video'
    ? videoPexels(data.videos)
    : fotoPexels(data.photos)

  return json({ fonte: 'pexels', tipo, pagina: pag, risultati })
}

function fotoPexels(lista: unknown) {
  if (!Array.isArray(lista)) return []
  return lista.map((foto) => {
    const rec = oggetto(foto)
    const src = oggetto(rec.src)
    const originale = stringa(src.original)
    const medio = stringa(src.medium) || stringa(src.small)
    const url = urlPexelsFoto(originale)
    return {
      id: String(rec.id ?? ''),
      anteprimaUrl: medio || url,
      url,
      posterUrl: url,
      larghezza: numero(rec.width),
      altezza: numero(rec.height),
      autore: stringa(rec.photographer),
      autoreLink: utm(stringa(rec.photographer_url)),
      paginaLink: utm(stringa(rec.url))
    }
  }).filter((r) => r.id && r.url)
}

function videoPexels(lista: unknown) {
  if (!Array.isArray(lista)) return []
  return lista.flatMap((video) => {
    const rec = oggetto(video)
    const files = Array.isArray(rec.video_files) ? rec.video_files.map(oggetto) : []
    const file = scegliFileVideo(files)
    if (!file?.link) return []
    const user = oggetto(rec.user)
    const poster = stringa(rec.image)
    return [{
      id: String(rec.id ?? ''),
      anteprimaUrl: poster,
      url: file.link,
      posterUrl: poster,
      larghezza: numero(file.width),
      altezza: numero(file.height),
      durata: numero(rec.duration),
      autore: stringa(user.name),
      autoreLink: utm(stringa(user.url)),
      paginaLink: utm(stringa(rec.url))
    }]
  }).filter((r) => r.id && r.url && r.posterUrl)
}

function urlPexelsFoto(original: string): string {
  if (!original) return ''
  try {
    const u = new URL(original)
    if (u.hostname !== 'images.pexels.com') return ''
    u.searchParams.set('auto', 'compress')
    u.searchParams.set('cs', 'tinysrgb')
    u.searchParams.set('w', '1440')
    return u.toString()
  } catch {
    return ''
  }
}

async function scegli(corpo: Record<string, unknown>) {
  const fonte = corpo.fonte === 'unsplash' || corpo.fonte === 'pexels' ? corpo.fonte : ''
  const tipo = corpo.tipo === 'foto' || corpo.tipo === 'video' ? corpo.tipo : ''
  const id = testo(corpo.id, 40)
  if (!fonte || !tipo || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return json({ errore: 'RICHIESTA', messaggio: 'Scelta dello sfondo non valida.' }, 400)
  }
  if (fonte === 'unsplash') return scegliUnsplash(tipo, stringa(corpo.downloadLocation))
  return scegliPexels(tipo, id, stringa(corpo.url), stringa(corpo.posterUrl))
}

async function scegliUnsplash(tipo: string, downloadLocation: string) {
  if (tipo !== 'foto') {
    return json({ errore: 'VIDEO_NON_DISPONIBILE', messaggio: 'Unsplash non ha video.' }, 400)
  }
  const chiave = chiaveUnsplash()
  if (!chiave) {
    return json({
      errore: 'CHIAVE_MANCANTE',
      messaggio: 'Manca la chiave Unsplash sul server (secret UNSPLASH_ACCESS_KEY).'
    }, 500)
  }
  const destinazione = hostConsentito(downloadLocation, new Set(['api.unsplash.com']))
  if (!destinazione || !destinazione.pathname.includes('/download')) {
    return json({ errore: 'RICHIESTA', messaggio: 'Indirizzo di download Unsplash non valido.' }, 400)
  }

  const res = await fetch(destinazione.toString(), {
    headers: { Authorization: `Client-ID ${chiave}`, 'Accept-Version': 'v1' },
    redirect: 'manual'
  })
  if (res.status === 429) {
    return json({ errore: 'LIMITE', messaggio: 'Unsplash ha raggiunto il limite di ricerche. Riprova più tardi.' }, 429)
  }
  if (res.status < 200 || res.status >= 400) {
    return json({ errore: 'SERVIZIO', messaggio: 'Unsplash non ha registrato la scelta.' }, 502)
  }
  return json({ ok: true })
}

async function scegliPexels(tipo: 'foto' | 'video', id: string, url: string, posterUrl: string) {
  const file = hostConsentito(url, HOST_PEXELS)
  if (!file) return json({ errore: 'RICHIESTA', messaggio: 'Indirizzo del file Pexels non valido.' }, 400)

  const max = tipo === 'video' ? MAX_VIDEO : MAX_FOTO
  const tipi = tipo === 'video'
    ? ['video/mp4']
    : ['image/jpeg', 'image/png', 'image/webp']
  let scaricato: { byte: Uint8Array, tipo: string }
  try {
    scaricato = await scarica(file.toString(), max, tipi)
  } catch (err) {
    return erroreScarico(err)
  }

  const estensione = estensioneDi(scaricato.tipo)
  const percorso = `pexels/${id}.${estensione}`
  let posterPercorso = percorso
  let posterByte = scaricato.byte
  let posterTipo = scaricato.tipo

  if (tipo === 'video') {
    const poster = hostConsentito(posterUrl, HOST_PEXELS)
    if (!poster) return json({ errore: 'RICHIESTA', messaggio: 'Manca il fotogramma di copertina.' }, 400)
    try {
      const foto = await scarica(poster.toString(), MAX_FOTO, ['image/jpeg', 'image/png', 'image/webp'])
      posterByte = foto.byte
      posterTipo = foto.tipo
      posterPercorso = `pexels/${id}-poster.${estensioneDi(foto.tipo)}`
    } catch (err) {
      return erroreScarico(err)
    }
  }

  const urlProgetto = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!urlProgetto || !serviceKey) return json({ errore: 'CONFIG_MANCANTE', messaggio: 'Configurazione del server incompleta.' }, 500)

  const admin = createClient(urlProgetto, serviceKey)
  const caricato = await admin.storage.from('sfondi-vetrina').upload(
    percorso,
    new Blob([scaricato.byte], { type: scaricato.tipo }),
    { contentType: scaricato.tipo, upsert: true }
  )
  if (caricato.error) {
    return json({ errore: 'ARCHIVIO', messaggio: 'Non sono riuscito a salvare lo sfondo.' }, 502)
  }

  let posterPubblico = admin.storage.from('sfondi-vetrina').getPublicUrl(percorso).data.publicUrl
  if (posterPercorso !== percorso) {
    const poster = await admin.storage.from('sfondi-vetrina').upload(
      posterPercorso,
      new Blob([posterByte], { type: posterTipo }),
      { contentType: posterTipo, upsert: true }
    )
    if (poster.error) {
      return json({ errore: 'ARCHIVIO', messaggio: 'Non sono riuscito a salvare la copertina.' }, 502)
    }
    posterPubblico = admin.storage.from('sfondi-vetrina').getPublicUrl(posterPercorso).data.publicUrl
  }

  const pubblico = admin.storage.from('sfondi-vetrina').getPublicUrl(percorso).data.publicUrl
  return json({
    sfondo_url: pubblico,
    sfondo_poster_url: posterPubblico,
    sfondo_fonte_id: id,
    sfondo_tipo: tipo,
    sfondo_fonte: 'pexels'
  })
}

function hostPericoloso(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '::1') return true
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || h === '0.0.0.0') return true
  const pezzi = /^172\.(\d+)\./.exec(h)
  if (pezzi) {
    const n = Number(pezzi[1])
    if (n >= 16 && n <= 31) return true
  }
  return false
}

async function scarica(url: string, maxByte: number, tipi: string[]) {
  const res = await fetch(url, { redirect: 'follow' })
  const finale = new URL(res.url)
  if (finale.protocol !== 'https:' || hostPericoloso(finale.hostname)) {
    throw Object.assign(new Error('HOST'), { code: 'HOST' })
  }
  if (!res.ok) throw Object.assign(new Error('SERVIZIO'), { code: 'SERVIZIO' })

  const lunghezza = Number(res.headers.get('content-length') || 0)
  if (lunghezza > maxByte) throw Object.assign(new Error('FILE_TROPPO_GRANDE'), { code: 'FILE_TROPPO_GRANDE' })

  const byte = new Uint8Array(await res.arrayBuffer())
  if (byte.byteLength === 0) throw Object.assign(new Error('SERVIZIO'), { code: 'SERVIZIO' })
  if (byte.byteLength > maxByte) throw Object.assign(new Error('FILE_TROPPO_GRANDE'), { code: 'FILE_TROPPO_GRANDE' })

  const tipoHeader = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const tipo = tipi.includes(tipoHeader) ? tipoHeader : riconosciTipo(byte)
  if (!tipo || !tipi.includes(tipo)) throw Object.assign(new Error('TIPO_NON_CONSENTITO'), { code: 'TIPO_NON_CONSENTITO' })
  return { byte, tipo }
}

function riconosciTipo(byte: Uint8Array): string | null {
  if (byte.length >= 3 && byte[0] === 0xff && byte[1] === 0xd8 && byte[2] === 0xff) return 'image/jpeg'
  if (byte.length >= 8 && byte[0] === 0x89 && byte[1] === 0x50 && byte[2] === 0x4e && byte[3] === 0x47) return 'image/png'
  if (
    byte.length >= 12
    && byte[0] === 0x52 && byte[1] === 0x49 && byte[2] === 0x46 && byte[3] === 0x46
    && byte[8] === 0x57 && byte[9] === 0x45 && byte[10] === 0x42 && byte[11] === 0x50
  ) return 'image/webp'
  if (byte.length >= 8 && String.fromCharCode(byte[4], byte[5], byte[6], byte[7]) === 'ftyp') return 'video/mp4'
  return null
}

function erroreScarico(err: unknown) {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
  if (code === 'FILE_TROPPO_GRANDE') {
    return json({ errore: code, messaggio: 'Il file supera il peso consentito.' }, 422)
  }
  if (code === 'TIPO_NON_CONSENTITO' || code === 'HOST') {
    return json({ errore: 'TIPO_NON_CONSENTITO', messaggio: 'Il file non è un’immagine o un video utilizzabile.' }, 422)
  }
  return json({ errore: 'SERVIZIO', messaggio: 'Non sono riuscito a scaricare il file da Pexels.' }, 502)
}

function estensioneDi(tipo: string): string {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'
  if (tipo === 'video/mp4') return 'mp4'
  return 'jpg'
}

function oggetto(valore: unknown): Record<string, unknown> {
  return valore && typeof valore === 'object' ? valore as Record<string, unknown> : {}
}

function stringa(valore: unknown): string {
  return typeof valore === 'string' ? valore : ''
}

function numero(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : 0
}
