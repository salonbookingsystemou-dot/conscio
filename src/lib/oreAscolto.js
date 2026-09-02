import { supabase, supabaseConfigurato } from './supabaseClient'
import {
  ascoltoCompletato,
  idAscoltoConPrefisso,
  recuperaAscoltoSeManca,
  sommaMinutiAscoltati
} from './ascolto.js'

export function formattaOreAscolto(minuti) {
  const tot = Math.max(0, Math.round(Number(minuti) || 0))
  const ore = Math.floor(tot / 60)
  const resto = tot % 60
  if (ore === 0) return `${resto} min`
  if (resto === 0) return ore === 1 ? '1 h' : `${ore} h`
  return `${ore} h ${resto} min`
}

function durataDaUrl(src) {
  return new Promise(resolve => {
    const audio = new Audio()
    audio.preload = 'metadata'
    let chiuso = false
    function fine(valore) {
      if (chiuso) return
      chiuso = true
      audio.removeAttribute('src')
      audio.load()
      resolve(valore)
    }
    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration
      fine(Number.isFinite(d) && d > 0 ? d : 0)
    })
    audio.addEventListener('error', () => fine(0))
    window.setTimeout(() => fine(0), 8000)
    audio.src = src
  })
}

export async function sommaMinutiTracce(codice) {
  if (!codice) return 0
  if (supabaseConfigurato) {
    const { data, error } = await supabase.rpc('programma_del_partecipante', {
      p_codice: codice
    })
    if (!error && data) {
      const payload = typeof data === 'string' ? JSON.parse(data) : data
      const pulito = codice.trim()
      await Promise.all((payload.lezioni || []).map(async lezione => {
        const esercizi = lezione.esercizi || []
        await Promise.all(esercizi.map(async ex => {
          if (!ex.traccia_audio || !ex.id) return
          const ids = idAscoltoConPrefisso(`${pulito}:${ex.id}`)
          if (ids.length === 0) return
          const secondi = await durataDaUrl(ex.traccia_audio)
          if (!secondi) return
          ids.forEach(id => recuperaAscoltoSeManca(id, secondi))
        }))
        // Compatibilità con chiavi vecchie (codice:lezioneId)
        if (lezione.traccia_audio) {
          const idVecchio = `${pulito}:${lezione.id || lezione.numero_settimana}`
          if (ascoltoCompletato(idVecchio)) {
            const secondi = await durataDaUrl(lezione.traccia_audio)
            if (secondi) recuperaAscoltoSeManca(idVecchio, secondi)
          }
        }
      }))
    }
  }
  return sommaMinutiAscoltati(codice)
}
