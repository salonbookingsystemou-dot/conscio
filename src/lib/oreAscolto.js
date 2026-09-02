import { supabase, supabaseConfigurato } from './supabaseClient'
import {
  sommaMinutiAscoltati,
  sincronizzaAscoltiLocaliVersoServer
} from './ascolto.js'

export function formattaOreAscolto(minuti) {
  const tot = Math.max(0, Math.round(Number(minuti) || 0))
  const ore = Math.floor(tot / 60)
  const resto = tot % 60
  if (ore === 0) return `${resto} min`
  if (resto === 0) return ore === 1 ? '1 h' : `${ore} h`
  return `${ore} h ${resto} min`
}

export async function sommaMinutiTracce(codice) {
  if (!codice) return 0
  const pulito = codice.trim()

  if (supabaseConfigurato) {
    try {
      await sincronizzaAscoltiLocaliVersoServer(pulito)
      const { data, error } = await supabase.rpc('minuti_ascolto_del_partecipante', {
        p_codice: pulito
      })
      if (!error && data != null) {
        const n = Number(data)
        if (Number.isFinite(n)) return Math.max(0, Math.round(n))
      }
    } catch {
      /* fallback locale */
    }
  }

  return sommaMinutiAscoltati(pulito)
}
