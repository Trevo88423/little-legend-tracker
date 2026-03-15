import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const FamilyContext = createContext(null)

export function FamilyProvider({ children }) {
  const { user } = useAuth()
  const [family, setFamily] = useState(null)
  const [members, setMembers] = useState([])
  const [children_, setChildren] = useState([])
  const [activeChild, setActiveChild] = useState(null)
  const [currentMember, setCurrentMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setFamily(null)
      setMembers([])
      setChildren([])
      setActiveChild(null)
      setCurrentMember(null)
      setLoading(false)
      return
    }
    loadFamilyData()
  }, [user])

  async function loadFamilyData() {
    setLoading(true)
    try {
      // Get family membership
      const { data: memberRows } = await supabase
        .from('family_members')
        .select('*, families(*)')
        .eq('user_id', user.id)

      if (!memberRows || memberRows.length === 0) {
        setLoading(false)
        return
      }

      const membership = memberRows[0]
      setFamily(membership.families)
      setCurrentMember(membership)

      // Load all members
      const { data: allMembers } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', membership.family_id)

      setMembers(allMembers || [])

      // Load children
      const { data: childRows } = await supabase
        .from('children')
        .select('*')
        .eq('family_id', membership.family_id)
        .order('created_at')

      setChildren(childRows || [])

      // Set active child (first child or from localStorage)
      if (childRows && childRows.length > 0) {
        const savedChildId = localStorage.getItem('ll-active-child')
        const savedChild = childRows.find(c => c.id === savedChildId)
        setActiveChild(savedChild || childRows[0])
      }
    } catch (err) {
      console.error('Failed to load family data:', err)
    } finally {
      setLoading(false)
    }
  }

  function selectChild(child) {
    setActiveChild(child)
    localStorage.setItem('ll-active-child', child.id)
  }

  return (
    <FamilyContext.Provider value={{
      family, members, children: children_, activeChild, currentMember,
      loading, selectChild, reload: loadFamilyData
    }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider')
  return ctx
}
