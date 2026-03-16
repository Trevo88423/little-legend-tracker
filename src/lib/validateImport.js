const VALID_CATEGORIES = ['heart', 'diuretic', 'stomach', 'blood', 'other']
const VALID_TRACKER_TYPES = ['number', 'counter', 'note']
const VALID_FEED_TYPES = ['bottle', 'tube', 'breast']
const TIME_RE = /^\d{2}:\d{2}$/

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

  const result = {
    babyName: parsed.baby_name || parsed.babyName || null,
    medications: [],
    trackers: [],
    weights: [],
    feedPlan: null,
    notes: []
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

      result.medications.push({
        name: med.name.trim(),
        dose: (med.dose || '').trim(),
        purpose: (med.purpose || '').trim(),
        category: normalizeCategory(med.category),
        times: validTimes,
        instructions: (med.instructions || '').trim()
      })
    })
  }

  // Validate trackers
  const trackers = parsed.trackers || []
  if (Array.isArray(trackers)) {
    trackers.forEach((t, i) => {
      if (!t.name || !t.name.trim()) {
        errors.push(`Tracker #${i + 1}: missing name`)
        return
      }
      result.trackers.push({
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

  // Feed plan as note
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

  // Notes
  const notes = parsed.notes || []
  if (Array.isArray(notes)) {
    notes.forEach(n => {
      const text = typeof n === 'string' ? n : (n.text || n.content || '')
      if (text.trim()) {
        result.notes.push(text.trim())
      }
    })
  }

  const hasData = result.medications.length > 0 || result.trackers.length > 0 ||
    result.weights.length > 0 || result.feedPlan || result.notes.length > 0

  if (!hasData && errors.length === 0) {
    errors.push('No medications, trackers, weights, or notes found in the JSON. Make sure the AI formatted its response correctly.')
  }

  return {
    valid: errors.length === 0 && hasData,
    errors,
    data: hasData ? result : null
  }
}
