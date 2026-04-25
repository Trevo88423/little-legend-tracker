import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { readNext } from '../lib/authNav'
import '../styles/auth.css'

// Handles email confirmation links and OAuth/PKCE callbacks.
// Supports both modern (token_hash + type) and legacy (code) Supabase flows.
// On success, lands the user authenticated at ?next= (validated, defaults to /app).
export default function AuthConfirm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const next = readNext(searchParams, '/app')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const code = searchParams.get('code')
    const errorDesc = searchParams.get('error_description') || searchParams.get('error')

    async function run() {
      if (errorDesc) {
        navigate(`/login?error=${encodeURIComponent(errorDesc)}`, { replace: true })
        return
      }

      try {
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
          if (error) throw error
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          // No confirmation params — treat as direct visit, just send them on
          navigate(next, { replace: true })
          return
        }

        // Password recovery flow needs a different destination
        if (type === 'recovery') {
          navigate('/reset-password', { replace: true })
          return
        }

        navigate(next, { replace: true })
      } catch (err) {
        const msg = err?.message || 'confirmation_failed'
        navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true })
      }
    }

    run()
  }, [navigate, searchParams])

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card" style={{ textAlign: 'center' }}>
        <span className="auth-icon">&#128153;</span>
        <h1>Confirming&hellip;</h1>
        <p className="auth-subtitle">Just a moment while we sign you in.</p>
        <div className="ll-spinner" style={{ margin: '16px auto' }} />
      </div>
    </div>
  )
}
