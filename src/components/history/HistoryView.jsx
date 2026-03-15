import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { formatDate } from '../../lib/dateUtils'
import { activityIcons } from '../../lib/constants'

export default function HistoryView() {
  const { data, exportData } = useTracker()
  const [filter, setFilter] = useState('all')

  const filteredLog = filter === 'all'
    ? data.activityLog
    : data.activityLog.filter(entry => entry.type === filter)

  // Group entries by date
  const groupedByDate = {}
  filteredLog.forEach(entry => {
    const date = entry.timestamp.split('T')[0]
    if (!groupedByDate[date]) groupedByDate[date] = []
    groupedByDate[date].push(entry)
  })
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      <div className="t-card">
        <div className="t-card-title">Activity History</div>

        <div className="t-form-row">
          <label>Filter</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Activity</option>
            <option value="med">Medications</option>
            <option value="feed">Feeds</option>
            <option value="weight">Weight</option>
            <option value="tracker">Trackers</option>
            <option value="note">Notes</option>
          </select>
        </div>

        <button
          className="t-btn t-btn-secondary t-btn-small"
          onClick={exportData}
          style={{ marginBottom: 12 }}
        >
          Export Data
        </button>

        {filteredLog.length === 0 ? (
          <div className="t-empty-state">No activity recorded yet</div>
        ) : (
          sortedDates.map(date => (
            <div key={date}>
              <div className="t-history-date-header">{formatDate(date)}</div>
              {groupedByDate[date].map((entry, i) => (
                <div className="t-history-entry" key={date + '-' + i}>
                  <div>
                    <span style={{ marginRight: 6 }}>
                      {activityIcons[entry.type] || '📋'}
                    </span>
                    {entry.message}
                  </div>
                  <div className="t-history-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString('en-AU', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
