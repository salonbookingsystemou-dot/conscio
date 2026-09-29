import { COLORI } from './colori.js'

const CHIAVE = 'conscio-tonalita'

export const HUE_DEFAULT = 142.5

// Token che ruotano con la tonalità. I colori dei toni e della scala dei
// minuti restano fissi: hanno un significato nei grafici.
const RUOTABILI = [
  ['--moss', COLORI.moss],
  ['--accent', COLORI.accent],
  ['--accent-hover', COLORI.accentHover],
  ['--accent-soft', COLORI.accentSoft],
  ['--ochre', COLORI.ochre],
  ['--ochre-soft', COLORI.ochreSoft],
  ['--bg', COLORI.bg],
  ['--surface-muted', COLORI.surfaceMuted],
  ['--track', COLORI.track],
  ['--ink', COLORI.ink],
  ['--ink-2', COLORI.ink2],
  ['--muted', COLORI.muted],
  ['--border', COLORI.border],
  ['--border-soft', COLORI.borderSoft],
  ['--grid', COLORI.grid]
]

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

const PALETTE = RUOTABILI.map(([nome, hex]) => [nome, ...hexToHsl(hex)])

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
  const meta = document.querySelector('meta[name="theme-color"]')
  if (Math.abs(delta) < 0.8) {
    for (const [nome] of PALETTE) root.style.removeProperty(nome)
    meta?.setAttribute('content', COLORI.moss)
    return
  }
  let moss = null
  for (const [nome, baseH, s, l] of PALETTE) {
    const ruotato = normalizzaHue(baseH + delta)
    root.style.setProperty(nome, `hsl(${ruotato.toFixed(2)} ${s.toFixed(2)}% ${l.toFixed(2)}%)`)
    if (nome === '--moss') moss = hslToHex(ruotato, s, l)
  }
  meta?.setAttribute('content', moss)
}

export function avviaTonalita() {
  applicaTonalita(leggiHue())
}
