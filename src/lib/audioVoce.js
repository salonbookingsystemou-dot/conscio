// Rifinisce il parlato di un paragrafo, in campioni già decodificati.
// Il volume del corpo della frase va allo stesso livello. In apertura il fade
// lungo non si raddrizza. In chiusura la parola resta com’è: la rampa parte
// solo quando il parlato è già sceso, così le ultime lettere si sentono.

const OBIETTIVO = 10 ** (-18 / 20)
const TETTO = 10 ** (-1 / 20)
const BOOST_MAX = 10 ** (12 / 20)
const HOP_S = 0.01
const ATTACCO_S = 0.07
// Una voce da meditazione chiude piano: la coda dell'ultima vocale scende ben
// sotto il livello del corpo. Soglia bassa e dissolvenza lunga per non tagliarla.
const SOGLIA_FINE = 0.03
const CODA_S = 0.18
const GUARDIA_S = 0.02

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

function curva(t) {
  const x = Math.min(1, Math.max(0, t))
  return 0.5 - 0.5 * Math.cos(Math.PI * x)
}

function guadagni(samples, sampleRate) {
  const hop = Math.max(1, Math.round(sampleRate * HOP_S))
  const env = inviluppo(samples, hop)
  const corpo = livelloCorpo(env)
  const gain = new Float32Array(samples.length).fill(1)
  if (corpo > 1e-5 && env.length > 4) {
    const margine = Math.min(
      Math.round(0.6 / HOP_S),
      Math.max(2, Math.floor(env.length * 0.3))
    )
    let arrivo = 0
    while (arrivo < margine && env[arrivo] < corpo * 0.82) arrivo += 1
    const attacco = Math.round(sampleRate * (arrivo > 1 ? ATTACCO_S : GUARDIA_S))
    const fineAttacco = Math.min(samples.length, Math.max(hop, arrivo * hop))
    const inizioAttacco = Math.max(0, fineAttacco - attacco)
    for (let i = 0; i < inizioAttacco; i += 1) gain[i] = 0
    for (let i = inizioAttacco; i < fineAttacco; i += 1) {
      gain[i] = curva((i - inizioAttacco) / Math.max(1, fineAttacco - inizioAttacco))
    }

    let fineParola = env.length - 1
    const limite = Math.max(0, env.length - 1 - margine)
    while (fineParola > limite && env[fineParola] < corpo * SOGLIA_FINE) fineParola -= 1
    const coda = Math.round(sampleRate * (fineParola < env.length - 2 ? CODA_S : GUARDIA_S))
    const inizioCoda = Math.min(samples.length, (fineParola + 1) * hop)
    if (inizioCoda > fineAttacco + hop) {
      const fineCoda = Math.min(samples.length, inizioCoda + coda)
      for (let i = inizioCoda; i < fineCoda; i += 1) {
        gain[i] = curva(1 - (i - inizioCoda) / Math.max(1, fineCoda - inizioCoda))
      }
      for (let i = fineCoda; i < samples.length; i += 1) gain[i] = 0
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
  return amplificati
}
