import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { contaDaFare, osservaDaFare } from '../lib/cicli.js'
import { SEZIONI, percorsoSezione, sezioneDa } from '../lib/sezioniAdmin.js'
import useClasseFinestra from '../lib/useClasseFinestra.js'
import BarraVoci from './BarraVoci.jsx'
import ConfineErrori from './ConfineErrori.jsx'
import { GuscioContext } from './admin/gusci.js'
import { ICONE_SEZIONE, IconaPiu } from './admin/IconeAdmin.jsx'
import RailNavigazione from './admin/RailNavigazione.jsx'
import { SnackbarProvider } from './admin/Snackbar.jsx'

// Nello spazio del ciclo le schede non smontano la pagina: il confine si azzera solo cambiando pagina.
function chiaveConfine(pathname) {
  if (/^\/admin\/cicli\/[^/]+/.test(pathname)) return '/admin/cicli/:ciclo'
  return pathname
}

function useDaFare() {
  const { pathname } = useLocation()
  const [numero, setNumero] = useState(0)

  useEffect(() => {
    let vivo = true
    const aggiorna = () => {
      contaDaFare().then(n => { if (vivo) setNumero(n) }).catch(() => {})
    }
    aggiorna()
    const smetti = osservaDaFare(aggiorna)
    return () => {
      vivo = false
      smetti()
    }
  }, [pathname])

  return numero
}

/**
 * Guscio dell'area facilitatore: rail a sinistra da 600px (esteso da 1200px),
 * barra in basso e FAB sotto i 600px. La testata è della pagina (PaginaAdmin).
 */
export default function AdminChrome() {
  const { esci } = useAuth()
  const { pathname } = useLocation()
  const classe = useClasseFinestra()
  const daFare = useDaFare()
  const attiva = sezioneDa(pathname)
  const badge = { cicli: daFare }
  const compatta = classe === 'compatta'
  const azione = attiva?.azione || null

  const voci = SEZIONI.map(s => ({
    to: percorsoSezione(s),
    label: s.etichetta,
    Icona: ICONE_SEZIONE[s.icona],
    badge: badge[s.id]
  }))

  const guscio = useMemo(() => ({ classe, esci }), [classe, esci])

  return (
    <GuscioContext.Provider value={guscio}>
      <SnackbarProvider>
        <div className={`admin-app is-${classe}${compatta && azione ? ' has-fab' : ''}`}>
          {!compatta && (
            <RailNavigazione
              sezioni={SEZIONI}
              attiva={attiva}
              badge={badge}
              esteso={classe === 'ampia'}
              onEsci={esci}
            />
          )}
          <main className="admin-main">
            <ConfineErrori key={chiaveConfine(pathname)}>
              <Outlet />
            </ConfineErrori>
          </main>
          {compatta && azione && (
            <Link to={azione.a} className="fab is-galleggiante">
              <IconaPiu />
              <span>{azione.etichetta}</span>
            </Link>
          )}
          {compatta && <BarraVoci voci={voci} etichetta="Area facilitatore" className="is-facilitatore" />}
        </div>
      </SnackbarProvider>
    </GuscioContext.Provider>
  )
}
