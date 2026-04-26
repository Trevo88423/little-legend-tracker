import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useFamily } from './FamilyContext'
import { today, now24, formatTime12 } from '../lib/dateUtils'
import { genId } from '../lib/idUtils'
import {
  dbToMedication, dbToFeed, dbToWeight, dbToNote, dbToTracker, dbToTrackerLog,
  dbToContact, dbToFeedSchedule, dbToSettings, dbToActivityLog,
  applyRowDelta, applyMedLogDelta, medLogsToMap,
  sortByName, sortByDateDescTimeDesc, sortByDateAsc, sortByCreatedAtDesc, sortByTimestampDesc,
} from '../lib/realtimeUtils'

const TrackerContext = createContext(null)

export function TrackerProvider({ children }) {
  const { family, activeChild, currentMember } = useFamily()
  const [loading, setLoading] = useState(true)

  const [data, setData] = useState({
    medications: [],
    medLog: {},
    feeds: [],
    feedSchedule: null,
    weights: [],
    trackers: [],
    trackerLogs: [],
    notes: [],
    contacts: [],
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

    // Realtime: apply each payload directly to local state instead of
    // refetching the whole table. ~80% reduction in select queries.
    const sub = (table) => ({ event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` })

    const channel = supabase.channel(`tracker-${familyId}-${childId}`)
      .on('postgres_changes', sub('medications'), (payload) => {
        setData(prev => ({
          ...prev,
          medications: applyRowDelta({
            list: prev.medications, payload, childId,
            transform: dbToMedication,
            isVisible: row => row.active === true, // soft-delete via active=false
            sortFn: sortByName,
          })
        }))
      })
      .on('postgres_changes', sub('med_logs'), (payload) => {
        setData(prev => ({ ...prev, medLog: applyMedLogDelta(prev.medLog, payload, childId) }))
      })
      .on('postgres_changes', sub('feeds'), (payload) => {
        setData(prev => ({
          ...prev,
          feeds: applyRowDelta({
            list: prev.feeds, payload, childId,
            transform: dbToFeed,
            sortFn: sortByDateDescTimeDesc,
          })
        }))
      })
      .on('postgres_changes', sub('feed_schedules'), (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload
        const relevant = eventType === 'DELETE' ? oldRow : newRow
        if (childId && relevant?.child_id !== undefined && relevant.child_id !== childId) return
        setData(prev => ({
          ...prev,
          feedSchedule: eventType === 'DELETE' ? null : dbToFeedSchedule(newRow)
        }))
      })
      .on('postgres_changes', sub('weights'), (payload) => {
        // Weights local shape is keyed by `date` (no id field). The DB has a surrogate
        // `id` primary key, so DELETE realtime payloads only contain {id} — no date —
        // which means we can't locate the row in local state on DELETE. Fall back to a
        // single loadWeights() in that case. INSERT/UPDATE work fine via the new row.
        const { eventType, new: newRow } = payload
        if (eventType === 'DELETE') { loadWeights(); return }
        if (childId && newRow?.child_id !== undefined && newRow.child_id !== childId) return
        setData(prev => {
          const w = dbToWeight(newRow)
          const idx = prev.weights.findIndex(x => x.date === w.date)
          let weights
          if (idx >= 0) {
            weights = prev.weights.slice()
            weights[idx] = w
          } else {
            weights = [...prev.weights, w].sort(sortByDateAsc)
          }
          return { ...prev, weights }
        })
      })
      .on('postgres_changes', sub('notes'), (payload) => {
        setData(prev => ({
          ...prev,
          notes: applyRowDelta({
            list: prev.notes, payload, childId,
            transform: dbToNote,
            sortFn: sortByCreatedAtDesc,
          })
        }))
      })
      .on('postgres_changes', sub('trackers'), (payload) => {
        setData(prev => ({
          ...prev,
          trackers: applyRowDelta({
            list: prev.trackers, payload, childId,
            transform: dbToTracker,
          })
        }))
      })
      .on('postgres_changes', sub('tracker_logs'), (payload) => {
        setData(prev => ({
          ...prev,
          trackerLogs: applyRowDelta({
            list: prev.trackerLogs, payload, childId,
            transform: dbToTrackerLog,
          })
        }))
      })
      .on('postgres_changes', sub('contacts'), (payload) => {
        setData(prev => ({
          ...prev,
          contacts: applyRowDelta({
            list: prev.contacts, payload, childId,
            transform: dbToContact,
            sortFn: sortByName,
          })
        }))
      })
      .on('postgres_changes', sub('settings'), (payload) => {
        const { eventType, new: newRow } = payload
        if (eventType === 'DELETE') return
        if (childId && newRow?.child_id !== childId) return
        setData(prev => ({ ...prev, settings: dbToSettings(newRow) }))
      })
      .on('postgres_changes', sub('activity_log'), (payload) => {
        setData(prev => ({
          ...prev,
          activityLog: applyRowDelta({
            list: prev.activityLog, payload, childId,
            transform: dbToActivityLog,
            sortFn: sortByTimestampDesc,
            limit: 200,
          })
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [familyId, childId])

  const fq = useCallback(() => ({ family_id: familyId, child_id: childId }), [familyId, childId])

  async function loadAllData() {
    setLoading(true)
    try {
      // Single RPC returns all 11 collections as one JSONB blob — replaces
      // 11 separate selects on every mount. RLS on each underlying table
      // still enforces row-level access (function uses SECURITY INVOKER).
      const { data: snapshot, error } = await supabase.rpc('get_tracker_snapshot', {
        p_family_id: familyId,
        p_child_id: childId,
      })
      if (error) {
        // Fall back to individual loads if the RPC isn't available
        // (e.g., migration 016 not yet applied in this environment).
        console.warn('get_tracker_snapshot RPC failed, falling back to per-table loads:', error.message)
        await Promise.all([
          loadMedications(), loadMedLogs(), loadFeeds(), loadFeedSchedule(), loadWeights(),
          loadNotes(), loadTrackers(), loadTrackerLogs(), loadContacts(), loadSettings(), loadActivityLog(),
        ])
        return
      }
      if (!snapshot) return
      setData(prev => ({
        ...prev,
        medications: (snapshot.medications || []).map(dbToMedication),
        medLog: medLogsToMap(snapshot.med_logs),
        feeds: (snapshot.feeds || []).map(dbToFeed),
        feedSchedule: snapshot.feed_schedule ? dbToFeedSchedule(snapshot.feed_schedule) : null,
        weights: (snapshot.weights || []).map(dbToWeight),
        notes: (snapshot.notes || []).map(dbToNote),
        trackers: (snapshot.trackers || []).map(dbToTracker),
        trackerLogs: (snapshot.tracker_logs || []).map(dbToTrackerLog),
        contacts: (snapshot.contacts || []).map(dbToContact),
        settings: snapshot.settings ? dbToSettings(snapshot.settings) : prev.settings,
        activityLog: (snapshot.activity_log || []).map(dbToActivityLog),
      }))
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMedications() {
    const { data: rows } = await supabase.from('medications').select('*')
      .eq('family_id', familyId).eq('child_id', childId).eq('active', true).order('name')
    setData(prev => ({ ...prev, medications: (rows || []).map(dbToMedication) }))
  }

  async function loadMedLogs() {
    const { data: rows } = await supabase.from('med_logs').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    setData(prev => ({ ...prev, medLog: medLogsToMap(rows) }))
  }

  async function loadFeeds() {
    const { data: rows } = await supabase.from('feeds').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('date', { ascending: false }).order('time', { ascending: false })
    setData(prev => ({ ...prev, feeds: (rows || []).map(dbToFeed) }))
  }

  async function loadFeedSchedule() {
    const { data: row } = await supabase.from('feed_schedules').select('*')
      .eq('family_id', familyId).eq('child_id', childId).maybeSingle()
    setData(prev => ({ ...prev, feedSchedule: row ? dbToFeedSchedule(row) : null }))
  }

  async function loadWeights() {
    const { data: rows } = await supabase.from('weights').select('*')
      .eq('family_id', familyId).eq('child_id', childId).order('date')
    setData(prev => ({ ...prev, weights: (rows || []).map(dbToWeight) }))
  }

  async function loadNotes() {
    const { data: rows } = await supabase.from('notes').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('created_at', { ascending: false })
    setData(prev => ({ ...prev, notes: (rows || []).map(dbToNote) }))
  }

  async function loadTrackers() {
    const { data: rows } = await supabase.from('trackers').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    setData(prev => ({ ...prev, trackers: (rows || []).map(dbToTracker) }))
  }

  async function loadTrackerLogs() {
    const { data: rows } = await supabase.from('tracker_logs').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
    setData(prev => ({ ...prev, trackerLogs: (rows || []).map(dbToTrackerLog) }))
  }

  async function loadContacts() {
    const { data: rows } = await supabase.from('contacts').select('*')
      .eq('family_id', familyId).eq('child_id', childId).order('name')
    setData(prev => ({ ...prev, contacts: (rows || []).map(dbToContact) }))
  }

  async function loadSettings() {
    const { data: row } = await supabase.from('settings').select('*')
      .eq('family_id', familyId).eq('child_id', childId).single()
    if (row) setData(prev => ({ ...prev, settings: dbToSettings(row) }))
  }

  async function loadActivityLog() {
    const { data: rows } = await supabase.from('activity_log').select('*')
      .eq('family_id', familyId).eq('child_id', childId)
      .order('timestamp', { ascending: false }).limit(200)
    setData(prev => ({ ...prev, activityLog: (rows || []).map(dbToActivityLog) }))
  }

  // ==================== ACTIVITY LOGGING ====================
  function logActivity(type, message) {
    // Generate the id client-side so the optimistic local entry and the
    // realtime echo (when it arrives) share an id and dedupe via applyRowDelta.
    const id = genId()
    const timestamp = new Date().toISOString()
    const entry = { id, timestamp, type, message }
    setData(prev => ({
      ...prev,
      activityLog: [entry, ...prev.activityLog].slice(0, 200)
    }))
    supabase.from('activity_log').insert({ id, ...fq(), type, message, timestamp }).then()
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
      // Un-give: increment supply back
      setData(prev => {
        const newLog = { ...prev.medLog }
        if (newLog[d]) { newLog[d] = { ...newLog[d] }; delete newLog[d][key] }
        const medications = med.doseAmount != null && med.supplyRemaining != null
          ? prev.medications.map(m => m.id === medId ? { ...m, supplyRemaining: m.supplyRemaining + m.doseAmount } : m)
          : prev.medications
        return { ...prev, medLog: newLog, medications }
      })
      await supabase.from('med_logs').delete().match({ ...fq(), date: d, med_key: key })
      if (med.doseAmount != null && med.supplyRemaining != null) {
        await supabase.from('medications').update({ supply_remaining: med.supplyRemaining + med.doseAmount }).eq('id', medId)
      }
      logActivity('med', `Unmarked ${med.name} (${formatTime12(time)}) \u2014 ${loggerName}`)
    } else {
      // Give: decrement supply
      const givenAt = now24()
      setData(prev => {
        const newLog = { ...prev.medLog }
        if (!newLog[d]) newLog[d] = {}
        newLog[d] = { ...newLog[d], [key]: { givenAt, givenBy: loggerName } }
        const medications = med.doseAmount != null && med.supplyRemaining != null
          ? prev.medications.map(m => m.id === medId ? { ...m, supplyRemaining: Math.max(0, m.supplyRemaining - m.doseAmount) } : m)
          : prev.medications
        return { ...prev, medLog: newLog, medications }
      })
      await supabase.from('med_logs').upsert({ ...fq(), date: d, med_key: key, given_at: givenAt, given_by: loggerName })
      if (med.doseAmount != null && med.supplyRemaining != null) {
        await supabase.from('medications').update({ supply_remaining: Math.max(0, med.supplyRemaining - med.doseAmount) }).eq('id', medId)
      }
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

  // ==================== FEED SCHEDULE ====================
  async function saveFeedSchedule(scheduleData) {
    const { times, targetAmount, feedType } = scheduleData
    const existing = data.feedSchedule
    const id = existing?.id || genId()
    const local = { id, times: [...times].sort(), targetAmount, feedType: feedType || 'bottle' }
    setData(prev => ({ ...prev, feedSchedule: local }))
    await supabase.from('feed_schedules').upsert({
      id, ...fq(), times: local.times, target_amount: targetAmount, feed_type: local.feedType
    })
    logActivity('feed', `${existing ? 'Updated' : 'Created'} feed schedule: ${times.length} feeds/day, ${targetAmount}mL target — ${loggerName}`)
  }

  async function deleteFeedSchedule() {
    const id = data.feedSchedule?.id
    if (!id) return
    setData(prev => ({ ...prev, feedSchedule: null }))
    await supabase.from('feed_schedules').delete().eq('id', id)
    logActivity('feed', `Deleted feed schedule — ${loggerName}`)
  }

  function isFeedDone(scheduledTime) {
    const feeds = getTodayFeeds()
    // Exact match first
    if (feeds.some(f => f.time === scheduledTime)) return true
    // Fuzzy match: feed logged within ±15 minutes of scheduled time
    const [sh, sm] = scheduledTime.split(':').map(Number)
    const schedMins = sh * 60 + sm
    return feeds.some(f => {
      const [fh, fm] = f.time.split(':').map(Number)
      const feedMins = fh * 60 + fm
      return Math.abs(feedMins - schedMins) <= 15
    })
  }

  function getMatchingFeed(scheduledTime) {
    const feeds = getTodayFeeds()
    // Exact match first
    const exact = feeds.find(f => f.time === scheduledTime)
    if (exact) return exact
    // Fuzzy match: closest feed within ±15 minutes
    const [sh, sm] = scheduledTime.split(':').map(Number)
    const schedMins = sh * 60 + sm
    let best = null, bestDiff = Infinity
    for (const f of feeds) {
      const [fh, fm] = f.time.split(':').map(Number)
      const diff = Math.abs(fh * 60 + fm - schedMins)
      if (diff <= 15 && diff < bestDiff) { best = f; bestDiff = diff }
    }
    return best
  }

  function getFeedScheduleStats() {
    const schedule = data.feedSchedule
    if (!schedule) return { total: 0, done: 0 }
    const total = schedule.times.length
    const done = schedule.times.filter(t => isFeedDone(t)).length
    return { total, done }
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
    const { error } = await supabase.from('trackers').insert({ id, ...fq(), name: name.trim(), icon: icon || '\uD83D\uDCDD', unit, type })
    if (error) { loadTrackers(); throw error }
  }

  async function deleteTracker(id) {
    setData(prev => ({
      ...prev,
      trackers: prev.trackers.filter(t => t.id !== id),
      trackerLogs: prev.trackerLogs.filter(l => l.trackerId !== id)
    }))
    const { error } = await supabase.from('trackers').delete().eq('id', id)
    if (error) { loadTrackers(); loadTrackerLogs(); throw error }
  }

  async function logTrackerEntry(trackerId, time, value, notes) {
    const tracker = data.trackers.find(t => t.id === trackerId)
    if (!tracker) return
    const logId = genId()
    const t = time || now24()
    const newLog = { id: logId, trackerId, date: today(), time: t, value, notes }
    setData(prev => ({ ...prev, trackerLogs: [...prev.trackerLogs, newLog] }))
    const { error } = await supabase.from('tracker_logs').insert({ id: logId, ...fq(), tracker_id: trackerId, date: today(), time: t, value, notes, logged_by: loggerName })
    if (error) { loadTrackerLogs(); throw error }
    logActivity('tracker', `${tracker.icon} ${tracker.name}: ${value}${tracker.unit || ''}${notes ? ' \u2014 ' + notes : ''} \u2014 ${loggerName}`)
  }

  // ==================== CONTACTS ====================
  async function addContact(contactData) {
    const id = genId()
    const newContact = {
      id, name: contactData.name.trim(), role: contactData.role || 'Other',
      phone: contactData.phone?.trim() || null, email: contactData.email?.trim() || null,
      location: contactData.location?.trim() || null, notes: contactData.notes?.trim() || null,
    }
    setData(prev => ({ ...prev, contacts: [...prev.contacts, newContact].sort((a, b) => a.name.localeCompare(b.name)) }))
    await supabase.from('contacts').insert({
      id, ...fq(), name: newContact.name, role: newContact.role,
      phone: newContact.phone, email: newContact.email,
      location: newContact.location, notes: newContact.notes,
    })
    logActivity('contact', `Added contact: ${newContact.name} (${newContact.role}) — ${loggerName}`)
  }

  async function updateContact(id, contactData) {
    const updated = {
      name: contactData.name.trim(), role: contactData.role || 'Other',
      phone: contactData.phone?.trim() || null, email: contactData.email?.trim() || null,
      location: contactData.location?.trim() || null, notes: contactData.notes?.trim() || null,
    }
    setData(prev => ({
      ...prev,
      contacts: prev.contacts.map(c => c.id === id ? { ...c, ...updated } : c)
        .sort((a, b) => a.name.localeCompare(b.name))
    }))
    await supabase.from('contacts').update(updated).eq('id', id)
    logActivity('contact', `Updated contact: ${updated.name} — ${loggerName}`)
  }

  async function deleteContact(id) {
    const contact = data.contacts.find(c => c.id === id)
    setData(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }))
    await supabase.from('contacts').delete().eq('id', id)
    if (contact) logActivity('contact', `Deleted contact: ${contact.name} — ${loggerName}`)
  }

  // ==================== MEDICATIONS SETTINGS ====================
  async function saveMedication(medData) {
    const { id: medId, name, purpose, dose, category, times, instructions,
      supplyUnit, doseAmount, supplyRemaining, supplyTotal,
      refillsRemaining, prescriptionSource, expiryDate, openedDate,
      daysAfterOpening, lowSupplyDays } = medData
    const inventoryFields = {
      supplyUnit: supplyUnit || 'mL',
      doseAmount: doseAmount != null && doseAmount !== '' ? Number(doseAmount) : null,
      supplyRemaining: supplyRemaining != null && supplyRemaining !== '' ? Number(supplyRemaining) : null,
      supplyTotal: supplyTotal != null && supplyTotal !== '' ? Number(supplyTotal) : null,
      refillsRemaining: refillsRemaining != null && refillsRemaining !== '' ? Number(refillsRemaining) : null,
      prescriptionSource: prescriptionSource || null,
      expiryDate: expiryDate || null, openedDate: openedDate || null,
      daysAfterOpening: daysAfterOpening != null && daysAfterOpening !== '' ? Number(daysAfterOpening) : null,
      lowSupplyDays: lowSupplyDays != null && lowSupplyDays !== '' ? Number(lowSupplyDays) : 3,
    }
    const dbInventory = {
      supply_unit: inventoryFields.supplyUnit, dose_amount: inventoryFields.doseAmount,
      supply_remaining: inventoryFields.supplyRemaining, supply_total: inventoryFields.supplyTotal,
      refills_remaining: inventoryFields.refillsRemaining, prescription_source: inventoryFields.prescriptionSource,
      expiry_date: inventoryFields.expiryDate, opened_date: inventoryFields.openedDate,
      days_after_opening: inventoryFields.daysAfterOpening, low_supply_days: inventoryFields.lowSupplyDays,
    }
    if (medId) {
      setData(prev => ({
        ...prev,
        medications: prev.medications.map(m => m.id === medId
          ? { ...m, name, purpose, dose, category, times, instructions, ...inventoryFields }
          : m
        )
      }))
      const { error } = await supabase.from('medications').update({
        name, purpose, dose, category, times, instructions, ...dbInventory
      }).eq('id', medId)
      if (error) { loadMedications(); throw error }
    } else {
      const id = genId()
      const newMed = { id, name, purpose, dose, category, times, instructions, ...inventoryFields }
      setData(prev => ({ ...prev, medications: [...prev.medications, newMed] }))
      const { error } = await supabase.from('medications').insert({
        id, ...fq(), name, purpose, dose, category, times, instructions, ...dbInventory, active: true
      })
      if (error) { loadMedications(); throw error }
    }
  }

  async function openNewBottle(medId) {
    const med = data.medications.find(m => m.id === medId)
    if (!med || !med.supplyTotal) return
    const todayStr = today()
    setData(prev => ({
      ...prev,
      medications: prev.medications.map(m => m.id === medId ? {
        ...m, supplyRemaining: m.supplyTotal, openedDate: todayStr,
        refillsRemaining: m.refillsRemaining != null ? Math.max(0, m.refillsRemaining - 1) : null,
      } : m)
    }))
    const updates = { supply_remaining: med.supplyTotal, opened_date: todayStr }
    if (med.refillsRemaining != null) updates.refills_remaining = Math.max(0, med.refillsRemaining - 1)
    await supabase.from('medications').update(updates).eq('id', medId)
    logActivity('med', `Opened new ${med.supplyUnit || 'bottle'} of ${med.name} \u2014 ${loggerName}`)
  }

  function getMedSupplyInfo(medId) {
    const med = data.medications.find(m => m.id === medId)
    if (!med) return null
    const hasSupply = med.supplyRemaining != null && med.doseAmount != null
    const dosesRemaining = hasSupply ? med.supplyRemaining / med.doseAmount : null
    const timesPerDay = med.times?.length || 1
    const daysRemaining = hasSupply ? med.supplyRemaining / (med.doseAmount * timesPerDay) : null
    let effectiveExpiry = null
    if (med.expiryDate) effectiveExpiry = med.expiryDate
    if (med.openedDate && med.daysAfterOpening) {
      const opened = new Date(med.openedDate)
      opened.setDate(opened.getDate() + med.daysAfterOpening)
      const openedExpiry = opened.toISOString().split('T')[0]
      if (!effectiveExpiry || openedExpiry < effectiveExpiry) effectiveExpiry = openedExpiry
    }
    const todayStr = today()
    const daysUntilExpiry = effectiveExpiry ? Math.ceil((new Date(effectiveExpiry) - new Date(todayStr)) / 86400000) : null
    const isLow = daysRemaining != null && daysRemaining <= (med.lowSupplyDays ?? 3)
    const isExpiringSoon = daysUntilExpiry != null && daysUntilExpiry <= 7 && daysUntilExpiry > 0
    const isExpired = daysUntilExpiry != null && daysUntilExpiry <= 0
    return {
      supplyRemaining: med.supplyRemaining, supplyTotal: med.supplyTotal,
      supplyUnit: med.supplyUnit, doseAmount: med.doseAmount,
      dosesRemaining, daysRemaining, effectiveExpiry, daysUntilExpiry,
      isLow, isExpiringSoon, isExpired, refillsRemaining: med.refillsRemaining,
      prescriptionSource: med.prescriptionSource, hasSupply,
    }
  }

  function getMedsNeedingAttention() {
    return data.medications.filter(med => {
      const info = getMedSupplyInfo(med.id)
      return info && (info.isLow || info.isExpiringSoon || info.isExpired)
    }).map(med => ({ med, info: getMedSupplyInfo(med.id) }))
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
      isMedGiven, toggleMed, resetMedsForDay, saveMedication, deleteMedication, openNewBottle, getMedSupplyInfo, getMedsNeedingAttention,
      // Feed operations
      logFeed, deleteFeed, saveFeedSchedule, deleteFeedSchedule, isFeedDone, getMatchingFeed, getFeedScheduleStats,
      // Weight operations
      logWeight, deleteWeight,
      // Note operations
      addNote, deleteNote,
      // Tracker operations
      addTracker, deleteTracker, logTrackerEntry,
      // Contact operations
      addContact, updateContact, deleteContact,
      // Settings
      toggleSetting,
      // Activity
      logActivity,
      // Computed
      getTimeSlots, getNextMed, getMedStats, getTodayFeeds, getLatestWeight, getTodayNotes,
      // Export
      exportData,
      // Reload all data from DB
      reload: loadAllData,
    }}>
      {children}
    </TrackerContext.Provider>
  )
}

const EMPTY_TRACKER = {
  loading: true,
  data: { medications: [], medLog: {}, feeds: [], feedSchedule: null, weights: [], trackers: [], trackerLogs: [], notes: [], contacts: [], settings: { medAlarms: false, feedAlarms: false, soundAlerts: false }, activityLog: [] },
  loggerName: '',
  isMedGiven: () => false,
  toggleSetting: () => {},
  saveMedication: async () => {},
  deleteMedication: async () => {},
  openNewBottle: async () => {},
  getMedSupplyInfo: () => null,
  getMedsNeedingAttention: () => [],
  logMed: async () => {},
  unlogMed: async () => {},
  addFeed: async () => {},
  deleteFeed: async () => {},
  saveFeedSchedule: async () => {},
  deleteFeedSchedule: async () => {},
  isFeedDone: () => false,
  getMatchingFeed: () => null,
  getFeedScheduleStats: () => ({ total: 0, done: 0 }),
  addWeight: async () => {},
  addNote: async () => {},
  deleteNote: async () => {},
  saveTracker: async () => {},
  deleteTracker: async () => {},
  logTrackerEntry: async () => {},
  deleteTrackerLog: async () => {},
  addContact: async () => {},
  updateContact: async () => {},
  deleteContact: async () => {},
  logActivity: async () => {},
  getTimeSlots: () => [],
  getNextMed: () => null,
  getMedStats: () => ({ total: 0, given: 0, missed: 0 }),
  getTodayFeeds: () => [],
  getLatestWeight: () => null,
  getTodayNotes: () => [],
  exportData: () => {},
  reload: async () => {},
}

export function useTracker() {
  const ctx = useContext(TrackerContext)
  return ctx || EMPTY_TRACKER
}
