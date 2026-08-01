import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = 'BOlhXFiuCyrX8_8Nq0b89qgBrwW_aptffO1-iHTIFaImBpJ200GeTMc9aX1p6VRDt-mQ_TttDfYfGEuVgKNfFsk'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// État partagé entre toutes les instances du hook (AppLayout, SettingsSection…)
// pour qu'un abonnement activé à un endroit soit reflété partout.
interface PushState {
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
}

let pushState: PushState = {
  permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  subscribed: false,
}
const listeners = new Set<() => void>()

function setPushState(partial: Partial<PushState>) {
  pushState = { ...pushState, ...partial }
  listeners.forEach(l => l())
}

function subscribeStore(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return pushState
}

let checkedForUserId: string | null = null

export function usePushNotifications(userId: string | null) {
  const { permission, subscribed } = useSyncExternalStore(subscribeStore, getSnapshot)

  // Check existing subscription on mount (une seule fois par utilisateur,
  // toutes instances confondues)
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (checkedForUserId === userId) return
    checkedForUserId = userId

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        setPushState({ subscribed: true })
        // Ensure it's saved in DB (idempotent upsert)
        await saveSubscription(userId, sub)
      }
    })
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return false

    try {
      const perm = await Notification.requestPermission()
      setPushState({ permission: perm })
      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        })
      }

      const saved = await saveSubscription(userId, sub)
      if (!saved) {
        // Abonnement navigateur OK mais jamais enregistré côté serveur :
        // ne pas prétendre que c'est activé
        return false
      }
      setPushState({ subscribed: true })
      return true
    } catch (e) {
      console.error('Push subscription error:', e)
      return false
    }
  }, [userId])

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        // Remove from DB
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
      }
      setPushState({ subscribed: false })
    } catch (e) {
      console.error('Push unsubscribe error:', e)
    }
  }, [])

  return { permission, subscribed, subscribe, unsubscribe }
}

async function saveSubscription(userId: string, sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) {
    console.error('Push subscription save error:', error)
    return false
  }
  return true
}
