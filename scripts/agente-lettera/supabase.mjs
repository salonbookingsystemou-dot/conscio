// Accesso a Supabase con il service role (solo nel job di GitHub Actions).
// Tocca solo le tabelle della lettera, le impostazioni del sito e le RPC pubbliche della vetrina.
// Non legge mai iscritti_lettera né tabelle dei partecipanti.

export function clientSupabase({ url, chiave }) {
  const base = String(url || '').replace(/\/+$/, '')
  if (!base || !chiave) throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti')
  const intestazioni = { apikey: chiave, Authorization: `Bearer ${chiave}` }

  async function rest(metodo, percorso, { corpo, prefer } = {}) {
    const res = await fetch(`${base}/rest/v1/${percorso}`, {
      method: metodo,
      headers: {
        ...intestazioni,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {})
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000)
    })
    const testo = await res.text()
    if (!res.ok) throw new Error(`Supabase ${metodo} ${percorso.split('?')[0]}: ${res.status} ${testo.slice(0, 300)}`)
    return testo ? JSON.parse(testo) : null
  }

  return {
    base,
    seleziona: (tabella, query = '') => rest('GET', `${tabella}${query ? `?${query}` : ''}`),
    inserisci: (tabella, righe, conflitto) =>
      rest('POST', `${tabella}${conflitto ? `?on_conflict=${conflitto}` : ''}`, {
        corpo: righe,
        prefer: conflitto ? 'resolution=merge-duplicates,return=representation' : 'return=representation'
      }),
    aggiorna: (tabella, filtro, valori) =>
      rest('PATCH', `${tabella}?${filtro}`, { corpo: valori, prefer: 'return=representation' }),
    rpc: (nome, argomenti = {}) => rest('POST', `rpc/${nome}`, { corpo: argomenti }),

    /** Caricamento pubblico con cache di un anno (come gli altri file in Storage). */
    async carica(bucket, percorso, dati, tipo) {
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${percorso}`, {
        method: 'POST',
        headers: { ...intestazioni, 'Content-Type': tipo, 'cache-control': 'max-age=31536000', 'x-upsert': 'true' },
        body: dati,
        signal: AbortSignal.timeout(60_000)
      })
      if (!res.ok) throw new Error(`Storage ${percorso}: ${res.status} ${(await res.text()).slice(0, 200)}`)
      return `${base}/storage/v1/object/public/${bucket}/${percorso}`
    },

    async esiste(urlPubblico) {
      try {
        const res = await fetch(urlPubblico, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })
        return res.ok
      } catch {
        return false
      }
    }
  }
}

/** Gli URL già visti tra quelli dati (per non ripetere notizie). */
export async function hashGiaVisti(db, hashes) {
  const visti = new Set()
  for (let i = 0; i < hashes.length; i += 100) {
    const blocco = hashes.slice(i, i + 100)
    if (!blocco.length) continue
    const righe = await db.seleziona('notizie_lettera', `select=url_hash&url_hash=in.(${blocco.join(',')})`)
    for (const r of righe || []) visti.add(r.url_hash)
  }
  return visti
}
