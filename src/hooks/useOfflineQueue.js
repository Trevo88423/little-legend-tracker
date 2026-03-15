import { useState, useEffect, useCallback } from 'react'

const DB_NAME = 'little-legend-offline'
const STORE_NAME = 'queue'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueLength, setQueueLength] = useState(0)

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); flushQueue() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const enqueue = useCallback(async (operation) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).add({
        ...operation,
        timestamp: Date.now()
      })
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
      })
      setQueueLength(prev => prev + 1)
    } catch (err) {
      console.error('Failed to enqueue operation:', err)
    }
  }, [])

  const flushQueue = useCallback(async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const items = await new Promise((resolve, reject) => {
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      if (items.length === 0) return

      const { supabase } = await import('../lib/supabase')

      for (const item of items) {
        try {
          const { table, operation, data: opData, match } = item
          if (operation === 'insert') {
            await supabase.from(table).insert(opData)
          } else if (operation === 'upsert') {
            await supabase.from(table).upsert(opData)
          } else if (operation === 'update') {
            await supabase.from(table).update(opData).match(match)
          } else if (operation === 'delete') {
            await supabase.from(table).delete().match(match)
          }

          // Remove from queue
          const delTx = db.transaction(STORE_NAME, 'readwrite')
          delTx.objectStore(STORE_NAME).delete(item.id)
        } catch (err) {
          console.error('Failed to flush operation:', err)
          break // Stop on first failure
        }
      }

      setQueueLength(0)
    } catch (err) {
      console.error('Failed to flush queue:', err)
    }
  }, [])

  return { isOnline, queueLength, enqueue, flushQueue }
}
