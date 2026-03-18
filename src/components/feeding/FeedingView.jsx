import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, now24, formatTime12 } from '../../lib/dateUtils'
import { typeLabels, typeCls } from '../../lib/constants'

export default function FeedingView() {
  const {
    data, getTodayFeeds, logFeed, deleteFeed,
    saveFeedSchedule, deleteFeedSchedule, isFeedDone, getMatchingFeed, getFeedScheduleStats
  } = useTracker()

  const [feedTime, setFeedTime] = useState(now24())
  const [feedType, setFeedType] = useState('bottle')
  const [feedAmount, setFeedAmount] = useState('')
  const [feedNotes, setFeedNotes] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Schedule form state
  const [schedTimes, setSchedTimes] = useState(['08:00'])
  const [schedTarget, setSchedTarget] = useState('')
  const [schedType, setSchedType] = useState('bottle')

  const todayFeeds = getTodayFeeds()
  const totalMl = todayFeeds.reduce((sum, f) => sum + f.amount, 0)
  const schedule = data.feedSchedule
  const schedStats = getFeedScheduleStats()

  async function handleLogFeed(e) {
    e.preventDefault()
    if (!feedAmount) return
    await logFeed(feedTime, feedType, feedAmount, feedNotes)
    setFeedAmount('')
    setFeedNotes('')
    setFeedTime(now24())
  }

  function handleDelete(id) {
    if (window.confirm('Delete this feed entry?')) {
      deleteFeed(id)
    }
  }

  function handleScheduleSlotTap(time) {
    if (isFeedDone(time)) return
    setFeedTime(time)
    setFeedType(schedule?.feedType || 'bottle')
    setFeedAmount(schedule?.targetAmount ? String(schedule.targetAmount) : '')
    setFeedNotes('')
    // Scroll to form
    setTimeout(() => {
      document.getElementById('feed-log-form')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  function openScheduleModal() {
    if (schedule) {
      setSchedTimes([...schedule.times])
      setSchedTarget(schedule.targetAmount ? String(schedule.targetAmount) : '')
      setSchedType(schedule.feedType || 'bottle')
    } else {
      setSchedTimes(['08:00'])
      setSchedTarget('')
      setSchedType('bottle')
    }
    setShowScheduleModal(true)
  }

  async function handleSaveSchedule(e) {
    e.preventDefault()
    const filtered = schedTimes.filter(t => t)
    if (filtered.length === 0) return
    await saveFeedSchedule({
      times: filtered,
      targetAmount: parseFloat(schedTarget) || 0,
      feedType: schedType,
    })
    setShowScheduleModal(false)
  }

  async function handleDeleteSchedule() {
    if (window.confirm('Delete the feed schedule? This will remove all scheduled times.')) {
      await deleteFeedSchedule()
      setShowScheduleModal(false)
    }
  }

  function addSchedTime() {
    setSchedTimes(prev => [...prev, '08:00'])
  }

  function removeSchedTime(idx) {
    setSchedTimes(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSchedTime(idx, value) {
    setSchedTimes(prev => {
      const times = [...prev]
      times[idx] = value
      return times
    })
  }

  return (
    <div>
      {/* Today's Schedule Card */}
      {schedule && schedule.times.length > 0 && (
        <div className="t-card">
          <div className="t-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Today's Schedule</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              {schedStats.done}/{schedStats.total} done
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...schedule.times].sort().map(time => {
              const done = isFeedDone(time)
              const matchingFeed = done ? getMatchingFeed(time) : null
              return (
                <div
                  key={time}
                  onClick={() => !done && handleScheduleSlotTap(time)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: done ? 'var(--color-green-bg, rgba(34,197,94,0.08))' : 'var(--color-bg)',
                    cursor: done ? 'default' : 'pointer',
                    opacity: done ? 0.7 : 1,
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{done ? '\u2705' : '\u23F0'}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: 75 }}>
                    {formatTime12(time)}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {schedule.targetAmount ? `${schedule.targetAmount} mL target` : ''}
                  </span>
                  {matchingFeed && (
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                      {matchingFeed.amount} mL
                      {matchingFeed.time !== time && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                          ({formatTime12(matchingFeed.time)})
                        </span>
                      )}
                    </span>
                  )}
                  {!done && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      tap to log
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <button
            className="t-btn t-btn-secondary t-btn-small"
            style={{ marginTop: 10 }}
            onClick={openScheduleModal}
          >
            Edit Schedule
          </button>
        </div>
      )}

      {/* Set Feed Schedule button when no schedule exists */}
      {!schedule && (
        <div className="t-card">
          <div className="t-empty-state" style={{ marginBottom: 8 }}>
            No feed schedule set
          </div>
          <button
            className="t-btn t-btn-primary"
            onClick={openScheduleModal}
          >
            Set Feed Schedule
          </button>
        </div>
      )}

      <div className="t-card" id="feed-log-form">
        <div className="t-card-title">Log a Feed</div>
        <form onSubmit={handleLogFeed}>
          <div className="t-form-row">
            <label>Time</label>
            <input
              type="time"
              value={feedTime}
              onChange={e => setFeedTime(e.target.value)}
            />
          </div>
          <div className="t-form-row">
            <label>Type</label>
            <select value={feedType} onChange={e => setFeedType(e.target.value)}>
              <option value="bottle">Bottle</option>
              <option value="tube">NG Tube</option>
              <option value="breast">Breast</option>
            </select>
          </div>
          <div className="t-form-row">
            <label>Amount</label>
            <input
              type="number"
              placeholder="mL"
              value={feedAmount}
              onChange={e => setFeedAmount(e.target.value)}
              min="0"
              step="1"
            />
          </div>
          <div className="t-form-row">
            <label>Notes</label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={feedNotes}
              onChange={e => setFeedNotes(e.target.value)}
            />
          </div>
          <button type="submit" className="t-btn t-btn-primary">
            🍼 Log Feed
          </button>
        </form>
      </div>

      <div className="t-card">
        <div className="t-card-title">Today's Feeds</div>
        {todayFeeds.length === 0 ? (
          <div className="t-empty-state">No feeds recorded today</div>
        ) : (
          <>
            {todayFeeds.map(feed => (
              <div className="t-feed-entry" key={feed.id}>
                <span className="t-feed-time">{formatTime12(feed.time)}</span>
                <span className={`t-feed-type ${typeCls[feed.type] || ''}`}>
                  {typeLabels[feed.type] || feed.type}
                </span>
                {feed.loggedBy && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {feed.loggedBy}
                  </span>
                )}
                {feed.notes && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', flex: 1 }}>
                    {feed.notes}
                  </span>
                )}
                <span className="t-feed-amount">
                  {feed.amount}<span className="t-feed-unit">mL</span>
                </span>
                <button
                  className="t-delete-btn"
                  onClick={() => handleDelete(feed.id)}
                  title="Delete feed"
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{
              textAlign: 'right',
              marginTop: 10,
              fontWeight: 800,
              fontSize: '0.95rem',
              color: 'var(--color-primary)'
            }}>
              Total: {totalMl} mL
            </div>
          </>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="t-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>{schedule ? 'Edit Feed Schedule' : 'Set Feed Schedule'}</h3>
            <form onSubmit={handleSaveSchedule}>
              <div className="t-form-row">
                <label>Target Amount (mL)</label>
                <input
                  type="number"
                  placeholder="e.g. 90"
                  value={schedTarget}
                  onChange={e => setSchedTarget(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
              <div className="t-form-row">
                <label>Default Type</label>
                <select value={schedType} onChange={e => setSchedType(e.target.value)}>
                  <option value="bottle">Bottle</option>
                  <option value="tube">NG Tube</option>
                  <option value="breast">Breast</option>
                </select>
              </div>

              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <label style={{
                  fontWeight: 700, fontSize: '0.78rem',
                  color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8
                }}>
                  Feed Times
                </label>
                {schedTimes.map((t, idx) => (
                  <div className="t-form-row" key={idx}>
                    <input
                      type="time"
                      value={t}
                      onChange={e => updateSchedTime(idx, e.target.value)}
                    />
                    {schedTimes.length > 1 && (
                      <button
                        type="button"
                        className="t-delete-btn"
                        onClick={() => removeSchedTime(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="t-btn t-btn-secondary t-btn-small"
                  onClick={addSchedTime}
                >
                  + Add Time
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {schedule && (
                  <button
                    type="button"
                    className="t-btn t-btn-secondary"
                    style={{ color: 'var(--color-red)' }}
                    onClick={handleDeleteSchedule}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="t-btn t-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
