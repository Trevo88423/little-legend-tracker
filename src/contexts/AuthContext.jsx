import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState(null)

  useEffect(() => {
    // Handle PKCE auth code exchange (email confirmation, password reset, etc.)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    let pendingHandled = false

    async function handlePending() {
      // Guard: only run once per session initialization
      if (pendingHandled) return
      pendingHandled = true
      await completePendingSignup()
      await completePendingJoin()
    }

    async function init() {
      // If there's a code, exchange it FIRST before doing anything else
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) console.error('Code exchange failed:', error)
        // Clean the code from URL
        window.history.replaceState(null, '', window.location.pathname)
      }

      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      // Complete pending signup/join if user is signed in
      if (session) {
        await handlePending()
      }

      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN' && session) {
        await handlePending()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function completePendingSignup() {
    const pending = localStorage.getItem('pendingSignup')
    if (!pending) return
    // Small delay to ensure auth.uid() is propagated server-side after code exchange
    await new Promise(r => setTimeout(r, 1000))
    // Retry up to 2 times in case of transient auth propagation issues
    const data = JSON.parse(pending)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await supabase.rpc('complete_signup', {
          p_family_name: data.familyName,
          p_pin_input: data.pin,
          p_display_name: data.displayName,
          p_child_name: data.childName,
          p_child_dob: data.childDob,
        })
        if (error) throw error
        localStorage.removeItem('pendingSignup')
        return
      } catch (err) {
        console.error(`Failed to complete pending signup (attempt ${attempt + 1}):`, err)
        if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
      }
    }
    setSetupError('signup')
  }

  async function completePendingJoin() {
    const pending = localStorage.getItem('pendingJoin')
    if (!pending) return
    // Small delay to ensure auth.users row is propagated
    await new Promise(r => setTimeout(r, 1000))
    try {
      const data = JSON.parse(pending)
      // Verify PIN + family name
      const { data: families, error: rpcError } = await supabase
        .rpc('verify_family_pin', {
          pin_input: data.pin,
          family_name_input: data.familyName,
        })
      if (rpcError) throw rpcError
      if (!families || families.length === 0) {
        console.error('Pending join: no family found with that name and PIN')
        setSetupError('join')
        return
      }
      // Join the first matching family
      const { error: joinError } = await supabase.rpc('complete_join_family', {
        p_family_id: families[0].family_id,
        p_display_name: data.displayName,
        p_pin_input: data.pin,
      })
      if (joinError) throw joinError
      // Only clear after success (idempotent RPC prevents duplicates on retry)
      localStorage.removeItem('pendingJoin')
    } catch (err) {
      console.error('Failed to complete pending join:', err)
      setSetupError('join')
    }
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
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
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, loading, setupError, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
