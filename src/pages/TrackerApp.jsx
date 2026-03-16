import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useFamily } from '../contexts/FamilyContext'
import { useTracker } from '../contexts/TrackerContext'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import '../styles/tracker.css'

const tabs = [
  { label: 'Dashboard', path: '' },
  { label: 'Meds', path: 'meds' },
  { label: 'Feeding', path: 'feeding' },
  { label: 'Weight', path: 'weight' },
  { label: 'Notes', path: 'notes' },
  { label: 'Tracking', path: 'tracking' },
  { label: 'History', path: 'history' },
  { label: 'Settings', path: 'settings' },
  { label: 'Reports', path: 'reports' },
]

export default function TrackerApp() {
  const navigate = useNavigate()
  const { signOut, setupError } = useAuth()
  const { activeChild, loading: familyLoading, currentMember } = useFamily()
  const { loading: trackerLoading, loggerName, getLatestWeight } = useTracker()
  useNotifications()

  if (familyLoading || trackerLoading) {
    return (
      <div className="ll-auth-screen">
        <div className="ll-auth-card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">&#128153;</span>
          <h1>Loading...</h1>
          <p className="auth-subtitle">Getting everything ready for your little legend</p>
          <div className="ll-spinner" />
        </div>
      </div>
    )
  }

  if (!activeChild) {
    const hasPendingJoin = !!localStorage.getItem('pendingJoin')
    const hasPendingSignup = !!localStorage.getItem('pendingSignup')
    const hasPending = hasPendingJoin || hasPendingSignup

    let title = 'No Child Found'
    let message = 'You need to join a family or create an account to start tracking.'
    if (setupError === 'signup') {
      title = 'Setup Issue'
      message = 'We had trouble finishing your account setup. Please try again or refresh the page.'
    } else if (setupError === 'join') {
      title = 'Join Issue'
      message = 'We couldn\'t complete joining the family. The child\'s name or PIN may be wrong. Please try again.'
    } else if (hasPending) {
      title = 'Almost There!'
      message = 'Your request is being processed. If it doesn\'t complete automatically, try refreshing or join again.'
    }

    return (
      <div className="ll-auth-screen">
        <div className="ll-auth-card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">&#128118;</span>
          <h1>{title}</h1>
          <p className="auth-subtitle">{message}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {(setupError || hasPending) && (
              <button
                className="auth-submit-btn"
                onClick={() => window.location.reload()}
              >
                Refresh &amp; Retry
              </button>
            )}
            <button
              className="auth-submit-btn"
              style={setupError || hasPending ? { background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '2px solid var(--color-border)' } : {}}
              onClick={() => navigate('/join')}
            >
              Join a Family
            </button>
            <button
              className="auth-submit-btn"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '2px solid var(--color-border)' }}
              onClick={() => { localStorage.removeItem('pendingJoin'); localStorage.removeItem('pendingSignup'); navigate('/signup') }}
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  const latestWeight = getLatestWeight()

  function getAge(dob) {
    if (!dob) return null
    const birth = new Date(dob + 'T00:00:00')
    const now = new Date()
    let years = now.getFullYear() - birth.getFullYear()
    let months = now.getMonth() - birth.getMonth()
    let days = now.getDate() - birth.getDate()
    if (days < 0) {
      months--
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      days += prevMonth.getDate()
    }
    if (months < 0) {
      years--
      months += 12
    }
    const parts = []
    if (years > 0) parts.push(`${years}y`)
    if (months > 0) parts.push(`${months}m`)
    parts.push(`${days}d`)
    return parts.join(' ')
  }

  const age = getAge(activeChild.date_of_birth)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function handleSwitchUser() {
    navigate('/login')
  }

  return (
    <div className="ll-app">
      {/* Header */}
      <div className="ll-header">
        <div className="ll-header-top">
          <div>
            <h1>{activeChild.name} &#11088;</h1>
            <div className="ll-subtitle">
              {age && <>{age} old &middot; </>}
              Logged in as {loggerName}
              {latestWeight ? ` \u00B7 ${latestWeight.value}kg` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="ll-header-btn" onClick={handleSwitchUser}>
              Switch User
            </button>
            <button className="ll-header-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="ll-tab-bar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === ''}
            className={({ isActive }) => `ll-tab${isActive ? ' active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <div className="ll-content">
        <Outlet />
      </div>
    </div>
  )
}
