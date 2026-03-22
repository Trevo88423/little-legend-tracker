import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'

const ROLES = [
  'Cardiologist', 'Paediatrician', 'GP', 'Surgeon', 'Pharmacy',
  'Hospital', 'Therapist', 'Nurse', 'Dietitian', 'Other'
]

const EMPTY_FORM = { name: '', role: 'GP', phone: '', email: '', location: '', notes: '' }

export default function ContactsView() {
  const { data, addContact, updateContact, deleteContact } = useTracker()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const contacts = data.contacts || []

  // Group contacts by role
  const grouped = {}
  contacts.forEach(c => {
    if (!grouped[c.role]) grouped[c.role] = []
    grouped[c.role].push(c)
  })
  const roles = Object.keys(grouped).sort()

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return

    if (editingId) {
      await updateContact(editingId, form)
    } else {
      await addContact(form)
    }
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function handleEdit(contact) {
    setForm({
      name: contact.name,
      role: contact.role,
      phone: contact.phone || '',
      email: contact.email || '',
      location: contact.location || '',
      notes: contact.notes || '',
    })
    setEditingId(contact.id)
    setShowForm(true)
  }

  function handleCancel() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function handleDelete(id) {
    if (window.confirm('Delete this contact?')) {
      deleteContact(id)
    }
  }

  function formatPhone(phone) {
    return phone.replace(/[^\d+]/g, '')
  }

  return (
    <div>
      {!showForm && (
        <button
          className="t-btn t-btn-primary"
          style={{ marginBottom: 12 }}
          onClick={() => setShowForm(true)}
        >
          + Add Contact
        </button>
      )}

      {showForm && (
        <div className="t-card">
          <div className="t-card-title">{editingId ? 'Edit Contact' : 'Add Contact'}</div>
          <form onSubmit={handleSubmit}>
            <div className="t-form-row stack">
              <label>Name *</label>
              <input
                type="text"
                placeholder="e.g. Dr Sarah Chen"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="t-form-row stack">
              <label>Role</label>
              <select value={form.role} onChange={e => handleChange('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="t-form-row stack">
              <label>Phone</label>
              <input
                type="tel"
                placeholder="e.g. 02 1234 5678"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>
            <div className="t-form-row stack">
              <label>Email</label>
              <input
                type="email"
                placeholder="e.g. doctor@hospital.com"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
              />
            </div>
            <div className="t-form-row stack">
              <label>Location</label>
              <input
                type="text"
                placeholder="e.g. Westmead Children's Hospital"
                value={form.location}
                onChange={e => handleChange('location', e.target.value)}
              />
            </div>
            <div className="t-form-row stack">
              <label>Notes</label>
              <input
                type="text"
                placeholder="e.g. Level 2, see every 3 months"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                {editingId ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </form>
        </div>
      )}

      {contacts.length === 0 && !showForm && (
        <div className="t-card">
          <div className="t-empty-state">
            No contacts yet. Add your child's medical team, pharmacies, and hospitals.
          </div>
        </div>
      )}

      {roles.map(role => (
        <div className="t-card" key={role}>
          <div className="t-card-title">{role} ({grouped[role].length})</div>
          {grouped[role].map(contact => (
            <div key={contact.id} className="t-notes-entry" style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{contact.name}</div>
                  {contact.phone && (
                    <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
                      <a href={`tel:${formatPhone(contact.phone)}`} style={{ color: 'var(--color-primary)' }}>
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.email && (
                    <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
                      <a href={`mailto:${contact.email}`} style={{ color: 'var(--color-primary)' }}>
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.location && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {contact.location}
                    </div>
                  )}
                  {contact.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {contact.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="t-delete-btn"
                    onClick={() => handleEdit(contact)}
                    title="Edit contact"
                    style={{ fontSize: '0.72rem' }}
                  >
                    Edit
                  </button>
                  <button
                    className="t-delete-btn"
                    onClick={() => handleDelete(contact.id)}
                    title="Delete contact"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
