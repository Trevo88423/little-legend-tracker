import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { readNext } from '../lib/authNav'
import '../styles/auth.css'

export default function Onboarding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading, onboardingComplete, refreshOnboardingStatus } = useAuth()

  const next = readNext(searchParams, '/app')
  const initialMode = searchParams.get('mode') === 'join' ? 'join' : 'create'
  const [mode, setMode] = useState(initialMode)

  // Redirect away from onboarding once we know the user is logged in & complete
  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate(`/login?next=${encodeURIComponent('/onboarding')}`, { replace: true })
      return
    }
    if (onboardingComplete === true) {
      navigate(next, { replace: true })
    }
  }, [loading, user, onboardingComplete, next, navigate])

  if (loading || !user || onboardingComplete === true) {
    return (
      <div className="ll-auth-screen">
        <div className="ll-auth-card" style={{ textAlign: 'center' }}>
          <div className="ll-spinner" style={{ margin: '40px auto' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <span className="auth-icon">&#128118;</span>
        <h1>Set up your tracker</h1>
        <p className="auth-subtitle">
          {mode === 'create'
            ? "Tell us about your little legend"
            : "Joining your partner's tracker"}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, marginTop: 8 }}>
          <button
            type="button"
            className="auth-submit-btn"
            style={{
              flex: 1,
              background: mode === 'create' ? 'var(--color-primary)' : 'var(--color-bg)',
              color: mode === 'create' ? '#fff' : 'var(--color-text-secondary)',
              border: mode === 'create' ? 'none' : '2px solid var(--color-border)',
            }}
            onClick={() => setMode('create')}
          >
            Create new
          </button>
          <button
            type="button"
            className="auth-submit-btn"
            style={{
              flex: 1,
              background: mode === 'join' ? 'var(--color-primary)' : 'var(--color-bg)',
              color: mode === 'join' ? '#fff' : 'var(--color-text-secondary)',
              border: mode === 'join' ? 'none' : '2px solid var(--color-border)',
            }}
            onClick={() => setMode('join')}
          >
            Join existing
          </button>
        </div>

        {mode === 'create'
          ? <CreateFamilyForm next={next} onDone={refreshOnboardingStatus} />
          : <JoinFamilyForm next={next} onDone={refreshOnboardingStatus} />}

        <Link to="/login" className="auth-link" style={{ marginTop: 16 }}>
          Sign in with a different account
        </Link>
      </div>
    </div>
  )
}

function CreateFamilyForm({ next, onDone }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [childSex, setChildSex] = useState('')
  const [familyPin, setFamilyPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6,8}$/.test(familyPin)) {
      setError('Family PIN must be 6-8 digits')
      return
    }
    setLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('complete_signup', {
        p_family_name: childName.trim(),
        p_pin_input: familyPin,
        p_display_name: displayName.trim(),
        p_child_name: childName.trim(),
        p_child_dob: childDob || null,
        p_child_sex: childSex || null,
      })
      if (rpcError) throw rpcError
      await onDone()
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="ll-auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="ob-display">Your Display Name</label>
        <input id="ob-display" type="text" value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Mum, Dad, Sarah" required />
      </div>
      <div className="form-group">
        <label htmlFor="ob-child-name">Child's Name</label>
        <input id="ob-child-name" type="text" value={childName}
          onChange={e => setChildName(e.target.value)}
          placeholder="Your little legend's name" required />
      </div>
      <div className="form-group">
        <label htmlFor="ob-dob">Child's Date of Birth (optional)</label>
        <input id="ob-dob" type="date" value={childDob}
          onChange={e => setChildDob(e.target.value)} />
      </div>
      <div className="form-group">
        <label htmlFor="ob-sex">Child's Sex (optional &mdash; for growth percentiles)</label>
        <select id="ob-sex" value={childSex} onChange={e => setChildSex(e.target.value)}>
          <option value="">Prefer not to say</option>
          <option value="male">Boy</option>
          <option value="female">Girl</option>
          <option value="other">Other / intersex</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="ob-pin">Family PIN (6-8 digits)</label>
        <input id="ob-pin" type="text" inputMode="numeric" pattern="\d{6,8}"
          value={familyPin}
          onChange={e => setFamilyPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="Used by partner to join"
          required maxLength={8} />
      </div>
      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? 'Setting up…' : 'Create family'}
      </button>
      {error && <p className="auth-error-msg">{error}</p>}
    </form>
  )
}

