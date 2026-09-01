const CHIAVE = 'conscio-invito-home'

export function appGiaInHome() {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = window.navigator.standalone === true
  return standalone || iosStandalone
}

export function eIos() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function eDispositivoMobile() {
  if (typeof navigator === 'undefined') return false
  const ua = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const stretto = window.matchMedia('(max-width: 720px)').matches
  return ua || stretto
}

export function invitoGiaChiuso() {
  try {
    return localStorage.getItem(CHIAVE) === '1'
  } catch {
    return false
  }
}

export function memorizzaInvitoChiuso() {
  try {
    localStorage.setItem(CHIAVE, '1')
  } catch {
    /* storage non disponibile */
  }
}

export function vaMostratoInvito() {
  return !appGiaInHome() && !invitoGiaChiuso() && eDispositivoMobile()
}

export function apriInvitoHome() {
  window.dispatchEvent(new Event('conscio-apri-invito-home'))
}
