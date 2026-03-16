import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const steps = [
  { icon: '1', title: 'Gather Your Papers', desc: 'Find your discharge papers, medication list, or care instructions.' },
  { icon: '2', title: 'Copy the Prompt', desc: 'We\'ll give you a prompt to paste into any AI chatbot (ChatGPT, Claude, Gemini).' },
  { icon: '3', title: 'Photograph & Send', desc: 'Take a photo of your papers and send it to the AI along with the prompt.' },
  { icon: '4', title: 'Import the Result', desc: 'Paste the JSON response back here and we\'ll set everything up.' },
]

export default function SetupInstructions({ onNext }) {
  const [showTips, setShowTips] = useState(false)
  const navigate = useNavigate()

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>AI-Powered Quick Setup</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          Import medications, trackers, and care plans from your discharge papers in minutes.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div className="t-card" key={i} style={{ marginBottom: 0, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gradient-primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '0.85rem', flexShrink: 0
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        className="t-btn t-btn-secondary t-btn-small"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={() => setShowTips(!showTips)}
      >
        {showTips ? 'Hide Tips' : 'Show Tips'}
      </button>

      {showTips && (
        <div className="t-card" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Tips for best results:</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 4 }}>Take clear, well-lit photos of your papers</li>
            <li style={{ marginBottom: 4 }}>Include all pages that mention medications or feeding plans</li>
            <li style={{ marginBottom: 4 }}>Any AI chatbot works &mdash; ChatGPT, Claude, Gemini, etc.</li>
            <li style={{ marginBottom: 4 }}>If the AI gets something wrong, you can edit or remove items before importing</li>
            <li>You can always add more medications manually in Settings</li>
          </ul>
        </div>
      )}

      <button className="t-btn t-btn-primary" onClick={onNext}>
        Get Started
      </button>

      <button
        className="t-btn t-btn-secondary"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => navigate('/app/settings')}
      >
        I&apos;ll set up manually instead
      </button>
    </div>
  )
}
