import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { readNext } from '../lib/authNav'
import '../styles/auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, user, onboardingComplete, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const next = readNext(searchParams, '/app')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    if (params.get('confirmed') || (hash && (hash.includes('type=signup') || hash.includes('type=email')))) {
      setConfirmed(true)
      if (params.get('confirmed')) {
        // Strip the param but keep `next` if present
        params.delete('confirmed')
        const qs = params.toString()
        window.history.replaceState(null, '', '/login' + (qs ? `?${qs}` : ''))
      }
    }
    const errParam = params.get('error')
    if (errParam) {
      setError(decodeURIComponent(errParam))
    }
  }, [])

  // Already signed in — bounce to next (or onboarding if not done).
  // null means status unknown (migration may not be applied yet); fall through
  // to `next` and let ProtectedRoute / FamilyContext handle any orphan state.
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (onboardingComplete === false) {
      navigate(`/onboarding?next=${encodeURIComponent(next)}`, { replace: true })
    } else {
      navigate(next, { replace: true })
    }
  }, [authLoading, user, onboardingComplete, next, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email.trim(), password)
      // Navigation handled by the effect above once onboarding status loads
    } catch (err) {
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#127775;</span>
        <h1>Welcome Back</h1>
        <p className="auth-subtitle">Sign in to Little Legend Tracker</p>

        {confirmed && (
          <p className="auth-success-msg">Email confirmed! You can now sign in.</p>
        )}

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
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error && <p className="auth-error-msg">{error}</p>}

          <Link to="/forgot-password" className="auth-link" style={{ marginTop: 8, fontSize: 14 }}>
            Forgot your password?
          </Link>
        </form>

        <div className="auth-divider">or</div>

        <Link
          to={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="auth-link auth-link-primary"
        >
          Create a new account
        </Link>
        <br />
        <Link to="/join" className="auth-link">
          Join an existing family
        </Link>
      </div>
    </div>
  )
}
