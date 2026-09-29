import type { FullSession } from './api'
import type { SessionSet, WeightUnit } from './types'
import { kgTo, round } from './units'

export const FEELINGS = ['Rough', 'Meh', 'Okay', 'Good', 'Strong'] as const

export function feelingLabel(f: number | null) {
  return f ? FEELINGS[f - 1] : null
}

const key = (name: string) => name.trim().toLowerCase()

/** Sets from the most recent session that included this exercise. */
export function lastSetsFor(sessions: FullSession[], exercise: string): { date: string; sets: SessionSet[] } | null {
  // sessions arrive newest first
  for (const s of sessions) {
    const sets = s.sets.filter((x) => key(x.exercise_name) === key(exercise))
    if (sets.length) return { date: s.performed_on, sets: [...sets].sort((a, b) => a.set_number - b.set_number) }
  }
  return null
}

export function formatSet(s: Pick<SessionSet, 'weight_kg' | 'reps' | 'rpe'>, unit: WeightUnit): string {
  const w = s.weight_kg != null ? `${round(kgTo(s.weight_kg, unit))}${unit}` : 'BW'
  const r = s.reps != null ? ` × ${s.reps}` : ''
  const rpe = s.rpe != null ? ` @${s.rpe}` : ''
  return `${w}${r}${rpe}`
}

/** Groups a session's sets by exercise, keeping first-seen order. */
export function groupSets(sets: SessionSet[]): { name: string; sets: SessionSet[] }[] {
  const out = new Map<string, { name: string; sets: SessionSet[] }>()
  for (const s of sets) {
    const k = key(s.exercise_name)
    if (!out.has(k)) out.set(k, { name: s.exercise_name, sets: [] })
    out.get(k)!.sets.push(s)
  }
  for (const g of out.values()) g.sets.sort((a, b) => a.set_number - b.set_number)
  return [...out.values()]
}
