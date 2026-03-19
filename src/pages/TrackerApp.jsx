import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useFamily } from '../contexts/FamilyContext'
import { useTracker } from '../contexts/TrackerContext'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { supabase } from '../lib/supabase'
import '../styles/tracker.css'

function SetupFallback({ user, navigate }) {
  const flow = user?.user_metadata?.flow
  const meta = user?.user_metadata || {}

  const [showForm, setShowForm] = useState(false)
  const [displayName, setDisplayName] = useState(meta.display_name || '')
  const [childName, setChildName] = useState(meta.child_name || '')
  const [childDob, setChildDob] = useState(meta.child_dob || '')
  const [pin, setPin] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  async function handleCompleteSetup(e) {
    e.preventDefault()
    if (!/^\d{6,8}$/.test(pin)) { setFormError('PIN must be 6-8 digits'); return }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase.rpc('complete_signup', {
        p_family_name: childName.trim(),
        p_pin_input: pin,
        p_display_name: displayName.trim(),
        p_child_name: childName.trim(),
        p_child_dob: childDob || null,
      })
      if (error) throw error
      window.location.reload()
    } catch (err) {
      setFormError(err.message || 'Setup failed. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  let title = 'No Child Found'
  let message = 'You need to join a family or create an account to start tracking.'
  if (flow === 'signup') {
    title = 'Setup Issue'
    message = 'Your account setup didn\'t complete automatically. You can complete it below.'
  } else if (flow === 'join') {
    title = 'Join Issue'
    message = 'Couldn\'t auto-join the family — the child\'s name or PIN may have been wrong. Please try again.'
  }

  if (showForm) {
    return (
      <div className="ll-auth-screen">
        <div className="ll-auth-card">
          <span className="auth-icon">&#128118;</span>
          <h1>Complete Setup</h1>
          <p className="auth-subtitle">Finish setting up your account</p>
          <form className="ll-auth-form" onSubmit={handleCompleteSetup}>
            <div className="form-group">
              <label htmlFor="setup-name">Your Display Name</label>
              <input id="setup-name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Mum, Dad, Sarah" required />
            </div>
            <div className="form-group">
              <label htmlFor="setup-child">Child's Name</label>
              <input id="setup-child" type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Your little legend's name" required />
            </div>
            <div className="form-group">
              <label htmlFor="setup-dob">Date of Birth (optional)</label>
              <input id="setup-dob" type="date" value={childDob} onChange={e => setChildDob(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="setup-pin">Family PIN (6-8 digits)</label>
              <input id="setup-pin" type="text" inputMode="numeric" pattern="\d{6,8}" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Your partner uses this to join" required maxLength={8} />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={formLoading}>
              {formLoading ? 'Setting up...' : 'Complete Setup'}
            </button>
            {formError && <p className="auth-error-msg">{formError}</p>}
          </form>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', marginTop: 12, fontSize: '0.82rem' }}
            onClick={() => setShowForm(false)}>
            &larr; Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card" style={{ textAlign: 'center' }}>
        <span className="auth-icon">&#128118;</span>
        <h1>{title}</h1>
        <p className="auth-subtitle">{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {flow && (
            <button className="auth-submit-btn" onClick={() => window.location.reload()}>
              Refresh &amp; Retry
            </button>
          )}
          {flow === 'join' ? (
            <>
              <button className="auth-submit-btn" onClick={() => navigate('/join')}>
                Try Joining Again
              </button>
              <button className="auth-submit-btn"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '2px solid var(--color-border)' }}
                onClick={() => setShowForm(true)}>
                Create New Family Instead
              </button>
            </>
          ) : (
            <>
              <button className="auth-submit-btn" onClick={() => setShowForm(true)}>
                Complete Setup Manually
              </button>
              <button className="auth-submit-btn"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '2px solid var(--color-border)' }}
                onClick={() => navigate('/join')}>
                Join a Family
              </button>
            </>
          )}
          <button className="auth-submit-btn"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '2px solid var(--color-border)' }}
            onClick={() => navigate('/signup')}>
            Create New Account
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const { user, signOut } = useAuth()
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
    return <SetupFallback user={user} navigate={navigate} />
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
