// "Install the app" support (Progressive Web App).
//
// Android Chrome fires `beforeinstallprompt`, which we keep so our own button
// can open the real install dialog at any time. iPhones never prompt, so we
// show Share → Add to Home Screen instructions instead. Browsers built into
// other apps (Instagram, WhatsApp, Facebook…) can't install at all, so we tell
// people to open the link in Safari or Chrome first.
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform =
  | 'installed'       // already running from the home screen
  | 'in-app'          // inside Instagram/Facebook/etc: must open in a real browser
  | 'ios-safari'      // Share → Add to Home Screen
  | 'ios-other'       // Chrome/Firefox/Edge on iPhone: share icon in the address bar
  | 'android-prompt'  // we can open the native install dialog
  | 'android-manual'  // ⋮ menu → Install app
  | 'desktop-prompt'
  | 'desktop'

let deferred: BeforeInstallPromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Call once at startup, before React renders, so the event isn't missed. */
export function captureInstallEvents() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own card instead of Chrome's bar
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    justInstalled = true
    notify()
  })
}

export function detectPlatform(opts: { ua: string; standalone: boolean; hasPrompt: boolean; touchMac?: boolean }): InstallPlatform {
  const { ua, standalone, hasPrompt, touchMac = false } = opts
  if (standalone) return 'installed'
  if (/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|Twitter|TikTok|musical_ly|Bytedance|Snapchat|LinkedInApp|WhatsApp/i.test(ua)) return 'in-app'
  const ios = /iPhone|iPad|iPod/i.test(ua) || touchMac
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/i.test(ua)) {
    if (/; wv\)/.test(ua)) return 'in-app' // Android WebView inside another app
    return hasPrompt ? 'android-prompt' : 'android-manual'
  }
  return hasPrompt ? 'desktop-prompt' : 'desktop'
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function snapshot() {
  return `${deferred ? 1 : 0}${justInstalled ? 1 : 0}`
}

export function useInstall() {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    snapshot,
    snapshot,
  )
  const platform = justInstalled
    ? 'installed'
    : detectPlatform({
        ua: navigator.userAgent,
        standalone: isStandalone(),
        hasPrompt: deferred != null,
        touchMac: /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1,
      })
  return {
    platform,
    justInstalled,
    /** Opens the browser's install dialog. Returns true if the person accepted. */
    async promptInstall(): Promise<boolean> {
      if (!deferred) return false
      const e = deferred
      deferred = null // each event can only be used once
      notify()
      await e.prompt()
      const { outcome } = await e.userChoice
      return outcome === 'accepted'
    },
  }
}

// ---------------------------------------------------------------- snoozing
// The card can be dismissed. It comes back after a few days, and stops
// appearing on its own after three dismissals (Profile always has it).

const KEY = 'levelup.install.dismissals'
const SNOOZE_DAYS = [1, 3, 7]

interface Dismissals { count: number; until: number }

function readDismissals(): Dismissals {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Dismissals | null
    return v && typeof v.count === 'number' ? v : { count: 0, until: 0 }
  } catch {
    return { count: 0, until: 0 }
  }
}

export function installCardSnoozed(now = Date.now()): boolean {
  const d = readDismissals()
  return d.count >= SNOOZE_DAYS.length || now < d.until
}

export function snoozeInstallCard(now = Date.now()) {
  const d = readDismissals()
  const days = SNOOZE_DAYS[Math.min(d.count, SNOOZE_DAYS.length - 1)]
  try {
    localStorage.setItem(KEY, JSON.stringify({ count: d.count + 1, until: now + days * 86_400_000 }))
  } catch {
    // Storage blocked (private mode): the card simply shows again next visit.
  }
}
