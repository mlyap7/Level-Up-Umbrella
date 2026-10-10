import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDailyLogs, listMeasurementTypes, updateProfile, upsertDailyLog, upsertMeasurements } from '../../lib/api'
import { useAuth, useProfile } from '../../lib/auth'
import { formatFullDate, todayISO } from '../../lib/dates'
import type { GoalType, LengthUnit, WeightUnit } from '../../lib/types'
import { cmTo, kgTo, parseNumber, round, toCm, toKg } from '../../lib/units'
import { useAsync } from '../../lib/useAsync'
import { useInstall } from '../../lib/install'
import { InstallInstructions } from '../../components/InstallCard'
import { ErrorMsg, Loading, UnitInput } from '../../components/ui'

// Edit this to change the welcome note clients see first.
const WELCOME_NOTE = (firstName: string) => [
  `Hey ${firstName || 'there'}, welcome to the Level Up app!`,
  'This is where we track your progress together: your weigh-ins, measurements, training and weekly check-ins. You’ll see your progress for yourself, and I’ll see everything I need to coach you better.',
  'Let’s get you set up. It takes about 2 minutes.',
]
const WELCOME_SIGNOFF = 'Coach Milo'

const GOALS: { value: GoalType; label: string; hint: string }[] = [
  { value: 'lose', label: 'Lose fat', hint: 'Lean down and feel lighter' },
  { value: 'gain', label: 'Build muscle', hint: 'Get stronger and add size' },
  { value: 'maintain', label: 'Maintain and recomp', hint: 'Same weight, better shape' },
]

const STEPS = ['Welcome', 'Your goal', 'About you', 'Starting point', 'Today', 'How it works', 'Install'] as const

