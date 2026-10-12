import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { PartecipanteProvider } from './lib/partecipante.jsx'
import { TonalitaProvider } from './lib/tonalita.jsx'
import { avviaTonalita } from './lib/tonalita.js'
import { pulisciCacheTracceLegacy } from './lib/cacheTracce.js'
import ConfineErrori from './components/ConfineErrori.jsx'
import './styles/tokens.css'
import './styles.css'
import './styles/admin.css'

// GitHub Pages non ha la route /ascolta: se la pagina arriva qui lo stesso
// (service worker o server di sviluppo), si entra dal percorso pubblico, senza codice.
function portaAscoltaSulHash() {
  const percorso = location.pathname.replace(/\/+$/, '') || '/'
  if (percorso !== '/ascolta' && !percorso.startsWith('/ascolta/')) return false
  const coda = percorso.slice('/ascolta'.length)
  location.replace(`${location.origin}/#/ascolta${coda}${location.search}`)
  return true
}

const ascoltaDaIndirizzo = portaAscoltaSulHash()

avviaTonalita()
// Rimuove la vecchia cache tracce che poteva contenere risposte opaque rotte.
pulisciCacheTracceLegacy()

// Usiamo HashRouter (non BrowserRouter) perché GitHub Pages serve file statici:
// con le route "pulite" un refresh su /lezioni darebbe 404. HashRouter usa /#/lezioni
// e funziona sempre, senza bisogno di configurazioni server aggiuntive.
if (!ascoltaDaIndirizzo) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ConfineErrori intero>
        <HashRouter>
          <AuthProvider>
            <PartecipanteProvider>
              <TonalitaProvider>
                <App />
              </TonalitaProvider>
            </PartecipanteProvider>
          </AuthProvider>
        </HashRouter>
      </ConfineErrori>
    </React.StrictMode>
  )
}
