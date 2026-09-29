import { useEffect, useState } from 'react'

/**
 * Reads CSS custom properties as concrete colours. SVG presentation attributes
 * (used by the chart library) don't reliably resolve var(), so we pass hex values
 * and re-read them when the colour scheme flips.
 */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Record<T, string>
  }
  const [vars, setVars] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setVars(read())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return vars
}
