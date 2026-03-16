import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { genId } from '../lib/idUtils'
import '../styles/auth.css'

// PIN hashing is done server-side via create_family_with_pin RPC

export default function Signup() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [familyPin, setFamilyPin] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validatePin(pin) {
    return /^\d{6,8}$/.test(pin)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!validatePin(familyPin)) {
      setError('Family PIN must be 6-8 digits')
      return
    }

    setLoading(true)

    try {
      // 1. Sign up the user
      const { user, session } = await signUp(email.trim(), password)
      if (!user) throw new Error('Signup failed - no user returned')

      // Store pending signup data for after email verification
      const signupData = {
        familyName: `${displayName.trim()}'s Family`,
        pin: familyPin,
        displayName: displayName.trim(),
        childName: childName.trim(),
        childDob: childDob || null,
      }

      // If no session (email confirmation required), save data and redirect
      if (!session) {
        sessionStorage.setItem('pendingSignup', JSON.stringify(signupData))
        navigate('/check-email', { state: { email: email.trim() } })
        return
      }

      // Session exists - complete signup immediately
      const { data, error: rpcError } = await supabase.rpc('complete_signup', {
        p_family_name: signupData.familyName,
        p_pin_input: signupData.pin,
        p_display_name: signupData.displayName,
        p_child_name: signupData.childName,
        p_child_dob: signupData.childDob,
      })
      if (rpcError) throw rpcError

      navigate('/app')
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#128118;</span>
        <h1>Create Account</h1>
        <p className="auth-subtitle">Start tracking your little legend</p>

        <form className="ll-auth-form" onSubmit={handleSubmit}>
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
            <label htmlFor="childName">Child's Name</label>
            <input
              id="childName"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Your little legend's name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="childDob">Date of Birth (optional)</label>
            <input
              id="childDob"
              type="date"
              value={childDob}
              onChange={(e) => setChildDob(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="familyPin">Family PIN (6-8 digits)</label>
            <input
              id="familyPin"
              type="text"
              inputMode="numeric"
              pattern="\d{6,8}"
              value={familyPin}
              onChange={(e) => setFamilyPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Used by partner to join"
              required
              maxLength={8}
            />
          </div>

          <label className="auth-consent">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" target="_blank">Privacy Policy</Link>
            </span>
          </label>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || !agreed}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          {error && <p className="auth-error-msg">{error}</p>}
        </form>

        <Link to="/login" className="auth-link">
          Already have an account? <span className="auth-link-primary">Sign in</span>
        </Link>
      </div>
    </div>
  )
}
