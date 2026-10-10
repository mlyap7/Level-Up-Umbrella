// Prints the SQL that loads scripts/program-templates.ts into program_templates.
// Usage: npx vite-node scripts/build-templates-sql.ts
import { parseProgramText } from '../src/lib/programText'
import { TEMPLATES } from './program-templates'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const rows = TEMPLATES.map((t) => {
  const parsed = parseProgramText(t.table)
  if (parsed.error || parsed.warnings.length) throw new Error(`${t.name}: ${parsed.error ?? parsed.warnings.join('; ')}`)
  return `  (${q(t.name)}, ${q(t.description)}, ${q(t.notes)}, ${q(JSON.stringify(parsed.workouts))}::jsonb)`
})
console.log(`insert into public.program_templates (name, description, notes, workouts) values
${rows.join(',\n')}
on conflict (name) do nothing;`)
