import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTracker } from '../../contexts/TrackerContext'
import { formatTime12 } from '../../lib/dateUtils'
import { catClasses, catIcons } from '../../lib/constants'
import { useFamily } from '../../contexts/FamilyContext'

const emptyMed = {
  id: null,
  name: '',
  purpose: '',
  dose: '',
  category: 'other',
  times: ['08:00'],
  instructions: ''
}

export default function SettingsView() {
  const { data, toggleSetting, saveMedication, deleteMedication, exportData } = useTracker()
  const { family, members, activeChild } = useFamily()
  const navigate = useNavigate()

  const [showMedModal, setShowMedModal] = useState(false)
  const [medForm, setMedForm] = useState({ ...emptyMed })

  const { settings, medications } = data

  function openAddMed() {
    setMedForm({ ...emptyMed })
    setShowMedModal(true)
  }

  function openEditMed(med) {
    setMedForm({
      id: med.id,
      name: med.name,
      purpose: med.purpose || '',
      dose: med.dose || '',
      category: med.category || 'other',
      times: [...(med.times || ['08:00'])],
      instructions: med.instructions || ''
    })
    setShowMedModal(true)
  }

  function updateMedForm(field, value) {
    setMedForm(prev => ({ ...prev, [field]: value }))
  }

  function addTimeSlot() {
    setMedForm(prev => ({ ...prev, times: [...prev.times, '08:00'] }))
  }

  function removeTimeSlot(idx) {
    setMedForm(prev => ({
      ...prev,
      times: prev.times.filter((_, i) => i !== idx)
    }))
  }

  function updateTimeSlot(idx, value) {
    setMedForm(prev => {
      const times = [...prev.times]
      times[idx] = value
      return { ...prev, times }
    })
  }

  async function handleSaveMed(e) {
    e.preventDefault()
    if (!medForm.name.trim()) return
    try {
      await saveMedication(medForm)
      setShowMedModal(false)
    } catch (err) {
      alert('Failed to save medication: ' + err.message)
    }
  }

  function handleDeleteMed(med) {
    if (window.confirm(`Delete ${med.name} from the medication schedule?`)) {
      deleteMedication(med.id)
    }
  }

  return (
    <div>
      {/* Alarm Settings */}
      <div className="t-card">
        <div className="t-card-title">Alarm Settings</div>

        <div className="t-toggle-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Medication Reminders</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Get notified 5 min before, at dose time, and if overdue
            </div>
          </div>
          <div
            className={`t-toggle ${settings.medAlarms ? 'on' : ''}`}
            onClick={() => toggleSetting('medAlarms')}
          >
            <div className="t-toggle-knob" />
          </div>
        </div>

        {settings.medAlarms && (
          <button
            className="t-btn t-btn-secondary t-btn-small"
            style={{ marginBottom: 12 }}
            onClick={async () => {
              if (typeof Notification === 'undefined') {
                alert('Notifications are not supported in this browser')
                return
              }
              const perm = await Notification.requestPermission()
              if (perm === 'granted') {
                new Notification('💊 Test Notification', {
                  body: 'Medication reminders are working!',
                  tag: 'test',
                })
              } else {
                alert('Notification permission was denied. Check your browser settings.')
              }
            }}
          >
            🔔 Test Notification
          </button>
        )}

        <div className="t-toggle-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Sound Alerts</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Play a sound with notifications
            </div>
          </div>
          <div
            className={`t-toggle ${settings.soundAlerts ? 'on' : ''}`}
            onClick={() => toggleSetting('soundAlerts')}
          >
            <div className="t-toggle-knob" />
          </div>
        </div>
      </div>

      {/* Medication Schedule */}
      <div className="t-card">
        <div className="t-card-title">Medication Schedule</div>

        {medications.length === 0 ? (
          <div className="t-empty-state">No medications configured</div>
        ) : (
          medications.map(med => (
            <div
              className={`t-med-item ${catClasses[med.category] || 'med-other'}`}
              key={med.id}
              style={{ cursor: 'default' }}
            >
              <div className="t-med-info">
                <div className="t-med-name">
                  {catIcons[med.category] || '💊'} {med.name}
                </div>
                <div className="t-med-dose">{med.dose}</div>
                {med.purpose && <div className="t-med-detail">{med.purpose}</div>}
                <div className="t-med-detail">
                  Times: {med.times.map(t => formatTime12(t)).join(', ')}
                </div>
                {med.instructions && (
                  <div className="t-med-detail">{med.instructions}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  className="t-btn t-btn-secondary t-btn-small"
                  onClick={() => openEditMed(med)}
                >
                  Edit
                </button>
                <button
                  className="t-delete-btn"
                  onClick={() => handleDeleteMed(med)}
                  title="Delete medication"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}

        <button
          className="t-btn t-btn-primary"
          onClick={openAddMed}
          style={{ marginTop: 10 }}
        >
          + Add Medication
        </button>
      </div>

      {/* Data Management */}
      <div className="t-card">
        <div className="t-card-title">Data Management</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={exportData}>
            Export All Data
          </button>
          <button className="t-btn t-btn-primary" style={{ flex: 1 }} onClick={() => navigate('/app/ai-setup')}>
            Smart Import
          </button>
        </div>
      </div>

      {/* Family Info */}
      <div className="t-card">
        <div className="t-card-title">Family Info</div>
        {family && (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Family:</strong> {family.name || 'My Family'}
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Your partner needs the child's name + your PIN to join
              </div>
            </div>
            {activeChild && (
              <div style={{ marginBottom: 8 }}>
                <strong>Active Child:</strong> {activeChild.name}
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                  Family: {family.id?.slice(0, 8)} / Child: {activeChild.id?.slice(0, 8)}
                </div>
              </div>
            )}
            {members.length > 0 && (
              <div>
                <strong>Members:</strong>
                <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                  {members.map(m => (
                    <li key={m.id} style={{ marginBottom: 2 }}>
                      {m.display_name} ({m.role || 'member'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!family && (
          <div className="t-empty-state">No family configured</div>
        )}
      </div>

      {/* Request Features */}
      <div className="t-card">
        <div className="t-card-title">Feedback</div>
        <a
          href="https://github.com/Trevo88423/little-legend-tracker/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="t-btn t-btn-secondary"
          style={{ width: '100%', textDecoration: 'none' }}
        >
          Request a Feature or Report a Bug
        </a>
      </div>

      {/* Pay It Forward */}
      <div className="t-card">
        <div className="t-card-title">Pay It Forward</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
          If Little Legend has made your days a little easier, we&apos;d love you to pay it forward.
          We don&apos;t charge for this app and never will &mdash; but if you&apos;d like to give back,
          please consider donating to the charities that supported our family:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="https://www.cckin.com.au/donate"
            target="_blank"
            rel="noopener noreferrer"
            className="t-btn t-btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Central Coast Kids in Need
          </a>
          <a
            href="https://rmhc.org.au"
            target="_blank"
            rel="noopener noreferrer"
            className="t-btn t-btn-primary"
            style={{ textDecoration: 'none', background: 'var(--color-red)' }}
          >
            Ronald McDonald House Charities
          </a>
        </div>
      </div>

      {/* Medication Form Modal */}
      {showMedModal && (
        <div className="t-modal-overlay" onClick={() => setShowMedModal(false)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>{medForm.id ? 'Edit Medication' : 'Add Medication'}</h3>
            <form onSubmit={handleSaveMed}>
              <div className="t-form-row">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="Medication name"
                  value={medForm.name}
                  onChange={e => updateMedForm('name', e.target.value)}
                  required
                />
              </div>
              <div className="t-form-row">
                <label>Dose</label>
                <input
                  type="text"
                  placeholder="e.g. 2.5mL, 1 tablet"
                  value={medForm.dose}
                  onChange={e => updateMedForm('dose', e.target.value)}
                />
              </div>
              <div className="t-form-row">
                <label>Purpose</label>
                <input
                  type="text"
                  placeholder="What is it for?"
                  value={medForm.purpose}
                  onChange={e => updateMedForm('purpose', e.target.value)}
                />
              </div>
              <div className="t-form-row">
                <label>Category</label>
                <select
                  value={medForm.category}
                  onChange={e => updateMedForm('category', e.target.value)}
                >
                  <option value="heart">Heart</option>
                  <option value="diuretic">Diuretic</option>
                  <option value="stomach">Stomach</option>
                  <option value="blood">Blood</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="t-form-row stack">
                <label>Instructions</label>
                <input
                  type="text"
                  placeholder="Special instructions..."
                  value={medForm.instructions}
                  onChange={e => updateMedForm('instructions', e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <label style={{
                  fontWeight: 700, fontSize: '0.78rem',
                  color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8
                }}>
                  Schedule Times
                </label>
                {medForm.times.map((t, idx) => (
                  <div className="t-form-row" key={idx}>
                    <input
                      type="time"
                      value={t}
                      onChange={e => updateTimeSlot(idx, e.target.value)}
                    />
                    {medForm.times.length > 1 && (
                      <button
                        type="button"
                        className="t-delete-btn"
                        onClick={() => removeTimeSlot(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="t-btn t-btn-secondary t-btn-small"
                  onClick={addTimeSlot}
                >
                  + Add Time
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="t-btn t-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowMedModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  {medForm.id ? 'Save Changes' : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
