import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, formatTime12, formatDate } from '../../lib/dateUtils'
import { catIcons, dotColors, activityIcons } from '../../lib/constants'

export default function DashboardView() {
  const {
    data, getNextMed, getMedStats, getTodayFeeds, getLatestWeight,
    isMedGiven, getTimeSlots
  } = useTracker()

  const [notifDismissed, setNotifDismissed] = useState(() => localStorage.getItem('ll-notif-dismissed') === '1')
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  const { nextMed, nextTime } = getNextMed()
  const medStats = getMedStats()
  const todayFeeds = getTodayFeeds()
  const latestWeight = getLatestWeight()
  const totalMl = todayFeeds.reduce((sum, f) => sum + f.amount, 0)
  const timeSlots = getTimeSlots()

  const showNotifBanner = notifPermission !== 'granted' && !notifDismissed && data.settings.medAlarms

  const recentActivity = data.activityLog.slice(0, 5)

  // Build today's medication timeline
  const sortedTimes = Object.keys(timeSlots).sort()
  const timeline = sortedTimes.map(time => {
    const meds = timeSlots[time]
    const names = meds.map(m => {
      const given = isMedGiven(m.id, time)
      return { name: m.name, given }
    })
    const allGiven = names.every(n => n.given)
    return { time, names, allGiven }
  })

  async function requestNotifications() {
    if (typeof Notification === 'undefined') {
      dismissBanner()
      return
    }
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    if (result !== 'granted') {
      dismissBanner()
    }
  }

  function dismissBanner() {
    setNotifDismissed(true)
    localStorage.setItem('ll-notif-dismissed', '1')
  }

  return (
    <div>
      {showNotifBanner && (
        <div className="t-notif-banner" onClick={requestNotifications} style={{ cursor: 'pointer', position: 'relative' }}>
          <span className="t-notif-icon">🔔</span>
          <span className="t-notif-text">
            Enable notifications to receive medication reminders. Tap here to allow.
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); dismissBanner() }}
            style={{
              position: 'absolute', top: 6, right: 8,
              background: 'none', border: 'none', color: 'inherit',
              fontSize: '1.1rem', cursor: 'pointer', opacity: 0.7, padding: '2px 6px',
            }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {nextMed && nextTime && (
        <div className="t-next-med-banner">
          <span className="t-next-med-icon">{catIcons[nextMed.category] || '💊'}</span>
          <div className="t-next-med-text">
            <div className="t-next-med-label">NEXT MEDICATION</div>
            <div className="t-next-med-name">{nextMed.name} {nextMed.dose}</div>
          </div>
          <div className="t-next-med-time">{formatTime12(nextTime)}</div>
        </div>
      )}

      <div className="t-overview-grid">
        <div className="t-overview-stat">
          <div className="t-stat-number">{medStats.done}/{medStats.total}</div>
          <div className="t-stat-label">Meds Given</div>
        </div>
        <div className="t-overview-stat">
          <div className="t-stat-number">{todayFeeds.length}</div>
          <div className="t-stat-label">Feeds Today</div>
        </div>
        <div className="t-overview-stat">
          <div className="t-stat-number">{totalMl}</div>
          <div className="t-stat-label">Total mL</div>
        </div>
        <div className="t-overview-stat">
          <div className="t-stat-number">{latestWeight ? latestWeight.value + 'kg' : '--'}</div>
          <div className="t-stat-label">Latest Weight</div>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="t-card">
          <div className="t-card-title">Today's Medication Timeline</div>
          {timeline.map((slot, i) => (
            <div
              className="t-timeline-row"
              key={slot.time}
              style={{ opacity: slot.allGiven ? 0.5 : 1 }}
            >
              <span
                className="t-med-time-dot"
                style={{ background: dotColors[i % dotColors.length] }}
              />
              <span className="t-timeline-time">{formatTime12(slot.time)}</span>
              <span className="t-timeline-names">
                {slot.names.map((n, j) => (
                  <span key={j}>
                    {j > 0 && ', '}
                    <span style={{ textDecoration: n.given ? 'line-through' : 'none' }}>
                      {n.name}
                    </span>
                  </span>
                ))}
              </span>
              {slot.allGiven && <span style={{ color: 'var(--color-green)', fontSize: '0.78rem' }}>✓</span>}
            </div>
          ))}
        </div>
      )}

      <div className="t-card">
        <div className="t-card-title">Recent Activity</div>
        {recentActivity.length === 0 ? (
          <div className="t-empty-state">No activity recorded yet today</div>
        ) : (
          recentActivity.map((entry, i) => (
            <div className="t-history-entry" key={i}>
              <div>
                <span style={{ marginRight: 6 }}>{activityIcons[entry.type] || '📋'}</span>
                {entry.message}
              </div>
              <div className="t-history-timestamp">
                {new Date(entry.timestamp).toLocaleTimeString('en-AU', {
                  hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
