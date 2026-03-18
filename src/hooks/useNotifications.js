import { useEffect, useRef, useCallback } from 'react'
import { formatTime12 } from '../lib/dateUtils'
import { useTracker } from '../contexts/TrackerContext'

export function useNotifications() {
  const { data, isMedGiven, isFeedDone, getMedSupplyInfo } = useTracker()
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
  }, [data.settings.medAlarms, data.medications, isMedGiven])

  function sendNotification(title, body, tag) {
    // Always use service worker showNotification so tags deduplicate
    // with server-side push notifications (which also use SW tags)
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          tag,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        })
      }).catch(() => {
        // Last resort fallback
        try { new Notification(title, { body, tag, requireInteraction: true }) } catch {}
      })
    } else {
      try { new Notification(title, { body, tag, requireInteraction: true }) } catch {}
    }
  }

  // Feed schedule notifications
  useEffect(() => {
    if (!data.settings.feedAlarms || !data.feedSchedule) return

    function checkFeeds() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      data.feedSchedule.times.forEach(t => {
        const [h, m] = t.split(':').map(Number)
        const feedMin = h * 60 + m

        const dueKey = `feed-due-${t}`
        if (nowMin === feedMin && !sentRef.current.has(dueKey) && !isFeedDone(t)) {
          const target = data.feedSchedule.targetAmount
          sendNotification(
            `\uD83C\uDF7C Feed due now!`,
            `${target ? target + ' mL ' : ''}${formatTime12(t)} — tap to log`,
            `feed-due-${t}`
          )
          sentRef.current.add(dueKey)
          playSound()
        }
      })
    }

    checkFeeds()
    const interval = setInterval(checkFeeds, 30000)
    return () => clearInterval(interval)
  }, [data.settings.feedAlarms, data.feedSchedule, isFeedDone])

  // Supply and expiry notifications (once per day)
  useEffect(() => {
    if (!data.settings.medAlarms || data.medications.length === 0) return

    function checkSupply() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return

      data.medications.forEach(med => {
        const info = getMedSupplyInfo(med.id)
        if (!info) return

        const lowKey = `supply-low-${med.id}`
        if (info.isLow && !sentRef.current.has(lowKey)) {
          sendNotification(
            `\u26A0\uFE0F Low supply: ${med.name}`,
            `${Math.round(info.daysRemaining)} days remaining (${info.supplyRemaining}${info.supplyUnit})`,
            `supply-low-${med.id}`
          )
          sentRef.current.add(lowKey)
        }

        const expKey = `supply-exp-${med.id}`
        if (info.isExpiringSoon && !info.isExpired && !sentRef.current.has(expKey)) {
          sendNotification(
            `\u26A0\uFE0F Expiring soon: ${med.name}`,
            `Expires in ${info.daysUntilExpiry} days`,
            `supply-exp-${med.id}`
          )
          sentRef.current.add(expKey)
        }

        const expiredKey = `supply-expired-${med.id}`
        if (info.isExpired && !sentRef.current.has(expiredKey)) {
          sendNotification(
            `\u274C Expired: ${med.name}`,
            'This medication has expired and should not be used',
            `supply-expired-${med.id}`
          )
          sentRef.current.add(expiredKey)
        }
      })
    }

    checkSupply()
    const interval = setInterval(checkSupply, 30000)
    return () => clearInterval(interval)
  }, [data.settings.medAlarms, data.medications, getMedSupplyInfo])

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
