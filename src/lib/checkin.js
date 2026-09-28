import { supabase } from './supabaseClient'

export const PRESENZA = [
  { valore: 0, etichetta: 'mai' },
  { valore: 1, etichetta: 'raramente' },
  { valore: 2, etichetta: 'qualche volta' },
  { valore: 3, etichetta: 'spesso' },
  { valore: 4, etichetta: 'molto spesso' }
]

export const OSTACOLI = [
  { id: 'tempo', etichetta: 'tempo' },
  { id: 'stanchezza', etichetta: 'stanchezza' },
  { id: 'dimenticanza', etichetta: 'mi sono dimenticato' },
  { id: 'noia', etichetta: 'noia' },
  { id: 'disagio', etichetta: 'disagio durante la pratica' },
  { id: 'altro', etichetta: 'altro' }
]

export const NOTA_MAX = 1000

function payload(data) {
  return typeof data === 'string' ? JSON.parse(data) : data
}

export async function leggiCheckin(codice) {
  const { data, error } = await supabase.rpc('checkin_del_partecipante', {
    p_codice: codice.trim()
  })
  if (error || !data) return { stato: null, error }
  return { stato: payload(data), error: null }
}

export async function daiConsensoCheckin(codice) {
  const { error } = await supabase.rpc('dai_consenso_checkin', { p_codice: codice.trim() })
  return { error }
}

export async function salvaCheckin(codice, risposte) {
  const { data, error } = await supabase.rpc('salva_checkin', {
    p_codice: codice.trim(),
    p_stress: risposte.stress,
    p_sonno: risposte.sonno,
    p_presenza_quotidiana: risposte.presenza,
    p_ostacoli: risposte.ostacoli,
    p_esperienza_difficile: risposte.difficile,
    p_nota_difficile: risposte.difficile ? risposte.nota : null
  })
  if (error) return { esito: null, error }
  return { esito: payload(data), error: null }
}

export function messaggioErroreCheckin(error) {
  const testo = error?.message || ''
  if (testo.includes('CODICE_NON_TROVATO')) return 'Codice non riconosciuto. Controlla e riprova.'
  if (testo.includes('CONSENSO_CHECKIN_MANCANTE')) return 'Prima di compilare serve il tuo consenso al check-in.'
  if (testo.includes('ACCESSO_NON_IDONEO')) return 'Il check-in si apre dopo l’esito idoneo dello screening.'
  if (testo.includes('CHECKIN_NON_APERTO')) return 'Il check-in non è aperto in questa settimana.'
  if (testo.includes('CHECKIN_GIA_COMPILATO')) return 'Il check-in di questa settimana è già registrato.'
  if (testo.includes('TROPPI_TENTATIVI')) return 'Troppi salvataggi ravvicinati. Riprova tra qualche minuto.'
  return 'Non è stato possibile salvare il check-in. Riprova.'
}
