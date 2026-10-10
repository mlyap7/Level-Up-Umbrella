import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { getCoachMode } from './lib/mode'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Loading } from './components/ui'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { UpdatePassword } from './pages/auth/UpdatePassword'
import { Dashboard } from './pages/client/Dashboard'
import { Training } from './pages/client/Training'
import { LogWorkout } from './pages/client/LogWorkout'
import { CheckIns } from './pages/client/CheckIns'
import { Journal } from './pages/client/Journal'
import { ProfilePage } from './pages/client/Profile'
import { Welcome } from './pages/client/Welcome'
import { PhotosPage } from './pages/client/Photos'
import { QuestionnairePage } from './pages/client/Questionnaire'
import { CoachHome } from './pages/coach/CoachHome'
import { ClientDetail } from './pages/coach/ClientDetail'
import { CoachSettings } from './pages/coach/CoachSettings'

function Home() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <Loading />
  // Coaches land where they were last: coaching, or their own journey.
  return profile.role === 'coach' && getCoachMode() === 'coaching' ? <Navigate to="/coach" replace /> : <Dashboard />
}

export function App() {
  if (!isConfigured) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Almost there</h1>
          <p>This site isn’t connected to its database yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README.md), then redeploy.</p>
        </div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          <Route path="/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="training" element={<RequireAuth><Training /></RequireAuth>} />
            <Route path="training/log/:workoutId" element={<RequireAuth><LogWorkout /></RequireAuth>} />
            <Route path="check-in" element={<RequireAuth><CheckIns /></RequireAuth>} />
            <Route path="journal" element={<RequireAuth><Journal /></RequireAuth>} />
            <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="photos" element={<RequireAuth><PhotosPage /></RequireAuth>} />
            <Route path="questionnaire" element={<RequireAuth><QuestionnairePage /></RequireAuth>} />

            <Route path="coach" element={<RequireAuth role="coach"><CoachHome /></RequireAuth>} />
            <Route path="coach/settings" element={<RequireAuth role="coach"><CoachSettings /></RequireAuth>} />
            <Route path="coach/clients/:clientId/*" element={<RequireAuth role="coach"><ClientDetail /></RequireAuth>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
