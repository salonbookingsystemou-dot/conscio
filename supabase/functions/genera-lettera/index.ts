// Edge Function: «Genera lettera» dalla scheda del facilitatore.
// Lancia su GitHub il job «Lettera settimanale» (.github/workflows/lettera-agente.yml) con comando «genera».
// Il lavoro vero lo fa il job (pochi minuti): qui si chiede solo di partire.
// Solo facilitatore (JWT + is_facilitatore()).
// Secret: GH_DISPATCH_TOKEN (token GitHub a grana fine, solo su questo repository, permesso «Actions: Read and write»).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REPO = 'salonbookingsystemou-dot/conscio'
const WORKFLOW = 'lettera-agente.yml'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

/** Lunedì della settimana in corso, ora italiana (come lo script). */
function lunediItalia(ora = new Date()): string {
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(ora)
  const d = new Date(`${oggi}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'NON_AUTORIZZATO' }, 401)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const conSessione = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: isFac } = await conSessione.rpc('is_facilitatore')
  if (!isFac) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const token = Deno.env.get('GH_DISPATCH_TOKEN') ?? ''
  if (!token) return json({ ok: false, motivo: 'GITHUB_NON_CONFIGURATO' })

  // Una lettera già partita non si rifà.
  const { data: bozza } = await conSessione
    .from('bozze_lettera')
    .select('stato')
    .eq('settimana', lunediItalia())
    .maybeSingle()
  if (bozza && ['in_invio', 'inviata'].includes(bozza.stato)) {
    return json({ ok: false, motivo: 'GIA_INVIATA' })
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'conscio-genera-lettera',
      'Content-Type': 'application/json'
    },
    // Con una bozza già pronta si rifà da capo (l'agente non tocca mai una lettera partita).
    body: JSON.stringify({ ref: 'main', inputs: { comando: 'genera', forza: bozza ? 'true' : 'false' } })
  })

  if (res.status === 204) return json({ ok: true, rifatta: Boolean(bozza) })
  const testo = await res.text().catch(() => '')
  console.error('genera-lettera', res.status, testo.slice(0, 300))
  if (res.status === 401 || res.status === 403) return json({ ok: false, motivo: 'GITHUB_TOKEN_NON_VALIDO' })
  return json({ ok: false, motivo: 'GITHUB_ERRORE', errore: `GitHub ha risposto ${res.status}` })
})
