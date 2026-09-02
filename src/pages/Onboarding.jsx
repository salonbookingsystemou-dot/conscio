import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigurato } from '../lib/supabaseClient'
import { ATTEGGIAMENTI, DOMANDE_ONBOARDING } from '../lib/atteggiamenti.js'
import { usePartecipante } from '../lib/partecipante.jsx'
import CampoNota from '../components/CampoNota.jsx'
import AvvisoDatiPseudonimi from '../components/AvvisoDatiPseudonimi.jsx'

const PASSI = ['intro', 'q1', 'q2', 'atteggiamenti']

export default function Onboarding() {
  const {
    codice,
    registrato,
    caricamento,
    onboardingCompleto,
    t0Completo,
    aggiornaPercorso
  } = usePartecipante()
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [indiceAtt, setIndiceAtt] = useState(0)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    if (!caricamento && registrato && onboardingCompleto) {
      navigate(t0Completo ? '/programma' : '/questionari', { replace: true })
    }
  }, [caricamento, registrato, onboardingCompleto, t0Completo, navigate])

  if (caricamento) return <p>Caricamento…</p>
  if (!registrato) return <Navigate to="/entra" replace state={{ da: '/onboarding' }} />
  if (onboardingCompleto) return null

  const idPasso = PASSI[passo]
  const totale = PASSI.length
  const avanzamento = Math.round(((passo + 1) / totale) * 100)
  const att = ATTEGGIAMENTI[indiceAtt]
  const ultimaAtt = indiceAtt >= ATTEGGIAMENTI.length - 1

  async function completaWizard() {
    setErrore(null)
    if (!supabaseConfigurato) {
      setErrore('Connessione non configurata. Riprova più tardi.')
      return
    }
    if (!q1.trim() || !q2.trim()) {
      setErrore('Entrambe le risposte sono necessarie per continuare.')
      return
    }
    setInvio(true)
    const { error } = await supabase.rpc('salva_onboarding', {
      p_codice: codice.trim(),
      p_q1: q1.trim(),
      p_q2: q2.trim()
    })
    if (error) {
      setErrore(error.message?.includes('RISPOSTE_MANCANTI')
        ? 'Entrambe le risposte sono necessarie per continuare.'
        : 'Non è stato possibile salvare. Riprova.')
      setInvio(false)
      return
    }
    await aggiornaPercorso(codice.trim())
    setInvio(false)
    navigate('/questionari', { replace: true, state: { daOnboarding: true } })
  }

  function avantiDomanda() {
    setErrore(null)
    if (idPasso === 'q1' && !q1.trim()) {
      setErrore('Questa risposta è necessaria per continuare.')
      return
    }
    if (idPasso === 'q2' && !q2.trim()) {
      setErrore('Questa risposta è necessaria per continuare.')
      return
    }
    setPasso(p => Math.min(p + 1, PASSI.length - 1))
  }

  return (
    <div className="onboarding">
      <p className="meta-riga">
        <span className="badge">Primo accesso</span>
        <span>Passo {passo + 1} di {totale}</span>
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${avanzamento}%` }} />
      </div>

      {idPasso === 'intro' && (
        <div className="card">
          <h2>Benvenuto nel percorso</h2>
          <p className="lead">
            Prima di aprire le settimane di pratica, ti chiediamo due risposte brevi
            e di scorrere i dieci atteggiamenti della mindfulness. Poi compilerai i
            questionari iniziali (T0).
          </p>
          <AvvisoDatiPseudonimi />
          <p className="hint">Questo passaggio non si può saltare: serve una sola volta.</p>
          <div className="azioni">
            <button className="btn" type="button" onClick={() => setPasso(1)}>
              Inizia
            </button>
          </div>
        </div>
      )}

      {(idPasso === 'q1' || idPasso === 'q2') && (
        <div className="card">
          <h2>Due domande</h2>
          <CampoNota
            required
            label={idPasso === 'q1' ? DOMANDE_ONBOARDING[0].label : DOMANDE_ONBOARDING[1].label}
            value={idPasso === 'q1' ? q1 : q2}
            onChange={idPasso === 'q1' ? setQ1 : setQ2}
            placeholder={idPasso === 'q1' ? DOMANDE_ONBOARDING[0].placeholder : DOMANDE_ONBOARDING[1].placeholder}
            rows={4}
          />
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          <div className="azioni">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => { setErrore(null); setPasso(p => Math.max(0, p - 1)) }}
            >
              Indietro
            </button>
            <button className="btn" type="button" onClick={avantiDomanda}>
              Continua
            </button>
          </div>
        </div>
      )}

      {idPasso === 'atteggiamenti' && att && (
        <div className="card onboarding-atteggiamenti">
          <h2>Dieci atteggiamenti</h2>
          <p className="hint">
            Scorri uno alla volta. Sono orientamenti alla pratica, non regole da memorizzare.
          </p>
          <p className="meta-riga">
            <span>{indiceAtt + 1} di {ATTEGGIAMENTI.length}</span>
          </p>
          <article className="atteggiamento-card">
            <p className="atteggiamento-num" aria-hidden="true">{String(indiceAtt + 1).padStart(2, '0')}</p>
            <h3>{att.titolo}</h3>
            <p>{att.testo}</p>
          </article>
          {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          <div className="azioni">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={invio}
              onClick={() => {
                setErrore(null)
                if (indiceAtt === 0) setPasso(2)
                else setIndiceAtt(i => i - 1)
              }}
            >
              Indietro
            </button>
            {ultimaAtt ? (
              <button className="btn" type="button" disabled={invio} onClick={completaWizard}>
                {invio ? 'Salvataggio…' : 'Vai ai questionari T0'}
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                disabled={invio}
                onClick={() => setIndiceAtt(i => i + 1)}
              >
                Successivo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
