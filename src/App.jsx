import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import SoloFacilitatore from './components/SoloFacilitatore.jsx'
import Iscrizione from './pages/Iscrizione.jsx'
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
          <Route path="/questionari" element={<Questionari />} />
          <Route path="/pratica" element={<LogPratica />} />
          <Route path="/programma" element={<Programma />} />
          <Route path="/comunicazioni" element={<Comunicazioni />} />
          <Route path="/accedi" element={<Accedi />} />
          <Route path="/dashboard" element={<SoloFacilitatore><Dashboard /></SoloFacilitatore>} />
          <Route path="/lezioni" element={<SoloFacilitatore><Lezioni /></SoloFacilitatore>} />
        </Routes>
      </div>
    </>
  )
}
