// Helpers for applying Supabase Realtime payloads as deltas to local state,
// instead of refetching the whole table on every change.
//
// - Row transformers convert DB snake_case rows into our local camelCase shape.
//   Used by both initial load (loadX in TrackerContext) and realtime handlers.
// - applyRowDelta() is the generic INSERT/UPDATE/DELETE applier for list-shaped
//   state. Special-shape tables (med_logs map, feed_schedules / settings
//   singletons) have their own handlers below.
//
// Note on Postgres REPLICA IDENTITY: by default the `old` row in DELETE
// payloads only contains the primary key. That's enough for list state keyed
// by `id`. For med_logs (keyed by date+med_key in our local map) we store the
// row's id alongside each entry so we can locate it on delete.

// ===== Row transformers =====

export function dbToMedication(row) {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    dose: row.dose,
    category: row.category,
    times: row.times,
    instructions: row.instructions,
    supplyUnit: row.supply_unit || 'mL',
    doseAmount: row.dose_amount != null ? Number(row.dose_amount) : null,
    supplyRemaining: row.supply_remaining != null ? Number(row.supply_remaining) : null,
    supplyTotal: row.supply_total != null ? Number(row.supply_total) : null,
    refillsRemaining: row.refills_remaining,
    prescriptionSource: row.prescription_source,
    expiryDate: row.expiry_date,
    openedDate: row.opened_date,
    daysAfterOpening: row.days_after_opening,
    lowSupplyDays: row.low_supply_days ?? 3,
  }
}

export function dbToFeed(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type,
    amount: Number(row.amount),
    notes: row.notes,
    loggedBy: row.logged_by,
  }
}

export function dbToWeight(row) {
  return { date: row.date, value: Number(row.value), notes: row.notes }
}

export function dbToNote(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    text: row.text,
    loggedBy: row.logged_by,
    timestamp: row.created_at,
  }
}

export function dbToTracker(row) {
  return { id: row.id, name: row.name, icon: row.icon, unit: row.unit, type: row.type }
}

export function dbToTrackerLog(row) {
  return {
    id: row.id,
    trackerId: row.tracker_id,
    date: row.date,
    time: row.time,
    value: row.value,
    notes: row.notes,
  }
}

export function dbToContact(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    location: row.location,
    notes: row.notes,
  }
}

export function dbToFeedSchedule(row) {
  return {
    id: row.id,
    times: row.times || [],
    targetAmount: Number(row.target_amount) || 0,
    feedType: row.feed_type || 'bottle',
  }
}

export function dbToSettings(row) {
  return {
    medAlarms: row.med_alarms,
    feedAlarms: row.feed_alarms,
    soundAlerts: row.sound_alerts,
  }
}

export function dbToActivityLog(row) {
  return { id: row.id, timestamp: row.timestamp, type: row.type, message: row.message }
}

// ===== Generic delta applier (list-shaped state) =====

/**
 * Apply a Realtime payload to a list. Returns the new list (or the same
 * reference if nothing changed).
 *
 * @param {Object}   args
 * @param {Array}    args.list       Current state list.
 * @param {Object}   args.payload    Supabase realtime payload {eventType,new,old}.
 * @param {string}   args.childId    Only apply if payload's child_id matches.
 * @param {Function} args.transform  Row → local shape.
 * @param {Function} [args.isVisible=()=>true]  Row → bool. If false, treat as removal
 *                                              (e.g. medications.active === false).
 * @param {Function} [args.sortFn]   Comparator to keep list sorted after change.
 * @param {number}   [args.limit]    Cap list length (e.g. activity_log → 200).
 * @param {string}   [args.idField='id']  Identity field for upsert/delete matching.
 */
export function applyRowDelta({
  list,
  payload,
  childId,
  transform,
  isVisible = () => true,
  sortFn = null,
  limit = null,
  idField = 'id',
}) {
  const { eventType, new: newRow, old: oldRow } = payload
  const relevant = eventType === 'DELETE' ? oldRow : newRow

  // Skip if this row doesn't belong to our active child. The realtime filter
  // is family-scoped, so sibling data would otherwise leak into local state.
  if (childId && relevant?.child_id !== undefined && relevant.child_id !== childId) {
    return list
  }

  let next = list

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const transformed = transform(newRow)
    const visible = isVisible(newRow)
    const id = transformed[idField]
    const idx = list.findIndex(r => r[idField] === id)

    if (!visible) {
      next = idx >= 0 ? list.filter(r => r[idField] !== id) : list
    } else if (idx >= 0) {
      next = list.slice()
      next[idx] = transformed
    } else {
      next = [...list, transformed]
    }
  } else if (eventType === 'DELETE') {
    const id = oldRow?.[idField]
    if (id == null) return list
    next = list.filter(r => r[idField] !== id)
  }

  if (next !== list && sortFn) next = next.slice().sort(sortFn)
  if (limit != null && next.length > limit) next = next.slice(0, limit)
  return next
}

// ===== med_logs special handler =====
// Local shape: { [date]: { [med_key]: { id, givenAt, givenBy } } }
// We store the row's id so we can locate the entry on DELETE (where the
// payload's old row only contains the primary key).

export function applyMedLogDelta(prevMedLog, payload, childId) {
  const { eventType, new: newRow, old: oldRow } = payload
  const relevant = eventType === 'DELETE' ? oldRow : newRow
  if (childId && relevant?.child_id !== undefined && relevant.child_id !== childId) {
    return prevMedLog
  }

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const { date, med_key: medKey, given_at: givenAt, given_by: givenBy, id } = newRow
    if (!date || !medKey) return prevMedLog
    const day = { ...(prevMedLog[date] || {}) }
    day[medKey] = { id, givenAt, givenBy }
    return { ...prevMedLog, [date]: day }
  }

  if (eventType === 'DELETE') {
    // Best case: REPLICA IDENTITY FULL means we have date+med_key in oldRow.
    if (oldRow?.date && oldRow?.med_key) {
      const day = { ...(prevMedLog[oldRow.date] || {}) }
      delete day[oldRow.med_key]
      return { ...prevMedLog, [oldRow.date]: day }
    }
    // Fallback: scan our local map for the row id.
    const id = oldRow?.id
    if (id == null) return prevMedLog
    for (const [date, day] of Object.entries(prevMedLog)) {
      for (const [key, entry] of Object.entries(day)) {
        if (entry.id === id) {
          const newDay = { ...day }
          delete newDay[key]
          return { ...prevMedLog, [date]: newDay }
        }
      }
    }
    return prevMedLog
  }

  return prevMedLog
}

// ===== Comparators =====

export const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '')
export const sortByDateDescTimeDesc = (a, b) => {
  if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '')
  return (b.time || '').localeCompare(a.time || '')
}
export const sortByDateAsc = (a, b) => (a.date || '').localeCompare(b.date || '')
export const sortByTimestampDesc = (a, b) =>
  (b.timestamp || '').localeCompare(a.timestamp || '')
export const sortByCreatedAtDesc = (a, b) =>
  (b.timestamp || '').localeCompare(a.timestamp || '') // notes use `timestamp` field
