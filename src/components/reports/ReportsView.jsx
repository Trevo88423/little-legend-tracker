import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { useFamily } from '../../contexts/FamilyContext'
import { generateMedSchedule, generateDailySummary, generateWeeklyReport, generateGrowthReport, generateContactsReport } from '../../lib/pdfGenerator'
import { today, daysAgo } from '../../lib/dateUtils'

const reportTypes = [
  {
    id: 'med-schedule',
    title: 'Medication Schedule',
    icon: '💊',
    description: 'Current medications with doses, times, instructions and category. Scheduled doses and PRN/as-needed meds shown in separate sections so handover staff can see at a glance what runs on a clock vs. what waits for symptoms.',
    buttonLabel: 'Generate Med Schedule',
    generator: 'medSchedule',
  },
  {
    id: 'contacts-report',
    title: 'Medical Contacts',
    icon: '👥',
    description: "Every contact you've added — paediatrician, cardiologist, GP, surgeon, therapists, hospital and pharmacy — grouped by role with phone, email, location and notes. Hand to a new provider or sitter for instant context.",
    buttonLabel: 'Generate Contacts Report',
    generator: 'contactsReport',
  },
  {
    id: 'growth-report',
    title: 'Growth Report',
    icon: '📏',
    description: "Latest weight and height with WHO percentiles, embedded growth charts with percentile bands, 2-week trend, and full history. Built for paediatric and cardiology appointments.",
    buttonLabel: 'Generate Growth Report',
    generator: 'growthReport',
  },
  {
    id: 'daily-summary',
    title: 'Daily Summary',
    icon: '📋',
    description: 'Everything logged for the chosen day — meds given, bolus & continuous feeds with totals, latest weight & height with percentiles, custom tracker entries, and notes.',
    buttonLabel: 'Generate Daily Summary',
    generator: 'dailySummary',
  },
  {
    id: 'weekly-report',
    title: 'Period Report',
    icon: '📈',
    description: 'Custom date range overview: medication adherence (overall and per-medication), daily intake (bolus + continuous), weight & height trend with percentiles, plus all notes and a filtered activity timeline. Defaults to the last 7 days; pick any range for "last appointment to now".',
    buttonLabel: 'Generate Period Report',
    generator: 'weeklyReport',
  },
]

export default function ReportsView() {
  const { data, loggerName } = useTracker()
  const { activeChild, family } = useFamily()
  const [generating, setGenerating] = useState(null)
  const [error, setError] = useState(null)

  // Date controls — Daily uses one date, Period uses a from/to range
  const todayStr = today()
  const [dailyDate, setDailyDate] = useState(todayStr)
  const [periodFrom, setPeriodFrom] = useState(daysAgo(6))
  const [periodTo, setPeriodTo] = useState(todayStr)

  async function handleGenerate(type) {
    setGenerating(type)
    setError(null)

    const childName = activeChild?.name || 'Child'

    try {
      switch (type) {
        case 'medSchedule':
          await generateMedSchedule(data.medications || [], childName)
          break
        case 'contactsReport':
          await generateContactsReport(data, activeChild)
          break
        case 'growthReport':
          await generateGrowthReport(data, activeChild)
          break
        case 'dailySummary':
          await generateDailySummary(data, activeChild, dailyDate)
          break
        case 'weeklyReport':
          if (periodFrom > periodTo) {
            setError('"From" date must be before "To" date.')
            return
          }
          await generateWeeklyReport(data, activeChild, { from: periodFrom, to: periodTo })
          break
        default:
          break
      }
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError(`Failed to generate report: ${err.message}`)
    } finally {
      setGenerating(null)
    }
  }

  function renderDateControls(reportId) {
    if (reportId === 'daily-summary') {
      return (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Date
          </label>
          <input
            type="date"
            value={dailyDate}
            max={todayStr}
            onChange={e => setDailyDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )
    }
    if (reportId === 'weekly-report') {
      return (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              From
            </label>
            <input
              type="date"
              value={periodFrom}
              max={periodTo}
              onChange={e => setPeriodFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              To
            </label>
            <input
              type="date"
              value={periodTo}
              min={periodFrom}
              max={todayStr}
              onChange={e => setPeriodTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <div className="ll-card" style={{ marginBottom: '16px' }}>
        <div className="ll-card-header">
          <span className="ll-card-icon">&#128196;</span>
          <h2 className="ll-card-title">Reports</h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Generate PDF reports to share with doctors, specialists, or family members.
          Each report is based on the data currently logged for {activeChild?.name || 'your child'}.
        </p>
      </div>

      {error && (
        <div className="ll-card" style={{ borderLeft: '4px solid var(--color-red)', marginBottom: '16px' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-red)', fontWeight: 700 }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {reportTypes.map((report) => (
          <div key={report.id} className="ll-card">
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '2rem', flexShrink: 0 }}>{report.icon}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '6px' }}>
                  {report.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                  {report.description}
                </p>
                {renderDateControls(report.id)}
                <button
                  className="ll-btn ll-btn-primary"
                  onClick={() => handleGenerate(report.generator)}
                  disabled={generating !== null}
                  style={{ width: '100%' }}
                >
                  {generating === report.generator ? 'Generating...' : report.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
