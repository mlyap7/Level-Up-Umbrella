# Level Up Transformations: client coaching app

A mobile-friendly web app where coaching clients log their progress and the coach sees everything in one dashboard.

**Clients can**
- Log daily body weight (plus optional steps and sleep). The chart shows each weigh-in as a dot and a **7-day average trend line**, so normal water-weight swings don't cause panic.
- Log weekly measurements. Waist and hips are set up by default, and clients can add their own (arms, thighs, chest…) and hide ones they no longer track.
- Follow the training program their coach wrote, logging weight, reps and RPE for every set. The logger shows **what they lifted last time** for each exercise. They can also log a custom workout.
- Rate how each session felt and add remarks.
- Submit a **weekly check-in**: adherence, energy, sleep, hunger, stress and digestion on a 1–10 scale, plus wins, struggles and questions. They see the coach's reply underneath.
- Keep a daily journal with a mood rating.
- Choose kg or lb and cm or in. Everything is stored in kg/cm and converted for display.
- Add the site to their phone's home screen so it opens like an app.

**The coach can**
- See every client on one screen, sorted by who **needs attention**: no weigh-in for 3+ days, weight not trending toward their goal for 2 weeks, a missed check-in, low ratings (e.g. stress 8+/10), or a check-in still waiting for a reply.
- Open any client to see their progress charts, check-ins (and reply), logged workouts and journal.
- Build training programs per client: workouts, exercises, target sets/reps/RPE and notes.
- Set a **sign-up code** so only invited people can create accounts.
- Archive clients who finish coaching. Their data is kept and they can be restored.

Built with React + Vite (front end, hosted free on Vercel) and Supabase (logins + Postgres database, free tier). Every table is protected by row-level security: clients can only ever see their own data.

---

## Going live (about 20 minutes, no coding)

### 1. Create the database (Supabase)
1. Sign up at [supabase.com](https://supabase.com) and create a **new project**. Pick the region closest to your clients (e.g. Singapore). Save the database password somewhere safe.
2. In the project, open **SQL Editor → New query**. Paste in the whole of [`supabase/migrations/20260929000000_init.sql`](supabase/migrations/20260929000000_init.sql) and click **Run**. You should see "Success".
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key. You need both in step 2.

### 2. Put the site online (Vercel)
1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project** and import this repository. Vercel detects Vite automatically.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
4. Click **Deploy**. You get a URL like `https://level-up-xyz.vercel.app`. You can add your own domain later under **Settings → Domains**.

### 3. Connect the two
In Supabase, open **Authentication → URL Configuration**:
- **Site URL**: your Vercel URL
- **Redirect URLs**: add `https://YOUR-VERCEL-URL/**`

This makes the confirmation and password-reset emails link back to your site.

### 4. Make yourself the coach
1. Go to your site and **create an account** like a client would.
2. In Supabase **SQL Editor**, run this (with your email):
   ```sql
   update public.profiles set role = 'coach'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign out and back in. You now land on the coach dashboard.

To add an assistant coach later, run the same command with their email. Coaches can see every client.

### 5. Invite clients
In the app, go to **Settings**, set a sign-up code (e.g. `LEVELUP2026`), and send clients the sign-up link along with the code.

### 6. Your logo
Already set up. The files live in `public/brand/`:
- `logo.png`: the full logo, shown on the sign-in and sign-up pages.
- `logo-mark.png`: just the bolt-and-arrow, shown in the header next to the "LEVEL UP" wordmark.

The phone home-screen icons and browser tab icon (`public/icons/`) are made from the same mark. To change the logo later, upload new files with exactly the same names to the same folders.

### Emails: one thing to set up before you have many clients
Supabase's built-in email sender is only meant for testing and allows just a few emails per hour. Before inviting lots of clients, connect a proper sender under **Authentication → Emails → SMTP Settings**. [Resend](https://resend.com) has a free tier that works well. You can also edit the email wording and branding in the same section.

---

## For developers

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL and anon key
npm run dev                       # http://localhost:5173
```

**Local database (needs Docker):**
```bash
npx supabase start                # prints API URL, anon key and DB URL
npx supabase db reset             # re-applies supabase/migrations
# put the printed values in .env.local, then optionally load demo data:
API_URL=... ANON_KEY=... DB_URL=... node scripts/seed-demo.mjs
```
Demo logins: `coach@demo.test` / `sarah@demo.test`, password `password123`.

**Checks:**
```bash
npm run typecheck
npm test                                                   # unit tests (trend maths, flags, units)
API_URL=... ANON_KEY=... DB_URL=... node scripts/rls-check.mjs   # security rules against a local Supabase
```

**Changing the database:** add a new file in `supabase/migrations/` (never edit one that has already been run on the live project), then run it in the Supabase SQL editor or with `npx supabase db push`.

### Project layout
```
supabase/migrations/   database tables and security rules
scripts/               security checks and demo data (local only)
src/lib/               data access (api.ts), trend maths and coach flags (stats.ts), units, dates
src/components/        chart, logging cards, check-in thread, program builder…
src/pages/client/      client screens
src/pages/coach/       coach screens
src/styles.css         colours and layout (brand orange is --brand)
```

## Ideas for later
- Progress photos (front, side, back) stored privately in Supabase Storage
- Email or push reminders for missed weigh-ins and check-ins
- Optional menstrual cycle tracking, to explain weight spikes
- Nutrition targets (calories and protein) with a simple daily "hit / missed" log
- CSV export of a client's data
