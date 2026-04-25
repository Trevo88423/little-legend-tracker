import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/auth.css'

// Joining an existing family is now an authenticated, rate-limited action.
// /join is a small router: send authenticated users to /onboarding?mode=join
// and unauthenticated users to /login (or /signup) with an appropriate `next`.
export default function JoinFamily() {
  const navigate = useNavigate()
  const { user, loading, onboardingComplete } = useAuth()

  // Where /onboarding should send the user after they finish joining
  const joinDest = '/onboarding?mode=join'
  const nextParam = encodeURIComponent(joinDest)

  useEffect(() => {
    if (loading) return
    if (user) {
      // Already signed in — go straight to the join tab. Onboarding will
      // redirect to /app if they're already in a family.
      if (onboardingComplete) {
        navigate('/app', { replace: true })
      } else {
        navigate(joinDest, { replace: true })
      }
    }
  }, [loading, user, onboardingComplete, navigate])

  // Unauthenticated branch: explain the flow & send them to login/signup
  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#128106;</span>
        <h1>Join a Family</h1>
        <p className="auth-subtitle">
          Sign in or create an account first, then you'll join your partner's tracker
          using their child's name and PIN.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <Link
            to={`/login?next=${nextParam}`}
            className="auth-submit-btn"
            style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
          >
            Sign in
          </Link>
          <Link
            to={`/signup?next=${nextParam}`}
            className="auth-submit-btn"
            style={{
              display: 'block', textDecoration: 'none', textAlign: 'center',
              background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
              border: '2px solid var(--color-border)',
            }}
          >
            Create new account
          </Link>
        </div>
      </div>
    </div>
  )
}
