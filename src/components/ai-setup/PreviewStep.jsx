import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTracker } from '../../contexts/TrackerContext'
import { catIcons, catClasses } from '../../lib/constants'
import { formatTime12 } from '../../lib/dateUtils'

export default function PreviewStep({ data, onBack }) {
  const { data: trackerData, saveMedication, addTracker, logWeight, addNote, saveFeedSchedule } = useTracker()
  const existingMedIds = new Set(trackerData.medications.map(m => m.id))
  const navigate = useNavigate()

  const [meds, setMeds] = useState(data.medications)
  const [trackers, setTrackers] = useState(data.trackers)
  const [weights, setWeights] = useState(data.weights)
  const [feedSchedule, setFeedSchedule] = useState(data.feedSchedule)
  const [feedPlan, setFeedPlan] = useState(data.feedPlan)
  const [notes, setNotes] = useState(data.notes)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importResult, setImportResult] = useState(null)

  function removeMed(i) { setMeds(prev => prev.filter((_, idx) => idx !== i)) }
  function removeTracker(i) { setTrackers(prev => prev.filter((_, idx) => idx !== i)) }
  function removeWeight(i) { setWeights(prev => prev.filter((_, idx) => idx !== i)) }
  function removeNote(i) { setNotes(prev => prev.filter((_, idx) => idx !== i)) }
  function removeFeedPlan() { setFeedPlan(null) }

  const totalItems = meds.length + trackers.length + weights.length + notes.length + (feedSchedule ? 1 : 0) + (feedPlan ? 1 : 0)

  async function handleImport() {
    setImporting(true)
    const counts = { medsAdded: 0, medsUpdated: 0, trackers: 0, weights: 0, feedSchedule: 0, notes: 0 }

    try {
      // Import medications
      for (const med of meds) {
        const isUpdate = med.id && existingMedIds.has(med.id)
        await saveMedication({
          id: isUpdate ? med.id : null,
          name: med.name,
          dose: med.dose,
          purpose: med.purpose,
          category: med.category,
          times: med.times,
          instructions: med.instructions,
          doseAmount: med.doseAmount,
          supplyUnit: med.supplyUnit,
          supplyRemaining: med.supplyRemaining,
          supplyTotal: med.supplyTotal,
          refillsRemaining: med.refillsRemaining,
          prescriptionSource: med.prescriptionSource,
          expiryDate: med.expiryDate,
          openedDate: med.openedDate,
          daysAfterOpening: med.daysAfterOpening,
          lowSupplyDays: med.lowSupplyDays,
        })
        if (isUpdate) counts.medsUpdated++
        else counts.medsAdded++
      }

      // Import trackers
      for (const t of trackers) {
        await addTracker(t.name, t.icon, t.unit, t.type)
        counts.trackers++
      }

      // Import weights
      for (const w of weights) {
        await logWeight(w.date, w.value)
        counts.weights++
      }

      // Import feed schedule
      if (feedSchedule) {
        await saveFeedSchedule(feedSchedule)
        counts.feedSchedule = 1
      }

      // Import feed plan as note
      if (feedPlan) {
        await addNote(feedPlan)
        counts.notes++
      }

      // Import notes
      for (const n of notes) {
        await addNote(n)
        counts.notes++
      }

      setImportResult(counts)
      setDone(true)
    } catch (err) {
      console.error('Import error:', err)
      alert('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  if (done && importResult) {
    return (
      <div className="t-import-success">
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>+</div>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>Import Complete!</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          {importResult.medsAdded > 0 && <div>{importResult.medsAdded} medication{importResult.medsAdded !== 1 ? 's' : ''} added</div>}
          {importResult.medsUpdated > 0 && <div>{importResult.medsUpdated} medication{importResult.medsUpdated !== 1 ? 's' : ''} updated</div>}
          {importResult.trackers > 0 && <div>{importResult.trackers} tracker{importResult.trackers !== 1 ? 's' : ''} added</div>}
          {importResult.weights > 0 && <div>{importResult.weights} weight{importResult.weights !== 1 ? 's' : ''} logged</div>}
          {importResult.feedSchedule > 0 && <div>Feed schedule imported</div>}
          {importResult.notes > 0 && <div>{importResult.notes} note{importResult.notes !== 1 ? 's' : ''} added</div>}
        </div>
        <button className="t-btn t-btn-primary" onClick={() => navigate('/app/dashboard')}>
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Review before importing</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          {totalItems} item{totalItems !== 1 ? 's' : ''} ready to import. Remove any that don&apos;t look right.
        </p>
      </div>

      {data.babyName && (
        <div className="t-card" style={{ marginBottom: 8 }}>
          <div className="t-card-title">Baby</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{data.babyName}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Name shown for reference only &mdash; not imported
          </div>
        </div>
      )}

      {/* Medications */}
      {meds.length > 0 && (() => {
        const updates = meds.filter(m => m.id && existingMedIds.has(m.id)).length
        const adds = meds.length - updates
        const label = [adds && `${adds} new`, updates && `${updates} update${updates !== 1 ? 's' : ''}`].filter(Boolean).join(', ')
        return (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Medications ({label})</div>
          {meds.map((med, i) => {
            const isUpdate = med.id && existingMedIds.has(med.id)
            return (
            <div className={`t-med-item ${catClasses[med.category] || 'med-other'}`} key={i} style={{ cursor: 'default' }}>
              <div className="t-med-info">
                <div className="t-med-name">
                  {catIcons[med.category] || catIcons.other} {med.name}
                  {isUpdate && <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'var(--color-primary)', color: 'white', padding: '1px 5px', borderRadius: 4, marginLeft: 6, verticalAlign: 'middle' }}>UPDATE</span>}
                </div>
                {med.dose && <div className="t-med-dose">{med.dose}</div>}
                {med.purpose && <div className="t-med-detail">{med.purpose}</div>}
                <div className="t-med-detail">
                  {med.times.length > 0
                    ? `Times: ${med.times.map(t => formatTime12(t)).join(', ')}`
                    : 'PRN / As needed'}
                </div>
                {med.instructions && <div className="t-med-detail">{med.instructions}</div>}
                {(med.supplyTotal || med.expiryDate || med.prescriptionSource || med.refillsRemaining != null) && (
                  <div className="t-med-detail" style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                    {med.supplyTotal && <span>{med.supplyRemaining != null ? med.supplyRemaining : med.supplyTotal}/{med.supplyTotal}{med.supplyUnit || 'mL'}</span>}
                    {med.expiryDate && <span>{med.supplyTotal ? ' \u00B7 ' : ''}Exp: {med.expiryDate}</span>}
                    {med.prescriptionSource && <span>{(med.supplyTotal || med.expiryDate) ? ' \u00B7 ' : ''}{med.prescriptionSource}</span>}
                    {med.refillsRemaining != null && <span>{(med.supplyTotal || med.expiryDate || med.prescriptionSource) ? ' \u00B7 ' : ''}{med.refillsRemaining} refills</span>}
                  </div>
                )}
              </div>
              <button className="t-delete-btn" onClick={() => removeMed(i)} title="Remove">
                x
              </button>
            </div>
            )
          })}
        </div>
        )
      })()}

      {/* Trackers */}
      {trackers.length > 0 && (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Trackers ({trackers.length})</div>
          {trackers.map((t, i) => (
            <div className="t-tracker-item" key={i}>
              <div className="t-tracker-icon" style={{ background: 'var(--color-primary-light)' }}>
                {t.icon || ''}
              </div>
              <div style={{ flex: 1 }}>
                <div className="t-tracker-name">{t.name}</div>
                <div className="t-tracker-last">
                  {t.type}{t.unit ? ` (${t.unit})` : ''}
                </div>
              </div>
              <button className="t-delete-btn" onClick={() => removeTracker(i)} title="Remove">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Weights */}
      {weights.length > 0 && (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Weights ({weights.length})</div>
          {weights.map((w, i) => (
            <div className="t-tracker-item" key={i}>
              <div className="t-tracker-icon" style={{ background: 'var(--color-primary-light)' }}>
                <span role="img" aria-label="weight">&#x2696;&#xFE0F;</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="t-tracker-name">{w.value} kg</div>
                {w.date && <div className="t-tracker-last">{w.date}</div>}
              </div>
              <button className="t-delete-btn" onClick={() => removeWeight(i)} title="Remove">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feed Schedule */}
      {feedSchedule && (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Feed Schedule</div>
          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            <strong>Target:</strong> {feedSchedule.targetAmount ? `${feedSchedule.targetAmount} mL` : 'Not set'}
            {' '}&middot;{' '}
            <strong>Type:</strong> {feedSchedule.feedType}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            <strong>Times:</strong> {feedSchedule.times.map(t => formatTime12(t)).join(', ')}
          </div>
          <button className="t-delete-btn" onClick={() => setFeedSchedule(null)} title="Remove" style={{ marginTop: 4 }}>
            x Remove
          </button>
        </div>
      )}

      {/* Feed Plan */}
      {feedPlan && (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Feed Plan</div>
          <div className="t-notes-entry">
            <div className="t-notes-text">{feedPlan}</div>
          </div>
          <button className="t-delete-btn" onClick={removeFeedPlan} title="Remove" style={{ marginTop: 4 }}>
            x Remove
          </button>
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div className="t-card t-preview-section">
          <div className="t-card-title">Notes ({notes.length})</div>
          {notes.map((n, i) => (
            <div className="t-notes-entry" key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div className="t-notes-text" style={{ flex: 1 }}>{n}</div>
              <button className="t-delete-btn" onClick={() => removeNote(i)} title="Remove">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {totalItems === 0 && (
        <div className="t-empty-state">All items removed. Go back to re-import.</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={onBack}>
          Back
        </button>
        <button
          className="t-btn t-btn-green"
          style={{ flex: 1 }}
          onClick={handleImport}
          disabled={importing || totalItems === 0}
        >
          {importing ? 'Importing...' : `Import All (${totalItems})`}
        </button>
      </div>
    </div>
  )
}
