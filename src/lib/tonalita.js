const CHIAVE = 'conscio-tonalita'

export const HUE_DEFAULT = 142.5

const PALETTE = [
  ['--moss', 142.5, 17.58, 35.69],
  ['--moss-dark', 145.71, 18.26, 22.55],
  ['--ochre', 31.7, 46.09, 45.1],
  ['--bg', 77.14, 20, 93.14],
  ['--surface', 48, 38.46, 97.45],
  ['--ink', 156.92, 15.29, 16.67],
  ['--ink-soft', 141.82, 5.7, 37.84],
  ['--border', 55, 13.95, 83.14]
]

function normalizzaHue(hue) {
  const n = Number(hue)
  if (!Number.isFinite(n)) return HUE_DEFAULT
  return ((n % 360) + 360) % 360
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = n => {
    const k = (n + h / 30) % 12
    const c = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function leggiHue() {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (grezzo == null) return HUE_DEFAULT
    return normalizzaHue(grezzo)
  } catch {
    return HUE_DEFAULT
  }
}

export function salvaHue(hue) {
  try {
    localStorage.setItem(CHIAVE, String(normalizzaHue(hue)))
  } catch {
    /* archivio non disponibile */
  }
}

export function applicaTonalita(hue) {
  const h = normalizzaHue(hue)
  const delta = h - HUE_DEFAULT
  const root = document.documentElement
  let moss = null
  for (const [nome, baseH, s, l] of PALETTE) {
    const ruotato = normalizzaHue(baseH + delta)
    root.style.setProperty(nome, `hsl(${ruotato.toFixed(2)} ${s}% ${l}%)`)
    if (nome === '--moss') moss = hslToHex(ruotato, s, l)
  }
  if (moss) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', moss)
  }
}

export function avviaTonalita() {
  applicaTonalita(leggiHue())
}
