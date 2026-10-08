import { addDays, daysBetween, weekStart } from './dates'
import type { Pose, ProgressPhoto } from './types'

export const POSES: { pose: Pose; label: string; tip: string }[] = [
  { pose: 'front', label: 'Front', tip: 'Face the camera, arms relaxed by your sides' },
  { pose: 'side', label: 'Side', tip: 'Turn 90°, stand tall, arms relaxed' },
  { pose: 'back', label: 'Back', tip: 'Back to the camera, arms relaxed' },
]

/**
 * Photos are taken every second week, counted from the week the client
 * started with Level Up, so not every client is due the same week.
 */
export function isPhotoWeek(startedOn: string, today: string): boolean {
  const weeks = Math.floor(daysBetween(weekStart(startedOn), weekStart(today)) / 7)
  return weeks >= 0 && weeks % 2 === 0
}

/** Due when it's a photo week and nothing was uploaded in the last 10 days. */
export function photosDue(startedOn: string, today: string, photos: Pick<ProgressPhoto, 'taken_on'>[]): boolean {
  if (!isPhotoWeek(startedOn, today)) return false
  const since = addDays(today, -10)
  return !photos.some((p) => p.taken_on >= since)
}

/** Groups photos by date, newest first. */
export function photoSets(photos: ProgressPhoto[]): { date: string; byPose: Partial<Record<Pose, ProgressPhoto>> }[] {
  const map = new Map<string, Partial<Record<Pose, ProgressPhoto>>>()
  for (const p of photos) {
    if (!map.has(p.taken_on)) map.set(p.taken_on, {})
    map.get(p.taken_on)![p.pose] = p
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, byPose]) => ({ date, byPose }))
}
