import { Link, useLocation } from 'react-router-dom'
import '../styles/auth.css'

export default function CheckEmail() {
  const location = useLocation()
  const email = location.state?.email || 'your email'

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <span className="auth-icon">&#9993;&#65039;</span>
        <h1>Check Your Email</h1>
        <p className="auth-subtitle">We've sent a confirmation link</p>

        <div className="auth-check-email-body">
          <p>
            We've sent a verification email to <strong>{email}</strong>.
          </p>
          <p>
            Click the link in the email to confirm your account, then come back here to sign in.
          </p>
          <p className="auth-check-email-tip">
            Can't find it? Check your spam or junk folder.
          </p>
        </div>

        <Link to="/login" className="auth-submit-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '24px' }}>
          Go to Login
        </Link>

        <Link to="/" className="auth-link" style={{ marginTop: '16px' }}>
          &larr; Back to home
        </Link>
      </div>
    </div>
  )
}
