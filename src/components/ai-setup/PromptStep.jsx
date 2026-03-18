import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'

const PROMPT_TEXT = `I'm using a baby medication tracker app. Please read the attached photo(s) or information I provide.

IMPORTANT: Before outputting JSON, have a brief conversation with me first. After reading the photo/info:
1. Confirm what medications and other details you found
2. Then ask me about supply & inventory details — group these into one or two messages to keep it quick:
   - For each medication: do I have an open bottle/pack? How much is left?
   - When does each one expire? (if not visible on the label)
   - How many refills do I have remaining?
   - Who prescribed each medication? (if not visible)
   - How many days' warning do I want before running low? (default is 3)
3. Once I've answered, output the final JSON

Keep the conversation friendly and brief. If I say "skip" or "just output it", output the JSON with whatever info you have.

When ready, output a JSON object with this exact format. Only include sections that are relevant — leave the rest as empty arrays or null. Output ONLY the JSON, no other text.

{
  "baby_name": "Name if mentioned (optional)",
  "medications": [
    {
      "id": "existing-uuid-if-updating",
      "name": "Medication name",
      "dose": "e.g. 2.5mL, 1 tablet",
      "dose_amount": 2.5,
      "supply_unit": "mL|tablets|capsules|doses|puffs",
      "supply_remaining": 150,
      "supply_total": 200,
      "refills_remaining": 2,
      "prescription_source": "Prescriber or pharmacy name",
      "expiry_date": "YYYY-MM-DD",
      "opened_date": "YYYY-MM-DD",
      "days_after_opening": 28,
      "low_supply_days": 3,
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
  "feed_schedule": {
    "times": ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
    "target_amount": 90,
    "feed_type": "bottle|tube|breast"
  },
  "feed_plan": {
    "type": "bottle|tube|breast",
    "amount": "Amount per feed as written (e.g. 120mL, 90-120mL)",
    "frequency": "How often",
    "instructions": "Special feeding instructions"
  },
  "notes": ["Any important notes from the source"]
}

Rules:
- Times must be in 24-hour HH:MM format
- Category must be one of: heart, diuretic, stomach, blood, other
- Tracker type must be one of: number, counter, note
- Feed type must be one of: bottle, tube, breast
- feed_schedule.times must be an array of HH:MM strings for each scheduled feed
- feed_schedule.target_amount is the target mL per feed as a number
- If the source mentions a feeding schedule with specific times, use feed_schedule. If it only describes a general plan, use feed_plan
- Weight value in kg
- Include ALL medications mentioned
- If unsure about a category, use "other"
- If a medication is PRN / as-needed, put "as needed" in instructions and set times to an empty array []
- For purpose, use plain parent-friendly language (e.g. "helps the heart pump better" not "afterload reduction")
- dose_amount is the numeric dose per administration (e.g. 2.5 from "2.5mL twice daily")
- supply_unit must be one of: mL, tablets, capsules, doses, puffs
- supply_total is the full bottle or pack size (e.g. 200 for a 200mL bottle)
- supply_remaining is how much is currently left — if it's a new/unopened bottle, set equal to supply_total
- expiry_date and opened_date in YYYY-MM-DD format
- days_after_opening is the number of days the medication is valid after opening (e.g. 28 if label says "use within 28 days of opening")
- low_supply_days defaults to 3 — only include if the parent specifies a different preference
- All supply/inventory fields are optional — omit any you don't have info for
- If the user provides an export from the app (with existing medication IDs), keep the "id" field so the import updates existing medications instead of creating duplicates. If adding new medications, omit the "id" field.
- Output valid JSON only, no markdown fences

Example output for a single medication:
{"baby_name":"Emma","medications":[{"name":"Furosemide","dose":"2mg (0.2mL)","dose_amount":0.2,"supply_unit":"mL","supply_remaining":18.5,"supply_total":30,"refills_remaining":2,"prescription_source":"Westmead Hospital","expiry_date":"2026-09-15","days_after_opening":28,"purpose":"Removes extra fluid to help the heart","category":"diuretic","times":["08:00","20:00"],"instructions":"Give on an empty stomach"}],"trackers":[],"weights":[],"feed_schedule":{"times":["06:00","09:00","12:00","15:00","18:00","21:00"],"target_amount":90,"feed_type":"bottle"},"feed_plan":null,"notes":[]}`

