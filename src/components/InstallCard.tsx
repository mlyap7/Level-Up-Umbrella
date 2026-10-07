import { useState, type ReactNode } from 'react'
import { installCardSnoozed, snoozeInstallCard, useInstall, type InstallPlatform } from '../lib/install'

const SAFE_STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// Icons that look like the buttons people need to find on their phone.
const ShareIcon = () => (
  <svg className="install-glyph" viewBox="0 0 24 24" aria-label="Share icon" {...SAFE_STROKE}>
    <path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5v10h14V11h-1" />
  </svg>
)
const AddIcon = () => (
  <svg className="install-glyph" viewBox="0 0 24 24" aria-label="Add icon" {...SAFE_STROKE}>
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
  </svg>
)
const DotsIcon = ({ vertical }: { vertical?: boolean }) => (
  <svg className="install-glyph" viewBox="0 0 24 24" aria-label="Menu icon" fill="currentColor">
    {vertical
      ? <><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></>
      : <><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></>}
  </svg>
)

function Steps({ children }: { children: ReactNode }) {
  return <ol className="install-steps">{children}</ol>
}

function CopyLink() {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin)
        setCopied(true)
      } catch {
        prompt('Copy this link:', window.location.origin)
      }
    }}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
  )
}

/** The instructions for one platform. Shared by the dashboard card and the Profile page. */
export function InstallInstructions({ platform, onInstall }: { platform: InstallPlatform; onInstall: () => void }) {
  switch (platform) {
    case 'installed':
      return <p className="small" style={{ margin: 0 }}>✓ You’re using the installed app. Open it any time from your home screen.</p>
    case 'android-prompt':
    case 'desktop-prompt':
      return (
        <div className="stack-sm">
          <p className="small" style={{ margin: 0 }}>One tap and Level Up sits on your home screen like any other app: full screen, no browser bars.</p>
          <div><button type="button" className="btn" onClick={onInstall}>Install app</button></div>
        </div>
      )
    case 'ios-safari':
      return (
        <Steps>
          <li>Tap the <strong>Share</strong> button <ShareIcon /> at the bottom of Safari. <span className="muted">(On some iPhones it’s inside the <DotsIcon /> menu.)</span></li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong> <AddIcon /></li>
          <li>Tap <strong>Add</strong>. Then open Level Up from your home screen and sign in once more.</li>
        </Steps>
      )
    case 'ios-other':
      return (
        <Steps>
          <li>Tap the <strong>Share</strong> button <ShareIcon /> in the address bar (top right).</li>
          <li>Tap <strong>Add to Home Screen</strong> <AddIcon />. You may need to tap <strong>More</strong> first.</li>
          <li>Tap <strong>Add</strong>, then open Level Up from your home screen and sign in once more.</li>
        </Steps>
      )
    case 'in-app':
      return (
        <div className="stack-sm">
          <p className="small" style={{ margin: 0 }}>You opened this link inside another app (like Instagram), which can’t install apps.</p>
          <Steps>
            <li>Tap the <DotsIcon /> menu at the top right.</li>
            <li>Choose <strong>Open in browser</strong> (or <strong>Open in Safari / Chrome</strong>).</li>
            <li>Install from there. This card will show you how.</li>
          </Steps>
          <div className="row"><span className="small muted">No menu? Copy the link and paste it into Safari or Chrome.</span><CopyLink /></div>
        </div>
      )
    case 'android-manual':
      return (
        <Steps>
          <li>Tap the <DotsIcon vertical /> menu at the top right of your browser.</li>
          <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Don’t see it? Choose <strong>Open in Chrome</strong> first, then try again.</li>
        </Steps>
      )
    case 'desktop':
      return <p className="small" style={{ margin: 0 }}>On your computer, just bookmark this page. To install the app on your phone, open <strong>{window.location.host}</strong> there and follow the steps.</p>
  }
}

const TITLES: Record<InstallPlatform, string> = {
  'installed': 'Installed',
  'in-app': 'Open in your browser to install',
  'ios-safari': 'Add Level Up to your home screen',
  'ios-other': 'Add Level Up to your home screen',
  'android-prompt': 'Install the Level Up app',
  'android-manual': 'Install the Level Up app',
  'desktop-prompt': 'Install the Level Up app',
  'desktop': 'Install the Level Up app',
}

/** Dashboard card. Only shows on phones that haven't installed the app yet. */
export function InstallCard() {
  const { platform, justInstalled, promptInstall } = useInstall()
  const [hidden, setHidden] = useState(installCardSnoozed)

  if (justInstalled) {
    return (
      <div className="install-card" role="status">
        <img className="install-icon" src="/icons/icon-192.png" alt="" />
        <div><strong>Installed!</strong> <span className="small">Find Level Up on your home screen. Use it from there from now on.</span></div>
      </div>
    )
  }
  if (hidden || platform === 'installed' || platform === 'desktop' || platform === 'desktop-prompt') return null

  return (
    <section className="install-card" aria-labelledby="install-title">
      <img className="install-icon" src="/icons/icon-192.png" alt="" />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <h2 id="install-title" style={{ marginBottom: 6 }}>{TITLES[platform]}</h2>
          <button type="button" className="icon-btn" aria-label="Not now" title="Not now"
            onClick={() => { snoozeInstallCard(); setHidden(true) }}>×</button>
        </div>
        <InstallInstructions platform={platform} onInstall={() => void promptInstall()} />
      </div>
    </section>
  )
}

/** Always-available version for the Profile page. */
export function InstallSection() {
  const { platform, promptInstall } = useInstall()
  return (
    <section className="card">
      <div className="card-title"><h2>{platform === 'installed' ? 'App' : TITLES[platform]}</h2></div>
      <InstallInstructions platform={platform} onInstall={() => void promptInstall()} />
    </section>
  )
}

/** Short notice for sign-up/sign-in pages opened inside Instagram, Facebook etc. */
export function InAppBrowserNotice() {
  const { platform } = useInstall()
  if (platform !== 'in-app') return null
  return (
    <div className="alert alert-info small" style={{ marginBottom: 12 }}>
      <strong>Tip:</strong> you’re in another app’s browser. Tap the <DotsIcon /> menu and choose <strong>Open in browser</strong> before signing up, so you can install the app afterwards.
    </div>
  )
}
