import type { LengthUnit, WeightUnit } from './types'

const LB_PER_KG = 2.20462262
const CM_PER_IN = 2.54

export function kgTo(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG
}

export function cmTo(cm: number, unit: LengthUnit): number {
  return unit === 'cm' ? cm : cm / CM_PER_IN
}

export function toCm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value : value * CM_PER_IN
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return '–'
  return `${round(kgTo(kg, unit)).toFixed(1)} ${unit}`
}

export function formatLength(cm: number | null | undefined, unit: LengthUnit): string {
  if (cm == null) return '–'
  return `${round(cmTo(cm, unit)).toFixed(1)} ${unit}`
}

/** Parses a number typed by a user. Accepts a comma as decimal separator. */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "+0.4 kg", "−1.2 kg", "±0.0 kg". Rounds first so tiny changes never show as "−0.0". */
export function formatChange(value: number | null, unit: string, decimals = 1): string {
  if (value == null) return '–'
  const r = round(value, decimals)
  const sign = r > 0 ? '+' : r < 0 ? '−' : '±'
  return `${sign}${Math.abs(r).toFixed(decimals)}${unit ? ` ${unit}` : ''}`
}
