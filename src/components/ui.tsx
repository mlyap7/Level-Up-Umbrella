import type { ReactNode } from 'react'

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-title">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function ErrorMsg({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return <div className="alert alert-error" role="alert">{error}</div>
}

export function Loading() {
  return <div className="empty" aria-live="polite">Loading…</div>
}

export function UnitInput({ unit, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="input-unit">
      <input inputMode="decimal" autoComplete="off" {...props} />
      <span>{unit}</span>
    </div>
  )
}

/** 1–N rating buttons. Radio-group semantics for screen readers. */
export function RatingScale({ value, onChange, max = 10, low, high, label }: {
  value: number | null
  onChange: (v: number) => void
  max?: 5 | 10
  low?: string
  high?: string
  label: string
}) {
  return (
    <div>
      <div className={`scale ${max === 5 ? 'five' : ''}`} role="radiogroup" aria-label={label}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-pressed={value === n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      {(low || high) && <div className="scale-ends"><span>{low}</span><span>{high}</span></div>}
    </div>
  )
}

export const MOODS = ['Awful', 'Low', 'Okay', 'Good', 'Great'] as const

export function moodLabel(m: number | null) {
  return m ? MOODS[m - 1] : null
}
