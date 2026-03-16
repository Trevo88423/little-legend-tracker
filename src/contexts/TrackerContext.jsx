import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFamily } from './FamilyContext'
import { today, now24, formatTime12 } from '../lib/dateUtils'
import { genId } from '../lib/idUtils'

const TrackerContext = createContext(null)

export function TrackerProvider({ children }) {
  const { family, activeChild, currentMember } = useFamily()
  const [loading, setLoading] = useState(true)

  const [data, setData] = useState({
    medications: [],
    medLog: {},
    feeds: [],
    weights: [],
    trackers: [],
    trackerLogs: [],
    notes: [],
    settings: { medAlarms: true, feedAlarms: false, soundAlerts: false },
    activityLog: [],
  })

  const familyId = family?.id
  const childId = activeChild?.id
  const loggerName = currentMember?.display_name || 'Unknown'

  useEffect(() => {
    if (!familyId || !childId) {
      setLoading(false)
      return
    }
    loadAllData()

    const channel = supabase.channel(`tracker-${familyId}-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'med_logs', filter: `family_id=eq.${familyId}` }, () => loadMedLogs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feeds', filter: `family_id=eq.${familyId}` }, () => loadFeeds())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weights', filter: `family_id=eq.${familyId}` }, () => loadWeights())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `family_id=eq.${familyId}` }, () => loadNotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medications', filter: `family_id=eq.${familyId}` }, () => loadMedications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log', filter: `family_id=eq.${familyId}` }, () => loadActivityLog())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_logs', filter: `family_id=eq.${familyId}` }, () => loadTrackerLogs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `family_id=eq.${familyId}` }, () => loadSettings())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [familyId, childId])

  const fq = useCallback(() => ({ family_id: familyId, child_id: childId }), [familyId, childId])

  async function loadAllData() {
    setLoading(true)
    try {
      await Promise.all([
        loadMedications(), loadMedLogs(), loadFeeds(), loadWeights(),
        loadNotes(), loadTrackers(), loadTrackerLogs(), loadSettings(), loadActivityLog(),
      ])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMedications() {
    const { data: rows } = await supabase.from('medications').select('*')
      .eq('family_id', familyId).eq('child_id', childId).eq('active', true).order('name')
    setData(prev => ({
      ...prev,
      medications: (rows || []).map(m => ({
        id: m.id, name: m.name, purpose: m.purpose, dose: m.dose,
        category: m.category, times: m.times, instructions: m.instructions
      }))
    }))
  }

  async function loadMedLogs() {
    const { data: rows } = await supabase.from('med_logs').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    const logMap = {}
    ;(rows || []).forEach(row => {
      if (!logMap[row.date]) logMap[row.date] = {}
      logMap[row.date][row.med_key] = { givenAt: row.given_at, givenBy: row.given_by }
    })
    setData(prev => ({ ...prev, medLog: logMap }))
  }

  async function loadFeeds() {
    const { data: rows } = await supabase.from('feeds').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('date', { ascending: false }).order('time', { ascending: false })
    setData(prev => ({
      ...prev,
      feeds: (rows || []).map(f => ({
        id: f.id, date: f.date, time: f.time, type: f.type,
        amount: Number(f.amount), notes: f.notes, loggedBy: f.logged_by
      }))
    }))
  }

  async function loadWeights() {
    const { data: rows } = await supabase.from('weights').select('*')
      .eq('family_id', familyId).eq('child_id', childId).order('date')
    setData(prev => ({
      ...prev,
      weights: (rows || []).map(w => ({ date: w.date, value: Number(w.value), notes: w.notes }))
    }))
  }

  async function loadNotes() {
    const { data: rows } = await supabase.from('notes').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('created_at', { ascending: false })
    setData(prev => ({
      ...prev,
      notes: (rows || []).map(n => ({
        id: n.id, date: n.date, time: n.time, text: n.text,
        loggedBy: n.logged_by, timestamp: n.created_at
      }))
    }))
  }

  async function loadTrackers() {
    const { data: rows } = await supabase.from('trackers').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    setData(prev => ({
      ...prev,
      trackers: (rows || []).map(t => ({
        id: t.id, name: t.name, icon: t.icon, unit: t.unit, type: t.type
      }))
    }))
  }

  async function loadTrackerLogs() {
    const { data: rows } = await supabase.from('tracker_logs').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    setData(prev => ({
      ...prev,
      trackerLogs: (rows || []).map(l => ({
        id: l.id, trackerId: l.tracker_id, date: l.date, time: l.time,
        value: l.value, notes: l.notes
      }))
    }))
  }

  async function loadSettings() {
    const { data: row } = await supabase.from('settings').select('*')
      .eq('family_id', familyId).eq('child_id', childId).single()
    if (row) {
      setData(prev => ({
        ...prev,
        settings: { medAlarms: row.med_alarms, feedAlarms: row.feed_alarms, soundAlerts: row.sound_alerts }
      }))
    }
  }

  async function loadActivityLog() {
    const { data: rows } = await supabase.from('activity_log').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('timestamp', { ascending: false }).limit(200)
    setData(prev => ({
      ...prev,
      activityLog: (rows || []).map(a => ({
        timestamp: a.timestamp, type: a.type, message: a.message
      }))
    }))
  }

  // ==================== ACTIVITY LOGGING ====================
  function logActivity(type, message) {
    const entry = { timestamp: new Date().toISOString(), type, message }
    setData(prev => ({
      ...prev,
      activityLog: [entry, ...prev.activityLog].slice(0, 200)
    }))
    supabase.from('activity_log').insert({ ...fq(), type, message }).then()
  }

  // ==================== MED OPERATIONS ====================
  function getMedKey(medId, time) { return medId + '_' + time }

  function isMedGiven(medId, time, date) {
    const d = date || today()
    return data.medLog[d] && data.medLog[d][getMedKey(medId, time)]
  }

  async function toggleMed(medId, time) {
    const d = today()
    const key = getMedKey(medId, time)
    const med = data.medications.find(m => m.id === medId)

    if (isMedGiven(medId, time)) {
      setData(prev => {
        const newLog = { ...prev.medLog }
        if (newLog[d]) { newLog[d] = { ...newLog[d] }; delete newLog[d][key] }
        return { ...prev, medLog: newLog }
      })
      await supabase.from('med_logs').delete().match({ ...fq(), date: d, med_key: key })
      logActivity('med', `Unmarked ${med.name} (${formatTime12(time)}) \u2014 ${loggerName}`)
    } else {
      const givenAt = now24()
      setData(prev => {
        const newLog = { ...prev.medLog }
        if (!newLog[d]) newLog[d] = {}
        newLog[d] = { ...newLog[d], [key]: { givenAt, givenBy: loggerName } }
        return { ...prev, medLog: newLog }
      })
      await supabase.from('med_logs').upsert({ ...fq(), date: d, med_key: key, given_at: givenAt, given_by: loggerName })
      logActivity('med', `Gave ${med.name} ${med.dose} at ${formatTime12(givenAt)} \u2014 ${loggerName}`)
    }
  }

  async function resetMedsForDay() {
    setData(prev => ({ ...prev, medLog: { ...prev.medLog, [today()]: {} } }))
    await supabase.from('med_logs').delete().match({ ...fq(), date: today() })
  }

  // ==================== FEEDING ====================
  async function logFeed(feedTime, feedType, feedAmount, feedNotes) {
    const amount = parseFloat(feedAmount)
    if (!amount) return
    const time = feedTime || now24()
    const id = genId()
    const newFeed = { id, date: today(), time, type: feedType, amount, notes: feedNotes, loggedBy: loggerName }
    setData(prev => ({ ...prev, feeds: [newFeed, ...prev.feeds] }))
    await supabase.from('feeds').insert({ id, ...fq(), date: today(), time, type: feedType, amount, notes: feedNotes, logged_by: loggerName })
    logActivity('feed', `${feedType.charAt(0).toUpperCase() + feedType.slice(1)} feed: ${amount}mL at ${formatTime12(time)}${feedNotes ? ' \u2014 ' + feedNotes : ''} \u2014 ${loggerName}`)
  }

  async function deleteFeed(id) {
    setData(prev => ({ ...prev, feeds: prev.feeds.filter(f => f.id !== id) }))
    await supabase.from('feeds').delete().eq('id', id)
  }

  // ==================== WEIGHT ====================
  async function logWeight(weightDate, weightValue) {
    const value = parseFloat(weightValue)
    if (!value || value < 0.1 || value > 50) return
    const date = weightDate || today()
    setData(prev => {
      const newWeights = prev.weights.filter(w => w.date !== date)
      newWeights.push({ date, value })
      newWeights.sort((a, b) => a.date.localeCompare(b.date))
      return { ...prev, weights: newWeights }
    })
    await supabase.from('weights').upsert({ ...fq(), date, value, logged_by: loggerName })
    logActivity('weight', `Weight: ${value}kg on ${date} \u2014 ${loggerName}`)
  }

  async function deleteWeight(date) {
    setData(prev => ({ ...prev, weights: prev.weights.filter(w => w.date !== date) }))
    await supabase.from('weights').delete().match({ ...fq(), date })
  }

  // ==================== NOTES ====================
  async function addNote(noteText) {
    if (!noteText.trim()) return
    const id = genId()
    const time = now24()
    const newNote = { id, date: today(), time, text: noteText.trim(), loggedBy: loggerName, timestamp: new Date().toISOString() }
    setData(prev => ({ ...prev, notes: [newNote, ...prev.notes] }))
    await supabase.from('notes').insert({ id, ...fq(), date: today(), time, text: noteText.trim(), logged_by: loggerName })
    logActivity('note', `Note: ${noteText.trim().substring(0, 60)}${noteText.length > 60 ? '...' : ''} \u2014 ${loggerName}`)
  }

  async function deleteNote(id) {
    setData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }))
    await supabase.from('notes').delete().eq('id', id)
  }

  // ==================== CUSTOM TRACKERS ====================
  async function addTracker(name, icon, unit, type) {
    const id = genId()
    const newTracker = { id, name: name.trim(), icon: icon || '\uD83D\uDCDD', unit, type }
    setData(prev => ({ ...prev, trackers: [...prev.trackers, newTracker] }))
    await supabase.from('trackers').insert({ id, ...fq(), name: name.trim(), icon: icon || '\uD83D\uDCDD', unit, type })
  }

  async function deleteTracker(id) {
    setData(prev => ({
      ...prev,
      trackers: prev.trackers.filter(t => t.id !== id),
      trackerLogs: prev.trackerLogs.filter(l => l.trackerId !== id)
    }))
    await supabase.from('trackers').delete().eq('id', id)
  }

  async function logTrackerEntry(trackerId, time, value, notes) {
    const tracker = data.trackers.find(t => t.id === trackerId)
    if (!tracker) return
    const logId = genId()
    const t = time || now24()
    const newLog = { id: logId, trackerId, date: today(), time: t, value, notes }
    setData(prev => ({ ...prev, trackerLogs: [...prev.trackerLogs, newLog] }))
    await supabase.from('tracker_logs').insert({ id: logId, ...fq(), tracker_id: trackerId, date: today(), time: t, value, notes, logged_by: loggerName })
    logActivity('tracker', `${tracker.icon} ${tracker.name}: ${value}${tracker.unit || ''}${notes ? ' \u2014 ' + notes : ''} \u2014 ${loggerName}`)
  }

  // ==================== MEDICATIONS SETTINGS ====================
  async function saveMedication(medData) {
    const { id: medId, name, purpose, dose, category, times, instructions } = medData
    if (medId) {
      setData(prev => ({
        ...prev,
        medications: prev.medications.map(m => m.id === medId
          ? { ...m, name, purpose, dose, category, times, instructions }
          : m
        )
      }))
      const { error } = await supabase.from('medications').update({
        name, purpose, dose, category, times, instructions
      }).eq('id', medId)
      if (error) { loadMedications(); throw error }
    } else {
      const id = genId()
      const newMed = { id, name, purpose, dose, category, times, instructions }
      setData(prev => ({ ...prev, medications: [...prev.medications, newMed] }))
      const { error } = await supabase.from('medications').insert({
        id, ...fq(), name, purpose, dose, category, times, instructions, active: true
      })
      if (error) { loadMedications(); throw error }
    }
  }

  async function deleteMedication(id) {
    setData(prev => ({ ...prev, medications: prev.medications.filter(m => m.id !== id) }))
    await supabase.from('medications').update({ active: false }).eq('id', id)
  }

  async function toggleSetting(key) {
    const dbKey = key === 'medAlarms' ? 'med_alarms' : key === 'feedAlarms' ? 'feed_alarms' : 'sound_alerts'
    const newValue = !data.settings[key]
    setData(prev => ({ ...prev, settings: { ...prev.settings, [key]: newValue } }))
    await supabase.from('settings').update({ [dbKey]: newValue })
      .match({ family_id: familyId, child_id: childId })
  }

  // ==================== COMPUTED VALUES ====================
  function getTimeSlots() {
    const slots = {}
    data.medications.forEach(med => {
      med.times.forEach(t => {
        if (!slots[t]) slots[t] = []
        slots[t].push(med)
      })
    })
    return slots
  }

  function getNextMed() {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    let nextMed = null, nextTime = null, nextMinDiff = Infinity
    data.medications.forEach(med => {
      med.times.forEach(t => {
        if (!isMedGiven(med.id, t)) {
          const [h, m] = t.split(':').map(Number)
          let diff = (h * 60 + m) - nowMin
          if (diff < -30) diff += 1440
          if (diff < nextMinDiff) {
            nextMinDiff = diff
            nextMed = med
            nextTime = t
          }
        }
      })
    })
    return { nextMed, nextTime }
  }

  function getMedStats() {
    let total = 0, done = 0
    data.medications.forEach(med => {
      med.times.forEach(t => {
        total++
        if (isMedGiven(med.id, t)) done++
      })
    })
    return { total, done }
  }

  function getTodayFeeds() {
    return data.feeds.filter(f => f.date === today()).sort((a, b) => a.time.localeCompare(b.time))
  }

  function getLatestWeight() {
    return data.weights.length > 0 ? data.weights[data.weights.length - 1] : null
  }

  function getTodayNotes() {
    return (data.notes || []).filter(n => n.date === today()).sort((a, b) => b.time.localeCompare(a.time))
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `little-legend-${activeChild?.name || 'data'}-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TrackerContext.Provider value={{
      data, loading, loggerName,
      // Med operations
      isMedGiven, toggleMed, resetMedsForDay, saveMedication, deleteMedication,
      // Feed operations
      logFeed, deleteFeed,
      // Weight operations
      logWeight, deleteWeight,
      // Note operations
      addNote, deleteNote,
      // Tracker operations
      addTracker, deleteTracker, logTrackerEntry,
      // Settings
      toggleSetting,
      // Activity
      logActivity,
      // Computed
      getTimeSlots, getNextMed, getMedStats, getTodayFeeds, getLatestWeight, getTodayNotes,
      // Export
      exportData,
    }}>
      {children}
    </TrackerContext.Provider>
  )
}

const EMPTY_TRACKER = {
  loading: true,
  data: { medications: [], medLog: {}, feeds: [], weights: [], trackers: [], trackerLogs: [], notes: [], settings: { medAlarms: false, feedAlarms: false, soundAlerts: false }, activityLog: [] },
  loggerName: '',
  isMedGiven: () => false,
  toggleSetting: () => {},
  saveMedication: async () => {},
  deleteMedication: async () => {},
  logMed: async () => {},
  unlogMed: async () => {},
  addFeed: async () => {},
  deleteFeed: async () => {},
  addWeight: async () => {},
  addNote: async () => {},
  deleteNote: async () => {},
  saveTracker: async () => {},
  deleteTracker: async () => {},
  logTrackerEntry: async () => {},
  deleteTrackerLog: async () => {},
  logActivity: async () => {},
  getTimeSlots: () => [],
  getNextMed: () => null,
  getMedStats: () => ({ total: 0, given: 0, missed: 0 }),
  getTodayFeeds: () => [],
  getLatestWeight: () => null,
  getTodayNotes: () => [],
  exportData: () => {},
}

export function useTracker() {
  const ctx = useContext(TrackerContext)
  return ctx || EMPTY_TRACKER
}
