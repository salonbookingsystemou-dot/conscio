// Gira prima delle route di Workbox (importScripts in cima a sw.js).
// Su iOS, fetch() di una navigazione dall’icona in home può fallire con
// TypeError: Load failed. Se respondWith riceve quel rifiuto, Safari
// mostra la pagina di errore e l’app non si apre.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  if (event.stopImmediatePropagation) event.stopImmediatePropagation()
  event.respondWith(apriNavigazione(event.request))
})

async function apriNavigazione(richiesta) {
  try {
    const rete = await fetch(richiesta.url, {
      credentials: 'same-origin',
      cache: 'reload',
      redirect: 'follow'
    })
    if (rete && rete.status >= 200 && rete.status < 400) {
      return rete.redirected ? await copiaRisposta(rete) : rete
    }
  } catch {
    // iOS: Load failed. Si usa la copia già in cache.
  }

  const salvata = await trovaIndex()
  if (salvata) return salvata

  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Percorso MBSR</title><p style="font-family:sans-serif;padding:24px">Non riesco ad aprire l’app. Controlla la connessione e riprova.</p>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  )
}

async function trovaIndex() {
  const indice = new URL('index.html', self.registration.scope).href
  const nomi = await caches.keys()
  for (const nome of nomi) {
    const cache = await caches.open(nome)
    const trovata = await cache.match(indice, { ignoreSearch: true })
    if (trovata) return trovata
  }
  return null
}

async function copiaRisposta(rete) {
  return new Response(await rete.blob(), {
    status: rete.status,
    statusText: rete.statusText,
    headers: new Headers(rete.headers)
  })
}
