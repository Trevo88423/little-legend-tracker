// WHO Child Growth Standards: weight-for-age and length-for-age, 0-24 months.
// Source: who.int/tools/child-growth-standards (rounded — kg to 0.1, cm to 0.1).
// Each row: [ageMonths, P3, P15, P50, P85, P97]

const BOYS_WEIGHT_FOR_AGE = [
  [0,  2.5, 2.9,  3.3,  3.9,  4.3],
  [1,  3.4, 3.9,  4.5,  5.1,  5.7],
  [2,  4.4, 4.9,  5.6,  6.3,  7.0],
  [3,  5.1, 5.7,  6.4,  7.2,  7.9],
  [4,  5.6, 6.2,  7.0,  7.8,  8.6],
  [5,  6.1, 6.7,  7.5,  8.4,  9.2],
  [6,  6.4, 7.1,  7.9,  8.8,  9.7],
  [7,  6.7, 7.4,  8.3,  9.2, 10.2],
  [8,  7.0, 7.7,  8.6,  9.6, 10.5],
  [9,  7.2, 7.9,  8.9,  9.9, 10.9],
  [10, 7.5, 8.2,  9.2, 10.2, 11.2],
  [11, 7.7, 8.4,  9.4, 10.5, 11.5],
  [12, 7.8, 8.6,  9.6, 10.8, 11.8],
  [14, 8.2, 9.0, 10.1, 11.3, 12.4],
  [16, 8.5, 9.4, 10.5, 11.8, 12.9],
  [18, 8.9, 9.8, 10.9, 12.3, 13.5],
  [20, 9.2, 10.1, 11.3, 12.7, 14.0],
  [22, 9.5, 10.5, 11.7, 13.2, 14.5],
  [24, 9.7, 10.8, 12.2, 13.7, 15.0],
]

const GIRLS_WEIGHT_FOR_AGE = [
  [0,  2.4, 2.8,  3.2,  3.7,  4.2],
  [1,  3.2, 3.6,  4.2,  4.8,  5.4],
  [2,  3.9, 4.5,  5.1,  5.8,  6.5],
  [3,  4.5, 5.1,  5.8,  6.6,  7.4],
  [4,  5.0, 5.6,  6.4,  7.3,  8.1],
  [5,  5.4, 6.1,  6.9,  7.8,  8.7],
  [6,  5.7, 6.4,  7.3,  8.3,  9.2],
  [7,  6.0, 6.7,  7.6,  8.7,  9.6],
  [8,  6.3, 7.0,  7.9,  9.0, 10.0],
  [9,  6.5, 7.3,  8.2,  9.3, 10.4],
  [10, 6.7, 7.5,  8.5,  9.6, 10.7],
  [11, 6.9, 7.7,  8.7,  9.9, 11.0],
  [12, 7.0, 7.9,  8.9, 10.2, 11.3],
  [14, 7.4, 8.2,  9.4, 10.7, 11.9],
  [16, 7.7, 8.6,  9.8, 11.2, 12.4],
  [18, 8.1, 9.0, 10.2, 11.6, 13.0],
  [20, 8.4, 9.4, 10.6, 12.1, 13.5],
  [22, 8.6, 9.7, 11.0, 12.6, 14.0],
  [24, 8.9, 10.0, 11.5, 13.0, 14.5],
]

// Length-for-age (cm). Approximations of WHO standards for display.
const BOYS_LENGTH_FOR_AGE = [
  [0,  46.3, 47.9, 49.9, 51.8, 53.4],
  [1,  51.1, 52.7, 54.7, 56.7, 58.4],
  [2,  54.7, 56.4, 58.4, 60.4, 62.2],
  [3,  57.6, 59.3, 61.4, 63.5, 65.3],
  [4,  60.0, 61.7, 63.9, 66.0, 67.8],
  [5,  61.9, 63.7, 65.9, 68.0, 69.9],
  [6,  63.6, 65.5, 67.6, 69.8, 71.6],
  [7,  65.1, 66.9, 69.2, 71.4, 73.2],
  [8,  66.5, 68.4, 70.6, 72.9, 74.7],
  [9,  67.7, 69.6, 72.0, 74.3, 76.2],
  [10, 69.0, 70.9, 73.3, 75.6, 77.6],
  [11, 70.2, 72.1, 74.5, 76.9, 78.9],
  [12, 71.3, 73.3, 75.7, 78.1, 80.2],
  [14, 73.4, 75.4, 78.0, 80.5, 82.7],
  [16, 75.4, 77.5, 80.2, 82.8, 85.0],
  [18, 77.2, 79.5, 82.3, 85.0, 87.3],
  [20, 78.9, 81.3, 84.2, 87.1, 89.4],
  [22, 80.6, 83.0, 86.0, 89.0, 91.4],
  [24, 82.1, 84.6, 87.8, 90.9, 93.4],
]

