import { useState, useRef, useEffect, useCallback } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, formatDate } from '../../lib/dateUtils'

export default function WeightView() {
  const { data, logWeight, deleteWeight } = useTracker()
  const [weightDate, setWeightDate] = useState(today())
  const [weightValue, setWeightValue] = useState('')
  const canvasRef = useRef(null)

  const weights = data.weights

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

    const values = weights.map(wt => wt.value)
    const minVal = Math.min(...values) - 0.1
    const maxVal = Math.max(...values) + 0.1
    const range = maxVal - minVal || 1

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

      // Y-axis labels
      const val = maxVal - (range / gridLines) * i
      ctx.fillStyle = '#a89888'
      ctx.font = '600 10px Nunito, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val.toFixed(2), pad.left - 6, y + 4)
    }

    // Data points
    const points = weights.map((wt, i) => ({
      x: pad.left + (chartW / (weights.length - 1)) * i,
      y: pad.top + chartH - ((wt.value - minVal) / range) * chartH
    }))

    // Line
    ctx.strokeStyle = '#e86c50'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
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
    points.forEach(p => {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#e86c50'
      ctx.lineWidth = 2.5
      ctx.stroke()
    })

    // Date labels on x-axis
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
  }, [weights])

  useEffect(() => {
    drawWeightChart()
    function onResize() { drawWeightChart() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawWeightChart])

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
          <div className="t-weight-chart">
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 200 }}
            />
          </div>
        </div>
      )}

      <div className="t-card">
        <div className="t-card-title">Weight History</div>
        {weights.length === 0 ? (
          <div className="t-empty-state">No weight entries recorded yet</div>
        ) : (
          [...weights].reverse().map(wt => (
            <div className="t-feed-entry" key={wt.date}>
              <span className="t-feed-time">{formatDate(wt.date)}</span>
              <span className="t-feed-amount">
                {wt.value}<span className="t-feed-unit">kg</span>
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
