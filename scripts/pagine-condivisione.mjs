// Dopo `vite build`: una pagina statica per ogni meditazione pubblica in vetrina,
// in dist/ascolta/<slug>/index.html, con titolo e immagine per le anteprime dei
// link (WhatsApp, Telegram, Facebook non eseguono JavaScript e non vedono l'app).
// Chi apre il link viene mandato subito a /#/ascolta/<slug>.
// Se Supabase non risponde la build non si ferma: resta il rimando di 404.html.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DESCRIZIONE_SEZIONE = 'Pillole di meditazione da assumere ogni volta che si ha bisogno di tornare in contatto con se stessi. Assaggiane subito una.'

function escapa(testo) {
  return String(testo ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function riassunto(testo, massimo = 200) {
  const pulito = String(testo || '').replace(/\s+/g, ' ').trim()
  if (pulito.length <= massimo) return pulito
  return `${pulito.slice(0, massimo - 1).replace(/\s+\S*$/, '')}…`
}

function immagine(traccia) {
  const sfondo = traccia?.sfondo || {}
  if (sfondo.poster_url) return sfondo.poster_url
  if (sfondo.tipo !== 'video' && sfondo.url) return sfondo.url
  return ''
}

function pagina({ titolo, descrizione, immagineUrl, url, destinazione }) {
  const meta = [
    ['og:type', 'website'],
    ['og:site_name', 'Conscio'],
    ['og:locale', 'it_IT'],
    ['og:title', titolo],
    ['og:description', descrizione],
    ['og:url', url],
    immagineUrl && ['og:image', immagineUrl],
    immagineUrl && ['og:image:alt', titolo]
  ].filter(Boolean)
  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapa(titolo)}</title>
    <meta name="description" content="${escapa(descrizione)}" />
    <link rel="canonical" href="${escapa(url)}" />
${meta.map(([nome, valore]) => `    <meta property="${nome}" content="${escapa(valore)}" />`).join('\n')}
    <meta name="twitter:card" content="${immagineUrl ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapa(titolo)}" />
    <meta name="twitter:description" content="${escapa(descrizione)}" />
${immagineUrl ? `    <meta name="twitter:image" content="${escapa(immagineUrl)}" />\n` : ''}    <script>location.replace(${JSON.stringify(destinazione)} + location.search)</script>
  </head>
  <body>
    <p><a href="${escapa(destinazione)}">${escapa(titolo)}</a></p>
  </body>
</html>
`
}

async function principale() {
  const env = loadEnv('production', process.cwd(), '')
  const base = env.VITE_SUPABASE_URL
  const chiave = env.VITE_SUPABASE_ANON_KEY
  if (!base || !chiave) throw new Error('mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
  const dominio = (await readFile('public/CNAME', 'utf8').catch(() => '')).trim() || 'conscio.mnesti.it'
  const sito = `https://${dominio}`

  const risposta = await fetch(`${base}/rest/v1/rpc/vetrina_elenco`, {
    method: 'POST',
    headers: {
      apikey: chiave,
      Authorization: `Bearer ${chiave}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  })
  if (!risposta.ok) throw new Error(`vetrina_elenco ha risposto ${risposta.status}`)
  const elenco = await risposta.json()
  const tracce = (Array.isArray(elenco) ? elenco : []).filter(t => SLUG.test(t?.slug || ''))

  for (const traccia of tracce) {
    const cartella = `dist/ascolta/${traccia.slug}`
    await mkdir(cartella, { recursive: true })
    await writeFile(`${cartella}/index.html`, pagina({
      titolo: traccia.titolo,
      descrizione: riassunto(traccia.descrizione) || DESCRIZIONE_SEZIONE,
      immagineUrl: immagine(traccia),
      url: `${sito}/ascolta/${traccia.slug}/`,
      destinazione: `/#/ascolta/${traccia.slug}`
    }))
  }

  await mkdir('dist/ascolta', { recursive: true })
  await writeFile('dist/ascolta/index.html', pagina({
    titolo: 'Ascoltati',
    descrizione: DESCRIZIONE_SEZIONE,
    immagineUrl: immagine(tracce[0]),
    url: `${sito}/ascolta/`,
    destinazione: '/#/ascolta'
  }))

  console.log(`pagine di condivisione: ${tracce.length} meditazioni`)
}

principale().catch(err => {
  console.warn(`pagine di condivisione non generate: ${err.message}`)
})
