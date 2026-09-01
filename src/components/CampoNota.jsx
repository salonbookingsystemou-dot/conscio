import { useEffect, useId, useRef, useState } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

let detentore = null

function IconaMicrofono() {
  return (
    <svg className="icona-microfono" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3.2" width="6" height="10.6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 12.2a5 5 0 0 0 10 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 17.2v2.6M9.2 20.6h5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export default function CampoNota({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  required = false
}) {
  const autoId = useId()
  const campoId = id || autoId
  const voceId = useId()
  const [mio, setMio] = useState(false)
  const baseRef = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable
  } = useSpeechRecognition({ clearTranscriptOnListen: true })

  const inAscolto = listening && mio

  useEffect(() => {
    if (!inAscolto) return
    const parlato = transcript.trim()
    const base = baseRef.current.trim()
    onChangeRef.current(base && parlato ? `${base} ${parlato}` : (parlato || base))
  }, [transcript, inAscolto])

  useEffect(() => {
    if (!listening && detentore === voceId) {
      detentore = null
      setMio(false)
    }
  }, [listening, voceId])

  async function toggleVoce() {
    if (inAscolto) {
      await SpeechRecognition.stopListening()
      detentore = null
      setMio(false)
      return
    }
    baseRef.current = value
    resetTranscript()
    detentore = voceId
    setMio(true)
    try {
      await SpeechRecognition.startListening({
        continuous: browserSupportsContinuousListening,
        language: 'it-IT'
      })
    } catch {
      detentore = null
      setMio(false)
    }
  }

  return (
    <div className="field">
      <label htmlFor={campoId}>{label}</label>
      <textarea
        id={campoId}
        rows={rows}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={inAscolto}
        onChange={e => onChange(e.target.value)}
      />
      {browserSupportsSpeechRecognition ? (
        <div className="nota-vocale">
          <button
            type="button"
            className={`btn btn-ghost btn-voce${inAscolto ? ' is-on' : ''}`}
            onClick={toggleVoce}
            aria-pressed={inAscolto}
          >
            <IconaMicrofono />
            {inAscolto ? 'Interrompi' : 'Registra nota'}
          </button>
          <p className="hint">
            {!isMicrophoneAvailable
              ? 'Serve il permesso al microfono per dettare.'
              : inAscolto
                ? 'Sto ascoltando. Puoi correggere il testo dopo.'
                : 'Puoi dettare invece di scrivere. Resta solo il testo, non l’audio.'}
          </p>
        </div>
      ) : (
        <p className="hint">Per dettare la nota apri la pagina in Chrome, Edge o Safari.</p>
      )}
    </div>
  )
}
