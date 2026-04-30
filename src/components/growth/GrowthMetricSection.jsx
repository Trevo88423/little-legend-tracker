import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useFamily } from '../../contexts/FamilyContext'
import { today, formatDate } from '../../lib/dateUtils'
import {
  ageInMonths,
  estimatePercentile,
  ordinal,
} from '../../lib/whoGrowthStandards'
import { drawGrowthChart } from '../../lib/growthChart'

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
    const rect = canvas.getBoundingClientRect()
    const result = drawGrowthChart(canvas, {
      entries,
      metric,
      childSex,
      childDob,
      width: rect.width,
      height: rect.height,
      dpr: window.devicePixelRatio || 1,
      activePointIdx,
    })
    pointHitsRef.current = result?.points || []
  }, [entries, childSex, childDob, activePointIdx, metric])

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
