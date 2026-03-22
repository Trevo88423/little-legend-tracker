const VALID_CATEGORIES = ['heart', 'diuretic', 'stomach', 'blood', 'other']
const VALID_TRACKER_TYPES = ['number', 'counter', 'note']
const VALID_FEED_TYPES = ['bottle', 'tube', 'breast']
const VALID_SUPPLY_UNITS = ['mL', 'tablets', 'capsules', 'doses', 'puffs']
const VALID_CONTACT_ROLES = ['Cardiologist', 'Paediatrician', 'GP', 'Surgeon', 'Pharmacy', 'Hospital', 'Therapist', 'Nurse', 'Dietitian', 'Other']
const TIME_RE = /^\d{2}:\d{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function stripFences(text) {
  let s = text.trim()
  // Remove ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  return s.trim()
}

function validateTime(t) {
  if (!TIME_RE.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function normalizeCategory(cat) {
  if (!cat) return 'other'
  const lower = cat.toLowerCase().trim()
  return VALID_CATEGORIES.includes(lower) ? lower : 'other'
}

function normalizeTrackerType(type) {
  if (!type) return 'number'
  const lower = type.toLowerCase().trim()
  // Map common AI output variations
  if (lower === 'value') return 'number'
  if (lower === 'text') return 'note'
  return VALID_TRACKER_TYPES.includes(lower) ? lower : 'number'
}

function normalizeFeedType(type) {
  if (!type) return 'bottle'
  const lower = type.toLowerCase().trim()
  return VALID_FEED_TYPES.includes(lower) ? lower : 'bottle'
}

function normalizeSupplyUnit(unit) {
  if (!unit) return 'mL'
  const lower = unit.toLowerCase().trim()
  const map = { 'ml': 'mL', 'tablet': 'tablets', 'capsule': 'capsules', 'dose': 'doses', 'puff': 'puffs' }
  if (map[lower]) return map[lower]
  return VALID_SUPPLY_UNITS.find(u => u.toLowerCase() === lower) || 'mL'
}

function optionalPositiveNumber(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return !isNaN(n) && n >= 0 ? n : null
}

function optionalPositiveInt(val) {
  if (val == null || val === '') return null
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= 0 ? n : null
}

function optionalDate(val) {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  return DATE_RE.test(trimmed) ? trimmed : null
}

// Detect if JSON is an exported backup (vs AI setup data)
function isBackupFile(parsed) {
  // Backup files have medLog as an object keyed by dates, or feeds with date/time fields
  if (parsed.medLog && typeof parsed.medLog === 'object' && !Array.isArray(parsed.medLog)) {
    return true
  }
  if (Array.isArray(parsed.feeds) && parsed.feeds.length > 0 && parsed.feeds[0].date && parsed.feeds[0].time) {
    return true
  }
  if (Array.isArray(parsed.activityLog) && parsed.activityLog.length > 0) {
    return true
  }
  return false
}

function extractHistory(parsed) {
  const history = { medLog: {}, feeds: [], notes: [], trackerLogs: [], settings: null, activityLog: [] }

  // Extract medLog: { "2026-03-19": { "medId_08:00": { givenAt, givenBy } } }
  if (parsed.medLog && typeof parsed.medLog === 'object') {
    for (const [date, entries] of Object.entries(parsed.medLog)) {
      if (!DATE_RE.test(date) || typeof entries !== 'object') continue
      history.medLog[date] = {}
      for (const [medKey, entry] of Object.entries(entries)) {
        if (!medKey || typeof entry !== 'object') continue
        history.medLog[date][medKey] = {
          givenAt: entry.givenAt || null,
          givenBy: entry.givenBy || null,
        }
      }
    }
  }

  // Extract feeds: [{ id, date, time, type, amount, notes, loggedBy }]
  if (Array.isArray(parsed.feeds)) {
    for (const f of parsed.feeds) {
      if (!f.date || !f.time) continue
      const amount = parseFloat(f.amount)
      if (!amount || amount <= 0) continue
      const type = VALID_FEED_TYPES.includes(f.type) ? f.type : 'bottle'
      history.feeds.push({
        id: f.id || null,
        date: f.date,
        time: f.time,
        type,
        amount,
        notes: f.notes || null,
        loggedBy: f.loggedBy || null,
      })
    }
  }

  // Extract notes with timestamps: [{ id, date, time, text, loggedBy }]
  if (Array.isArray(parsed.notes)) {
    for (const n of parsed.notes) {
      if (typeof n !== 'object' || !n.date || !n.time || !n.text) continue
      history.notes.push({
        id: n.id || null,
        date: n.date,
        time: n.time,
        text: n.text,
        loggedBy: n.loggedBy || null,
      })
    }
  }

  // Extract trackerLogs: [{ id, trackerId, date, time, value, notes }]
  if (Array.isArray(parsed.trackerLogs)) {
    for (const tl of parsed.trackerLogs) {
      if (!tl.trackerId || !tl.date || !tl.time) continue
      history.trackerLogs.push({
        id: tl.id || null,
        trackerId: tl.trackerId,
        date: tl.date,
        time: tl.time,
        value: tl.value != null ? String(tl.value) : null,
        notes: tl.notes || null,
      })
    }
  }

  // Extract settings
  if (parsed.settings && typeof parsed.settings === 'object') {
    history.settings = {
      medAlarms: !!parsed.settings.medAlarms,
      feedAlarms: !!parsed.settings.feedAlarms,
      soundAlerts: !!parsed.settings.soundAlerts,
    }
  }

  // Extract activityLog: [{ timestamp, type, message }]
  if (Array.isArray(parsed.activityLog)) {
    for (const a of parsed.activityLog) {
      if (!a.type || !a.message) continue
      history.activityLog.push({
        timestamp: a.timestamp || new Date().toISOString(),
        type: a.type,
        message: a.message,
      })
    }
  }

  return history
}

function historyCount(history) {
  let count = 0
  count += Object.values(history.medLog).reduce((sum, entries) => sum + Object.keys(entries).length, 0)
  count += history.feeds.length
  count += history.notes.length
  count += history.trackerLogs.length
  count += history.activityLog.length
  if (history.settings) count++
  return count
}

export function validateImport(rawText) {
  const errors = []

  if (!rawText || !rawText.trim()) {
    return { valid: false, errors: ['No data provided. Paste the JSON from the AI chatbot.'], data: null }
  }

  const stripped = stripFences(rawText)

  let parsed
  try {
    parsed = JSON.parse(stripped)
  } catch (e) {
    return {
      valid: false,
      errors: ['Invalid JSON format. Make sure you copied the entire response from the AI chatbot. If it included extra text, ask the AI to "output only the JSON, nothing else".'],
      data: null
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, errors: ['Expected a JSON object with medications, trackers, etc.'], data: null }
  }

  const backup = isBackupFile(parsed)

  const result = {
    babyName: parsed.baby_name || parsed.babyName || null,
    isBackup: backup,
    medications: [],
    trackers: [],
    weights: [],
    feedSchedule: null,
    feedPlan: null,
    contacts: [],
    notes: [],
    history: null,
  }

  // Validate medications
  const meds = parsed.medications || []
  if (!Array.isArray(meds)) {
    errors.push('medications should be an array')
  } else {
    meds.forEach((med, i) => {
      if (!med.name || !med.name.trim()) {
        errors.push(`Medication #${i + 1}: missing name`)
        return
      }
      const times = med.times || []
      if (!Array.isArray(times)) {
        errors.push(`${med.name}: times should be an array`)
        return
      }
      // Empty times array is valid for PRN / as-needed meds
      const validTimes = []
      times.forEach(t => {
        if (validateTime(t)) {
          validTimes.push(t)
        } else {
          errors.push(`${med.name}: invalid time "${t}" (use HH:MM format)`)
        }
      })
      if (times.length > 0 && validTimes.length === 0) return

      const doseAmount = optionalPositiveNumber(med.dose_amount || med.doseAmount)
      const supplyRemaining = optionalPositiveNumber(med.supply_remaining || med.supplyRemaining)
      const supplyTotal = optionalPositiveNumber(med.supply_total || med.supplyTotal)

      result.medications.push({
        id: med.id || null,
        name: med.name.trim(),
        dose: (med.dose || '').trim(),
        purpose: (med.purpose || '').trim(),
        category: normalizeCategory(med.category),
        times: validTimes,
        instructions: (med.instructions || '').trim(),
        doseAmount,
        supplyUnit: normalizeSupplyUnit(med.supply_unit || med.supplyUnit),
        supplyRemaining: supplyRemaining != null ? supplyRemaining : supplyTotal,
        supplyTotal,
        refillsRemaining: optionalPositiveInt(med.refills_remaining || med.refillsRemaining),
        prescriptionSource: (med.prescription_source || med.prescriptionSource || '').trim() || null,
        expiryDate: optionalDate(med.expiry_date || med.expiryDate),
        openedDate: optionalDate(med.opened_date || med.openedDate),
        daysAfterOpening: optionalPositiveInt(med.days_after_opening || med.daysAfterOpening),
        lowSupplyDays: optionalPositiveInt(med.low_supply_days || med.lowSupplyDays) ?? 3,
      })
    })
  }

  // Validate trackers (preserve id for backup mode)
  const trackers = parsed.trackers || []
  if (Array.isArray(trackers)) {
    trackers.forEach((t, i) => {
      if (!t.name || !t.name.trim()) {
        errors.push(`Tracker #${i + 1}: missing name`)
        return
      }
      result.trackers.push({
        id: backup ? (t.id || null) : undefined,
        name: t.name.trim(),
        icon: (t.icon || '').trim() || null,
        unit: (t.unit || '').trim() || null,
        type: normalizeTrackerType(t.type)
      })
    })
  }

  // Validate weights
  const weights = parsed.weights || []
  if (Array.isArray(weights)) {
    weights.forEach((w, i) => {
      const val = parseFloat(w.value)
      if (!val || val < 0.1 || val > 50) {
        errors.push(`Weight #${i + 1}: invalid value (must be 0.1-50 kg)`)
        return
      }
      result.weights.push({
        date: w.date || null,
        value: val
      })
    })
  }

  // Validate feed schedule
  const feedSchedule = parsed.feed_schedule || parsed.feedSchedule || null
  if (feedSchedule && typeof feedSchedule === 'object') {
    const times = feedSchedule.times || []
    if (Array.isArray(times) && times.length > 0) {
      const validTimes = []
      times.forEach(t => {
        if (validateTime(t)) {
          validTimes.push(t)
        } else {
          errors.push(`Feed schedule: invalid time "${t}" (use HH:MM format)`)
        }
      })
      if (validTimes.length > 0) {
        result.feedSchedule = {
          times: validTimes,
          targetAmount: parseFloat(feedSchedule.target_amount || feedSchedule.targetAmount) || 0,
          feedType: normalizeFeedType(feedSchedule.feed_type || feedSchedule.feedType)
        }
      }
    }
  }

  // Feed plan as note (only for non-backup)
  if (!backup) {
    const feedPlan = parsed.feed_plan || parsed.feedPlan || null
    if (feedPlan && typeof feedPlan === 'object') {
      const parts = []
      if (feedPlan.type) parts.push(`Type: ${feedPlan.type}`)
      if (feedPlan.amount) parts.push(`Amount: ${feedPlan.amount}`)
      if (feedPlan.frequency) parts.push(`Frequency: ${feedPlan.frequency}`)
      if (feedPlan.instructions) parts.push(`Instructions: ${feedPlan.instructions}`)
      if (feedPlan.schedule && Array.isArray(feedPlan.schedule)) {
        parts.push(`Schedule: ${feedPlan.schedule.join(', ')}`)
      }
      if (parts.length > 0) {
        result.feedPlan = `FEEDING PLAN (from discharge papers)\n${parts.join('\n')}`
      }
    } else if (typeof feedPlan === 'string' && feedPlan.trim()) {
      result.feedPlan = `FEEDING PLAN (from discharge papers)\n${feedPlan.trim()}`
    }
  }

  // Validate contacts
  const contacts = parsed.contacts || []
  if (Array.isArray(contacts)) {
    contacts.forEach((c, i) => {
      if (!c.name || !c.name.trim()) {
        errors.push(`Contact #${i + 1}: missing name`)
        return
      }
      const role = c.role ? VALID_CONTACT_ROLES.find(r => r.toLowerCase() === c.role.toLowerCase().trim()) || 'Other' : 'Other'
      result.contacts.push({
        name: c.name.trim(),
        role,
        phone: (c.phone || '').trim() || null,
        email: (c.email || '').trim() || null,
        location: (c.location || '').trim() || null,
        notes: (c.notes || '').trim() || null,
      })
    })
  }

  // Notes — for backups, historical notes go into history.notes; for AI setup, flatten to strings
  const notes = parsed.notes || []
  if (Array.isArray(notes) && !backup) {
    notes.forEach(n => {
      const text = typeof n === 'string' ? n : (n.text || n.content || '')
      if (text.trim()) {
        result.notes.push(text.trim())
      }
    })
  }

  // Extract history for backup files
  if (backup) {
    result.history = extractHistory(parsed)
  }

  const histCount = result.history ? historyCount(result.history) : 0
  const hasData = result.medications.length > 0 || result.trackers.length > 0 ||
    result.weights.length > 0 || result.feedSchedule || result.feedPlan || result.contacts.length > 0 ||
    result.notes.length > 0 || histCount > 0

  if (!hasData && errors.length === 0) {
    errors.push('No medications, trackers, weights, contacts, or notes found in the JSON. Make sure the AI formatted its response correctly.')
  }

  return {
    valid: errors.length === 0 && hasData,
    errors,
    data: hasData ? result : null
  }
}
