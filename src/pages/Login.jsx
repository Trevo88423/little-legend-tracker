import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    // Supabase redirects here after email confirmation with hash params
    const hash = window.location.hash
    if (hash && (hash.includes('type=signup') || hash.includes('type=email'))) {
      setConfirmed(true)
      // Clean the URL hash
      window.history.replaceState(null, '', '/login')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email.trim(), password)
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Failed to sign in')
    } finally {
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

        <Link to="/signup" className="auth-link auth-link-primary">
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
