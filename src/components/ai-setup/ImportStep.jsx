import { useState, useRef } from 'react'
import { validateImport } from '../../lib/validateImport'

export default function ImportStep({ onNext, onBack }) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const fileRef = useRef(null)

  function handleValidate(rawText) {
    const { valid, errors: errs, data } = validateImport(rawText)
    if (valid) {
      setErrors([])
      onNext(data)
    } else {
      setErrors(errs)
    }
  }

  function handleSubmit() {
    handleValidate(text)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      setText(content)
      handleValidate(content)
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      setText(content)
      handleValidate(content)
    }
    reader.readAsText(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>Import your data</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          Paste the JSON response from the AI chatbot, or upload the file.
        </p>
      </div>

      <div className="t-form-row stack">
        <label>Paste JSON here</label>
        <textarea
          className="t-import-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='{"medications": [...], "trackers": [...]}'
          rows={8}
        />
      </div>

      <div
        className="t-dropzone"
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <span style={{ fontSize: '1.5rem' }}>+</span>
        <span>Drop a JSON file here or tap to browse</span>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      {errors.length > 0 && (
        <div className="t-import-error">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Issues found:</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {errors.map((err, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{err}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Try asking the AI to regenerate the JSON, making sure to follow the exact format.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="t-btn t-btn-secondary" style={{ flex: 1 }} onClick={onBack}>
          Back
        </button>
        <button className="t-btn t-btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>
          Validate & Preview
        </button>
      </div>
    </div>
  )
}
