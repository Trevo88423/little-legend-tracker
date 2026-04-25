import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Quietly swallow AbortError noise in console (happens during HMR / multi-tab races
// when the Supabase auth lock is "stolen" by a newer instance — harmless).
function isBenignAbort(err) {
  return err?.name === 'AbortError' || /Lock broken by another request/.test(err?.message || '')
}

async function fetchOnboardingStatus(userId) {
  if (!userId) return { onboardingComplete: null, setupError: null }
  try {
    const { data, error } = await supabase
      .from('user_setup_status')
      .select('onboarding_complete, last_error')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      if (!isBenignAbort(error)) {
        console.warn('user_setup_status query failed:', error.message)
      }
      return { onboardingComplete: null, setupError: null }
    }
    return {
      onboardingComplete: Boolean(data?.onboarding_complete),
      setupError: data?.last_error || null,
    }
  } catch (err) {
    if (!isBenignAbort(err)) {
      console.warn('user_setup_status exception:', err?.message)
    }
    return { onboardingComplete: null, setupError: null }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [setupError, setSetupError] = useState(null)
  const userIdRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    // Single source of truth: onAuthStateChange fires INITIAL_SESSION at startup
    // with the current session, then SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED as needed.
    // We do NOT call getSession() separately — that creates a second lock acquisition
    // which races with the listener and triggers "Lock broken by another request".
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      const u = session?.user ?? null
      userIdRef.current = u?.id ?? null
      setUser(u)

      const status = await fetchOnboardingStatus(u?.id)
      if (cancelled) return
      // Only apply if the user hasn't changed since we started the fetch
      if (userIdRef.current === (u?.id ?? null)) {
        setOnboardingComplete(status.onboardingComplete)
        setSetupError(status.setupError)
      }

      if (event === 'INITIAL_SESSION') setLoading(false)
    })

    // Legacy code exchange for stale email links that bypass /auth/confirm.
    // Fire-and-forget: the listener above will pick up the SIGNED_IN event
    // when the exchange completes.
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.location.pathname !== '/auth/confirm') {
      supabase.auth.exchangeCodeForSession(code)
        .catch(err => {
          if (!isBenignAbort(err)) console.warn('Legacy code exchange failed:', err?.message)
        })
        .finally(() => {
          if (cancelled) return
          window.history.replaceState(null, '', window.location.pathname + window.location.hash)
        })
    }

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const refreshOnboardingStatus = useCallback(async () => {
    const status = await fetchOnboardingStatus(userIdRef.current)
    setOnboardingComplete(status.onboardingComplete)
    setSetupError(status.setupError)
  }, [])

  async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
        data: metadata,
      },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      onboardingComplete,
      setupError,
      refreshOnboardingStatus,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
