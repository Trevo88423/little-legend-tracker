import { useTracker } from '../../contexts/TrackerContext'
import { today, formatTime12, formatDate } from '../../lib/dateUtils'
import { catClasses, catIcons, dotColors } from '../../lib/constants'

export default function MedsView() {
  const { getTimeSlots, isMedGiven, toggleMed, resetMedsForDay } = useTracker()

  const timeSlots = getTimeSlots()
  const sortedTimes = Object.keys(timeSlots).sort()

  function handleReset() {
    if (window.confirm('Reset all medications for today? This will uncheck everything.')) {
      resetMedsForDay()
    }
  }

  return (
    <div>
      <div className="t-reset-row">
        <span className="t-date-display">{formatDate(today())}</span>
        <button className="t-btn t-btn-secondary t-btn-small" onClick={handleReset}>
          Reset All
        </button>
      </div>

      {sortedTimes.length === 0 && (
        <div className="t-empty-state">
          No medications scheduled. Add medications in Settings.
        </div>
      )}

      {sortedTimes.map((time, idx) => {
        const meds = timeSlots[time]
        const allGiven = meds.every(m => isMedGiven(m.id, time))

        return (
          <div className="t-med-time-group" key={time}>
            <div className="t-med-time-header">
              <span
                className="t-med-time-dot"
                style={{ background: dotColors[idx % dotColors.length] }}
              />
              <span>{formatTime12(time)}</span>
              {allGiven && <span className="t-med-all-given">All given ✓</span>}
            </div>

            {meds.map(med => {
              const given = isMedGiven(med.id, time)
              const givenInfo = given || null

              return (
                <div
                  className={`t-med-item ${catClasses[med.category] || 'med-other'} ${given ? 'given' : ''}`}
                  key={med.id + '_' + time}
                  onClick={() => toggleMed(med.id, time)}
                >
                  <div className="t-med-check">
                    {given ? '✓' : ''}
                  </div>
                  <div className="t-med-info">
                    <div className="t-med-name">
                      {catIcons[med.category] || '💊'} {med.name}
                    </div>
                    <div className="t-med-dose">{med.dose}</div>
                    {med.purpose && (
                      <div className="t-med-detail">{med.purpose}</div>
                    )}
                    {med.instructions && (
                      <div className="t-med-detail">{med.instructions}</div>
                    )}
                    {given && givenInfo && (
                      <div className="t-med-given-time">
                        Given at {formatTime12(givenInfo.givenAt)}
                        {givenInfo.givenBy ? ` by ${givenInfo.givenBy}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
