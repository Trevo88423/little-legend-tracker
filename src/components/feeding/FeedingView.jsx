import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, now24, formatTime12 } from '../../lib/dateUtils'
import { typeLabels, typeCls } from '../../lib/constants'

export default function FeedingView() {
  const { getTodayFeeds, logFeed, deleteFeed } = useTracker()

  const [feedTime, setFeedTime] = useState(now24())
  const [feedType, setFeedType] = useState('bottle')
  const [feedAmount, setFeedAmount] = useState('')
  const [feedNotes, setFeedNotes] = useState('')

  const todayFeeds = getTodayFeeds()
  const totalMl = todayFeeds.reduce((sum, f) => sum + f.amount, 0)

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

  return (
    <div>
      <div className="t-card">
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
    </div>
  )
}
