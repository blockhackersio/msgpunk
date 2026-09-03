import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { IonApp, IonRouterOutlet } from '@ionic/react'
import Onboarding from './pages/Onboarding.tsx'
import FormsList from './pages/FormsList.tsx'
import RepliesList from './pages/RepliesList.tsx'
import ReplyDetail from './pages/ReplyDetail.tsx'
import Settings from './pages/Settings.tsx'

function App() {
  return (
    <IonApp>
      <BrowserRouter>
        <IonRouterOutlet>
          <Routes>
            <Route path="/" element={<Onboarding />} />
            <Route path="/forms" element={<FormsList />} />
            <Route path="/forms/:formId/replies" element={<RepliesList />} />
            <Route path="/forms/:formId/replies/:msgId" element={<ReplyDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </IonRouterOutlet>
      </BrowserRouter>
    </IonApp>
  )
}

export default App
