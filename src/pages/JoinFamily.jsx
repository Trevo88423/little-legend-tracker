import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { genId } from '../lib/idUtils'
import '../styles/auth.css'

export default function JoinFamily() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [familyPin, setFamilyPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Family picker state (when multiple families match the PIN)
  const [matchedFamilies, setMatchedFamilies] = useState([])
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!/^\d{6,8}$/.test(familyPin)) {
      setError('Family PIN must be 6-8 digits')
      return
    }

    setLoading(true)

    try {
      // 1. Sign up the user
      const { user } = await signUp(email.trim(), password)
      if (!user) throw new Error('Signup failed - no user returned')

      // 2. Verify the family PIN via RPC
      const { data: families, error: rpcError } = await supabase
        .rpc('verify_family_pin', { pin_input: familyPin })

      if (rpcError) throw rpcError
      if (!families || families.length === 0) {
        throw new Error('No family found with that PIN. Please check and try again.')
      }

      // 3. If multiple families match, show picker
      if (families.length > 1) {
        setMatchedFamilies(families)
        setShowPicker(true)
        setLoading(false)
        return
      }

      // 4. Single match - join directly
      await joinFamily(families[0].id)
    } catch (err) {
      setError(err.message || 'Failed to join family')
      setLoading(false)
    }
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

  async function handleFamilySelect() {
    if (!selectedFamilyId) {
      setError('Please select a family')
      return
    }
    await joinFamily(selectedFamilyId)
  }

  return (
    <div className="ll-auth-screen">
      <div className="ll-auth-card">
        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        <span className="auth-icon">&#128106;</span>
        <h1>Join Family</h1>
        <p className="auth-subtitle">Connect with your partner's account</p>

        {!showPicker ? (
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
          <div className="ll-auth-form">
            <p className="auth-subtitle" style={{ marginBottom: 16 }}>
              Multiple families found. Which one would you like to join?
            </p>

            <div className="form-group">
              {matchedFamilies.map((fam) => (
                <label
                  key={fam.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    marginBottom: 8,
                    border: selectedFamilyId === fam.id
                      ? '2px solid var(--color-primary)'
                      : '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: selectedFamilyId === fam.id
                      ? 'var(--color-bg)'
                      : 'white',
                  }}
                >
                  <input
                    type="radio"
                    name="family"
                    value={fam.id}
                    checked={selectedFamilyId === fam.id}
                    onChange={() => setSelectedFamilyId(fam.id)}
                  />
                  <span style={{ fontWeight: 700 }}>{fam.name}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              className="auth-submit-btn"
              disabled={loading || !selectedFamilyId}
              onClick={handleFamilySelect}
            >
              {loading ? 'Joining...' : 'Join Selected Family'}
            </button>

            {error && <p className="auth-error-msg">{error}</p>}
          </div>
        )}

        <div className="auth-divider">or</div>

        <Link to="/signup" className="auth-link auth-link-primary">
          Create a new family instead
        </Link>
        <br />
        <Link to="/login" className="auth-link">
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  )
}