export function Welcome() {
  const profile = useProfile()
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { platform, promptInstall } = useInstall()
  const today = todayISO()

  const { data, loading } = useAsync(async () => {
    const [logs, types] = await Promise.all([listDailyLogs(profile.id), listMeasurementTypes(profile.id)])
    return { logs, types: types.filter((t) => !t.archived) }
  }, [profile.id])

  // Resume where they left off if they leave halfway (the phone remembers the
  // last step reached). Profile fields alone can't tell us: imported answers
  // pre-fill some of them before the client has seen those steps.
  const stepKey = `levelup.welcomeStep.${profile.id}`
  const [step, setStepState] = useState(() => {
    try { return Math.min(Number(localStorage.getItem(stepKey)) || 0, 5) } catch { return 0 }
  })
  const setStep = (next: number | ((s: number) => number)) => setStepState((s) => {
    const v = typeof next === 'function' ? next(s) : next
    try { localStorage.setItem(stepKey, String(v)) } catch { /* private mode: no resume */ }
    return v
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: goal
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weight_unit)
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>(profile.length_unit)
  const [goalType, setGoalType] = useState<GoalType>(profile.goal_type)
  const [mainGoal, setMainGoal] = useState(profile.main_goal ?? '')
  const [why, setWhy] = useState(profile.goal_note)
  // Fields from the questionnaire database update; skipped if it hasn't run yet.
  const hasNewFields = profile.has_smart_scale !== undefined
  const [smartScale, setSmartScale] = useState<boolean | null>(hasNewFields && profile.onboarded_at ? Boolean(profile.has_smart_scale) : null)
  const [goalWeight, setGoalWeight] = useState(
    profile.goal_weight_kg != null ? String(round(kgTo(Number(profile.goal_weight_kg), profile.weight_unit))) : '',
  )
  // Step 2: height
  const [height, setHeight] = useState(profile.height_cm != null ? String(round(cmTo(profile.height_cm, profile.length_unit))) : '')
  // Step 3: starting point
  const [startMode, setStartMode] = useState<'now' | 'earlier'>(
    profile.coaching_started_on && profile.coaching_started_on < today ? 'earlier' : 'now',
  )
  const [startDate, setStartDate] = useState(profile.coaching_started_on ?? today)
  const [startWeight, setStartWeight] = useState('')
  // Step 4: today
  const [todayWeight, setTodayWeight] = useState('')
  const [measures, setMeasures] = useState<Record<string, string>>({})
  const [bodyStats, setBodyStats] = useState({ fat: '', muscle: '', visceral: '' })

  if (loading && !data) return <Loading />

  const firstName = profile.full_name.split(' ')[0]
  const last = STEPS.length - 1

  async function run(fn: () => Promise<void | false>) {
    setError(null)
    setBusy(true)
    try {
      if ((await fn()) !== false) setStep((s) => Math.min(s + 1, last))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const saveGoal = () => run(async () => {
    const gw = parseNumber(goalWeight)
    const gwKg = gw == null ? null : toKg(gw, weightUnit)
    if (gwKg != null && (gwKg < 30 || gwKg > 300)) { setError(`Check your target weight (${weightUnit}).`); return false }
    if (hasNewFields && !mainGoal.trim()) { setError('Tell us your main health goal.'); return false }
    if (!why.trim()) { setError('Tell us in a few words why this goal matters to you. It helps your coach a lot.'); return false }
    await updateProfile(profile.id, {
      weight_unit: weightUnit, length_unit: lengthUnit, goal_type: goalType,
      goal_note: why.trim(), goal_weight_kg: gwKg == null ? null : round(gwKg, 1),
      ...(hasNewFields ? { main_goal: mainGoal.trim() } : {}),
    })
  })

  const saveHeight = () => run(async () => {
    const h = parseNumber(height)
    const hCm = h == null ? null : toCm(h, lengthUnit)
    if (hCm == null || hCm < 90 || hCm > 250) { setError(`Enter your height in ${lengthUnit}.`); return false }
    if (hasNewFields && smartScale == null) { setError('Let us know whether you have a smart scale.'); return false }
    await updateProfile(profile.id, { height_cm: round(hCm, 1), ...(hasNewFields ? { has_smart_scale: Boolean(smartScale) } : {}) })
  })

  const saveStart = () => run(async () => {
    const date = startMode === 'now' ? today : startDate
    if (date > today) { setError('Pick a date that isn’t in the future.'); return false }
    if (startMode === 'earlier' && date < today) {
      const w = parseNumber(startWeight)
      const kg = w == null ? null : toKg(w, weightUnit)
      if (kg != null && (kg < 25 || kg > 350)) { setError(`That weight looks off. Check it’s in ${weightUnit}.`); return false }
      if (kg != null) await upsertDailyLog(profile.id, { log_date: date, weight_kg: round(kg, 2) })
    }
    await updateProfile(profile.id, { coaching_started_on: date })
  })

  const saveToday = (skipMeasurements = false) => run(async () => {
    const w = parseNumber(todayWeight)
    const kg = w == null ? null : toKg(w, weightUnit)
    if (kg == null && !alreadyWeighed) { setError('Enter your weight today. Your best reading is fine.'); return false }
    if (kg != null && (kg < 25 || kg > 350)) { setError(`That weight looks off. Check it’s in ${weightUnit}.`); return false }
    const bf = parseNumber(bodyStats.fat)
    const mm = parseNumber(bodyStats.muscle)
    const vf = parseNumber(bodyStats.visceral)
    if (bf != null && (bf < 2 || bf > 75)) { setError('Body fat should be a percentage, e.g. 28.4.'); return false }
    if (vf != null && (vf < 1 || vf > 60)) { setError('Visceral fat is the rating on your scale, usually 1 to 59.'); return false }
    const rows: { type_id: string; value_cm: number }[] = []
    for (const t of skipMeasurements ? [] : data?.types ?? []) {
      const v = parseNumber(measures[t.id] ?? '')
      if (v == null) continue
      const cm = toCm(v, lengthUnit)
      if (cm <= 5 || cm > 300) { setError(`Check your ${t.name.toLowerCase()} (${lengthUnit}).`); return false }
      rows.push({ type_id: t.id, value_cm: round(cm, 2) })
    }
    const stats = smartScale && hasNewFields
      ? { body_fat_pct: bf, muscle_mass_kg: mm == null ? null : round(toKg(mm, weightUnit), 2), visceral_fat: vf }
      : {}
    if (kg != null || Object.values(stats).some((v) => v != null)) {
      await upsertDailyLog(profile.id, { log_date: today, ...(kg != null ? { weight_kg: round(kg, 2) } : {}), ...stats })
    }
    await upsertMeasurements(profile.id, today, rows)
  })

  // Setup counts as done once they've seen the tour, BEFORE the install step.
  // People install from that step and then open the home-screen app, which on
  // iPhone starts fresh, so it must already know setup is finished.
  const completeSetup = () => run(async () => {
    await updateProfile(profile.id, { onboarded_at: new Date().toISOString() })
    if (platform === 'installed') {
      await refreshProfile()
      navigate('/', { replace: true })
      return false
    }
  })

  const finish = () => run(async () => {
    await refreshProfile()
    navigate('/', { replace: true })
    return false
  })


  const alreadyWeighed = data?.logs.some((l) => l.log_date === today && l.weight_kg != null)

  let body: ReactNode
  switch (step) {
    case 0:
      body = (
        <>
          <img className="welcome-logo" src="/brand/logo.png" alt="Level Up Transformations" />
          {WELCOME_NOTE(firstName).map((p, i) => <p key={i} className={i === 0 ? 'welcome-lead' : ''}>{p}</p>)}
          <p className="welcome-sign">{WELCOME_SIGNOFF}</p>
          <Next onClick={() => setStep(1)}>Let’s go</Next>
        </>
      )
      break
    case 1:
      body = (
        <>
          <h1>What are you working towards?</h1>
          <div className="form-row">
            <label className="field">I weigh myself in
              <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
                <option value="kg">kg</option><option value="lb">lb</option>
              </select>
            </label>
            <label className="field">I measure in
              <select value={lengthUnit} onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}>
                <option value="cm">cm</option><option value="in">inches</option>
              </select>
            </label>
          </div>
          <div className="choice-grid" role="radiogroup" aria-label="Main goal">
            {GOALS.map((g) => (
              <button key={g.value} type="button" role="radio" aria-checked={goalType === g.value}
                className={`choice ${goalType === g.value ? 'on' : ''}`} onClick={() => setGoalType(g.value)}>
                <strong>{g.label}</strong><span>{g.hint}</span>
              </button>
            ))}
          </div>
          {hasNewFields && (
            <label className="field">What is your main health goal?
              <textarea value={mainGoal} onChange={(e) => setMainGoal(e.target.value)} rows={2} maxLength={1000}
                placeholder="e.g. Lose 10 kg and get my blood sugar under control" />
            </label>
          )}
          <label className="field">Why is this goal important to you?
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} maxLength={1000}
              placeholder="e.g. I want the energy to keep up with my kids and be a role model for them" />
          </label>
          <label className="field">Rough target weight <span className="hint">If you have one in mind. This is for your coach and won’t appear on your charts.</span>
            <UnitInput unit={weightUnit} value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
          </label>
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={saveGoal}>Continue</Next>
        </>
      )
      break
    case 2:
      body = (
        <>
          <h1>A bit about you</h1>
          <label className="field">Height
            <UnitInput unit={lengthUnit} value={height} onChange={(e) => setHeight(e.target.value)} autoFocus />
          </label>
          {hasNewFields && (
            <>
              <p className="small" style={{ margin: '4px 0 -4px', fontWeight: 500, color: 'var(--text-2)' }}>Do you have a smart scale that shows body fat %?</p>
              <div className="choice-grid two" role="radiogroup" aria-label="Smart scale">
                <button type="button" role="radio" aria-checked={smartScale === true} className={`choice ${smartScale === true ? 'on' : ''}`} onClick={() => setSmartScale(true)}>
                  <strong>Yes</strong><span>e.g. Tanita, Xiaomi, Huawei</span>
                </button>
                <button type="button" role="radio" aria-checked={smartScale === false} className={`choice ${smartScale === false ? 'on' : ''}`} onClick={() => setSmartScale(false)}>
                  <strong>No</strong><span>You can switch this on later in Profile</span>
                </button>
              </div>
            </>
          )}
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={saveHeight}>Continue</Next>
        </>
      )
      break
    case 3:
      body = (
        <>
          <h1>Your starting point</h1>
          <p className="muted">When did you start coaching with Level Up?</p>
          <div className="choice-grid two" role="radiogroup" aria-label="When did you start">
            <button type="button" role="radio" aria-checked={startMode === 'now'} className={`choice ${startMode === 'now' ? 'on' : ''}`} onClick={() => setStartMode('now')}>
              <strong>I’m just starting</strong><span>Today is day one</span>
            </button>
            <button type="button" role="radio" aria-checked={startMode === 'earlier'} className={`choice ${startMode === 'earlier' ? 'on' : ''}`}
              onClick={() => { setStartMode('earlier'); if (startDate >= today) setStartDate('') }}>
              <strong>I’ve been with Level Up a while</strong><span>Add where you started</span>
            </button>
          </div>
          {startMode === 'earlier' && (
            <>
              <label className="field">Roughly when did you start?
                <input type="date" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="field">What did you weigh back then? <span className="hint">Your best guess is fine. It becomes the first point on your chart.</span>
                <UnitInput unit={weightUnit} value={startWeight} onChange={(e) => setStartWeight(e.target.value)} />
              </label>
            </>
          )}
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={() => (startMode === 'earlier' && !startDate ? setError('Pick the date you started.') : void saveStart())}>Continue</Next>
        </>
      )
      break
    case 4:
      body = (
        <>
          <h1>Today’s numbers</h1>
          {alreadyWeighed ? (
            <p className="alert alert-ok small">You’ve already logged your weight today. 👍</p>
          ) : (
            <label className="field">Body weight this morning <span className="hint">After the toilet, before food or drink</span>
              <UnitInput unit={weightUnit} value={todayWeight} onChange={(e) => setTodayWeight(e.target.value)} />
            </label>
          )}
          {smartScale && hasNewFields && (
            <div className="form-row three">
              <label className="field">Body fat
                <UnitInput unit="%" value={bodyStats.fat} onChange={(e) => setBodyStats((b) => ({ ...b, fat: e.target.value }))} />
              </label>
              <label className="field">Muscle mass
                <UnitInput unit={weightUnit} value={bodyStats.muscle} onChange={(e) => setBodyStats((b) => ({ ...b, muscle: e.target.value }))} />
              </label>
              <label className="field">Visceral fat
                <input inputMode="decimal" value={bodyStats.visceral} onChange={(e) => setBodyStats((b) => ({ ...b, visceral: e.target.value }))} />
              </label>
            </div>
          )}
          <div className="form-row">
            {(data?.types ?? []).slice(0, 4).map((t) => (
              <label key={t.id} className="field">{t.name}
                <UnitInput unit={lengthUnit} value={measures[t.id] ?? ''} onChange={(e) => setMeasures((m) => ({ ...m, [t.id]: e.target.value }))} />
              </label>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: -8 }}>Tape snug around the narrowest part of your waist and the widest part of your hips.</p>
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={() => saveToday()}>Continue</Next>
          <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => saveToday(true)}>Skip measurements for now</button>
          <p className="small muted" style={{ marginTop: -8, textAlign: 'center' }}>No tape measure handy? Add them later from your Progress page.</p>
        </>
      )
      break
    case 5:
      body = (
        <>
          <h1>How it works</h1>
          <div className="tour">
            <TourItem icon="☀️" title="Every morning: 2 minutes">
              Weigh in, then log last night’s sleep and yesterday’s steps on the <strong>Progress</strong> page. That’s your daily minimum.
            </TourItem>
            <TourItem icon="🏋️" title="During workouts">
              Open <strong>Training</strong>, tap Start and log each set. It shows what you lifted last time and saves as you go.
            </TourItem>
            <TourItem icon="✅" title="Every week">
              Send your <strong>Check-in</strong> and get feedback from your coach. Every second week, add your progress photos too.
            </TourItem>
            <TourItem icon="📝" title="Whenever it suits you">
              Write in your <strong>Journal</strong>, in the morning about yesterday or at night about today.
            </TourItem>
            <TourItem icon="💬" title="Discord is still home">
              Meal pics, daily quests, questions and banter all stay on Discord. The app is for your numbers and your progress.
            </TourItem>
          </div>
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={completeSetup}>Got it</Next>
        </>
      )
      break
    default:
      body = (
        <>
          <h1>{platform === 'installed' ? 'You’re all set!' : 'Last step: put it on your home screen'}</h1>
          {platform !== 'installed' && <p className="muted">So Level Up opens like any other app, one tap away.</p>}
          <div className="card"><InstallInstructions platform={platform} onInstall={() => void promptInstall()} /></div>
          <ErrorMsg error={error} />
          <Next busy={busy} onClick={finish}>{platform === 'installed' ? 'Go to my dashboard' : 'Done, take me to my dashboard'}</Next>
        </>
      )
  }

  return (
    <div className="welcome-wrap">
      <div className="welcome-card">
        {step > 0 && (
          <div className="welcome-top">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(null); setStep((s) => s - 1) }}>← Back</button>
            <div className="welcome-dots" aria-label={`Step ${step} of ${last}`}>
              {STEPS.slice(1).map((s, i) => <span key={s} className={i < step ? 'on' : ''} />)}
            </div>
          </div>
        )}
        <div className="stack">{body}</div>
        {step === 3 && startMode === 'earlier' && startDate && startDate < today && (
          <p className="small muted" style={{ marginTop: 12 }}>Started {formatFullDate(startDate)}. You can add more past weigh-ins later from the Progress page.</p>
        )}
      </div>
    </div>
  )
}

function Next({ children, onClick, busy }: { children: ReactNode; onClick: () => void; busy?: boolean }) {
  return <button type="button" className="btn btn-block" disabled={busy} onClick={onClick}>{busy ? 'Saving…' : children}</button>
}

function TourItem({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="tour-item">
      <span className="tour-icon" aria-hidden>{icon}</span>
      <div><strong>{title}</strong><p className="small" style={{ margin: '2px 0 0' }}>{children}</p></div>
    </div>
  )
}
