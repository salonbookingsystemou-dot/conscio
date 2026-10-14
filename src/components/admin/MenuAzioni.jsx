import { useEffect, useId, useRef, useState } from 'react'

/**
 * Menu a comparsa sotto un pulsante: Esc e il clic fuori lo chiudono, le frecce
 * su/giù scorrono le voci. `voci`: [{ etichetta, onClick, pericolo? }].
 * `renderPulsante(props)` disegna il pulsante che lo apre.
 */
export default function MenuAzioni({ voci, renderPulsante, allinea = 'destra' }) {
  const [aperto, setAperto] = useState(false)
  const contenitore = useRef(null)
  const elenco = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!aperto) return undefined
    elenco.current?.querySelector('[role="menuitem"]')?.focus()
    const fuori = e => { if (!contenitore.current?.contains(e.target)) setAperto(false) }
    document.addEventListener('pointerdown', fuori)
    return () => document.removeEventListener('pointerdown', fuori)
  }, [aperto])

  function chiudi(rimettiFuoco = true) {
    setAperto(false)
    if (rimettiFuoco) contenitore.current?.querySelector('[aria-haspopup]')?.focus()
  }

  function tasti(e) {
    const voci = [...(elenco.current?.querySelectorAll('[role="menuitem"]') || [])]
    const i = voci.indexOf(document.activeElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      chiudi()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      voci[(i + 1) % voci.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      voci[(i - 1 + voci.length) % voci.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      voci[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      voci[voci.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      chiudi(false)
    }
  }

  return (
    <div className="menu-azioni" ref={contenitore}>
      {renderPulsante({
        'aria-haspopup': 'menu',
        'aria-expanded': aperto,
        'aria-controls': aperto ? id : undefined,
        onClick: () => setAperto(v => !v),
        onKeyDown: e => {
          if (e.key === 'ArrowDown' && !aperto) {
            e.preventDefault()
            setAperto(true)
          }
        }
      })}
      {aperto && (
        <ul id={id} ref={elenco} className={`menu-azioni-elenco is-${allinea}`} role="menu" onKeyDown={tasti}>
          {voci.map(v => (
            <li key={v.etichetta} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu-azioni-voce${v.pericolo ? ' is-pericolo' : ''}`}
                onClick={() => {
                  chiudi()
                  v.onClick()
                }}
              >
                {v.etichetta}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
