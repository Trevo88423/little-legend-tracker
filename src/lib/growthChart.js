// Pure canvas drawing for the growth chart. Used by both:
//   - GrowthMetricSection (live on-screen chart, sized via getBoundingClientRect)
//   - pdfGenerator (off-screen canvas at fixed dimensions, output as PNG via toDataURL)
//
// All inputs are explicit so the function works without any DOM context beyond
// the canvas element itself.
//
// Returns { points: [{x, y, idx}] } so the caller can do hit-testing
// (used by the on-screen chart for tap-for-percentile tooltips). Off-screen
// callers can ignore the return value.

import { ageInMonths, buildPercentileCurves } from './whoGrowthStandards'

const DEFAULT_PAD = { top: 20, right: 20, bottom: 40, left: 45 }

export function drawGrowthChart(canvas, opts) {
  if (!canvas) return null
  const {
    entries,
    metric,
    childSex,
    childDob,
    width,
    height,
    dpr = 1,
    activePointIdx = null,
    pad = DEFAULT_PAD,
  } = opts

  if (!entries || entries.length < 2) return null

  const ctx = canvas.getContext('2d')
  canvas.width = width * dpr
  canvas.height = height * dpr
  // setTransform replaces any prior scaling — important when reusing a canvas
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const w = width
  const h = height
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  ctx.clearRect(0, 0, w, h)

  // Time-based x-axis
  const times = entries.map(e => new Date(e.date + 'T00:00:00').getTime())
  const tMin = times[0]
  const tMax = times[times.length - 1]
  const tRange = tMax - tMin || 1
  const xForTime = t => pad.left + ((t - tMin) / tRange) * chartW

  const hasContext = Boolean(childSex && childDob && childSex !== 'other')
  const curves = hasContext
    ? buildPercentileCurves(metric, childSex, childDob, entries[0].date, entries[entries.length - 1].date, 60)
    : null

  // Y range
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

  // Grid lines + Y-axis labels
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

  // Percentile bands behind data line
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
    // Right-edge percentile labels
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
  const points = entries.map((e, i) => ({
    x: xForTime(times[i]),
    y: yForValue(Number(e.value)),
    idx: i,
  }))

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

  // X-axis date labels (time-spaced)
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

  return { points }
}

// Render a chart to a temporary off-screen canvas at fixed dimensions and
// return its PNG data URL. Used by the PDF generator to embed visual charts.
export function renderGrowthChartPng(opts) {
  const { width, height } = opts
  const canvas = document.createElement('canvas')
  // Render at 2x for crispness in the PDF
  drawGrowthChart(canvas, { ...opts, dpr: 2 })
  return canvas.toDataURL('image/png')
}

// Returns false when there isn't enough data or context to draw a chart at all
export function canDrawGrowthChart(entries) {
  return Array.isArray(entries) && entries.length >= 2
}
