import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FamilyProvider } from '../../contexts/FamilyContext'
import { TrackerProvider } from '../../contexts/TrackerContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg, #f5f5f5)',
      }}>
        <div style={{
          textAlign: 'center',
          color: 'var(--color-text-muted, #999)',
          fontWeight: 700,
          fontSize: '0.9rem',
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid var(--color-border, #e0e0e0)',
            borderTopColor: 'var(--color-primary, #e86c50)',
            borderRadius: '50%',
            margin: '0 auto 12px',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <FamilyProvider>
      <TrackerProvider>
        <Outlet />
      </TrackerProvider>
    </FamilyProvider>
  )
}
