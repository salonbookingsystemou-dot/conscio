import { useEffect, useRef, useState } from 'react'
import iconaInfo from '../assets/icona-info.png'
import imgLuogo from '../assets/guida/luogo.png'
import imgTelefono from '../assets/guida/telefono.png'
import imgSchiena from '../assets/guida/schiena.png'
import imgPiedi from '../assets/guida/piedi.png'
import imgMani from '../assets/guida/mani.png'
import imgOcchi from '../assets/guida/occhi.png'
import imgCuffie from '../assets/guida/cuffie.png'

const PASSI = [
  {
    id: 'luogo',
    titolo: 'Un luogo dove non ti disturbano',
    testo: 'Scegli una stanza o un angolo in cui non verrai interrotto. Chiudi la porta e, se serve, avvisa chi è con te. Bastano pochi minuti di quiete.',
    immagine: imgLuogo
  },
  {
    id: 'telefono',
    titolo: 'Telefono spento o in silenzioso',
    testo: 'Spegni il telefono o mettilo in modalità silenziosa. Tieni le notifiche lontane, così l’attenzione può restare sulla pratica.',
    immagine: imgTelefono
  },
  {
    id: 'schiena',
    titolo: 'Siediti con la schiena dritta',
    testo: 'Siediti su una sedia, schiena eretta ma non rigida, lontana dallo schienale. Il busto si sostiene da solo, senza appoggiarti.',
    immagine: imgSchiena
  },
  {
    id: 'piedi',
    titolo: 'Piedi a contatto con il pavimento',
    testo: 'Appoggia i piedi a terra, o su un tappeto. Senti il contatto: è un ancoraggio semplice e stabile.',
    immagine: imgPiedi
  },
  {
    id: 'mani',
    titolo: 'Mani poggiate sulle gambe',
    testo: 'Lascia le mani sulle gambe, palmi verso il basso o verso l’alto, come ti è più naturale. Spalle morbide, braccia pesanti.',
    immagine: imgMani
  },
  {
    id: 'occhi',
    titolo: 'Occhi chiusi o socchiusi',
    testo: 'Chiudi gli occhi, o tienili appena socchiusi con lo sguardo morbido, verso il basso. Non c’è nulla da guardare.',
    immagine: imgOcchi
  },
  {
    id: 'cuffie',
    titolo: 'Cuffie e traccia audio',
    testo: 'Indossa le cuffie e fai partire la traccia. Lascia che la guida porti l’attenzione, senza sforzo.',
    immagine: imgCuffie
  }
]


export default function GuidaMeditazione() {
  const dialog = useRef(null)
  const tocco = useRef(null)
  const [aperto, setAperto] = useState(false)
  const [indice, setIndice] = useState(0)

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

  function apri() {
    setIndice(0)
    setAperto(true)
  }

  function chiudi() {
    setAperto(false)
  }

  function vai(delta) {
    setIndice(i => Math.min(PASSI.length - 1, Math.max(0, i + delta)))
  }

  function suToccoInizio(e) {
    tocco.current = e.changedTouches[0].clientX
  }

  function suToccoFine(e) {
    if (tocco.current == null) return
    const dx = e.changedTouches[0].clientX - tocco.current
    tocco.current = null
    if (dx > 48) vai(-1)
    if (dx < -48) vai(1)
  }

  const passo = PASSI[indice]
  const ultimo = indice === PASSI.length - 1

  return (
    <>
      <button
        type="button"
        className="guida-meditazione-apri"
        onClick={apri}
        aria-label="Informazioni: come predisporsi alla meditazione"
        title="Come predisporsi"
      >
        <img className="guida-meditazione-icona" src={iconaInfo} alt="" />
      </button>

      {aperto && (
        <dialog
          ref={dialog}
          className="guida-meditazione"
          aria-labelledby="guida-meditazione-titolo"
          onCancel={e => {
            e.preventDefault()
            chiudi()
          }}
          onClick={e => {
            if (e.target === dialog.current) chiudi()
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') vai(1)
            if (e.key === 'ArrowLeft') vai(-1)
          }}
        >
          <button
            type="button"
            className="guida-meditazione-chiudi"
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

          <p className="badge guida-meditazione-badge">Predisposizione</p>
          <h2 id="guida-meditazione-titolo">Come predisporsi</h2>

          <div
            className="guida-carosello"
            onTouchStart={suToccoInizio}
            onTouchEnd={suToccoFine}
          >
            <div className="guida-slide" key={passo.id}>
              <img className="guida-figura" src={passo.immagine} alt="" />
              <p className="guida-slide-passo">
                {indice + 1} di {PASSI.length}
              </p>
              <h3>{passo.titolo}</h3>
              <p>{passo.testo}</p>
            </div>
          </div>

          <div className="guida-punti" role="tablist" aria-label="Passi della guida">
            {PASSI.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === indice}
                aria-label={`Passo ${i + 1}: ${p.titolo}`}
                className={`guida-punto${i === indice ? ' is-on' : ''}`}
                onClick={() => setIndice(i)}
              />
            ))}
          </div>

          <div className="guida-azioni">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => vai(-1)}
              disabled={indice === 0}
            >
              Indietro
            </button>
            {ultimo ? (
              <button type="button" className="btn" onClick={chiudi}>
                Ho capito
              </button>
            ) : (
              <button type="button" className="btn btn-avanti" onClick={() => vai(1)}>
                Avanti
              </button>
            )}
          </div>
        </dialog>
      )}
    </>
  )
}