export default function PromptStep({ onNext, onBack }) {
  const { data } = useTracker()
  const [copied, setCopied] = useState(false)
  const [includeMeds, setIncludeMeds] = useState(false)
  const hasMeds = data.medications.length > 0

  function buildPromptText() {
    if (!includeMeds || !hasMeds) return PROMPT_TEXT
    const medsExport = data.medications.map(m => ({
      id: m.id, name: m.name, dose: m.dose, purpose: m.purpose,
      category: m.category, times: m.times, instructions: m.instructions,
      supply_unit: m.supplyUnit, dose_amount: m.doseAmount,
      supply_remaining: m.supplyRemaining, supply_total: m.supplyTotal,
      refills_remaining: m.refillsRemaining, prescription_source: m.prescriptionSource,
      expiry_date: m.expiryDate, opened_date: m.openedDate,
      days_after_opening: m.daysAfterOpening, low_supply_days: m.lowSupplyDays,
    }))
    return PROMPT_TEXT + `\n\nHere are my current medications from the app. Use these IDs when outputting the JSON so the import updates them instead of creating duplicates:\n${JSON.stringify({ medications: medsExport }, null, 2)}`
  }

  async function copyPrompt() {
    const text = buildPromptText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
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
          Paste it into any AI chatbot (ChatGPT, Claude, Gemini) along with a photo or description of what you want to add.
        </p>
      </div>

      <div className="t-prompt-block">
        {PROMPT_TEXT}
      </div>

      {hasMeds && (
        <div className="t-toggle-row" style={{ padding: '8px 0 12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Include current medications</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              Appends your {data.medications.length} med{data.medications.length !== 1 ? 's' : ''} with IDs so the AI can update them
            </div>
          </div>
          <div
            className={`t-toggle ${includeMeds ? 'on' : ''}`}
            onClick={() => setIncludeMeds(prev => !prev)}
          >
            <div className="t-toggle-knob" />
          </div>
        </div>
      )}

      <button
        className={`t-btn ${copied ? 't-btn-green' : 't-btn-primary'}`}
        onClick={copyPrompt}
        style={{ marginBottom: 12 }}
      >
        {copied ? 'Copied!' : includeMeds ? 'Copy Prompt + Meds' : 'Copy Prompt'}
      </button>

      <div className="t-card" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Next steps:</div>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li style={{ marginBottom: 4 }}>Open ChatGPT, Claude, or Gemini</li>
          <li style={{ marginBottom: 4 }}>Paste this prompt</li>
          <li style={{ marginBottom: 4 }}>Attach a photo or type what you want to add</li>
          <li style={{ marginBottom: 4 }}>The AI will ask a few quick questions about your supply levels, expiry dates, and refills &mdash; answer what you can, or say &ldquo;skip&rdquo;</li>
          <li style={{ marginBottom: 4 }}>It will then output the JSON</li>
          <li>Come back here and paste the result</li>
        </ol>
      </div>

      <div className="t-card" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', background: 'var(--color-primary-light)' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Works with anything:</div>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li style={{ marginBottom: 2 }}>Discharge papers or hospital med list &rarr; bulk import all medications</li>
          <li style={{ marginBottom: 2 }}>Photo of a prescription label/bottle &rarr; adds medication with supply &amp; expiry tracking</li>
          <li style={{ marginBottom: 2 }}>Photo of the clinic whiteboard &rarr; adds today&apos;s weight</li>
          <li style={{ marginBottom: 2 }}>Photo of a feeding plan update &rarr; sets up feed schedule with reminders</li>
          <li>&ldquo;We started tracking oxygen sats every 4 hours&rdquo; &rarr; adds a tracker</li>
        </ul>
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
