import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/auth.css'

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
      // Sign up with onboarding data in metadata — DB trigger handles the rest
      const { user, session } = await signUp(email.trim(), password, {
        flow: 'signup',
        display_name: displayName.trim(),
        child_name: childName.trim(),
        child_dob: childDob || null,
        family_name: childName.trim(),
        family_pin: familyPin,
      })
      if (!user) throw new Error('Signup failed - no user returned')

      if (session) {
        // Email confirmation not required — trigger already fired on INSERT
        navigate('/app')
      } else {
        // Email confirmation required — trigger fires when email confirmed
        navigate('/check-email', { state: { email: email.trim() } })
      }
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
            <label htmlFor="childDob">Child's Date of Birth (optional)</label>
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
