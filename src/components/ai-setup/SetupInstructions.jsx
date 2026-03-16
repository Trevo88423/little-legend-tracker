import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const steps = [
  { icon: '1', title: 'Have Something to Add', desc: 'A prescription, clinic whiteboard, feeding plan, or just a description of what to track.' },
  { icon: '2', title: 'Copy the Prompt', desc: 'We\'ll give you a prompt to paste into any AI chatbot (ChatGPT, Claude, Gemini).' },
  { icon: '3', title: 'Send a Photo or Message', desc: 'Attach a photo or type what you want to add, and send it with the prompt.' },
  { icon: '4', title: 'Import the Result', desc: 'Paste the JSON response back here and review before importing.' },
]

export default function SetupInstructions({ onNext }) {
  const [showTips, setShowTips] = useState(false)
  const navigate = useNavigate()

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>Smart Import</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          Snap a photo or describe what to add. An AI chatbot turns it into medications, trackers, weights, and notes.
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
            <li style={{ marginBottom: 4 }}>Take clear, well-lit photos &mdash; or just type what you need</li>
            <li style={{ marginBottom: 4 }}>Any AI chatbot works &mdash; ChatGPT, Claude, Gemini, etc.</li>
            <li style={{ marginBottom: 4 }}>The AI figures out what to fill in and leaves the rest empty</li>
            <li style={{ marginBottom: 4 }}>You can review and remove items before importing</li>
            <li>Use this as many times as you like &mdash; new script, new weight, new tracker</li>
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
