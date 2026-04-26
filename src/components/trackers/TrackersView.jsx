import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, now24, formatTime12 } from '../../lib/dateUtils'

export default function TrackersView() {
  const { data, addTracker, deleteTracker, logTrackerEntry } = useTracker()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(null) // tracker object or null

  // Add tracker form state
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newType, setNewType] = useState('counter')

  // Log tracker form state
  const [logTime, setLogTime] = useState(now24())
  const [logValue, setLogValue] = useState('')
  const [logNotes, setLogNotes] = useState('')

  const trackers = data.trackers
  const trackerLogs = data.trackerLogs

  function getTodaySummary(trackerId) {
    const todayLogs = trackerLogs.filter(l => l.trackerId === trackerId && l.date === today())
    if (todayLogs.length === 0) return 'No entries today'
    const tracker = trackers.find(t => t.id === trackerId)
    if (tracker && tracker.type === 'counter') {
      return `${todayLogs.length} time${todayLogs.length !== 1 ? 's' : ''} today`
    }
    const lastLog = todayLogs[todayLogs.length - 1]
    return `Latest: ${lastLog.value}${tracker?.unit || ''} at ${formatTime12(lastLog.time)}`
  }

  async function handleTrackerClick(tracker) {
    if (tracker.type === 'counter') {
      try {
        await logTrackerEntry(tracker.id, now24(), '1', '')
      } catch (err) {
        window.alert(`Couldn't log entry: ${err.message || 'unknown error'}`)
      }
    } else {
      setShowLogModal(tracker)
      setLogTime(now24())
      setLogValue('')
      setLogNotes('')
    }
  }

  async function handleAddTracker(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await addTracker(newName, newIcon, newUnit, newType)
    } catch (err) {
      window.alert(`Couldn't save tracker: ${err.message || 'unknown error'}`)
      return
    }
    setNewName('')
    setNewIcon('')
    setNewUnit('')
    setNewType('counter')
    setShowAddModal(false)
  }

  async function handleLogEntry(e) {
    e.preventDefault()
    if (!showLogModal || !logValue) return
    try {
      await logTrackerEntry(showLogModal.id, logTime, logValue, logNotes)
    } catch (err) {
      window.alert(`Couldn't log entry: ${err.message || 'unknown error'}`)
      return
    }
    setShowLogModal(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this tracker and all its data?')) return
    try {
      await deleteTracker(id)
    } catch (err) {
      window.alert(`Couldn't delete tracker: ${err.message || 'unknown error'}`)
    }
  }

  return (
    <div>
      <div className="t-card">
        <div className="t-card-title">Custom Trackers</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          Track anything specific to your little legend - nappy changes, sleep, tummy time, or any custom metric.
        </p>
        <button
          className="t-btn t-btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          + Add New Tracker
        </button>
      </div>

      {trackers.length === 0 ? (
        <div className="t-card">
          <div className="t-empty-state">
            No custom trackers yet. Create one above to get started!
          </div>
        </div>
      ) : (
        <div className="t-card">
          {trackers.map(tracker => (
            <div
              className="t-tracker-item"
              key={tracker.id}
              onClick={() => handleTrackerClick(tracker)}
              style={{ cursor: 'pointer' }}
            >
              <div className="t-tracker-icon">{tracker.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="t-tracker-name">{tracker.name}</div>
                <div className="t-tracker-last">{getTodaySummary(tracker.id)}</div>
              </div>
              <button
                className="t-delete-btn"
                onClick={e => { e.stopPropagation(); handleDelete(tracker.id) }}
                title="Delete tracker"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Tracker Modal */}
      {showAddModal && (
        <div className="t-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>Add New Tracker</h3>
            <form onSubmit={handleAddTracker}>
              <div className="t-form-row">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Nappy Changes"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="t-form-row">
                <label>Icon</label>
                <input
                  type="text"
                  placeholder="e.g. emoji"
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  maxLength={4}
                />
              </div>
              <div className="t-form-row">
                <label>Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="counter">Counter (tap to increment)</option>
                  <option value="value">Value (enter a number)</option>
                  <option value="text">Text (enter details)</option>
                </select>
              </div>
              {newType === 'value' && (
                <div className="t-form-row">
                  <label>Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. mins, mL, etc."
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  Add Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Tracker Entry Modal */}
      {showLogModal && (
        <div className="t-modal-overlay" onClick={() => setShowLogModal(null)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>{showLogModal.icon} Log {showLogModal.name}</h3>
            <form onSubmit={handleLogEntry}>
              <div className="t-form-row">
                <label>Time</label>
                <input
                  type="time"
                  value={logTime}
                  onChange={e => setLogTime(e.target.value)}
                />
              </div>
              <div className="t-form-row">
                <label>Value</label>
                {showLogModal.type === 'text' ? (
                  <input
                    type="text"
                    placeholder="Enter details..."
                    value={logValue}
                    onChange={e => setLogValue(e.target.value)}
                    required
                  />
                ) : (
                  <input
                    type="number"
                    placeholder={showLogModal.unit || 'Value'}
                    value={logValue}
                    onChange={e => setLogValue(e.target.value)}
                    required
                  />
                )}
              </div>
              <div className="t-form-row">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
