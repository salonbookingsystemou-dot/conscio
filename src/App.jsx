import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import SoloFacilitatore from './components/SoloFacilitatore.jsx'
import SoloRegistrato from './components/SoloRegistrato.jsx'
import Iscrizione from './pages/Iscrizione.jsx'
import Entra from './pages/Entra.jsx'
import Accedi from './pages/Accedi.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Lezioni from './pages/Lezioni.jsx'
import Questionari from './pages/Questionari.jsx'
import LogPratica from './pages/LogPratica.jsx'
import Comunicazioni from './pages/Comunicazioni.jsx'
import Programma from './pages/Programma.jsx'

export default function App() {
  return (
    <>
      <Nav />
      <div className="shell">
        <Routes>
          <Route path="/" element={<Iscrizione />} />
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
