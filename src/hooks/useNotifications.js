import { useEffect, useRef } from 'react'
import { formatTime12 } from '../lib/dateUtils'
import { useTracker } from '../contexts/TrackerContext'

export function useNotifications() {
  const { data, isMedGiven } = useTracker()
  const alarmRef = useRef(null)

  useEffect(() => {
    if (!data.settings.medAlarms) return

    alarmRef.current = setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      data.medications.forEach(med => {
        med.times.forEach(t => {
          const [h, m] = t.split(':').map(Number)
          const notifyMin = h * 60 + m - 5
          const nowMin = now.getHours() * 60 + now.getMinutes()
          if (nowMin === notifyMin && !isMedGiven(med.id, t)) {
            new Notification(`\uD83D\uDC8A ${med.name} due in 5 minutes`, {
              body: `${med.dose} at ${formatTime12(t)}`,
              tag: `med-${med.id}-${t}`,
              requireInteraction: true,
            })
            if (data.settings.soundAlerts) {
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
        })
      })
    }, 60000)

    return () => { if (alarmRef.current) clearInterval(alarmRef.current) }
  }, [data.settings.medAlarms, data.settings.soundAlerts, data.medications])

  function requestPermission() {
    if ('Notification' in window) {
      return Notification.requestPermission()
    }
    return Promise.resolve('denied')
  }

  return { requestPermission }
}
