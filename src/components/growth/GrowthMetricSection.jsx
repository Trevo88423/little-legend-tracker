import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useFamily } from '../../contexts/FamilyContext'
import { today, formatDate } from '../../lib/dateUtils'
import {
  ageInMonths,
  estimatePercentile,
  buildPercentileCurves,
  ordinal,
} from '../../lib/whoGrowthStandards'

// Generic growth metric section — used for both weight and height.
// Props:
//   metric: 'weight' | 'length'  (matches whoGrowthStandards table key)
//   title: 'Weight' | 'Height'
//   unit: 'kg' | 'cm'
//   data: array of { date, value, notes? } sorted by date asc
//   logEntry: async (date, value) => void
//   deleteEntry: async (date) => void
//   inputMin/inputMax/inputStep: number input bounds
//   placeholder: input placeholder text
//
// Mirrors the original WeightView layout: log form → chart with WHO bands
// (when sex+DOB are set) → tap-for-percentile tooltip → history list.
export default function GrowthMetricSection({
  metric,
  title,
  unit,
  data: entries,
  logEntry,
  deleteEntry,
  inputMin,
  inputMax,
  inputStep,
  placeholder,
}) {
  const { activeChild } = useFamily()
  const [entryDate, setEntryDate] = useState(today())
  const [entryValue, setEntryValue] = useState('')
  const [activePointIdx, setActivePointIdx] = useState(null)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const pointHitsRef = useRef([])

  const childSex = activeChild?.sex || null
  const childDob = activeChild?.date_of_birth || null
  const hasPercentileContext = Boolean(childSex && childDob)

  const enriched = useMemo(() => {
    if (!hasPercentileContext) return entries.map(e => ({ ...e, percentile: null, ageMonths: null }))
    return entries.map(e => {
      const months = ageInMonths(childDob, e.date)
      return {
        ...e,
        ageMonths: months,
        percentile: estimatePercentile(metric, childSex, months, Number(e.value)),
      }
    })
  }, [entries, childSex, childDob, hasPercentileContext, metric])

  const trend = useMemo(() => {
    if (!hasPercentileContext || enriched.length === 0) return null
    const latest = enriched[enriched.length - 1]
    if (!latest.percentile) return null
    const latestTime = new Date(latest.date + 'T00:00:00').getTime()
    const twoWeeksAgo = latestTime - 14 * 24 * 60 * 60 * 1000
    let prev = null
    for (let i = enriched.length - 2; i >= 0; i--) {
      const t = new Date(enriched[i].date + 'T00:00:00').getTime()
      if (t <= twoWeeksAgo) { prev = enriched[i]; break }
      prev = enriched[i]
    }
    return {
      current: latest.percentile,
      previous: prev?.percentile ?? null,
      previousDate: prev?.date ?? null,
      latestDate: latest.date,
    }
  }, [enriched, hasPercentileContext])

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || entries.length < 2) return

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

    const times = entries.map(e => new Date(e.date + 'T00:00:00').getTime())
    const tMin = times[0]
    const tMax = times[times.length - 1]
    const tRange = tMax - tMin || 1
    const xForTime = t => pad.left + ((t - tMin) / tRange) * chartW

    const curves = hasPercentileContext
      ? buildPercentileCurves(metric, childSex, childDob, entries[0].date, entries[entries.length - 1].date, 60)
      : null

    const dataValues = entries.map(e => Number(e.value))
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

    // Grid
    ctx.strokeStyle = '#ece8e1'
    ctx.lineWidth = 1
    const gridLines = 5
    const decimals = metric === 'weight' ? 2 : 1
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
      ctx.fillText(val.toFixed(decimals), pad.left - 6, y + 4)
    }

    // Percentile bands
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

    const points = entries.map((e, i) => ({
      x: xForTime(times[i]),
      y: yForValue(Number(e.value)),
      idx: i,
    }))
    pointHitsRef.current = points

    // Line + fill
    ctx.strokeStyle = '#e86c50'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
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

    // X labels
    ctx.fillStyle = '#a89888'
    ctx.font = '600 9px Nunito, sans-serif'
    ctx.textAlign = 'center'
    const maxLabels = 6
    const step = Math.max(1, Math.floor(entries.length / maxLabels))
    entries.forEach((e, i) => {
      if (i % step === 0 || i === entries.length - 1) {
        const dt = new Date(e.date + 'T00:00:00')
        const label = dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        ctx.fillText(label, points[i].x, h - pad.bottom + 20)
      }
    })
  }, [entries, hasPercentileContext, childSex, childDob, activePointIdx, metric])

  useEffect(() => {
    drawChart()
    function onResize() { drawChart() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawChart])

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
    if (nearestDist <= 18) setActivePointIdx(nearestIdx)
    else setActivePointIdx(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!entryValue) return
    await logEntry(entryDate, entryValue)
    setEntryValue('')
    setEntryDate(today())
  }

  function handleDelete(date) {
    if (window.confirm(`Delete ${title.toLowerCase()} entry for ${formatDate(date)}?`)) {
      deleteEntry(date)
    }
  }

  const activePoint = activePointIdx != null ? pointHitsRef.current[activePointIdx] : null
  const activeEntry = activePointIdx != null ? enriched[activePointIdx] : null
  const sexLabel = childSex === 'female' ? 'girls' : 'boys'
  const sourceLabel = metric === 'weight' ? 'weight-for-age' : 'length-for-age'
  const decimals = metric === 'weight' ? 2 : 1

  return (
    <>
      <div className="t-card">
        <div className="t-card-title">Log {title}</div>
        <form onSubmit={handleSubmit}>
          <div className="t-form-row">
            <label>Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
            />
          </div>
          <div className="t-form-row">
            <label>{title}</label>
            <input
              type="number"
              placeholder={placeholder}
              value={entryValue}
              onChange={e => setEntryValue(e.target.value)}
              min={inputMin}
              max={inputMax}
              step={inputStep}
            />
          </div>
          <button type="submit" className="t-btn t-btn-primary">
            Log {title}
          </button>
        </form>
      </div>

      {entries.length >= 2 && (
        <div className="t-card">
          <div className="t-card-title">{title} Chart</div>

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
                  {' '}(WHO {sexLabel} {sourceLabel})
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
              onTouchStart={(ev) => {
                const t = ev.touches[0]
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
                <div>{Number(activeEntry.value).toFixed(decimals)} {unit}</div>
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
        <div className="t-card-title">{title} History</div>
        {entries.length === 0 ? (
          <div className="t-empty-state">No {title.toLowerCase()} entries recorded yet</div>
        ) : (
          [...enriched].reverse().map(e => (
            <div className="t-feed-entry" key={e.date}>
              <span className="t-feed-time">{formatDate(e.date)}</span>
              <span className="t-feed-amount">
                {e.value}<span className="t-feed-unit">{unit}</span>
                {e.percentile != null && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                  }}>
                    ~{ordinal(e.percentile)}
                  </span>
                )}
              </span>
              <button
                className="t-delete-btn"
                onClick={() => handleDelete(e.date)}
                title={`Delete ${title.toLowerCase()}`}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
