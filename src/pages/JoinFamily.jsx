import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/auth.css'

export default function JoinFamily() {
  const navigate = useNavigate()
  const { user, signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [familyPin, setFamilyPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Email disambiguation step (rare: multiple families share same PIN + name)
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
      // If not logged in, sign up first
      if (!user) {
        const { user: newUser, session } = await signUp(email.trim(), password)
        if (!newUser) throw new Error('Signup failed - no user returned')

        // If email confirmation is required, there's no session yet
        if (!session) {
          localStorage.setItem('pendingJoin', JSON.stringify({
            familyName: familyName.trim(),
            pin: familyPin,
            displayName: displayName.trim(),
          }))
          navigate('/check-email', {
            state: {
              email: email.trim(),
              joinAfterVerify: true,
            },
          })
          return
        }
      }

      // Verify PIN + family name and join
      await verifyAndJoin()
    } catch (err) {
      setError(err.message || 'Failed to join family')
      setLoading(false)
    }
  }

  async function verifyAndJoin() {
    const { data: families, error: rpcError } = await supabase
      .rpc('verify_family_pin', {
        pin_input: familyPin,
        family_name_input: familyName.trim(),
      })

    if (rpcError) throw rpcError
    if (!families || families.length === 0) {
      throw new Error('No family found with that PIN and name. Please check and try again.')
    }

    // If multiple families match (rare PIN+name collision), ask for partner email
    if (families.length > 1) {
      setMatchedFamilyIds(families.map((f) => f.family_id))
      setShowEmailStep(true)
      setLoading(false)
      return
    }

    // Single match - join directly
    await joinFamily(families[0].family_id)
  }

  async function joinFamily(familyId) {
    setLoading(true)
    setError('')

    try {
      const { error: joinError } = await supabase.rpc('complete_join_family', {
        p_family_id: familyId,
        p_display_name: displayName.trim(),
        p_pin_input: familyPin,
      })
      if (joinError) throw joinError

      navigate('/app')
    } catch (err) {
      setError(err.message || 'Failed to join family')
    } finally {
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
      if (!familyId) throw new Error('No family member found with that email. Please check and try again.')

      await joinFamily(familyId)
    } catch (err) {
      setError(err.message || 'Failed to confirm family')
      setLoading(false)
    }
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#128106;</span>
        <h1>Join Family</h1>
        <p className="auth-subtitle">
          Join your partner's tracker with the child's name and PIN
        </p>

        {!showEmailStep ? (
          <form className="ll-auth-form" onSubmit={handleSubmit}>
            {!user && (
              <>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="displayName">Your Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mum, Dad, Sarah"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="familyName">Child's Name</label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Your little legend's name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="familyPin">Family PIN</label>
              <input
                id="familyPin"
                type="text"
                inputMode="numeric"
                pattern="\d{6,8}"
                value={familyPin}
                onChange={(e) => setFamilyPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Enter the PIN from your partner"
                required
                maxLength={8}
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Family'}
            </button>

            {error && <p className="auth-error-msg">{error}</p>}
          </form>
        ) : (
          <form className="ll-auth-form" onSubmit={handleEmailConfirm}>
            <p className="auth-subtitle" style={{ marginBottom: 16 }}>
              Multiple families matched. Enter your partner's email to confirm which family to join.
            </p>

            <div className="form-group">
              <label htmlFor="partnerEmail">Partner's Email</label>
              <input
                id="partnerEmail"
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="Your partner's email address"
                required
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !partnerEmail.trim()}
            >
              {loading ? 'Confirming...' : 'Confirm Family'}
            </button>

            {error && <p className="auth-error-msg">{error}</p>}
          </form>
        )}

        <div className="auth-divider">or</div>

        <Link to="/signup" className="auth-link auth-link-primary">
          Create a new family instead
        </Link>
        {!user && (
          <>
            <br />
            <Link to="/login" className="auth-link">
              Already have an account? Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
