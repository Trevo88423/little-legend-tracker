import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import JoinFamily from './pages/JoinFamily'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import CheckEmail from './pages/CheckEmail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import TrackerApp from './pages/TrackerApp'
import ProtectedRoute from './components/auth/ProtectedRoute'
import DashboardView from './components/dashboard/DashboardView'
import MedsView from './components/medications/MedsView'
import FeedingView from './components/feeding/FeedingView'
import WeightView from './components/weight/WeightView'
import NotesView from './components/notes/NotesView'
import TrackersView from './components/trackers/TrackersView'
import HistoryView from './components/history/HistoryView'
import SettingsView from './components/settings/SettingsView'
import ReportsView from './components/reports/ReportsView'
import AISetupWizard from './components/ai-setup/AISetupWizard'
import './styles/variables.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/join" element={<JoinFamily />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Protected app routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<TrackerApp />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardView />} />
              <Route path="meds" element={<MedsView />} />
              <Route path="feeding" element={<FeedingView />} />
              <Route path="weight" element={<WeightView />} />
              <Route path="notes" element={<NotesView />} />
              <Route path="tracking" element={<TrackersView />} />
              <Route path="history" element={<HistoryView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="reports" element={<ReportsView />} />
              <Route path="ai-setup" element={<AISetupWizard />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
