import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { useFamily } from '../../contexts/FamilyContext'
import { generateMedSchedule, generateDailySummary, generateWeeklyReport, generateGrowthReport } from '../../lib/pdfGenerator'

const reportTypes = [
  {
    id: 'med-schedule',
    title: 'Medication Schedule',
    icon: '\uD83D\uDC8A',
    description: 'A complete list of current medications with doses, times, and instructions. Perfect for handing to a new nurse or specialist.',
    buttonLabel: 'Generate Med Schedule',
    generator: 'medSchedule',
  },
  {
    id: 'growth-report',
    title: 'Growth Report',
    icon: '📏',
    description: "Latest weight and height with WHO percentiles, 2-week percentile trend, and full history. Built for paediatric and cardiology appointments.",
    buttonLabel: 'Generate Growth Report',
    generator: 'growthReport',
  },
  {
    id: 'daily-summary',
    title: 'Daily Summary',
    icon: '\uD83D\uDCCB',
    description: 'Everything logged today — meds given, bolus & continuous feeds with totals, latest weight & height with percentiles, custom tracker entries, and notes. Great for end-of-day handover.',
    buttonLabel: 'Generate Daily Summary',
    generator: 'dailySummary',
  },
  {
    id: 'weekly-report',
    title: 'Weekly Report',
    icon: '\uD83D\uDCC8',
    description: 'A 7-day overview: medication adherence (overall and per-medication), daily intake (bolus + continuous), weight & height trend with percentiles. Ideal for cardiology follow-ups.',
    buttonLabel: 'Generate Weekly Report',
    generator: 'weeklyReport',
  },
]

export default function ReportsView() {
  const { data, loggerName } = useTracker()
  const { activeChild, family } = useFamily()
  const [generating, setGenerating] = useState(null)
  const [error, setError] = useState(null)

  async function handleGenerate(type) {
    setGenerating(type)
    setError(null)

    const context = {
      child: activeChild,
      family,
      loggerName,
      data,
    }

    const childName = activeChild?.name || 'Child'

    try {
      switch (type) {
        case 'medSchedule':
          await generateMedSchedule(data.medications || [], childName)
          break
        case 'growthReport':
          await generateGrowthReport(data, activeChild)
          break
        case 'dailySummary':
          await generateDailySummary(data, activeChild)
          break
        case 'weeklyReport':
          await generateWeeklyReport(data, activeChild)
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
