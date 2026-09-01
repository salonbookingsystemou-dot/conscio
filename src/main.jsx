import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import './styles.css'

// Usiamo HashRouter (non BrowserRouter) perché GitHub Pages serve file statici:
// con le route "pulite" un refresh su /lezioni darebbe 404. HashRouter usa /#/lezioni
// e funziona sempre, senza bisogno di configurazioni server aggiuntive.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
