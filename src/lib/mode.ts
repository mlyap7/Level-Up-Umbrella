// Coaches switch between coaching their clients and tracking their own
// journey. The choice is remembered on this device so the app reopens there.
export type CoachMode = 'coaching' | 'journey'

const KEY = 'levelup.coachMode'

export function getCoachMode(): CoachMode {
  try {
    return localStorage.getItem(KEY) === 'journey' ? 'journey' : 'coaching'
  } catch {
    return 'coaching'
  }
}

export function setCoachMode(mode: CoachMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Private browsing: the switch still works, it just isn't remembered.
  }
}
