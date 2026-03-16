import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFamily } from '../contexts/FamilyContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isIOSInstalled() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
}

export function usePushSubscription() {
  const { family, activeChild } = useFamily()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastChildRef = useRef(null)

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const pushSupported = 'serviceWorker' in navigator &&
    'PushManager' in window &&
    VAPID_PUBLIC_KEY.length > 0 &&
    (!isIOS || isIOSInstalled())

  // Check current push permission and subscription status
  useEffect(() => {
    if (!pushSupported) return

    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setPushEnabled(!!sub)
      })
    })
  }, [pushSupported])

  // Re-sync subscription when activeChild changes
  useEffect(() => {
    if (!pushSupported || !pushEnabled || !family?.id || !activeChild?.id) return
    if (lastChildRef.current === activeChild.id) return
    lastChildRef.current = activeChild.id

    // Re-upsert subscription with new child_id
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (!sub) return
        const subJson = sub.toJSON()
        return supabase.rpc('upsert_push_subscription', {
          p_family_id: family.id,
          p_child_id: activeChild.id,
          p_endpoint: sub.endpoint,
          p_p256dh: subJson.keys.p256dh,
          p_auth: subJson.keys.auth,
          p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })
    })
  }, [pushSupported, pushEnabled, family?.id, activeChild?.id])

  // Listen for subscription changes from service worker
  useEffect(() => {
    if (!pushSupported) return

    function handleMessage(event) {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && family?.id && activeChild?.id) {
        const newSub = event.data.subscription
        supabase.rpc('upsert_push_subscription', {
          p_family_id: family.id,
          p_child_id: activeChild.id,
          p_endpoint: newSub.endpoint,
          p_p256dh: newSub.keys.p256dh,
          p_auth: newSub.keys.auth,
          p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [pushSupported, family?.id, activeChild?.id])

  const subscribe = useCallback(async () => {
    if (!pushSupported || !family?.id || !activeChild?.id) return
    setLoading(true)
    setError(null)

    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setError('Notification permission denied. Check browser settings.')
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
      }

      const subJson = sub.toJSON()
      const { error: rpcError } = await supabase.rpc('upsert_push_subscription', {
        p_family_id: family.id,
        p_child_id: activeChild.id,
        p_endpoint: sub.endpoint,
        p_p256dh: subJson.keys.p256dh,
        p_auth: subJson.keys.auth,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })

      if (rpcError) throw rpcError

      setPushEnabled(true)
      lastChildRef.current = activeChild.id
    } catch (err) {
      setError(err.message || 'Failed to enable push notifications')
    } finally {
      setLoading(false)
    }
  }, [pushSupported, family?.id, activeChild?.id])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        await supabase.rpc('remove_push_subscription', {
          p_endpoint: sub.endpoint
        })
        await sub.unsubscribe()
      }

      setPushEnabled(false)
      lastChildRef.current = null
    } catch (err) {
      setError(err.message || 'Failed to disable push notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    pushSupported,
    pushEnabled,
    pushPermission,
    subscribe,
    unsubscribe,
    loading,
    error,
    isIOS,
    isIOSInstalled: isIOS && isIOSInstalled()
  }
}
