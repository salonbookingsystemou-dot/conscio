// Rifinisce il parlato di un paragrafo, in campioni già decodificati.
// ElevenLabs chiude ogni generazione con un fade: qui la rampa si raddrizza
// e il volume del parlato va allo stesso livello, così i paragrafi non saltano.

const OBIETTIVO = 10 ** (-18 / 20)
const TETTO = 10 ** (-1 / 20)
const BOOST_MAX = 10 ** (12 / 20)
const FADE_MAX_GAIN = 10 ** (18 / 20)
const HOP_S = 0.01
const FADE_MAX_S = 0.5

function passaAlto(samples, sampleRate) {
  const rc = 1 / (2 * Math.PI * 20)
  const a = rc / (rc + 1 / sampleRate)
  const out = new Float32Array(samples.length)
  let prevY = 0
  let prevX = 0
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i]
    const y = a * (prevY + x - prevX)
    out[i] = y
    prevY = y
    prevX = x
  }
  return out
}

function inviluppo(samples, hop) {
  const n = Math.floor(samples.length / hop)
  const env = new Float32Array(n)
  for (let w = 0; w < n; w += 1) {
    let acc = 0
    const da = w * hop
    for (let i = 0; i < hop; i += 1) {
      const s = samples[da + i]
      acc += s * s
    }
    env[w] = Math.sqrt(acc / hop)
  }
  return env
}

function livelloCorpo(env) {
  const da = env.length >= 8 ? Math.floor(env.length * 0.2) : 0
  const a = env.length >= 8 ? Math.ceil(env.length * 0.8) : env.length
  const valori = []
  for (let i = da; i < a; i += 1) {
    if (env[i] > 1e-4) valori.push(env[i])
  }
  if (valori.length < 2) return 0
  valori.sort((x, y) => x - y)
  const i0 = Math.floor(valori.length * 0.35)
  const i1 = Math.max(i0 + 1, Math.ceil(valori.length * 0.85))
  let somma = 0
  for (let i = i0; i < i1; i += 1) somma += valori[i]
  return somma / (i1 - i0)
}

function indiciFade(env, corpo, versoFine) {
  const maxW = Math.min(
    env.length,
    Math.max(3, Math.round(FADE_MAX_S / HOP_S)),
    Math.max(3, Math.floor(env.length * 0.35))
  )
  const ordine = []
  for (let i = 0; i < maxW; i += 1) ordine.push(versoFine ? env.length - 1 - i : i)
  let i = 0
  while (i < ordine.length && env[ordine[i]] < corpo * 0.03) i += 1
  const onset = i
  let fine = i
  while (fine < ordine.length && env[ordine[fine]] < corpo * 0.88) fine += 1
  if (fine - onset < 3) return []
  const primo = env[ordine[onset]]
  const ultimo = env[ordine[Math.min(fine, ordine.length - 1)]]
  if (ultimo < primo * 1.12) return []
  return ordine.slice(onset, fine)
}

function guadagni(samples, sampleRate) {
  const hop = Math.max(1, Math.round(sampleRate * HOP_S))
  const env = inviluppo(samples, hop)
  const corpo = livelloCorpo(env)
  const perHop = new Float32Array(env.length).fill(1)
  if (corpo > 1e-5) {
    for (const versoFine of [false, true]) {
      const indici = indiciFade(env, corpo, versoFine)
      if (!indici.length) continue
      const interno = versoFine
        ? Math.min(...indici) - 1
        : Math.max(...indici) + 1
      const plateau = env[Math.max(0, Math.min(env.length - 1, interno))] || corpo
      const riferimento = Math.max(plateau, corpo * 0.88)
      for (const w of indici) {
        const livello = Math.max(env[w], riferimento * 0.05)
        perHop[w] = Math.min(FADE_MAX_GAIN, Math.max(1, riferimento / livello))
      }
    }
  }
  const gain = new Float32Array(samples.length).fill(1)
  for (let w = 0; w < perHop.length; w += 1) {
    const da = w * hop
    const a = Math.min(samples.length, da + hop)
    const g0 = perHop[w]
    const g1 = perHop[Math.min(perHop.length - 1, w + 1)]
    for (let i = da; i < a; i += 1) {
      const t = (i - da) / hop
      gain[i] = g0 + (g1 - g0) * t
    }
  }
  let globale = corpo > 1e-5 ? OBIETTIVO / corpo : 1
  if (globale > BOOST_MAX) globale = BOOST_MAX
  for (let i = 0; i < gain.length; i += 1) gain[i] *= globale
  return gain
}

function limita(sample) {
  const abs = Math.abs(sample)
  if (abs <= TETTO) return sample
  const segno = sample < 0 ? -1 : 1
  const eccesso = abs - TETTO
  const morbido = TETTO + (0.98 - TETTO) * Math.tanh(eccesso / (1 - TETTO))
  return segno * morbido
}

function tagliaSilenzio(canali, sampleRate) {
  const n = canali[0].length
  const margine = Math.round(sampleRate * 0.01)
  const soglia = 0.002
  let da = 0
  let a = n
  while (da < n && Math.abs(canali[0][da]) < soglia) da += 1
  while (a > da && Math.abs(canali[0][a - 1]) < soglia) a -= 1
  da = Math.max(0, da - margine)
  a = Math.min(n, a + margine)
  if (a - da < Math.round(sampleRate * 0.05)) return canali
  return canali.map(ch => ch.subarray(da, a))
}

function rampaAnticlic(canali, sampleRate) {
  const n = canali[0].length
  const rampa = Math.round(sampleRate * 0.004)
  if (n < rampa * 4) return canali
  const bordo = Math.max(...canali.map(ch => Math.abs(ch[0])), ...canali.map(ch => Math.abs(ch[n - 1])))
  if (bordo < 0.05) return canali
  return canali.map(ch => {
    const out = new Float32Array(ch)
    for (let i = 0; i < rampa; i += 1) {
      const t = i / rampa
      out[i] *= t
      out[n - 1 - i] *= t
    }
    return out
  })
}

export function rifinisciCampioni(canali, sampleRate) {
  const validi = (canali || []).filter(ch => ch && ch.length)
  if (!validi.length) return []
  const n = validi[0].length
  const puliti = validi.map(ch => passaAlto(ch, sampleRate))
  const mono = new Float32Array(n)
  for (const ch of puliti) {
    for (let i = 0; i < n; i += 1) mono[i] += ch[i]
  }
  const inv = 1 / puliti.length
  for (let i = 0; i < n; i += 1) mono[i] *= inv
  const gain = guadagni(mono, sampleRate)
  const amplificati = puliti.map(ch => {
    const out = new Float32Array(n)
    for (let i = 0; i < n; i += 1) out[i] = limita(ch[i] * gain[i])
    return out
  })
  return rampaAnticlic(tagliaSilenzio(amplificati, sampleRate), sampleRate)
}
