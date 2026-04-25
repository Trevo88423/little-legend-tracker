import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { useFamily } from '../../contexts/FamilyContext'
import { today, formatDate } from '../../lib/dateUtils'
import {
  ageInMonths,
  estimatePercentile,
  buildPercentileCurves,
  ordinal,
} from '../../lib/whoGrowthStandards'

export default function WeightView() {
  const { data, logWeight, deleteWeight } = useTracker()
  const { activeChild } = useFamily()
  const [weightDate, setWeightDate] = useState(today())
  const [weightValue, setWeightValue] = useState('')
  const [activePointIdx, setActivePointIdx] = useState(null)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const pointHitsRef = useRef([])

  const weights = data.weights
  const childSex = activeChild?.sex || null
  const childDob = activeChild?.date_of_birth || null
  const hasPercentileContext = Boolean(childSex && childDob)

  // Compute percentile for each weight entry (memoized)
  const enriched = useMemo(() => {
    if (!hasPercentileContext) return weights.map(w => ({ ...w, percentile: null, ageMonths: null }))
    return weights.map(w => {
      const months = ageInMonths(childDob, w.date)
      return {
        ...w,
        ageMonths: months,
        percentile: estimatePercentile(childSex, months, Number(w.value)),
      }
    })
  }, [weights, childSex, childDob, hasPercentileContext])

  // Current + 2-week trend
  const trend = useMemo(() => {
    if (!hasPercentileContext || enriched.length === 0) return null
    const latest = enriched[enriched.length - 1]
    if (!latest.percentile) return null
    const latestTime = new Date(latest.date + 'T00:00:00').getTime()
    const twoWeeksAgo = latestTime - 14 * 24 * 60 * 60 * 1000
    // Find the entry closest to (but not after) two weeks ago, or earliest if none old enough
    let prev = null
    for (let i = enriched.length - 2; i >= 0; i--) {
      const t = new Date(enriched[i].date + 'T00:00:00').getTime()
      if (t <= twoWeeksAgo) { prev = enriched[i]; break }
      prev = enriched[i] // fallback to oldest if all newer than 2 weeks
    }
    return {
      current: latest.percentile,
      previous: prev?.percentile ?? null,
      previousDate: prev?.date ?? null,
      latestDate: latest.date,
    }
  }, [enriched, hasPercentileContext])

  const drawWeightChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || weights.length < 2) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const pad = { top: 20, right: 20, bottom: 40, left: 45 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    // Time-based x-axis
    const times = weights.map(wt => new Date(wt.date + 'T00:00:00').getTime())
    const tMin = times[0]
    const tMax = times[times.length - 1]
    const tRange = tMax - tMin || 1
    const xForTime = t => pad.left + ((t - tMin) / tRange) * chartW

    // Build percentile curves across the same date range (if context present)
    const curves = hasPercentileContext
      ? buildPercentileCurves(childSex, childDob, weights[0].date, weights[weights.length - 1].date, 60)
      : null

    // Y range = union of data range and percentile range, with small pad
    const dataValues = weights.map(wt => Number(wt.value))
    let minVal = Math.min(...dataValues)
    let maxVal = Math.max(...dataValues)
    if (curves) {
      minVal = Math.min(minVal, ...curves.curves.p3)
      maxVal = Math.max(maxVal, ...curves.curves.p97)
    }
    const valuePad = (maxVal - minVal) * 0.08 || 0.1
    minVal -= valuePad
    maxVal += valuePad
    const range = maxVal - minVal || 1
    const yForValue = v => pad.top + chartH - ((v - minVal) / range) * chartH

    // Grid lines
    ctx.strokeStyle = '#ece8e1'
    ctx.lineWidth = 1
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (chartH / gridLines) * i
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      const val = maxVal - (range / gridLines) * i
      ctx.fillStyle = '#a89888'
      ctx.font = '600 10px Nunito, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val.toFixed(2), pad.left - 6, y + 4)
    }

    // Percentile bands (drawn behind everything else)
    if (curves) {
      const xs = curves.dates.map(d => xForTime(d.getTime()))
      const bands = [
        { lo: 'p3',  hi: 'p15', fill: 'rgba(120, 160, 200, 0.10)' },
        { lo: 'p15', hi: 'p85', fill: 'rgba(120, 200, 140, 0.14)' },
        { lo: 'p85', hi: 'p97', fill: 'rgba(120, 160, 200, 0.10)' },
      ]
      bands.forEach(b => {
        ctx.fillStyle = b.fill
        ctx.beginPath()
        xs.forEach((x, i) => {
          const y = yForValue(curves.curves[b.lo][i])
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        for (let i = xs.length - 1; i >= 0; i--) {
          ctx.lineTo(xs[i], yForValue(curves.curves[b.hi][i]))
        }
        ctx.closePath()
        ctx.fill()
      })
      // Curve lines
      const lines = [
        { key: 'p3',  color: 'rgba(120, 140, 170, 0.55)', width: 1, dash: [4, 3] },
        { key: 'p15', color: 'rgba(100, 160, 110, 0.55)', width: 1, dash: [4, 3] },
        { key: 'p50', color: 'rgba(80, 130, 90, 0.85)',   width: 1.5, dash: [] },
        { key: 'p85', color: 'rgba(100, 160, 110, 0.55)', width: 1, dash: [4, 3] },
        { key: 'p97', color: 'rgba(120, 140, 170, 0.55)', width: 1, dash: [4, 3] },
      ]
      lines.forEach(ln => {
        ctx.strokeStyle = ln.color
        ctx.lineWidth = ln.width
        ctx.setLineDash(ln.dash)
        ctx.beginPath()
        xs.forEach((x, i) => {
          const y = yForValue(curves.curves[ln.key][i])
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        ctx.stroke()
      })
      ctx.setLineDash([])
      // Right-edge labels for percentile lines
      ctx.fillStyle = '#7a8a8a'
      ctx.font = '600 9px Nunito, sans-serif'
      ctx.textAlign = 'left'
      const lastIdx = xs.length - 1
      const labelX = xs[lastIdx] + 2
      ;[['p3', '3'], ['p15', '15'], ['p50', '50'], ['p85', '85'], ['p97', '97']].forEach(([k, lbl]) => {
        if (labelX < w - 2) {
          ctx.fillText(lbl, labelX, yForValue(curves.curves[k][lastIdx]) + 3)
        }
      })
    }

    // Data points (time-positioned)
    const points = weights.map((wt, i) => ({
      x: xForTime(times[i]),
      y: yForValue(Number(wt.value)),
      idx: i,
    }))
    pointHitsRef.current = points

    // Line
    ctx.strokeStyle = '#e86c50'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()

    // Fill area under line
    ctx.fillStyle = 'rgba(232, 108, 80, 0.08)'
    ctx.beginPath()
    ctx.moveTo(points[0].x, pad.top + chartH)
    points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, pad.top + chartH)
    ctx.closePath()
    ctx.fill()

    // Dots
    points.forEach((p, i) => {
      const isActive = i === activePointIdx
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(p.x, p.y, isActive ? 7 : 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#e86c50'
      ctx.lineWidth = isActive ? 3 : 2.5
      ctx.stroke()
    })

    // Date labels on x-axis (time-spaced)
    ctx.fillStyle = '#a89888'
    ctx.font = '600 9px Nunito, sans-serif'
    ctx.textAlign = 'center'
    const maxLabels = 6
    const step = Math.max(1, Math.floor(weights.length / maxLabels))
    weights.forEach((wt, i) => {
      if (i % step === 0 || i === weights.length - 1) {
        const dt = new Date(wt.date + 'T00:00:00')
        const label = dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        ctx.fillText(label, points[i].x, h - pad.bottom + 20)
      }
    })
  }, [weights, hasPercentileContext, childSex, childDob, activePointIdx])

  useEffect(() => {
    drawWeightChart()
    function onResize() { drawWeightChart() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawWeightChart])

  function handleCanvasPointer(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let nearestIdx = null
    let nearestDist = Infinity
    pointHitsRef.current.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < nearestDist) { nearestDist = d; nearestIdx = i }
    })
    if (nearestDist <= 18) {
      setActivePointIdx(nearestIdx)
    } else {
      setActivePointIdx(null)
    }
  }

  async function handleLogWeight(e) {
    e.preventDefault()
    if (!weightValue) return
    await logWeight(weightDate, weightValue)
    setWeightValue('')
    setWeightDate(today())
  }

  function handleDelete(date) {
    if (window.confirm(`Delete weight entry for ${formatDate(date)}?`)) {
      deleteWeight(date)
    }
  }

  // Tooltip position for active point
  const activePoint = activePointIdx != null ? pointHitsRef.current[activePointIdx] : null
  const activeEntry = activePointIdx != null ? enriched[activePointIdx] : null

  return (
    <div>
      <div className="t-card">
        <div className="t-card-title">Log Weight</div>
        <form onSubmit={handleLogWeight}>
          <div className="t-form-row">
            <label>Date</label>
            <input
              type="date"
              value={weightDate}
              onChange={e => setWeightDate(e.target.value)}
            />
          </div>
          <div className="t-form-row">
            <label>Weight</label>
            <input
              type="number"
              placeholder="kg"
              value={weightValue}
              onChange={e => setWeightValue(e.target.value)}
              min="0.1"
              max="50"
              step="0.01"
            />
          </div>
          <button type="submit" className="t-btn t-btn-primary">
            Log Weight
          </button>
        </form>
      </div>

      {weights.length >= 2 && (
        <div className="t-card">
          <div className="t-card-title">Weight Chart</div>

          {hasPercentileContext && trend && (
            <div style={{
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              marginBottom: 10,
              padding: '8px 12px',
              background: 'var(--color-bg)',
              borderRadius: 8,
              lineHeight: 1.5,
            }}>
              <div>
                <strong>Currently ~{ordinal(trend.current)} percentile</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  {' '}(WHO {childSex === 'female' ? 'girls' : 'boys'} weight-for-age)
                </span>
              </div>
              {trend.previous != null && trend.previousDate !== trend.latestDate && (
                <div style={{ fontSize: '0.78rem', marginTop: 2 }}>
                  Trend: {trend.previous === trend.current ? '→' : trend.current > trend.previous ? '↑' : '↓'}{' '}
                  {ordinal(trend.previous)} → {ordinal(trend.current)}
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' '}(since {formatDate(trend.previousDate)})
                  </span>
                </div>
              )}
            </div>
          )}

          {!hasPercentileContext && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--color-text-muted)',
              marginBottom: 10,
              padding: '8px 12px',
              background: 'var(--color-bg)',
              borderRadius: 8,
              lineHeight: 1.4,
            }}>
              {childDob
                ? <>Set your child&apos;s sex in <strong>Settings</strong> to see WHO percentile bands.</>
                : <>Add date of birth{!childSex ? ' and sex' : ''} in <strong>Settings</strong> to see WHO percentile bands.</>}
            </div>
          )}

          <div className="t-weight-chart" ref={containerRef} style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 220, cursor: 'pointer' }}
              onClick={handleCanvasPointer}
              onMouseMove={handleCanvasPointer}
              onMouseLeave={() => setActivePointIdx(null)}
              onTouchStart={(e) => {
                const t = e.touches[0]
                if (t) handleCanvasPointer({ clientX: t.clientX, clientY: t.clientY })
              }}
            />
            {activePoint && activeEntry && (
              <div style={{
                position: 'absolute',
                left: Math.min(Math.max(activePoint.x - 70, 4), (containerRef.current?.clientWidth || 300) - 144),
                top: Math.max(activePoint.y - 70, 4),
                background: '#2c2620',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: '0.75rem',
                lineHeight: 1.35,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 5,
              }}>
                <div style={{ fontWeight: 700 }}>{formatDate(activeEntry.date)}</div>
                <div>{Number(activeEntry.value).toFixed(2)} kg</div>
                {activeEntry.percentile != null && (
                  <div style={{ color: '#ffd6a5' }}>~{ordinal(activeEntry.percentile)} percentile</div>
                )}
              </div>
            )}
          </div>

          {hasPercentileContext && (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--color-text-muted)',
              marginTop: 6,
              textAlign: 'center',
            }}>
              Tap any point for details. Bands: 3rd · 15th · 50th · 85th · 97th percentile.
            </div>
          )}
        </div>
      )}

      <div className="t-card">
        <div className="t-card-title">Weight History</div>
        {weights.length === 0 ? (
          <div className="t-empty-state">No weight entries recorded yet</div>
        ) : (
          [...enriched].reverse().map(wt => (
            <div className="t-feed-entry" key={wt.date}>
              <span className="t-feed-time">{formatDate(wt.date)}</span>
              <span className="t-feed-amount">
                {wt.value}<span className="t-feed-unit">kg</span>
                {wt.percentile != null && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                  }}>
                    ~{ordinal(wt.percentile)}
                  </span>
                )}
              </span>
              <button
                className="t-delete-btn"
                onClick={() => handleDelete(wt.date)}
                title="Delete weight"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
