import { describe, expect, it } from 'vitest'
import { detectPlatform } from './install'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85',
  androidChrome: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  androidInstagram: 'Mozilla/5.0 (Linux; Android 15; SM-S928B Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0 Mobile Safari/537.36 Instagram 390.0',
  androidWebView: 'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0 Mobile Safari/537.36',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
}

describe('detectPlatform', () => {
  const d = (ua: string, extra: Partial<Parameters<typeof detectPlatform>[0]> = {}) =>
    detectPlatform({ ua, standalone: false, hasPrompt: false, ...extra })

  it('recognises an already installed app first', () => {
    expect(d(UA.iphoneSafari, { standalone: true })).toBe('installed')
  })
  it('sends Instagram and other in-app browsers to a real browser', () => {
    expect(d(UA.iphoneInstagram)).toBe('in-app')
    expect(d(UA.androidInstagram, { hasPrompt: true })).toBe('in-app')
    expect(d(UA.androidWebView)).toBe('in-app')
  })
  it('splits iPhone Safari from other iPhone browsers', () => {
    expect(d(UA.iphoneSafari)).toBe('ios-safari')
    expect(d(UA.iphoneChrome)).toBe('ios-other')
    expect(d(UA.ipadDesktopMode, { touchMac: true })).toBe('ios-safari')
  })
  it('uses the native prompt on Android when available', () => {
    expect(d(UA.androidChrome, { hasPrompt: true })).toBe('android-prompt')
    expect(d(UA.androidChrome)).toBe('android-manual')
  })
  it('treats computers separately', () => {
    expect(d(UA.desktopChrome)).toBe('desktop')
    expect(d(UA.desktopChrome, { hasPrompt: true })).toBe('desktop-prompt')
  })
})
