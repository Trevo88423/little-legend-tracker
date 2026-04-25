import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { readNext } from '../lib/authNav'
import '../styles/auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp } = useAuth()
  const next = readNext(searchParams, '/app')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { user, session } = await signUp(email.trim(), password, {
        flow: 'signup',
        display_name: displayName.trim(),
      })
      if (!user) throw new Error('Signup failed - no user returned')

      const onboardingUrl = `/onboarding?next=${encodeURIComponent(next)}`

      if (session) {
        // Email confirmation disabled — straight to onboarding
        navigate(onboardingUrl, { replace: true })
      } else {
        // Email confirmation required — link in email lands on /auth/confirm
        // which handles the OTP and forwards to /onboarding
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

        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 12, lineHeight: 1.4, textAlign: 'center' }}>
          You'll set up your child's details after confirming your email.
        </p>

        <Link to={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className="auth-link">
          Already have an account? <span className="auth-link-primary">Sign in</span>
        </Link>
      </div>
    </div>
  )
}
