// WHO Child Growth Standards: weight-for-age, 0-24 months
// Source: who.int/tools/child-growth-standards (rounded to 0.1 kg)
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

export const WHO_PERCENTILES = [3, 15, 50, 85, 97]

function table(sex) {
  return sex === 'female' ? GIRLS_WEIGHT_FOR_AGE : BOYS_WEIGHT_FOR_AGE
}

export function ageInMonths(dob, asOf) {
  const a = new Date(dob + 'T00:00:00')
  const b = new Date((asOf || new Date().toISOString().slice(0, 10)) + 'T00:00:00')
  return (b - a) / (1000 * 60 * 60 * 24 * 30.4375)
}

// Returns [P3, P15, P50, P85, P97] in kg at the given age (interpolated linearly between rows)
export function percentileWeights(sex, ageMonths) {
  const t = table(sex)
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

// Estimate percentile (1-99) from weight + age + sex.
// Uses linear interpolation between the 5 reference percentiles.
// Returns null if sex isn't set.
export function estimatePercentile(sex, ageMonths, weightKg) {
  if (!sex || sex === 'other') return null
  const ws = percentileWeights(sex, ageMonths)
  if (weightKg <= ws[0]) {
    // Below P3 — linear extrapolate down toward 1st using the P3-P15 slope
    const slope = (ws[1] - ws[0]) / (15 - 3)
    const p = 3 - (ws[0] - weightKg) / slope
    return Math.max(1, Math.round(p))
  }
  if (weightKg >= ws[4]) {
    const slope = (ws[4] - ws[3]) / (97 - 85)
    const p = 97 + (weightKg - ws[4]) / slope
    return Math.min(99, Math.round(p))
  }
  for (let i = 0; i < 4; i++) {
    if (weightKg >= ws[i] && weightKg <= ws[i + 1]) {
      const f = (weightKg - ws[i]) / (ws[i + 1] - ws[i])
      return Math.round(WHO_PERCENTILES[i] + (WHO_PERCENTILES[i + 1] - WHO_PERCENTILES[i]) * f)
    }
  }
  return null
}

// Build a smooth set of percentile curves across a date range.
// Returns { dates: [Date], curves: { p3:[kg], p15:[kg], p50:[kg], p85:[kg], p97:[kg] } }
export function buildPercentileCurves(sex, dob, startDate, endDate, steps = 40) {
  if (!sex || sex === 'other' || !dob) return null
  const start = new Date(startDate + 'T00:00:00').getTime()
  const end = new Date(endDate + 'T00:00:00').getTime()
  const dates = []
  const out = { p3: [], p15: [], p50: [], p85: [], p97: [] }
  const keys = ['p3', 'p15', 'p50', 'p85', 'p97']
  for (let i = 0; i <= steps; i++) {
    const t = start + (end - start) * (i / steps)
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    const months = ageInMonths(dob, iso)
    const ws = percentileWeights(sex, months)
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
