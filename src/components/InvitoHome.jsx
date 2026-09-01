import { useEffect, useRef, useState } from 'react'
import iconaConscio from '../assets/icona-conscio.png'
import { usePartecipante } from '../lib/partecipante.jsx'
import {
  eIos,
  memorizzaInvitoChiuso,
  vaMostratoInvito
} from '../lib/invitoHome.js'

export default function InvitoHome() {
  const dialog = useRef(null)
  const sessionePronta = useRef(false)
  const eraRegistrato = useRef(false)
  const { registrato, caricamento } = usePartecipante()
  const [aperto, setAperto] = useState(false)
  const [eventoInstall, setEventoInstall] = useState(null)
  const ios = eIos()

  useEffect(() => {
    function suPrompt(e) {
      e.preventDefault()
      setEventoInstall(e)
    }
    function suApri() {
      setAperto(true)
    }
    window.addEventListener('beforeinstallprompt', suPrompt)
    window.addEventListener('conscio-apri-invito-home', suApri)
    return () => {
      window.removeEventListener('beforeinstallprompt', suPrompt)
      window.removeEventListener('conscio-apri-invito-home', suApri)
    }
  }, [])

  useEffect(() => {
    if (caricamento) return undefined
    if (!sessionePronta.current) {
      sessionePronta.current = true
      eraRegistrato.current = registrato
      return undefined
    }
    if (registrato && !eraRegistrato.current && vaMostratoInvito()) {
      const t = window.setTimeout(() => setAperto(true), 450)
      eraRegistrato.current = true
      return () => window.clearTimeout(t)
    }
    eraRegistrato.current = registrato
    return undefined
  }, [registrato, caricamento])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (aperto && !el.open) el.showModal()
    if (!aperto && el.open) el.close()
  }, [aperto])

  useEffect(() => {
    if (!aperto) return undefined
    const precedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedente
    }
  }, [aperto])

  function chiudi() {
    memorizzaInvitoChiuso()
    setAperto(false)
  }

  async function installa() {
    if (eventoInstall) {
      eventoInstall.prompt()
      await eventoInstall.userChoice.catch(() => {})
      setEventoInstall(null)
      chiudi()
      return
    }
    dialog.current?.querySelector('.invito-home-passi, .invito-home-guida')?.scrollIntoView({
      block: 'nearest'
    })
  }

  if (!aperto) return null

  return (
    <dialog
      ref={dialog}
      className="invito-home"
      aria-labelledby="invito-home-titolo"
      onCancel={e => {
        e.preventDefault()
        chiudi()
      }}
      onClick={e => {
        if (e.target === dialog.current) chiudi()
      }}
    >
      <button
        type="button"
        className="invito-home-chiudi"
        onClick={chiudi}
        aria-label="Chiudi"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <img className="invito-home-icona" src={iconaConscio} alt="" />
      <h2 id="invito-home-titolo">Tieni il percorso a portata di mano</h2>
      <p>
        Puoi aggiungere questa app alla schermata Home del telefono.
        Così la apri come le altre, senza passare dal browser.
      </p>
      <button type="button" className="btn" onClick={installa}>
        Installa app
      </button>
      {ios ? (
        <ol className="invito-home-passi">
          <li>Tocca il pulsante Condividi</li>
          <li>Scegli «Aggiungi a Home»</li>
        </ol>
      ) : !eventoInstall ? (
        <p className="hint invito-home-guida">
          Nel menu del browser scegli «Aggiungi a Home» oppure «Installa app».
        </p>
      ) : null}
    </dialog>
  )
}
