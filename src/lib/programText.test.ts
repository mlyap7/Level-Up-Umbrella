import { describe, expect, it } from 'vitest'
import { demoLink, parseProgramText, programToText } from './programText'

describe('parseProgramText', () => {
  it('reads a Markdown table from an AI chat', () => {
    const text = `Here is your plan:

| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Day A: Full Body | **Goblet squat** | 3 | 8-10 | 7 | 90s | 3-1-1 | Chest up |
| Day A: Full Body | Push-up | 3 | 6-10 | 7-8 | 60s | | Knees if needed |
| Day B: Full Body | Romanian deadlift | 3 | 10 | 7 | 90s | 3-0-1 | Soft knees |`
    const p = parseProgramText(text)
    expect(p.error).toBeNull()
    expect(p.workouts.map((w) => w.name)).toEqual(['Day A: Full Body', 'Day B: Full Body'])
    expect(p.workouts[0].exercises[0]).toEqual({ name: 'Goblet squat', sets: 3, reps: '8-10', rpe: 7, rest: '90s', tempo: '3-1-1', notes: 'Chest up', video_url: '' })
    expect(p.workouts[0].exercises[1].rpe).toBe(7.5)
  })

  it('reads cells copied from Google Sheets, with blank workout cells continuing the one above', () => {
    const text = 'Workout\tExercise\tSets\tReps\nDay A\tSquat\t3\t5\n\tBench press\t3\t5\nDay B\tDeadlift\t1\t5'
    const p = parseProgramText(text)
    expect(p.workouts).toHaveLength(2)
    expect(p.workouts[0].exercises.map((e) => e.name)).toEqual(['Squat', 'Bench press'])
  })

  it('reads CSV with quoted commas', () => {
    const p = parseProgramText('Workout,Exercise,Sets,Reps,Notes\nDay A,Row,3,10,"Squeeze, then lower slowly"')
    expect(p.workouts[0].exercises[0].notes).toBe('Squeeze, then lower slowly')
  })

  it('explains what is wrong when there is no header', () => {
    expect(parseProgramText('Squat 3x5\nBench 3x5').error).toMatch(/header row/)
  })

  it('drops out-of-range numbers and non-links with a warning', () => {
    const p = parseProgramText('Workout\tExercise\tSets\tRPE\tVideo\nA\tSquat\t50\t12\tnot a link')
    const e = p.workouts[0].exercises[0]
    expect([e.sets, e.rpe, e.video_url]).toEqual([null, null, ''])
    expect(p.warnings).toHaveLength(3)
  })

  it('round-trips through the copy-as-table format', () => {
    const p = parseProgramText('Workout\tExercise\tSets\tReps\tRPE\tRest\tTempo\tNotes\tVideo\nA\tSquat\t3\t5\t8\t2 min\t3-1-1\tBrace\thttps://youtu.be/x')
    expect(parseProgramText(programToText(p.workouts)).workouts).toEqual(p.workouts)
  })
})

describe('demoLink', () => {
  it('uses the coach video when there is one, otherwise a YouTube search', () => {
    expect(demoLink('Squat', 'https://youtu.be/abc')).toBe('https://youtu.be/abc')
    expect(demoLink('Goblet squat', '')).toContain('search_query=Goblet%20squat')
  })
})
