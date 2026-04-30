import { useState, useEffect } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { typeLabels } from '../../lib/constants'

const TUBE_TYPES = ['ng_tube', 'nj_tube', 'g_tube', 'j_tube']

function formatDuration(ms) {
  if (ms < 0) ms = 0
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function ContinuousFeedSection() {
  const {
    data,
    startContinuousFeed, disconnectContinuousFeed, reconnectContinuousFeed,
    endContinuousFeed, deleteContinuousFeedSession,
    getActiveContinuousSession, getActivePauseFor, getPausesForSession,
  } = useTracker()

  const active = getActiveContinuousSession()
  const activePause = active ? getActivePauseFor(active.id) : null

  // Force re-render once a minute so elapsed/paused times stay fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [active?.id])

  // Start modal
  const [showStartModal, setShowStartModal] = useState(false)
  const [startType, setStartType] = useState('g_tube')
  const [startRate, setStartRate] = useState('')
  const [startNotes, setStartNotes] = useState('')

  // End modal
  const [showEndModal, setShowEndModal] = useState(false)
  const [endTotal, setEndTotal] = useState('')
  const [endNotes, setEndNotes] = useState('')

  // Recent sessions toggle
  const [showRecent, setShowRecent] = useState(false)

  async function handleStart(e) {
    e.preventDefault()
    try {
      await startContinuousFeed({ feedType: startType, rateMlHr: startRate, notes: startNotes })
      setShowStartModal(false)
      setStartType('g_tube')
      setStartRate('')
      setStartNotes('')
    } catch (err) {
      window.alert(`Couldn't start feed: ${err.message || 'unknown error'}`)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectContinuousFeed()
    } catch (err) {
      window.alert(`Couldn't disconnect: ${err.message || 'unknown error'}`)
    }
  }

  async function handleReconnect() {
    try {
      await reconnectContinuousFeed()
    } catch (err) {
      window.alert(`Couldn't reconnect: ${err.message || 'unknown error'}`)
    }
  }

  async function handleEnd(e) {
    e.preventDefault()
    try {
      await endContinuousFeed({ totalMlActual: endTotal, notes: endNotes })
      setShowEndModal(false)
      setEndTotal('')
      setEndNotes('')
    } catch (err) {
      window.alert(`Couldn't end feed: ${err.message || 'unknown error'}`)
    }
  }

  async function handleDeleteSession(id) {
    if (!window.confirm('Delete this completed session and all its disconnect events?')) return
    try {
      await deleteContinuousFeedSession(id)
    } catch (err) {
      window.alert(`Couldn't delete: ${err.message || 'unknown error'}`)
    }
  }

  // Compute live numbers for active session
  let elapsedMs = 0, disconnectedMs = 0, currentRunMs = 0
  let pauses = []
  if (active) {
    const startedTs = new Date(active.startedAt).getTime()
    const nowTs = Date.now()
    elapsedMs = nowTs - startedTs
    pauses = getPausesForSession(active.id)
    for (const p of pauses) {
      const start = new Date(p.disconnectedAt).getTime()
      const end = p.reconnectedAt ? new Date(p.reconnectedAt).getTime() : nowTs
      disconnectedMs += end - start
    }
    currentRunMs = elapsedMs - disconnectedMs
  }

  const completed = (data.continuousFeedSessions || []).filter(s => s.endedAt)

  return (
    <>
      {active ? (
        <div className="t-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="t-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: activePause ? 'var(--color-amber, #f59e0b)' : 'var(--color-green, #22c55e)',
              animation: activePause ? 'none' : 'pulse 2s ease-in-out infinite',
            }} />
            <span>{activePause ? 'Disconnected' : 'Continuous feed running'}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {typeLabels[active.feedType] || active.feedType}
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8, marginBottom: 12, fontSize: '0.78rem',
          }}>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>Started</div>
              <div style={{ fontWeight: 700 }}>{formatTime(active.startedAt)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>On pump</div>
              <div style={{ fontWeight: 700 }}>{formatDuration(currentRunMs)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>Disconnected</div>
              <div style={{ fontWeight: 700 }}>{formatDuration(disconnectedMs)}</div>
            </div>
          </div>

          {active.rateMlHr != null && (
            <div style={{
              fontSize: '0.78rem', marginBottom: 10,
              color: 'var(--color-text-secondary)',
            }}>
              Rate: <strong>{active.rateMlHr} mL/hr</strong>
              {currentRunMs > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--color-text-muted)' }}>
                  ≈ {Math.round((active.rateMlHr * currentRunMs) / 3600000)}mL delivered
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activePause ? (
              <button
                className="t-btn t-btn-primary"
                style={{ flex: 1, minWidth: 140 }}
                onClick={handleReconnect}
              >
                🔌 Reconnect
              </button>
            ) : (
              <button
                className="t-btn t-btn-secondary"
                style={{ flex: 1, minWidth: 140 }}
                onClick={handleDisconnect}
              >
                ⏸ Disconnect
              </button>
            )}
            <button
              className="t-btn t-btn-secondary"
              style={{ flex: 1, minWidth: 140, color: 'var(--color-red)' }}
              onClick={() => setShowEndModal(true)}
            >
              ⏹ End feed
            </button>
          </div>

          {pauses.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                color: 'var(--color-text-secondary)',
              }}>
                {pauses.length} disconnect{pauses.length !== 1 ? 's' : ''}
              </summary>
              <div style={{ marginTop: 6, fontSize: '0.75rem' }}>
                {pauses.map(p => {
                  const open = !p.reconnectedAt
                  const dur = open
                    ? Date.now() - new Date(p.disconnectedAt).getTime()
                    : new Date(p.reconnectedAt).getTime() - new Date(p.disconnectedAt).getTime()
                  return (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '4px 8px', color: 'var(--color-text-secondary)',
                    }}>
                      <span>{formatTime(p.disconnectedAt)} {open ? '(ongoing)' : `→ ${formatTime(p.reconnectedAt)}`}</span>
                      <span style={{ fontWeight: 700 }}>{formatDuration(dur)}</span>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      ) : (
        <div className="t-card">
          <div className="t-card-title">Continuous Tube Feed</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            For pump feeds (G/J tubes typically). Tracks start time, disconnects, and total volume.
          </p>
          <button
            className="t-btn t-btn-primary"
            onClick={() => setShowStartModal(true)}
          >
            ▶ Start continuous feed
          </button>
        </div>
      )}

      {/* Recent completed sessions */}
      {completed.length > 0 && (
        <div className="t-card">
          <div
            className="t-card-title"
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            onClick={() => setShowRecent(s => !s)}
          >
            <span>Recent continuous feeds ({completed.length})</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {showRecent ? '▼' : '▶'}
            </span>
          </div>
          {showRecent && completed.slice(0, 10).map(s => {
            const startedTs = new Date(s.startedAt).getTime()
            const endedTs = new Date(s.endedAt).getTime()
            const totalMs = endedTs - startedTs
            const sessionPauses = getPausesForSession(s.id)
            const offMs = sessionPauses.reduce((sum, p) => {
              if (!p.reconnectedAt) return sum
              return sum + (new Date(p.reconnectedAt).getTime() - new Date(p.disconnectedAt).getTime())
            }, 0)
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderTop: '1px solid var(--color-border)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {formatDate(s.startedAt)} · {formatTime(s.startedAt)}–{formatTime(s.endedAt)}
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      ({typeLabels[s.feedType] || s.feedType})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {formatDuration(totalMs - offMs)} on pump
                    {offMs > 0 && ` · ${formatDuration(offMs)} disconnected`}
                    {s.totalMlActual != null && ` · ${s.totalMlActual}mL`}
                    {s.rateMlHr != null && ` · ${s.rateMlHr}mL/hr`}
                  </div>
                </div>
                <button
                  className="t-delete-btn"
                  onClick={() => handleDeleteSession(s.id)}
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Start modal */}
      {showStartModal && (
        <div className="t-modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>Start Continuous Feed</h3>
            <form onSubmit={handleStart}>
              <div className="t-form-row">
                <label>Type</label>
                <select value={startType} onChange={e => setStartType(e.target.value)}>
                  {TUBE_TYPES.map(t => (
                    <option key={t} value={t}>{typeLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div className="t-form-row">
                <label>Rate (mL/hr)</label>
                <input
                  type="number"
                  placeholder="optional"
                  value={startRate}
                  onChange={e => setStartRate(e.target.value)}
                  min="0"
                  step="any"
                />
              </div>
              <div className="t-form-row">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={startNotes}
                  onChange={e => setStartNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={() => setShowStartModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End modal */}
      {showEndModal && active && (
        <div className="t-modal-overlay" onClick={() => setShowEndModal(false)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <div className="t-modal-handle" />
            <h3>End Continuous Feed</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              Started {formatTime(active.startedAt)} · {formatDuration(currentRunMs)} on pump
              {disconnectedMs > 0 && ` · ${formatDuration(disconnectedMs)} disconnected`}
            </p>
            <form onSubmit={handleEnd}>
              <div className="t-form-row">
                <label>Total delivered (mL)</label>
                <input
                  type="number"
                  placeholder="optional, read from pump"
                  value={endTotal}
                  onChange={e => setEndTotal(e.target.value)}
                  min="0"
                  step="any"
                  autoFocus
                />
              </div>
              <div className="t-form-row">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={endNotes}
                  onChange={e => setEndNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={() => setShowEndModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="t-btn t-btn-primary" style={{ flex: 1 }}>
                  End feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
