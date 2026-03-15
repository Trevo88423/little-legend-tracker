import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/auth.css'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#128274;</span>
        <h1>Reset Password</h1>
        <p className="auth-subtitle">
          {sent
            ? 'Check your email for a reset link'
            : "Enter your email and we'll send you a reset link"}
        </p>

        {!sent ? (
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

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {error && <p className="auth-error-msg">{error}</p>}
          </form>
        ) : (
          <div className="ll-auth-form">
            <p style={{ textAlign: 'center', color: 'var(--color-success, #22c55e)', fontWeight: 600, marginBottom: 16 }}>
              Reset link sent to {email}
            </p>
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-muted)' }}>
              Click the link in your email to set a new password. Check your spam folder if you don't see it.
            </p>
          </div>
        )}

        <Link to="/login" className="auth-link">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
