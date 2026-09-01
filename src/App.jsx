import { Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import SoloFacilitatore from './components/SoloFacilitatore.jsx'
import SoloRegistrato from './components/SoloRegistrato.jsx'
import Splash from './pages/Splash.jsx'
import Iscrizione from './pages/Iscrizione.jsx'
import Entra from './pages/Entra.jsx'
import Accedi from './pages/Accedi.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Lezioni from './pages/Lezioni.jsx'
import Questionari from './pages/Questionari.jsx'
import LogPratica from './pages/LogPratica.jsx'
import Comunicazioni from './pages/Comunicazioni.jsx'
import Programma from './pages/Programma.jsx'
import Documento from './pages/Documento.jsx'

export default function App() {
  const { pathname } = useLocation()
  const splash = pathname === '/'

  return (
    <>
      {!splash && <Nav />}
      <div className={splash ? undefined : 'shell'}>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/iscrizione" element={<Iscrizione />} />
          <Route path="/documenti/:slug" element={<Documento />} />
          <Route path="/entra" element={<Entra />} />
          <Route path="/questionari" element={<SoloRegistrato><Questionari /></SoloRegistrato>} />
          <Route path="/pratica" element={<SoloRegistrato><LogPratica /></SoloRegistrato>} />
          <Route path="/programma" element={<SoloRegistrato><Programma /></SoloRegistrato>} />
          <Route path="/comunicazioni" element={<SoloRegistrato><Comunicazioni /></SoloRegistrato>} />
          <Route path="/accedi" element={<Accedi />} />
          <Route path="/dashboard" element={<SoloFacilitatore><Dashboard /></SoloFacilitatore>} />
          <Route path="/lezioni" element={<SoloFacilitatore><Lezioni /></SoloFacilitatore>} />
        </Routes>
      </div>
    </>
  )
}
