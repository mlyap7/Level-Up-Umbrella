import { useState } from 'react'
import { enablePush, sendTestPush, disablePush, usePushState, type PushState } from '../lib/push'

const isAndroid = () => /Android/i.test(navigator.userAgent)
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** How to unblock notifications on this kind of device. */
export function UnblockSteps() {
  if (isIOS()) {
    return (
      <ol className="install-steps">
        <li>Open your iPhone <strong>Settings</strong> app.</li>
        <li>Tap <strong>Notifications</strong>, then <strong>Level Up</strong>.</li>
        <li>Turn on <strong>Allow Notifications</strong>, then come back here.</li>
      </ol>
    )
  }
  if (isAndroid() && installed()) {
    return (
      <ol className="install-steps">
        <li>Press and hold the <strong>Level Up</strong> icon on your home screen.</li>
        <li>Tap <strong>App info</strong> (the ⓘ), then <strong>Notifications</strong>.</li>
        <li>Turn notifications <strong>on</strong>, then come back here.</li>
      </ol>
    )
  }
  if (isAndroid()) {
    return (
      <ol className="install-steps">
        <li>Tap the icon to the <strong>left of the web address</strong> at the top of Chrome.</li>
        <li>Tap <strong>Permissions</strong> (or <strong>Site settings</strong>), then <strong>Notifications</strong>.</li>
        <li>Choose <strong>Allow</strong>, then come back here.</li>
      </ol>
    )
  }
  return (
    <ol className="install-steps">
      <li>Click the icon to the <strong>left of the web address</strong>.</li>
      <li>Find <strong>Notifications</strong> and set it to <strong>Allow</strong>.</li>
      <li>Reload this page.</li>
    </ol>
  )
}

const DISMISS_KEY = 'levelup.reminders.dismissedUntil'
const snoozed = () => { try { return Date.now() < Number(localStorage.getItem(DISMISS_KEY) ?? 0) } catch { return false } }
const snooze = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 3 * 86_400_000)) } catch { /* ignore */ } }

/** Dashboard card: asks to turn on reminders, or explains how to unblock them. */
export function RemindersCard() {
  const { state, setState, refresh } = usePushState()
  const [hidden, setHidden] = useState(snoozed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justOn, setJustOn] = useState(false)

  if (justOn) {
    return (
      <section className="promo-card" role="status">
        <span className="tour-icon" aria-hidden>🔔</span>
        <div><strong>Reminders are on!</strong> <span className="small">You’ll get a nudge at 8am if you haven’t checked in yet. Change them anytime in Profile.</span></div>
      </section>
    )
  }
  if (!state || hidden || state === 'on' || state === 'unsupported' || state === 'ios-needs-install') return null

  async function turnOn() {
    setBusy(true); setError(null)
    try {
      const next = await enablePush()
      setState(next)
      if (next === 'on') setJustOn(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn on reminders.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="promo-card" aria-label="Reminders">
      <span className="tour-icon" aria-hidden>🔔</span>
      <div className="grow">
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <h2 style={{ marginBottom: 4 }}>{state === 'denied' ? 'Notifications are blocked' : 'Turn on reminders'}</h2>
          <button type="button" className="icon-btn" aria-label="Not now" onClick={() => { snooze(); setHidden(true) }}>×</button>
        </div>
        {state === 'denied' ? (
          <>
            <p className="small" style={{ margin: '0 0 8px' }}>Your phone is blocking Level Up’s reminders. Here’s how to allow them:</p>
            <UnblockSteps />
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={refresh}>I’ve done it, check again</button>
          </>
        ) : (
          <>
            <p className="small" style={{ margin: '0 0 10px' }}>Get a nudge at 8am if you haven’t done your morning check-in, plus your Sunday check-in and photo weeks. When your phone asks, tap <strong>Allow</strong>.</p>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void turnOn()}>{busy ? 'Turning on…' : 'Turn on reminders'}</button>
          </>
        )}
        {error && <p className="small" style={{ color: 'var(--crit)', margin: '8px 0 0' }}>{error}</p>}
      </div>
    </section>
  )
}

/** Status line + buttons for the Profile page. */
export function PushStatus() {
  const { state, setState, refresh } = usePushState()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (fn: () => Promise<PushState | string | void>) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fn()
      if (typeof r === 'string' && !['on', 'default', 'denied', 'granted-off', 'unsupported', 'ios-needs-install'].includes(r)) setMsg({ ok: true, text: r })
      else if (r) setState(r as PushState)
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }

  if (!state) return null
  return (
    <div className="stack-sm">
      {state === 'on' && (
        <>
          <p className="small" style={{ margin: 0 }}>✅ Notifications are <strong>on</strong> for this phone.</p>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(sendTestPush)}>Send me a test notification</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(async () => { await disablePush(); return 'granted-off' as PushState })}>Turn off on this phone</button>
          </div>
        </>
      )}
      {(state === 'default' || state === 'granted-off') && (
        <>
          <p className="small" style={{ margin: 0 }}>Notifications are <strong>off</strong> for this phone.</p>
          <div><button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(enablePush)}>Turn on notifications</button></div>
        </>
      )}
      {state === 'denied' && (
        <>
          <p className="small" style={{ margin: 0 }}>Notifications are <strong>blocked</strong> in your phone’s settings:</p>
          <UnblockSteps />
          <div><button type="button" className="btn btn-secondary btn-sm" onClick={refresh}>Check again</button></div>
        </>
      )}
      {state === 'ios-needs-install' && (
        <p className="small" style={{ margin: 0 }}>On iPhone, reminders only work in the installed app. Add Level Up to your home screen (see “Add Level Up to your home screen” above), open it from there, and turn notifications on here.</p>
      )}
      {state === 'unsupported' && (
        <p className="small" style={{ margin: 0 }}>This browser can’t show notifications. On Android use Chrome; on iPhone use the app from your home screen.</p>
      )}
      {msg && <p className="small" style={{ margin: 0, color: msg.ok ? 'var(--good)' : 'var(--crit)' }}>{msg.text}</p>}
    </div>
  )
}
