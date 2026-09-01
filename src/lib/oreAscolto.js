import { supabase, supabaseConfigurato } from './supabaseClient'

export function formattaOreAscolto(minuti) {
  const tot = Math.max(0, Math.round(Number(minuti) || 0))
  const ore = Math.floor(tot / 60)
  const resto = tot % 60
  if (ore === 0) return `${resto} min`
  if (resto === 0) return ore === 1 ? '1 h' : `${ore} h`
  return `${ore} h ${resto} min`
}

export async function sommaMinutiTracce(codice) {
  if (!codice || !supabaseConfigurato) return 0
  const { data, error } = await supabase.rpc('log_pratica_del_partecipante', {
    p_codice: codice
  })
  if (error || !data) return 0
  return data.reduce((tot, riga) => {
    if (riga.numero_settimana == null) return tot
    return tot + (Number(riga.durata_minuti) || 0)
  }, 0)
}
