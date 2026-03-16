import { useState } from 'react'

const PROMPT_TEXT = `I'm setting up a baby medication tracker app. Please read the attached discharge papers / medication list and output a JSON object with this exact format. Output ONLY the JSON, no other text.

{
  "baby_name": "Name from the papers (optional)",
  "medications": [
    {
      "name": "Medication name",
      "dose": "e.g. 2.5mL, 1 tablet",
      "purpose": "What it's for, in plain parent-friendly language",
      "category": "heart|diuretic|stomach|blood|other",
      "times": ["08:00", "14:00", "20:00"],
      "instructions": "Special instructions (optional)"
    }
  ],
  "trackers": [
    {
      "name": "Thing to track (e.g. Oxygen Saturation)",
      "icon": "emoji (optional)",
      "unit": "unit of measurement (e.g. %, bpm)",
      "type": "number|counter|note"
    }
  ],
  "weights": [
    {
      "date": "YYYY-MM-DD",
      "value": 3.2
    }
  ],
  "feed_plan": {
    "type": "bottle|tube|breast",
    "amount": "Amount per feed as written (e.g. 120mL, 90-120mL)",
    "frequency": "How often",
    "instructions": "Special feeding instructions"
  },
  "notes": ["Any important notes from the papers"]
}

Rules:
- Times must be in 24-hour HH:MM format
- Category must be one of: heart, diuretic, stomach, blood, other
- Tracker type must be one of: number, counter, note
- Feed type must be one of: bottle, tube, breast
- Weight value in kg
- Include ALL medications mentioned in the papers
- If unsure about a category, use "other"
- If a medication is PRN / as-needed, put "as needed" in instructions and set times to an empty array []
- For purpose, use plain parent-friendly language (e.g. "helps the heart pump better" not "afterload reduction")
- Output valid JSON only, no markdown fences

Example output for a single medication:
{"baby_name":"Emma","medications":[{"name":"Furosemide","dose":"2mg (0.2mL)","purpose":"Removes extra fluid to help the heart","category":"diuretic","times":["08:00","20:00"],"instructions":"Give on an empty stomach"}],"trackers":[],"weights":[],"feed_plan":null,"notes":[]}`

export default function PromptStep({ onNext, onBack }) {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_TEXT)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = PROMPT_TEXT
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Copy this prompt</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          Paste it into any AI chatbot (ChatGPT, Claude, Gemini) along with a photo of your discharge papers.
        </p>
      </div>

      <div className="t-prompt-block">
        {PROMPT_TEXT}
      </div>

      <button
        className={`t-btn ${copied ? 't-btn-green' : 't-btn-primary'}`}
        onClick={copyPrompt}
        style={{ marginBottom: 12 }}
      >
        {copied ? 'Copied!' : 'Copy Prompt'}
      </button>

      <div className="t-card" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Next steps:</div>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li style={{ marginBottom: 4 }}>Open ChatGPT, Claude, or Gemini</li>
          <li style={{ marginBottom: 4 }}>Paste this prompt</li>
          <li style={{ marginBottom: 4 }}>Attach a photo of your discharge papers</li>
          <li style={{ marginBottom: 4 }}>Send the message and wait for the JSON response</li>
          <li>Come back here and paste the result</li>
        </ol>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={onBack}>
          Back
        </button>
        <button className="t-btn t-btn-primary" style={{ flex: 1 }} onClick={onNext}>
          I have the JSON
        </button>
      </div>
    </div>
  )
}
