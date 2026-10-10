// Programs as plain tables, so they can be pasted from an AI chat, Google
// Sheets or Excel, and copied back out again.
//
//   Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes | Video
//
// Accepts tab-separated rows (copied spreadsheet cells), Markdown tables
// (what AI chats produce) and CSV. Only Workout and Exercise are required.
// A blank Workout cell means "same workout as the row above".

export interface ExerciseDraft {
  name: string
  sets: number | null
  reps: string
  rpe: number | null
  rest: string
  tempo: string
  notes: string
  video_url: string
}

export interface WorkoutDraft {
  name: string
  exercises: ExerciseDraft[]
}

export interface ParsedProgram {
  workouts: WorkoutDraft[]
  warnings: string[]
  error: string | null
}

type Column = 'workout' | 'exercise' | 'sets' | 'reps' | 'rpe' | 'rest' | 'tempo' | 'notes' | 'video'

const HEADER_WORDS: Record<Column, string[]> = {
  workout: ['workout', 'day', 'session'],
  exercise: ['exercise', 'movement', 'exercise name'],
  sets: ['sets', 'set'],
  reps: ['reps', 'rep', 'repetitions', 'reps/time', 'reps / time'],
  rpe: ['rpe', 'effort', 'intensity'],
  rest: ['rest', 'rest time', 'rest (s)', 'rest period'],
  tempo: ['tempo'],
  notes: ['notes', 'note', 'cues', 'coaching notes', 'coaching cues'],
  video: ['video', 'demo', 'link', 'video link', 'demo video', 'demo link'],
}

export const PROGRAM_COLUMNS = ['Workout', 'Exercise', 'Sets', 'Reps', 'RPE', 'Rest', 'Tempo', 'Notes', 'Video'] as const

const clean = (s: string) => s.replace(/\*\*|__|`/g, '').trim()

function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function splitRow(line: string, kind: 'tab' | 'pipe' | 'csv'): string[] {
  if (kind === 'tab') return line.split('\t').map(clean)
  if (kind === 'pipe') {
    const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
    return inner.split('|').map(clean)
  }
  return splitCsv(line).map(clean)
}

function columnFor(header: string): Column | null {
  const h = header.toLowerCase().replace(/[^a-z/() ]/g, '').trim()
  for (const [col, words] of Object.entries(HEADER_WORDS) as [Column, string[]][]) {
    if (words.includes(h)) return col
  }
  return null
}

// "3", "3-4" → 3. Returns null when there is no number.
function firstNumber(s: string): number | null {
  const m = s.match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

// "7", "7-8" → 7 / 7.5 (middle of a range).
function rpeValue(s: string): number | null {
  const nums = (s.match(/\d+(\.\d+)?/g) ?? []).map(Number).slice(0, 2)
  if (nums.length === 0) return null
  const v = nums.length === 2 ? (nums[0] + nums[1]) / 2 : nums[0]
  return Math.round(v * 2) / 2
}

const limit = (s: string, n: number) => s.slice(0, n)

export function parseProgramText(text: string): ParsedProgram {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim())
  const warnings: string[] = []
  const kindOf = (l: string): 'tab' | 'pipe' | 'csv' =>
    l.includes('\t') ? 'tab' : l.trim().startsWith('|') || l.includes(' | ') ? 'pipe' : 'csv'

  // Find the header row: the first row with an Exercise column.
  let headerAt = -1
  let cols: (Column | null)[] = []
  for (let i = 0; i < lines.length; i++) {
    const cells = splitRow(lines[i], kindOf(lines[i]))
    const mapped = cells.map(columnFor)
    if (mapped.includes('exercise')) { headerAt = i; cols = mapped; break }
  }
  if (headerAt < 0) {
    return { workouts: [], warnings, error: 'Couldn’t find the header row. The first row needs at least “Workout” and “Exercise” columns.' }
  }
  const has = (c: Column) => cols.includes(c)
  if (!has('workout')) warnings.push('No “Workout” column, so everything goes into one workout.')

  const workouts: WorkoutDraft[] = []
  let current: WorkoutDraft | null = null
  for (const line of lines.slice(headerAt + 1)) {
    if (/^\s*\|?\s*:?-{2,}/.test(line)) continue // Markdown separator row
    const cells = splitRow(line, kindOf(line))
    const get = (c: Column) => {
      const i = cols.indexOf(c)
      return i >= 0 ? (cells[i] ?? '').trim() : ''
    }
    const workoutName = has('workout') ? get('workout') : 'Workout'
    const name = get('exercise')
    if (workoutName && (!current || current.name !== workoutName)) {
      current = workouts.find((w) => w.name === workoutName) ?? null
      if (!current) {
        current = { name: limit(workoutName, 80), exercises: [] }
        workouts.push(current)
      }
    }
    if (!name) continue
    if (!current) {
      current = { name: 'Workout', exercises: [] }
      workouts.push(current)
    }
    const setsRaw = get('sets')
    let sets = firstNumber(setsRaw)
    if (sets != null && (sets < 1 || sets > 20)) {
      warnings.push(`${name}: ${setsRaw} sets is out of range, left blank.`)
      sets = null
    }
    const rpeRaw = get('rpe')
    let rpe = rpeValue(rpeRaw)
    if (rpe != null && (rpe < 1 || rpe > 10)) {
      warnings.push(`${name}: RPE ${rpeRaw} is out of range, left blank.`)
      rpe = null
    }
    let video = get('video')
    if (video && !/^https?:\/\//i.test(video)) {
      warnings.push(`${name}: video “${video}” isn’t a web link, left out.`)
      video = ''
    }
    current.exercises.push({
      name: limit(name, 80),
      sets: sets == null ? null : Math.round(sets),
      reps: limit(get('reps'), 40),
      rpe,
      rest: limit(get('rest'), 40),
      tempo: limit(get('tempo'), 20),
      notes: limit(get('notes'), 500),
      video_url: limit(video, 500),
    })
  }

  const filled = workouts.filter((w) => w.exercises.length > 0)
  if (filled.length === 0) return { workouts: [], warnings, error: 'Found the header row but no exercises under it.' }
  return { workouts: filled, warnings, error: null }
}

const cell = (v: string | number | null) => String(v ?? '').replace(/[\t\n]+/g, ' ')

/** Tab-separated, so it pastes straight into Google Sheets or Excel (and back here). */
export function programToText(workouts: WorkoutDraft[]): string {
  const rows = [PROGRAM_COLUMNS.join('\t')]
  for (const w of workouts) {
    for (const e of w.exercises) {
      rows.push([w.name, e.name, e.sets, e.reps, e.rpe, e.rest, e.tempo, e.notes, e.video_url].map(cell).join('\t'))
    }
  }
  return rows.join('\n')
}

/** The coach's own demo video if set, otherwise a YouTube search for the exercise. */
export function demoLink(name: string, videoUrl?: string | null): string {
  return videoUrl?.trim() || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`
}

/** What to ask an AI chat for, so its answer pastes straight in. */
export const AI_PROGRAM_PROMPT = `Write a strength training program as ONE table with exactly these columns:

Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes

Rules:
- One row per exercise. Repeat the workout name on every row (e.g. "Day A: Full Body").
- Sets: a single number. Reps: a number, a range like 8-10, or a time like 30s.
- RPE: a number from 1 to 10 (how hard the last set should feel).
- Rest: e.g. 60-90s or 2 min. Tempo: e.g. 3-1-1, or leave blank.
- Notes: one short coaching cue.
- No extra text before or after the table.

Client details: [goal, experience, equipment, days per week, injuries or limitations]`
