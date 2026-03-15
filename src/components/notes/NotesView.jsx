import { useState } from 'react'
import { useTracker } from '../../contexts/TrackerContext'
import { today, formatTime12, formatDate } from '../../lib/dateUtils'

export default function NotesView() {
  const { data, addNote, deleteNote, getTodayNotes } = useTracker()
  const [noteText, setNoteText] = useState('')

  const todayNotes = getTodayNotes()

  // Group previous notes by date (excluding today)
  const previousNotes = (data.notes || [])
    .filter(n => n.date !== today())
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const previousByDate = {}
  previousNotes.forEach(note => {
    if (!previousByDate[note.date]) previousByDate[note.date] = []
    previousByDate[note.date].push(note)
  })
  const previousDates = Object.keys(previousByDate).sort((a, b) => b.localeCompare(a))

  async function handleSaveNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    await addNote(noteText)
    setNoteText('')
  }

  function handleDelete(id) {
    if (window.confirm('Delete this note?')) {
      deleteNote(id)
    }
  }

  return (
    <div>
      <div className="t-card">
        <div className="t-card-title">Add a Note</div>
        <form onSubmit={handleSaveNote}>
          <div className="t-form-row stack">
            <textarea
              placeholder="Write a note about today..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={3}
            />
          </div>
          <button type="submit" className="t-btn t-btn-primary">
            Save Note
          </button>
        </form>
      </div>

      <div className="t-card">
        <div className="t-card-title">Today's Notes</div>
        {todayNotes.length === 0 ? (
          <div className="t-empty-state">No notes for today</div>
        ) : (
          todayNotes.map(note => (
            <div className="t-notes-entry" key={note.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="t-notes-time">
                  {formatTime12(note.time)}
                  {note.loggedBy ? ` - ${note.loggedBy}` : ''}
                </span>
                <button
                  className="t-delete-btn"
                  onClick={() => handleDelete(note.id)}
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
              <div className="t-notes-text">{note.text}</div>
            </div>
          ))
        )}
      </div>

      {previousDates.length > 0 && (
        <div className="t-card">
          <div className="t-card-title">Previous Notes</div>
          {previousDates.map(date => (
            <div key={date}>
              <div className="t-history-date-header">{formatDate(date)}</div>
              {previousByDate[date].map(note => (
                <div className="t-notes-entry" key={note.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="t-notes-time">
                      {formatTime12(note.time)}
                      {note.loggedBy ? ` - ${note.loggedBy}` : ''}
                    </span>
                    <button
                      className="t-delete-btn"
                      onClick={() => handleDelete(note.id)}
                      title="Delete note"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="t-notes-text">{note.text}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
