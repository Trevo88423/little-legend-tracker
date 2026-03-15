import { useEffect, useRef, useCallback } from 'react'
import { formatTime12 } from '../lib/dateUtils'
import { useTracker } from '../contexts/TrackerContext'

export function useNotifications() {
  const { data, isMedGiven } = useTracker()
  const alarmRef = useRef(null)
  const sentRef = useRef(new Set())

  // Reset sent notifications at midnight
  useEffect(() => {
    const now = new Date()
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now
    const timeout = setTimeout(() => sentRef.current.clear(), msUntilMidnight)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!data.settings.medAlarms) return

    function checkMeds() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      data.medications.forEach(med => {
        med.times.forEach(t => {
          const [h, m] = t.split(':').map(Number)
          const medMin = h * 60 + m

          // Notify 5 minutes before
          const earlyKey = `early-${med.id}-${t}`
          if (nowMin === medMin - 5 && !sentRef.current.has(earlyKey) && !isMedGiven(med.id, t)) {
            sendNotification(
              `💊 ${med.name} due in 5 minutes`,
              `${med.dose || ''} at ${formatTime12(t)}`,
              `med-early-${med.id}-${t}`
            )
            sentRef.current.add(earlyKey)
          }

          // Notify at the actual med time
          const dueKey = `due-${med.id}-${t}`
          if (nowMin === medMin && !sentRef.current.has(dueKey) && !isMedGiven(med.id, t)) {
            sendNotification(
              `⏰ ${med.name} is due now!`,
              `${med.dose || ''} — tap to open tracker`,
              `med-due-${med.id}-${t}`
            )
            sentRef.current.add(dueKey)
            playSound()
          }

          // Notify 15 minutes after if still not given
          const lateKey = `late-${med.id}-${t}`
          if (nowMin === medMin + 15 && !sentRef.current.has(lateKey) && !isMedGiven(med.id, t)) {
            sendNotification(
              `⚠️ ${med.name} is 15 minutes overdue`,
              `${med.dose || ''} was due at ${formatTime12(t)}`,
              `med-late-${med.id}-${t}`
            )
            sentRef.current.add(lateKey)
          }
        })
      })
    }

    // Check every 30 seconds so we don't miss a minute boundary
    checkMeds()
    alarmRef.current = setInterval(checkMeds, 30000)

    return () => { if (alarmRef.current) clearInterval(alarmRef.current) }
  }, [data.settings.medAlarms, data.medications])

  function sendNotification(title, body, tag) {
    try {
      new Notification(title, { body, tag, requireInteraction: true })
    } catch (e) {
      // Fallback for mobile - try service worker registration
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, { body, tag, requireInteraction: true })
        }).catch(() => {})
      }
    }
  }

  function playSound() {
    if (!data.settings.soundAlerts) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.3
      osc.start()
      setTimeout(() => { osc.stop(); ctx.close() }, 500)
    } catch (e) { /* ignore */ }
  }
}
