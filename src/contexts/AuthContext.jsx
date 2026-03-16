import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle PKCE auth code exchange (email confirmation, password reset, etc.)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) console.error('Code exchange failed:', error)
          // Clean the code from URL
          const cleanUrl = window.location.pathname
          window.history.replaceState(null, '', cleanUrl)
        })
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)

      // Complete pending signup if user is already signed in (e.g. page refresh)
      if (session) {
        const pending = localStorage.getItem('pendingSignup')
        if (pending) {
          try {
            const data = JSON.parse(pending)
            await supabase.rpc('complete_signup', {
              p_family_name: data.familyName,
              p_pin_input: data.pin,
              p_display_name: data.displayName,
              p_child_name: data.childName,
              p_child_dob: data.childDob,
            })
          } catch (err) {
            console.error('Failed to complete pending signup:', err)
          } finally {
            localStorage.removeItem('pendingSignup')
          }
        }
      }

      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      // Complete pending signup after email verification + sign-in
      if (event === 'SIGNED_IN' && session) {
        const pending = localStorage.getItem('pendingSignup')
        if (pending) {
          try {
            const data = JSON.parse(pending)
            await supabase.rpc('complete_signup', {
              p_family_name: data.familyName,
              p_pin_input: data.pin,
              p_display_name: data.displayName,
              p_child_name: data.childName,
              p_child_dob: data.childDob,
            })
          } catch (err) {
            console.error('Failed to complete pending signup:', err)
          } finally {
            localStorage.removeItem('pendingSignup')
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
