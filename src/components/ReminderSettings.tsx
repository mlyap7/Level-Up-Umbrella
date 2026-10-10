import { useState } from 'react'
import { updateProfile } from '../lib/api'
import { useAuth, useProfile } from '../lib/auth'
import type { Profile } from '../lib/types'
import { PushStatus } from './RemindersCard'
import { Card, ErrorMsg } from './ui'

type Key = 'remind_morning' | 'remind_checkin' | 'remind_photos' | 'remind_water'

const ITEMS: { key: Key; title: string; detail: string }[] = [
  { key: 'remind_morning', title: 'Morning check-in', detail: '8am, only if you haven’t logged your weight yet' },
  { key: 'remind_checkin', title: 'Sunday check-in', detail: 'Sunday 7pm, if you haven’t sent this week’s check-in' },
  { key: 'remind_photos', title: 'Photo week', detail: 'Saturday 9am every second week, if photos are due' },
  { key: 'remind_water', title: 'Water reminders', detail: 'From 10am to 8pm' },
]

export function ReminderSettings() {
  const profile = useProfile()
  const { refreshProfile } = useAuth()
  const [values, setValues] = useState<Pick<Profile, Key | 'water_every_hours'>>({
    remind_morning: profile.remind_morning, remind_checkin: profile.remind_checkin,
    remind_photos: profile.remind_photos, remind_water: profile.remind_water,
    water_every_hours: profile.water_every_hours ?? 2,
  })
  const [error, setError] = useState<string | null>(null)

  if (profile.remind_morning === undefined) return null // reminders database update not run yet

  async function change(patch: Partial<typeof values>) {
    const before = values
    setValues((v) => ({ ...v, ...patch }))
    setError(null)
    try {
      await updateProfile(profile.id, patch)
      await refreshProfile()
    } catch (err) {
      setValues(before)
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  return (
    <Card title="Reminders">
      <div className="stack">
        <PushStatus />
        <div className="stack-sm">
          {ITEMS.map((it) => (
            <label key={it.key} className="switch-row">
              <span>
                <strong>{it.title}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {it.key === 'remind_water' ? `Every ${values.water_every_hours} hours, ${it.detail.toLowerCase()}` : it.detail}
                </span>
              </span>
              <input type="checkbox" role="switch" className="switch" checked={Boolean(values[it.key])}
                onChange={(e) => void change({ [it.key]: e.target.checked })} aria-label={it.title} />
            </label>
          ))}
          {values.remind_water && (
            <div className="segmented" role="group" aria-label="Water reminder frequency" style={{ alignSelf: 'flex-start' }}>
              {([2, 3] as const).map((h) => (
                <button key={h} type="button" aria-pressed={values.water_every_hours === h} onClick={() => void change({ water_every_hours: h })}>Every {h} hours</button>
              ))}
            </div>
          )}
        </div>
        <ErrorMsg error={error} />
      </div>
    </Card>
  )
}