function JoinFamilyForm({ next, onDone }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [familyPin, setFamilyPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Disambiguation step (rare PIN+name collision)
  const [matchedFamilyIds, setMatchedFamilyIds] = useState([])
  const [showEmailStep, setShowEmailStep] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6,8}$/.test(familyPin)) {
      setError('Family PIN must be 6-8 digits')
      return
    }
    setLoading(true)
    try {
      const { data: families, error: rpcError } = await supabase
        .rpc('verify_family_pin', {
          pin_input: familyPin,
          family_name_input: familyName.trim(),
        })
      if (rpcError) throw rpcError
      if (!families || families.length === 0) {
        throw new Error("No family found with that PIN and name. Please check and try again.")
      }
      if (families.length > 1) {
        setMatchedFamilyIds(families.map(f => f.family_id))
        setShowEmailStep(true)
        setLoading(false)
        return
      }
      await joinFamily(families[0].family_id)
    } catch (err) {
      setError(err.message || 'Failed to join family')
      setLoading(false)
    }
  }

  async function joinFamily(familyId) {
    setLoading(true)
    try {
      const { error: joinError } = await supabase.rpc('complete_join_family', {
        p_family_id: familyId,
        p_display_name: displayName.trim(),
        p_pin_input: familyPin,
      })
      if (joinError) throw joinError
      await onDone()
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to join family')
      setLoading(false)
    }
  }

  async function handleEmailConfirm(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: familyId, error: rpcError } = await supabase
        .rpc('confirm_family_by_member_email', {
          p_family_ids: matchedFamilyIds,
          p_member_email: partnerEmail.trim(),
        })
      if (rpcError) throw rpcError
      if (!familyId) throw new Error("No family member found with that email.")
      await joinFamily(familyId)
    } catch (err) {
      setError(err.message || 'Failed to confirm family')
      setLoading(false)
    }
  }

  if (showEmailStep) {
    return (
      <form className="ll-auth-form" onSubmit={handleEmailConfirm}>
        <p className="auth-subtitle" style={{ marginBottom: 16 }}>
          Multiple families matched. Enter your partner's email to confirm which family to join.
        </p>
        <div className="form-group">
          <label htmlFor="ob-partner-email">Partner's Email</label>
          <input id="ob-partner-email" type="email" value={partnerEmail}
            onChange={e => setPartnerEmail(e.target.value)}
            placeholder="Your partner's email address" required autoComplete="off" />
        </div>
        <button type="submit" className="auth-submit-btn"
          disabled={loading || !partnerEmail.trim()}>
          {loading ? 'Confirming…' : 'Confirm Family'}
        </button>
        {error && <p className="auth-error-msg">{error}</p>}
      </form>
    )
  }

  return (
    <form className="ll-auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="ob-join-display">Your Display Name</label>
        <input id="ob-join-display" type="text" value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Mum, Dad, Sarah" required />
      </div>
      <div className="form-group">
        <label htmlFor="ob-join-name">Child's Name</label>
        <input id="ob-join-name" type="text" value={familyName}
          onChange={e => setFamilyName(e.target.value)}
          placeholder="Your little legend's name" required />
      </div>
      <div className="form-group">
        <label htmlFor="ob-join-pin">Family PIN</label>
        <input id="ob-join-pin" type="text" inputMode="numeric" pattern="\d{6,8}"
          value={familyPin}
          onChange={e => setFamilyPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="From your partner" required maxLength={8} />
      </div>
      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? 'Joining…' : 'Join family'}
      </button>
      {error && <p className="auth-error-msg">{error}</p>}
    </form>
  )
}
