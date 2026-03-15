import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useFamily } from '../contexts/FamilyContext'
import { useTracker } from '../contexts/TrackerContext'
import { useAuth } from '../contexts/AuthContext'
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
  const { signOut } = useAuth()
  const { activeChild, loading: familyLoading, currentMember } = useFamily()
  const { loading: trackerLoading, loggerName, getLatestWeight } = useTracker()

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
    return (
      <div className="ll-auth-screen">
        <div className="ll-auth-card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">&#128118;</span>
          <h1>No Child Found</h1>
          <p className="auth-subtitle">
            Please add a child to start tracking. Go to Settings to set up your little legend.
          </p>
        </div>
      </div>
    )
  }

  const latestWeight = getLatestWeight()

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
