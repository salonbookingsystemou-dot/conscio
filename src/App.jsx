import { Navigate, Routes, Route, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import AdminChrome from './components/AdminChrome.jsx'
import SoloFacilitatore from './components/SoloFacilitatore.jsx'
import { useAuth } from './lib/auth.jsx'
import SoloRegistrato from './components/SoloRegistrato.jsx'
import SoloPercorso from './components/SoloPercorso.jsx'
import StatoAttesa from './components/StatoAttesa.jsx'
import Splash from './pages/Splash.jsx'
import Iscrizione from './pages/Iscrizione.jsx'
import Entra from './pages/Entra.jsx'
import Accedi from './pages/Accedi.jsx'
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
import Ascolta from './pages/Ascolta.jsx'
import Cicli from './pages/admin/Cicli.jsx'
import Ciclo from './pages/admin/Ciclo.jsx'
import Panoramica from './pages/admin/ciclo/Panoramica.jsx'
import Iscritti from './pages/admin/ciclo/Iscritti.jsx'
import ProgrammaCiclo from './pages/admin/ciclo/Programma.jsx'
import EditorSettimana from './pages/admin/ciclo/EditorSettimana.jsx'
import PraticaCiclo from './pages/admin/ciclo/Pratica.jsx'
import QuestionariCiclo from './pages/admin/ciclo/Questionari.jsx'
import Tracce from './pages/admin/Tracce.jsx'
import NuovaTraccia from './pages/admin/NuovaTraccia.jsx'
import ComunicazioniFacilitatore from './pages/admin/Comunicazioni.jsx'
import Sito from './pages/admin/Sito.jsx'

function DaPercorso() {
  const [search] = useSearchParams()
  const ciclo = search.get('ciclo')
  return <Navigate to={ciclo ? `/admin/cicli/${ciclo}/programma` : '/admin/cicli'} replace />
}

function DaPercorsoSettimana() {
  const { cicloId, numero } = useParams()
  return <Navigate to={`/admin/cicli/${cicloId}/programma/settimana/${numero}`} replace />
}

function DaControlloTracce() {
  const [search] = useSearchParams()
  const ciclo = search.get('ciclo')
  const query = ciclo ? `?ciclo=${encodeURIComponent(ciclo)}&filtro=da-guardare` : '?filtro=da-guardare'
  return <Navigate to={`/admin/tracce${query}`} replace />
}

// Stesso indirizzo, due pagine: il partecipante vede i suoi avvisi, il facilitatore va alle sue comunicazioni.
function AvvisiOComunicazioni() {
  const { facilitatore, caricamento } = useAuth()
  if (caricamento) return <StatoAttesa />
  if (facilitatore) return <Navigate to="/admin/comunicazioni" replace />
  return <SoloPercorso><Comunicazioni /></SoloPercorso>
}

// Il guscio del facilitatore resta montato fra le pagine: il confine per pagina sta in AdminChrome.
// Le meditazioni pubbliche sono una pagina sola: passando dall'una all'altra il player a schermo intero resta aperto.
function chiaveConfine(pathname) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return '/admin'
  if (pathname === '/ascolta' || pathname.startsWith('/ascolta/')) return '/ascolta'
  return pathname
}

export default function App() {
  const { pathname } = useLocation()
  const splash = pathname === '/'
  const areaFacilitatore = pathname === '/admin' || pathname.startsWith('/admin/')

  const routes = (
      <ConfineErrori key={chiaveConfine(pathname)}>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/iscrizione" element={<Iscrizione />} />
          <Route path="/documenti/:slug" element={<Documento />} />
          <Route path="/dati" element={<IMieiDati />} />
          <Route path="/entra" element={<Entra />} />
          <Route path="/segnala" element={<Segnala />} />
          <Route path="/ascolta/:slug?" element={<Ascolta />} />
          <Route path="/onboarding" element={<SoloRegistrato><Onboarding /></SoloRegistrato>} />
          <Route path="/questionari" element={<SoloRegistrato><Questionari /></SoloRegistrato>} />
          <Route path="/pratica" element={<SoloPercorso><LogPratica /></SoloPercorso>} />
          <Route path="/programma" element={<SoloPercorso><Programma /></SoloPercorso>} />
          <Route path="/checkin" element={<SoloPercorso><Checkin /></SoloPercorso>} />
          <Route path="/comunicazioni" element={<AvvisiOComunicazioni />} />
          <Route path="/accedi" element={<Accedi />} />

          <Route path="/admin" element={<SoloFacilitatore><AdminChrome /></SoloFacilitatore>}>
            <Route index element={<Navigate to="/admin/cicli" replace />} />
            <Route path="cicli" element={<Cicli />} />
            <Route path="cicli/:cicloId" element={<Ciclo />}>
              <Route index element={<Navigate to="panoramica" replace />} />
              <Route path="panoramica" element={<Panoramica />} />
              <Route path="iscritti" element={<Iscritti />} />
              <Route path="programma" element={<ProgrammaCiclo />} />
              <Route path="programma/settimana/:numero" element={<EditorSettimana />} />
              <Route path="pratica" element={<PraticaCiclo />} />
              <Route path="questionari" element={<QuestionariCiclo />} />
            </Route>
            <Route path="tracce" element={<Tracce />} />
            <Route path="tracce/nuova" element={<NuovaTraccia />} />
            <Route path="comunicazioni" element={<ComunicazioniFacilitatore />} />
            <Route path="sito" element={<Sito />} />
            <Route path="*" element={<Navigate to="/admin/cicli" replace />} />
          </Route>

          <Route path="/dashboard" element={<Navigate to="/admin/cicli" replace />} />
          <Route path="/lezioni" element={<Navigate to="/admin/cicli" replace />} />
          <Route path="/percorso" element={<DaPercorso />} />
          <Route path="/percorso/:cicloId/settimana/:numero" element={<DaPercorsoSettimana />} />
          <Route path="/libreria" element={<Navigate to="/admin/tracce" replace />} />
          <Route path="/genera" element={<Navigate to="/admin/tracce/nuova?modo=genera" replace />} />
          <Route path="/controllo-tracce" element={<DaControlloTracce />} />
        </Routes>
      </ConfineErrori>
  )

  if (areaFacilitatore) {
    return (
      <>
        <PullToRefresh />
        <InvitoHome />
        {routes}
      </>
    )
  }

  return (
    <>
      <PullToRefresh />
      <InvitoHome />
      {!splash && (
        <>
          <Nav />
          <BarraBassa />
        </>
      )}
      <div className={splash ? undefined : 'shell'}>{routes}</div>
      {!splash && <Footer />}
    </>
  )
}