const GIRLS_LENGTH_FOR_AGE = [
  [0,  45.6, 47.2, 49.1, 51.0, 52.7],
  [1,  50.0, 51.7, 53.7, 55.6, 57.4],
  [2,  53.2, 54.9, 57.1, 59.2, 60.9],
  [3,  55.8, 57.6, 59.8, 61.9, 63.8],
  [4,  58.0, 59.8, 62.1, 64.3, 66.2],
  [5,  59.9, 61.7, 64.0, 66.2, 68.2],
  [6,  61.5, 63.4, 65.7, 68.0, 70.0],
  [7,  62.9, 64.9, 67.3, 69.6, 71.6],
  [8,  64.3, 66.2, 68.7, 71.1, 73.1],
  [9,  65.6, 67.6, 70.1, 72.6, 74.7],
  [10, 66.8, 68.9, 71.5, 74.0, 76.1],
  [11, 68.0, 70.1, 72.8, 75.3, 77.5],
  [12, 69.2, 71.3, 74.0, 76.7, 78.9],
  [14, 71.3, 73.5, 76.4, 79.1, 81.4],
  [16, 73.4, 75.7, 78.6, 81.5, 83.9],
  [18, 75.2, 77.6, 80.7, 83.7, 86.2],
  [20, 76.9, 79.4, 82.7, 85.8, 88.4],
  [22, 78.6, 81.2, 84.6, 87.7, 90.5],
  [24, 80.0, 82.7, 86.4, 89.6, 92.5],
]

export const WHO_PERCENTILES = [3, 15, 50, 85, 97]

// Pick the right reference table for (metric, sex). Returns null for sex
// values where WHO doesn't define percentiles ('other' / unset).
function table(metric, sex) {
  if (!sex || sex === 'other') return null
  if (metric === 'length' || metric === 'height') {
    return sex === 'female' ? GIRLS_LENGTH_FOR_AGE : BOYS_LENGTH_FOR_AGE
  }
  // Default to weight
  return sex === 'female' ? GIRLS_WEIGHT_FOR_AGE : BOYS_WEIGHT_FOR_AGE
}

export function ageInMonths(dob, asOf) {
  const a = new Date(dob + 'T00:00:00')
  const b = new Date((asOf || new Date().toISOString().slice(0, 10)) + 'T00:00:00')
  return (b - a) / (1000 * 60 * 60 * 24 * 30.4375)
}

// Returns [P3, P15, P50, P85, P97] in the metric's unit (kg or cm) at the
// given age, linearly interpolated between adjacent rows. Returns null when
// no reference table is available.
export function percentileValues(metric, sex, ageMonths) {
  const t = table(metric, sex)
  if (!t) return null
  if (ageMonths <= t[0][0]) return t[0].slice(1)
  if (ageMonths >= t[t.length - 1][0]) return t[t.length - 1].slice(1)
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i], b = t[i + 1]
    if (ageMonths >= a[0] && ageMonths <= b[0]) {
      const f = (ageMonths - a[0]) / (b[0] - a[0])
      return [1, 2, 3, 4, 5].map(c => a[c] + (b[c] - a[c]) * f)
    }
  }
  return t[t.length - 1].slice(1)
}

// Estimate percentile (1-99) for a measurement. Linear interpolation between
// the 5 reference percentiles, with linear extrapolation outside P3/P97.
// Returns null if no reference table is available for this (metric, sex).
export function estimatePercentile(metric, sex, ageMonths, value) {
  const ws = percentileValues(metric, sex, ageMonths)
  if (!ws) return null
  if (value <= ws[0]) {
    const slope = (ws[1] - ws[0]) / (15 - 3)
    const p = 3 - (ws[0] - value) / slope
    return Math.max(1, Math.round(p))
  }
  if (value >= ws[4]) {
    const slope = (ws[4] - ws[3]) / (97 - 85)
    const p = 97 + (value - ws[4]) / slope
    return Math.min(99, Math.round(p))
  }
  for (let i = 0; i < 4; i++) {
    if (value >= ws[i] && value <= ws[i + 1]) {
      const f = (value - ws[i]) / (ws[i + 1] - ws[i])
      return Math.round(WHO_PERCENTILES[i] + (WHO_PERCENTILES[i + 1] - WHO_PERCENTILES[i]) * f)
    }
  }
  return null
}

// Build smooth percentile curves across a date range, sampled `steps` times.
// Returns { dates: [Date], curves: { p3:[], p15:[], p50:[], p85:[], p97:[] } }
// or null if no reference table is available.
export function buildPercentileCurves(metric, sex, dob, startDate, endDate, steps = 40) {
  if (!dob) return null
  const t = table(metric, sex)
  if (!t) return null
  const start = new Date(startDate + 'T00:00:00').getTime()
  const end = new Date(endDate + 'T00:00:00').getTime()
  const dates = []
  const out = { p3: [], p15: [], p50: [], p85: [], p97: [] }
  const keys = ['p3', 'p15', 'p50', 'p85', 'p97']
  for (let i = 0; i <= steps; i++) {
    const t2 = start + (end - start) * (i / steps)
    const d = new Date(t2)
    const iso = d.toISOString().slice(0, 10)
    const months = ageInMonths(dob, iso)
    const ws = percentileValues(metric, sex, months)
    dates.push(d)
    keys.forEach((k, j) => out[k].push(ws[j]))
  }
  return { dates, curves: out }
}

// Suffix helper: 1 -> "1st", 2 -> "2nd", etc.
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
