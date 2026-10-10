// Reminder notifications (Web Push).
// The public key below pairs with the private key stored in Supabase
// (push_config). It is safe to publish.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const VAPID_PUBLIC_KEY = 'BMVz5h4iLTM7lXfEhUhoy6YNlt-ko9Ezpm3aAQM8_1FjnH6t5PCQ2XYLGc0WRrv3Tw-r2_U_JPmVITedx0uMAhg'

export type PushState =
  | 'unsupported'       // this browser can't do push (or iPhone outside the home-screen app)
  | 'ios-needs-install' // iPhone/iPad in Safari: only the installed app can get notifications
  | 'default'           // never asked
  | 'denied'            // blocked in phone/browser settings
  | 'granted-off'       // allowed, but this device isn't registered yet
  | 'on'                // all set

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker failed', err))
  })
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_user_agent: navigator.userAgent,
  })
  if (error) throw new Error(error.message)
}

export async function readPushState(): Promise<PushState> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported) return isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return 'granted-off'
  // Make sure the server knows about this device (e.g. a new sign-in on it).
  await save(sub).catch(() => undefined)
  return 'on'
}

/** Must be called from a tap/click: browsers only show the permission prompt then. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) }))
  await save(sub)
  return 'on'
}

export async function disablePush() {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? 'Could not send. Reminders may not be set up on the server yet.')
  }
  return `Sent to ${(data as { sent: number }).sent} device(s). It should arrive in a few seconds.`
}

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null)
  const refresh = useCallback(() => { readPushState().then(setState, () => setState('unsupported')) }, [])
  useEffect(() => {
    refresh()
    // Re-check when they come back from phone settings.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])
  return { state, setState, refresh }
}
