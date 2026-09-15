// Garantisce che una traccia audio sia disponibile offline.
//
// I tag <audio> caricano l'audio con richieste Range (risposte 206) che il
// service worker (CacheFirst) non salva come copia completa. Per far funzionare
// la riproduzione offline serve una richiesta "piena" (GET senza Range → 200):
// passando dal service worker, la copia integrale finisce nella cache
// "tracce-audio" e da lì il RangeRequestsPlugin serve i frammenti anche offline.

const inCorso = new Set()

// Nome allineato alla route del service worker (vite.config.js).
const CACHE_TRACCE = 'tracce-audio-v2'
// Vecchia cache che poteva contenere risposte opaque non affettabili: va rimossa.
const CACHE_LEGACY = 'tracce-audio'

export function tracciaRemota(url) {
  return typeof url === 'string' && url.includes('/storage/v1/object/public/tracce-audio/')
}

// Rimuove la cache legacy "avvelenata" da risposte opaque (una tantum).
export async function pulisciCacheTracceLegacy() {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(CACHE_LEGACY)
  } catch {
    // ignora
  }
}

export async function tracciaInCache(url) {
  if (!url || typeof caches === 'undefined') return false
  try {
    const match = await caches.match(url)
    return Boolean(match)
  } catch {
    return false
  }
}

export async function assicuraTracciaOffline(url) {
  if (!tracciaRemota(url)) return
  if (typeof caches === 'undefined' || typeof fetch === 'undefined') return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  if (inCorso.has(url)) return

  inCorso.add(url)
  try {
    if (await tracciaInCache(url)) return
    // Richiesta CORS "piena" (senza Range → 200): passa dal service worker, che
    // salva la copia completa in cache. È da questa copia che il RangeRequestsPlugin
    // serve i frammenti richiesti dal tag <audio>, anche offline.
    const risposta = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (risposta && risposta.body) {
      const reader = risposta.body.getReader()
      // Scorriamo lo stream fino alla fine senza accumulare in memoria.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }
  } catch {
    // Offline o errore di rete: si riproverà alla prossima apertura/ascolto.
  } finally {
    inCorso.delete(url)
  }
}
