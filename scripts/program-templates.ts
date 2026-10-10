// The starter program templates. Edit here, then regenerate the SQL with:
//   npx vite-node scripts/build-templates-sql.ts > supabase/templates.sql
// (Templates can also be added and edited in the app under Coaching → Templates.)

export interface TemplateSource { name: string; description: string; notes: string; table: string }

const RPE_NOTE = 'RPE 7 means you could have done about 3 more reps. When you hit the top of the rep range on every set, go a little heavier next time.'

export const TEMPLATES: TemplateSource[] = [
  {
    name: 'Beginner Full Body 3x (Gym)',
    description: 'Three full-body days a week with machines and dumbbells. The default for new gym clients.',
    notes: `Train 3 days a week with at least 1 rest day in between (e.g. Mon, Wed, Fri). ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Day A | Goblet squat | 3 | 8-10 | 7 | 90s | 3-1-1 | Sit down between your heels, chest tall |
| Day A | Dumbbell bench press | 3 | 8-10 | 7 | 90s | 3-0-1 | Shoulder blades squeezed together |
| Day A | Lat pulldown | 3 | 10-12 | 7 | 90s | 2-1-1 | Pull elbows down to your back pockets |
| Day A | Dumbbell Romanian deadlift | 3 | 10 | 7 | 90s | 3-0-1 | Push hips back, soft knees, flat back |
| Day A | Plank | 3 | 20-30s | 7 | 60s | | Squeeze glutes, ribs down |
| Day B | Leg press | 3 | 10-12 | 7 | 90s | 3-1-1 | Feet shoulder width, don't lock the knees |
| Day B | Seated cable row | 3 | 10-12 | 7 | 90s | 2-1-1 | Chest up, squeeze shoulder blades |
| Day B | Seated dumbbell shoulder press | 3 | 8-10 | 7 | 90s | 2-0-1 | Back against the pad, ribs down |
| Day B | Hip thrust | 3 | 10-12 | 7 | 90s | 2-1-1 | Pause 1 second at the top |
| Day B | Dead bug | 3 | 8 each side | 6 | 60s | | Lower back stays pressed down |
| Day C | Dumbbell split squat | 3 | 8 each leg | 7 | 90s | 3-1-1 | Hold something for balance if needed |
| Day C | Incline dumbbell press | 3 | 10 | 7 | 90s | 3-0-1 | Bench at about 30 degrees |
| Day C | One-arm dumbbell row | 3 | 10 each arm | 7 | 60-90s | 2-1-1 | Hand and knee on the bench, pull to your hip |
| Day C | Lying leg curl | 3 | 10-12 | 7 | 60-90s | 2-0-2 | Control the way down |
| Day C | Cable Pallof press | 3 | 10 each side | 6 | 60s | | Don't let the cable twist you |
`,
  },
  {
    name: 'Beginner Full Body 3x (Home Gym)',
    description: 'For home gyms with a barbell, bench and dumbbells. No squat rack needed.',
    notes: `Train 3 days a week with at least 1 rest day in between. No squat rack or spotter at home, so never bench press a barbell: use dumbbells or the floor press. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Day A | Goblet squat | 3 | 8-12 | 7 | 90s | 3-1-1 | Sit down between your heels, chest tall |
| Day A | Dumbbell bench press | 3 | 8-10 | 7 | 90s | 3-0-1 | Shoulder blades squeezed together |
| Day A | Barbell bent-over row | 3 | 8-10 | 7 | 90s | 2-1-1 | Hinge to about 45 degrees, pull to your belly button |
| Day A | Barbell Romanian deadlift | 3 | 8-10 | 7 | 2 min | 3-0-1 | Bar slides down your thighs, flat back |
| Day A | Plank | 3 | 20-30s | 7 | 60s | | Squeeze glutes, ribs down |
| Day B | Dumbbell reverse lunge | 3 | 8 each leg | 7 | 90s | 2-0-1 | Step back, front knee over the foot |
| Day B | Barbell floor press | 3 | 8-10 | 7 | 90s | 2-1-1 | Pause when your upper arms touch the floor |
| Day B | One-arm dumbbell row | 3 | 10 each arm | 7 | 60-90s | 2-1-1 | Hand and knee on the bench, pull to your hip |
| Day B | Barbell hip thrust | 3 | 10-12 | 7 | 90s | 2-1-1 | Upper back on the bench, pad the bar |
| Day B | Side plank | 3 | 20s each side | 7 | 60s | | Hips high, body in a straight line |
| Day C | Dumbbell step-up | 3 | 8 each leg | 7 | 90s | 2-0-1 | Low bench or step, drive through the front heel |
| Day C | Seated dumbbell shoulder press | 3 | 8-10 | 7 | 90s | 2-0-1 | Sit tall on the bench, ribs down |
| Day C | Chest-supported dumbbell row | 3 | 10-12 | 7 | 60-90s | 2-1-1 | Lie face down on the bench |
| Day C | Barbell deadlift | 3 | 5-6 | 7 | 2 min | | Bar over mid-foot, flat back, push the floor away |
| Day C | Dead bug | 3 | 8 each side | 6 | 60s | | Lower back stays pressed down |
`,
  },
  {
    name: 'Dumbbells & Bands Full Body 3x (Home)',
    description: 'A pair of dumbbells and resistance bands. Glute and posture friendly, great for most female clients starting at home.',
    notes: `Train 3 days a week with at least 1 rest day in between. Pick dumbbells you can lift for the top of the rep range with 2 to 3 reps to spare. Too easy? Lower slower (3 to 4 seconds) or add a pause before going heavier. Anchor bands in a closed door or around a sturdy post. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Day A | Goblet squat | 3 | 10-12 | 7 | 60-90s | 3-1-1 | Sit down between your heels, chest tall |
| Day A | Dumbbell Romanian deadlift | 3 | 10-12 | 7 | 60-90s | 3-0-1 | Push hips back, soft knees, flat back |
| Day A | Incline push-up | 3 | 6-10 | 7 | 60s | 2-0-1 | Hands on a bench or table, body straight |
| Day A | One-arm dumbbell row | 3 | 10-12 each arm | 7 | 60s | 2-1-1 | Hand on a chair, pull to your hip |
| Day A | Banded glute bridge | 3 | 12-15 | 7 | 60s | 2-1-1 | Band above knees, push knees out |
| Day A | Dead bug | 3 | 8 each side | 6 | 45s | | Lower back stays pressed down |
| Day B | Dumbbell reverse lunge | 3 | 8 each leg | 7 | 60-90s | 2-0-1 | Hold a wall for balance if needed |
| Day B | Dumbbell hip thrust | 3 | 12-15 | 7 | 60-90s | 2-1-1 | Shoulders on the sofa, pause at the top |
| Day B | Seated dumbbell shoulder press | 3 | 10-12 | 7 | 60s | 2-0-1 | Sit tall, ribs down |
| Day B | Band lat pulldown | 3 | 12-15 | 7 | 60s | 2-1-1 | Anchor high, pull elbows to your sides |
| Day B | Band lateral walk | 2 | 10 steps each way | 7 | 45s | | Stay low, toes forward |
| Day B | Side plank (knees) | 3 | 20s each side | 6 | 45s | | Hips high |
| Day C | Dumbbell sumo squat | 3 | 12 | 7 | 60-90s | 3-1-1 | Wide stance, toes out, knees follow toes |
| Day C | Single-leg glute bridge | 3 | 10 each leg | 7 | 60s | 2-1-1 | Drive through the heel |
| Day C | Dumbbell floor press | 3 | 10-12 | 7 | 60s | 2-1-1 | Pause when your elbows touch the floor |
| Day C | Band face pull | 3 | 15 | 6 | 45s | 2-1-1 | Pull to your forehead, thumbs back |
| Day C | Dumbbell bent-over row | 3 | 10-12 | 7 | 60s | 2-1-1 | Hinge forward, flat back |
| Day C | Bird dog | 3 | 8 each side | 5 | 45s | | Slow and steady, hips level |
`,
  },
  {
    name: 'Safe Start (Bodyweight, Low Impact)',
    description: 'Very simple, joint-friendly strength work with a chair and a wall. For older clients or anyone carrying a lot of weight. No floor work.',
    notes: 'Alternate Day A and Day B, 3 days a week. Keep a sturdy chair or kitchen counter within reach for balance. Effort should feel light to moderate (RPE 5 to 6): you can still talk. Do 2 sets for the first 2 weeks, then 3 sets. Stop and tell your coach if anything causes sharp pain, chest pain, dizziness or unusual shortness of breath.',
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Day A | Sit-to-stand from a chair | 2 | 8-10 | 6 | 60-90s | 3-1-1 | Use the armrests if needed. Sit down slowly |
| Day A | Wall push-up | 2 | 8-12 | 6 | 60s | 2-0-1 | Step further from the wall to make it harder |
| Day A | Standing hip hinge | 2 | 10 | 5 | 60s | 3-0-1 | Hands on hips, push hips back like closing a car door |
| Day A | Step-up on the bottom stair | 2 | 6-8 each leg | 6 | 60-90s | 2-0-2 | Hold the rail, whole foot on the step |
| Day A | Standing calf raise | 2 | 12 | 5 | 45s | 2-1-2 | Hold the chair or counter |
| Day A | Standing march | 2 | 30s | 5 | 45s | | Hold the chair, lift knees to a comfortable height |
| Day B | Sit-to-stand from a chair | 2 | 8-10 | 6 | 60-90s | 3-1-1 | Arms crossed if that feels OK |
| Day B | Wall push-up | 2 | 8-12 | 6 | 60s | 2-0-1 | Body straight from head to heels |
| Day B | Standing hip extension | 2 | 10 each leg | 5 | 45s | 2-1-2 | Hold the chair, squeeze your bum, small movement |
| Day B | Standing side leg raise | 2 | 10 each leg | 5 | 45s | 2-1-2 | Hold the chair, toes forward |
| Day B | Seated knee extension | 2 | 12 each leg | 5 | 45s | 2-1-2 | Sit tall, straighten the knee, lower slowly |
| Day B | Wall angel | 2 | 8 | 5 | 45s | | Back against the wall, slide arms up and down |
| Day B | Heel-to-toe walk | 2 | 30s | 5 | 45s | | Hold the kitchen counter, look ahead |
`,
  },
  {
    name: 'Push Pull Legs + Arms (Gym)',
    description: 'Push, Pull and Legs days with an optional Arms day. For clients with some gym experience.',
    notes: `Run Push, Pull, Legs in order. Add the Arms day as a 4th session if you have time. Take at least 1 full rest day each week. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Push | Barbell bench press | 3 | 6-8 | 7-8 | 2-3 min | 2-1-1 | Feet planted, slight arch, touch mid-chest |
| Push | Incline dumbbell press | 3 | 8-10 | 7 | 90s | 3-0-1 | Bench at about 30 degrees |
| Push | Seated dumbbell shoulder press | 3 | 8-10 | 7 | 90s | 2-0-1 | Back against the pad, ribs down |
| Push | Cable lateral raise | 3 | 12-15 | 8 | 60s | 2-0-2 | Lead with the elbow, stop at shoulder height |
| Push | Triceps rope pushdown | 3 | 10-12 | 8 | 60s | 2-0-1 | Elbows pinned, split the rope at the bottom |
| Pull | Lat pulldown | 3 | 8-10 | 7-8 | 90s | 2-1-1 | Pull elbows down to your back pockets |
| Pull | Seated cable row | 3 | 8-10 | 7-8 | 90s | 2-1-1 | Chest up, squeeze shoulder blades |
| Pull | Chest-supported dumbbell row | 3 | 10-12 | 7 | 90s | 2-1-1 | Chest on an incline bench |
| Pull | Face pull | 3 | 12-15 | 7 | 60s | 2-1-1 | Pull to your forehead, thumbs back |
| Pull | Dumbbell hammer curl | 3 | 10-12 | 8 | 60s | 2-0-2 | No swinging |
| Legs | Barbell back squat | 3 | 6-8 | 7-8 | 2-3 min | 3-1-1 | Brace, sit between the hips, knees follow toes |
| Legs | Romanian deadlift | 3 | 8-10 | 7 | 2 min | 3-0-1 | Bar slides down your thighs, flat back |
| Legs | Leg press | 3 | 10-12 | 8 | 90s | 3-1-1 | Don't lock the knees |
| Legs | Lying leg curl | 3 | 10-12 | 8 | 60-90s | 2-0-2 | Control the way down |
| Legs | Standing calf raise | 3 | 12-15 | 8 | 60s | 2-1-2 | Full stretch at the bottom |
| Arms (optional) | EZ-bar curl | 3 | 8-12 | 8 | 60-90s | 2-0-2 | Elbows still, squeeze at the top |
| Arms (optional) | Overhead cable triceps extension | 3 | 10-12 | 8 | 60-90s | 2-0-1 | Stretch at the bottom |
| Arms (optional) | Incline dumbbell curl | 2 | 10-12 | 8 | 60s | 3-0-1 | Let the arms hang straight back |
| Arms (optional) | Triceps bar pushdown | 2 | 12-15 | 8 | 60s | 2-0-1 | Elbows pinned |
| Arms (optional) | Cable lateral raise | 2 | 15 | 8 | 45s | 2-0-2 | Light and strict |
`,
  },
  {
    name: 'Upper Lower 4x (Gym)',
    description: 'Upper, Lower, Upper, Lower. For clients training 4 days a week at the gym.',
    notes: `Suggested week: Mon Upper A, Tue Lower A, Thu Upper B, Fri Lower B. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Upper A | Barbell bench press | 3 | 6-8 | 7-8 | 2-3 min | 2-1-1 | Feet planted, touch mid-chest |
| Upper A | Seated cable row | 3 | 8-10 | 7-8 | 90s | 2-1-1 | Chest up, squeeze shoulder blades |
| Upper A | Seated dumbbell shoulder press | 3 | 8-10 | 7 | 90s | 2-0-1 | Back against the pad |
| Upper A | Lat pulldown | 3 | 10-12 | 7 | 90s | 2-1-1 | Pull elbows to your back pockets |
| Upper A | Dumbbell curl | 2 | 10-12 | 8 | 60s | 2-0-2 | No swinging |
| Upper A | Triceps rope pushdown | 2 | 10-12 | 8 | 60s | 2-0-1 | Elbows pinned |
| Lower A | Barbell back squat | 3 | 6-8 | 7-8 | 2-3 min | 3-1-1 | Brace, knees follow toes |
| Lower A | Romanian deadlift | 3 | 8-10 | 7 | 2 min | 3-0-1 | Flat back, hips back |
| Lower A | Dumbbell reverse lunge | 3 | 8 each leg | 7 | 90s | 2-0-1 | Front knee over the foot |
| Lower A | Lying leg curl | 3 | 10-12 | 8 | 60-90s | 2-0-2 | Control the way down |
| Lower A | Standing calf raise | 3 | 12-15 | 8 | 60s | 2-1-2 | Full stretch at the bottom |
| Upper B | Incline dumbbell press | 3 | 8-10 | 7-8 | 90s | 3-0-1 | Bench at about 30 degrees |
| Upper B | Assisted pull-up | 3 | 6-10 | 7-8 | 2 min | 2-0-1 | Use the machine or a band, full range |
| Upper B | Chest-supported dumbbell row | 3 | 10-12 | 7 | 90s | 2-1-1 | Chest on an incline bench |
| Upper B | Cable lateral raise | 3 | 12-15 | 8 | 60s | 2-0-2 | Stop at shoulder height |
| Upper B | Face pull | 3 | 12-15 | 7 | 60s | 2-1-1 | Thumbs back |
| Upper B | Dumbbell hammer curl | 2 | 10-12 | 8 | 60s | 2-0-2 | No swinging |
| Lower B | Trap bar deadlift | 3 | 5 | 7 | 2-3 min | | Or a conventional deadlift. Push the floor away |
| Lower B | Leg press | 3 | 10-12 | 8 | 90s | 3-1-1 | Don't lock the knees |
| Lower B | Hip thrust | 3 | 8-12 | 8 | 90s | 2-1-1 | Pause 1 second at the top |
| Lower B | Leg extension | 3 | 12-15 | 8 | 60s | 2-1-2 | Squeeze at the top |
| Lower B | Seated calf raise | 3 | 12-15 | 8 | 60s | 2-1-2 | Full stretch at the bottom |
| Lower B | Hanging knee raise | 3 | 10 | 7 | 60s | | No swinging. Captain's chair is fine |
`,
  },
  {
    name: 'Upper Lower 4x (Home Gym)',
    description: 'Upper, Lower, Upper, Lower with a barbell, bench and dumbbells. No squat rack needed.',
    notes: `Suggested week: Mon Upper A, Tue Lower A, Thu Upper B, Fri Lower B. No rack or spotter, so never bench press a barbell: use dumbbells or the floor press. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Upper A | Dumbbell bench press | 3 | 8-10 | 7-8 | 90s | 3-0-1 | Shoulder blades squeezed together |
| Upper A | Barbell bent-over row | 3 | 8-10 | 7-8 | 90s | 2-1-1 | Hinge to 45 degrees, pull to your belly button |
| Upper A | Seated dumbbell shoulder press | 3 | 8-10 | 7 | 90s | 2-0-1 | Sit tall on the bench |
| Upper A | One-arm dumbbell row | 3 | 10-12 each arm | 7 | 60-90s | 2-1-1 | Hand and knee on the bench |
| Upper A | Dumbbell curl | 2 | 10-12 | 8 | 60s | 2-0-2 | No swinging |
| Upper A | Dumbbell overhead triceps extension | 2 | 10-12 | 8 | 60s | 2-0-1 | Elbows point up |
| Lower A | Dumbbell front squat | 3 | 8-12 | 7-8 | 2 min | 3-1-1 | Dumbbells on shoulders, chest tall |
| Lower A | Barbell Romanian deadlift | 3 | 8-10 | 7 | 2 min | 3-0-1 | Bar slides down your thighs |
| Lower A | Dumbbell reverse lunge | 3 | 8 each leg | 7 | 90s | 2-0-1 | Front knee over the foot |
| Lower A | Barbell hip thrust | 3 | 10-12 | 8 | 90s | 2-1-1 | Upper back on the bench, pad the bar |
| Lower A | Single-leg calf raise | 3 | 12 each leg | 8 | 45s | 2-1-2 | Hold the wall, full stretch |
| Upper B | Barbell floor press | 3 | 6-8 | 7-8 | 2 min | 2-1-1 | Pause when your upper arms touch the floor |
| Upper B | Chest-supported dumbbell row | 3 | 10-12 | 7 | 90s | 2-1-1 | Lie face down on the bench |
| Upper B | Push-up | 3 | As many as possible | 8 | 90s | 2-0-1 | Stop 2 reps before your form breaks |
| Upper B | Dumbbell lateral raise | 3 | 12-15 | 8 | 60s | 2-0-2 | Stop at shoulder height |
| Upper B | Dumbbell rear delt fly | 3 | 12-15 | 8 | 60s | 2-1-1 | Hinge forward, lead with the elbows |
| Upper B | Dumbbell hammer curl | 2 | 10-12 | 8 | 60s | 2-0-2 | No swinging |
| Lower B | Barbell deadlift | 3 | 5 | 7 | 2-3 min | | Bar over mid-foot, flat back |
| Lower B | Bulgarian split squat | 3 | 8 each leg | 8 | 90s | 3-1-1 | Rear foot on the bench, hold dumbbells |
| Lower B | Barbell glute bridge | 3 | 10-12 | 8 | 90s | 2-1-1 | Pause at the top |
| Lower B | Dead bug | 3 | 8 each side | 6 | 60s | | Lower back stays pressed down |
`,
  },
  {
    name: 'Dumbbells & Bands Upper Lower 4x (Home)',
    description: 'The next step after the Dumbbells & Bands full-body plan, once a client is consistent and wants 4 days.',
    notes: `Suggested week: Mon Upper A, Tue Lower A, Thu Upper B, Fri Lower B. When your dumbbells feel light, slow the lowering, add a pause, or do single-leg and single-arm versions. ${RPE_NOTE}`,
    table: `
| Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes |
|---|---|---|---|---|---|---|---|
| Upper A | Dumbbell floor press | 3 | 10-12 | 7-8 | 60-90s | 3-1-1 | Pause when your elbows touch the floor |
| Upper A | One-arm dumbbell row | 3 | 10-12 each arm | 7-8 | 60s | 2-1-1 | Hand on a chair, pull to your hip |
| Upper A | Seated dumbbell shoulder press | 3 | 10-12 | 7 | 60s | 2-0-1 | Sit tall, ribs down |
| Upper A | Band lat pulldown | 3 | 12-15 | 7 | 60s | 2-1-1 | Anchor high, elbows to your sides |
| Upper A | Dumbbell curl | 2 | 12 | 8 | 45s | 2-0-2 | No swinging |
| Upper A | Band triceps pushdown | 2 | 15 | 8 | 45s | 2-0-1 | Anchor high, elbows pinned |
| Lower A | Pause goblet squat | 3 | 10-12 | 7-8 | 90s | 3-2-1 | 2-second pause at the bottom |
| Lower A | Dumbbell Romanian deadlift | 3 | 10-12 | 7-8 | 90s | 3-0-1 | Flat back, hips back |
| Lower A | Dumbbell reverse lunge | 3 | 10 each leg | 7 | 60-90s | 2-0-1 | Hold a wall if needed |
| Lower A | Seated band hip abduction | 3 | 15-20 | 8 | 45s | 2-1-1 | Band above knees, push out |
| Lower A | Single-leg calf raise | 3 | 12 each leg | 8 | 45s | 2-1-2 | Hold the wall |
| Upper B | Push-up (incline or knees) | 3 | As many as possible | 8 | 60-90s | 2-0-1 | Stop 2 reps before your form breaks |
| Upper B | Band seated row | 3 | 12-15 | 7-8 | 60s | 2-1-1 | Squeeze shoulder blades |
| Upper B | Dumbbell lateral raise | 3 | 12-15 | 8 | 45s | 2-0-2 | Stop at shoulder height |
| Upper B | Band face pull | 3 | 15 | 7 | 45s | 2-1-1 | Thumbs back |
| Upper B | Dumbbell hammer curl | 2 | 12 | 8 | 45s | 2-0-2 | No swinging |
| Lower B | Bulgarian split squat | 3 | 8 each leg | 8 | 90s | 3-1-1 | Rear foot on the sofa or a chair |
| Lower B | Single-leg Romanian deadlift | 3 | 8 each leg | 7 | 60-90s | 3-0-1 | Hold a wall with the free hand |
| Lower B | Dumbbell hip thrust | 3 | 12-15 | 8 | 60-90s | 2-2-1 | Shoulders on the sofa, 2-second squeeze |
| Lower B | Band lateral walk | 2 | 10 steps each way | 8 | 45s | | Stay low, toes forward |
| Lower B | Dead bug | 3 | 8 each side | 6 | 45s | | Lower back stays pressed down |
`,
  },
]
