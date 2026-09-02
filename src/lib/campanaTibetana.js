const DURATA = 3

function AudioCtx() {
  const C = window.AudioContext || window.webkitAudioContext
  return C ? new C() : null
}

export function suonaCampanaTibetana() {
  const ctx = AudioCtx()
  if (!ctx) {
    return {
      attesa: Promise.resolve('fine'),
      ferma() {}
    }
  }

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.connect(ctx.destination)

  const t0 = ctx.currentTime
  const t1 = t0 + DURATA
  const parziali = [
    { f: 246.9, g: 0.4, dec: 2.85 },
    { f: 370.0, g: 0.2, dec: 2.45 },
    { f: 493.9, g: 0.15, dec: 2.2 },
    { f: 622.3, g: 0.09, dec: 1.85 },
    { f: 739.9, g: 0.06, dec: 1.55 },
    { f: 987.8, g: 0.035, dec: 1.2 }
  ]

  for (const p of parziali) {
    for (const scarto of [0, 1.6]) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(p.f + scarto, t0)
      const picco = p.g * (scarto ? 0.32 : 1)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(picco, t0 + 0.016)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.dec)
      osc.connect(g)
      g.connect(master)
      osc.start(t0)
      osc.stop(t1 + 0.08)
    }
  }

  const nCampioni = Math.floor(ctx.sampleRate * 0.035)
  const buffer = ctx.createBuffer(1, nCampioni, ctx.sampleRate)
  const dati = buffer.getChannelData(0)
  for (let i = 0; i < nCampioni; i++) {
    dati[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nCampioni * 0.22))
  }
  const rumore = ctx.createBufferSource()
  rumore.buffer = buffer
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.value = 1600
  filtro.Q.value = 0.7
  const gRumore = ctx.createGain()
  gRumore.gain.setValueAtTime(0.16, t0)
  gRumore.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
  rumore.connect(filtro)
  filtro.connect(gRumore)
  gRumore.connect(master)
  rumore.start(t0)

  master.gain.exponentialRampToValueAtTime(0.75, t0 + 0.02)
  master.gain.setValueAtTime(0.75, t0 + 2.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t1)

  let chiuso = false
  let timer = null
  let risolvi

  function chiudi() {
    if (chiuso) return
    chiuso = true
    if (timer) window.clearTimeout(timer)
    try {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
    } catch { /* already closed */ }
    window.setTimeout(() => {
      ctx.close().catch(() => {})
    }, 140)
  }

  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const attesa = new Promise(done => {
    risolvi = done
    timer = window.setTimeout(() => {
      chiudi()
      done('fine')
    }, DURATA * 1000)
  })

  return {
    attesa,
    ferma() {
      chiudi()
      risolvi?.('stop')
    }
  }
}
