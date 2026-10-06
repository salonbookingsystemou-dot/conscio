import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import AdminChrome from './components/AdminChrome.jsx'
import SoloFacilitatore from './components/SoloFacilitatore.jsx'
import { useAuth } from './lib/auth.jsx'
import SoloRegistrato from './components/SoloRegistrato.jsx'
import SoloPercorso from './components/SoloPercorso.jsx'
import Splash from './pages/Splash.jsx'
import Iscrizione from './pages/Iscrizione.jsx'
import Entra from './pages/Entra.jsx'
import Accedi from './pages/Accedi.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Libreria from './pages/Libreria.jsx'
import GeneraTraccia from './pages/GeneraTraccia.jsx'
import ControlloTracce from './pages/ControlloTracce.jsx'
import Percorso from './pages/Percorso.jsx'
import EditorSettimana from './pages/EditorSettimana.jsx'
import Questionari from './pages/Questionari.jsx'
import LogPratica from './pages/LogPratica.jsx'
import Comunicazioni from './pages/Comunicazioni.jsx'
import Programma from './pages/Programma.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Documento from './pages/Documento.jsx'
import IMieiDati from './pages/IMieiDati.jsx'
import Checkin from './pages/Checkin.jsx'
import InvitoHome from './components/InvitoHome.jsx'
import BarraBassa from './components/BarraBassa.jsx'
import Footer from './components/Footer.jsx'
import PullToRefresh from './components/PullToRefresh.jsx'
import ConfineErrori from './components/ConfineErrori.jsx'
import Segnala from './pages/Segnala.jsx'

function pagineAdminAmpie(pathname) {
  return pathname === '/dashboard'
    || pathname.includes('/settimana/')
    || pathname === '/questionari'
    || pathname === '/programma'
    || pathname === '/pratica'
    || pathname === '/comunicazioni'
    || pathname === '/genera'
    || pathname === '/controllo-tracce'
}

export default function App() {
  const { facilitatore } = useAuth()
  const { pathname } = useLocation()
  const splash = pathname === '/'
  const areaFacilitatore = Boolean(facilitatore) && !splash && pathname !== '/accedi'

  const routes = (
      <ConfineErrori key={pathname}>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/iscrizione" element={<Iscrizione />} />
          <Route path="/documenti/:slug" element={<Documento />} />
          <Route path="/dati" element={<IMieiDati />} />
          <Route path="/entra" element={<Entra />} />
          <Route path="/segnala" element={<Segnala />} />
          <Route path="/onboarding" element={<SoloRegistrato><Onboarding /></SoloRegistrato>} />
          <Route path="/questionari" element={<SoloRegistrato><Questionari /></SoloRegistrato>} />
          <Route path="/pratica" element={<SoloPercorso><LogPratica /></SoloPercorso>} />
          <Route path="/programma" element={<SoloPercorso><Programma /></SoloPercorso>} />
          <Route path="/checkin" element={<SoloPercorso><Checkin /></SoloPercorso>} />
          <Route path="/comunicazioni" element={<SoloPercorso><Comunicazioni /></SoloPercorso>} />
          <Route path="/accedi" element={<Accedi />} />
          <Route path="/dashboard" element={<SoloFacilitatore><Dashboard /></SoloFacilitatore>} />
          <Route path="/lezioni" element={<Navigate to="/percorso" replace />} />
          <Route path="/libreria" element={<SoloFacilitatore><Libreria /></SoloFacilitatore>} />
          <Route path="/genera" element={<SoloFacilitatore><GeneraTraccia /></SoloFacilitatore>} />
          <Route path="/controllo-tracce" element={<SoloFacilitatore><ControlloTracce /></SoloFacilitatore>} />
          <Route path="/percorso" element={<SoloFacilitatore><Percorso /></SoloFacilitatore>} />
          <Route path="/percorso/:cicloId/settimana/:numero" element={<SoloFacilitatore><EditorSettimana /></SoloFacilitatore>} />
        </Routes>
      </ConfineErrori>
  )

  return (
    <>
      <PullToRefresh />
      <InvitoHome />
      {!splash && !areaFacilitatore && (
        <>
          <Nav />
          <BarraBassa />
        </>
      )}
      {areaFacilitatore ? (
        <AdminChrome ampio={pagineAdminAmpie(pathname)}>{routes}</AdminChrome>
      ) : (
        <div className={splash ? undefined : 'shell'}>{routes}</div>
      )}
      {!areaFacilitatore && !splash && <Footer />}
    </>
  )
}
