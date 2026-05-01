import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import GrowthMetricSection from './GrowthMetricSection'

const TABS = [
  { key: 'weight', label: 'Weight' },
  { key: 'height', label: 'Height' },
]

export default function GrowthView() {
  const { data, logWeight, deleteWeight, logHeight, deleteHeight } = useTracker()
  const [activeTab, setActiveTab] = useState('weight')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              background: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-bg)',
              color: activeTab === t.key ? '#fff' : 'var(--color-text-secondary)',
              border: activeTab === t.key ? 'none' : '2px solid var(--color-border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'weight' ? (
        <GrowthMetricSection
          metric="weight"
          title="Weight"
          unit="kg"
          data={data.weights || []}
          logEntry={logWeight}
          deleteEntry={deleteWeight}
          inputMin="0.1"
          inputMax="50"
          inputStep="0.01"
          placeholder="kg"
        />
      ) : (
        <GrowthMetricSection
          metric="length"
          title="Height"
          unit="cm"
          data={data.heights || []}
          logEntry={logHeight}
          deleteEntry={deleteHeight}
          inputMin="30"
          inputMax="200"
          inputStep="0.1"
          placeholder="cm"
        />
      )}
    </div>
  )
}
