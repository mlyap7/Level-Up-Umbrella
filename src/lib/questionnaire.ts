// The coaching questionnaire, defined once. The client form, the coach's view
// and the import from the old Google Form all read from this list.
// To change a question, edit it here. Keep `key`s stable: saved answers use them.

export type QType = 'text' | 'tel' | 'number' | 'paragraph' | 'single' | 'multi' | 'scale' | 'confirm'

export interface Question {
  key: string
  label: string
  type: QType
  required?: boolean
  options?: string[]
  hint?: string
  placeholder?: string
  /** Only show when another answer has this value. */
  showIf?: { key: string; equals: string }
}

export interface Section {
  id: string
  title: string
  intro?: string
  questions: Question[]
}

export const MEDICAL_CONFIRMATION =
  'I confirm that I am medically fit to participate in a 90-day body transformation program, or I have consulted a doctor before enrolling.'
export const COMMITMENT_DECLARATION =
  'I commit to showing up for all 90 days and giving this program my full effort, even when life gets hard.'

export const QUESTIONNAIRE: Section[] = [
  {
    id: 'about',
    title: 'About you',
    questions: [
      { key: 'age', label: 'Age', type: 'number', required: true },
      { key: 'whatsapp', label: 'WhatsApp number', type: 'tel', required: true, placeholder: 'e.g. +60 12 345 6789' },
      { key: 'occupation', label: 'Occupation', type: 'text', required: true },
      { key: 'location', label: 'Which area / city are you based in?', type: 'text', required: true },
    ],
  },
  {
    id: 'health',
    title: 'Health and safety',
    intro: 'This stays private between you and your coaching team. It helps us keep your plan safe.',
    questions: [
      {
        key: 'conditions', label: 'Do you have any existing medical conditions?', type: 'multi', required: true,
        hint: 'Tick all that apply',
        options: ['None', 'Diabetes / pre-diabetes', 'High blood pressure', 'High cholesterol', 'Thyroid condition',
          'PCOS', 'Fatty liver', 'Gout', 'Asthma', 'Heart condition', 'Joint pain or injury', 'Other'],
      },
      { key: 'conditions_details', label: 'Anything to add about your conditions?', type: 'text', placeholder: 'e.g. type 2 diabetes since 2021, bad left knee' },
      { key: 'on_medication', label: 'Are you currently on any medication?', type: 'single', required: true, options: ['No', 'Yes'] },
      { key: 'medication_list', label: 'Please list your current medication(s)', type: 'paragraph', required: true, showIf: { key: 'on_medication', equals: 'Yes' } },
      {
        key: 'diet', label: 'Any food allergies or dietary restrictions?', type: 'multi', required: true,
        hint: 'Tick all that apply',
        options: ['None', 'Halal', 'Vegetarian', 'Vegan', 'No beef', 'No pork', 'Lactose intolerant', 'Gluten-free',
          'Nut allergy', 'Seafood / shellfish allergy', 'Other'],
      },
      { key: 'diet_details', label: 'Anything to add about your diet?', type: 'text' },
      { key: 'alcohol', label: 'Do you drink alcohol?', type: 'single', required: true, options: ['Never', 'A few times a month', 'Weekly', 'Several times a week'] },
      { key: 'smoking', label: 'Do you smoke or vape?', type: 'single', required: true, options: ['No', 'I’ve quit', 'Occasionally', 'Daily', 'I vape'] },
      { key: 'emergency_name', label: 'Emergency contact name', type: 'text', required: true },
      { key: 'emergency_whatsapp', label: 'Emergency contact WhatsApp number', type: 'tel', required: true },
      { key: 'medical_confirmation', label: MEDICAL_CONFIRMATION, type: 'confirm', required: true },
    ],
  },
  {
    id: 'lifestyle',
    title: 'Your lifestyle',
    questions: [
      { key: 'typical_day', label: 'Briefly describe what a typical weekday looks like for you', type: 'paragraph', required: true, placeholder: 'Wake-up time, work, meals, evenings, bedtime…' },
      { key: 'meals', label: 'How many meals do you eat per day on average?', type: 'single', required: true, options: ['1–2 meals', '3 meals', '4–5 meals', '6 or more', 'It varies / I often skip meals'] },
      { key: 'exercise', label: 'Do you currently exercise?', type: 'single', required: true, options: ['Not currently', 'Occasionally', 'Regularly (2+ times a week)'] },
      { key: 'exercise_details', label: 'What type, and how often?', type: 'text', placeholder: 'e.g. walking 3x a week, gym on weekends', showIf: { key: 'exercise', equals: '!Not currently' } },
    ],
  },
  {
    id: 'mindset',
    title: 'Your mindset',
    questions: [
      { key: 'life_in_90_days', label: 'Describe your life 90 days from now if you hit every goal', type: 'paragraph', required: true },
      { key: 'past_obstacles', label: 'What has stopped you from achieving your health goals in the past?', type: 'paragraph', required: true },
      { key: 'commitment', label: 'On a scale of 1–10, how committed are you to making this change?', type: 'scale', required: true },
    ],
  },
  {
    id: 'together',
    title: 'Working together',
    questions: [
      {
        key: 'checkin_time', label: 'What time of day works best for your daily check-ins?', type: 'single', required: true,
        options: ['Early morning (6–9am)', 'Mid-morning (9am–12pm)', 'Afternoon (12–3pm)', 'Late afternoon (3–6pm)', 'Evening (6–9pm)', 'Night (after 9pm)', 'It varies'],
      },
      { key: 'feedback', label: 'How do you prefer to receive feedback from your coach?', type: 'single', required: true, options: ['Text messages', 'Voice notes', 'Either is fine'] },
      { key: 'anything_else', label: 'Is there anything else you want your coach to know before Day 1?', type: 'paragraph' },
      { key: 'commitment_declaration', label: COMMITMENT_DECLARATION, type: 'confirm', required: true },
    ],
  },
]

export type Answers = Record<string, string | string[] | boolean | number | null | undefined>

export function isVisible(q: Question, a: Answers): boolean {
  if (!q.showIf) return true
  const v = a[q.showIf.key]
  const want = q.showIf.equals
  if (want.startsWith('!')) return v != null && v !== '' && v !== want.slice(1)
  return v === want
}

export function isAnswered(q: Question, a: Answers): boolean {
  const v = a[q.key]
  if (q.type === 'confirm') return v === true
  if (Array.isArray(v)) return v.length > 0
  return v != null && String(v).trim() !== ''
}

/** Required, visible questions that still need an answer. */
export function missingAnswers(a: Answers): Question[] {
  return QUESTIONNAIRE.flatMap((s) => s.questions).filter((q) => q.required && isVisible(q, a) && !isAnswered(q, a))
}

export function progress(a: Answers): { done: number; total: number } {
  const req = QUESTIONNAIRE.flatMap((s) => s.questions).filter((q) => q.required && isVisible(q, a))
  return { done: req.filter((q) => isAnswered(q, a)).length, total: req.length }
}

/** Text shown to the coach for one answer. */
export function formatAnswer(q: Question, v: Answers[string]): string {
  if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return '–'
  if (q.type === 'confirm') return v === true ? '✓ Confirmed' : 'Not confirmed'
  if (Array.isArray(v)) return v.join(', ')
  if (q.type === 'scale') return `${v}/10`
  return String(v)
}
