// Sends Level Up reminder notifications.
//
// Called two ways:
//   1. By the schedule (every 15 minutes) with the header x-cron-secret.
//      Sends whatever due_push_reminders() says is due, once each.
//   2. By a signed-in person tapping "Send me a test notification" in Profile.
//      Sends a test to that person's own devices only.
//
// Deploy with "Verify JWT" switched OFF: this function checks callers itself.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  // Newer projects may expose secret keys as JSON instead.
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    return Object.values(keys)[0] ?? ''
  } catch {
    return ''
  }
}

interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } })

  const { data: cfg, error: cfgError } = await admin.from('push_config').select('*').single()
  if (cfgError || !cfg) return json({ error: 'Reminders are not configured yet (push_config is empty).' }, 500)
  webpush.setVapidDetails(cfg.contact, cfg.vapid_public, cfg.vapid_private)

  async function send(sub: Sub, payload: Record<string, string>): Promise<boolean> {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 4 })
      await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id)
      return true
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410: the phone unsubscribed or the app was removed. Forget the device.
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
      console.error('push failed', status, (err as Error).message)
      return false
    }
  }

  // ---- Scheduled run
  if (req.headers.get('x-cron-secret')) {
    if (req.headers.get('x-cron-secret') !== cfg.cron_secret) return json({ error: 'Forbidden' }, 403)
    const { data: due, error } = await admin.rpc('due_push_reminders')
    if (error) return json({ error: error.message }, 500)
    const rows = (due ?? []) as (Sub & { subscription_id: string; user_id: string; kind: string; slot: string; title: string; body: string; url: string })[]
    let sent = 0
    const done = new Set<string>()
    for (const r of rows) {
      const ok = await send({ id: r.subscription_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
        { title: r.title, body: r.body, url: r.url, tag: r.kind })
      if (ok) sent++
      done.add(JSON.stringify([r.user_id, r.kind, r.slot]))
    }
    // Log each reminder once per person (even if one of their devices failed),
    // so nobody gets the same reminder twice.
    const log = [...done].map((k) => { const [user_id, kind, slot] = JSON.parse(k); return { user_id, kind, slot } })
    if (log.length) await admin.from('push_log').upsert(log, { onConflict: 'user_id,kind,slot', ignoreDuplicates: true })
    return json({ due: rows.length, sent })
  }

  // ---- Test notification for the signed-in person
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Not signed in' }, 401)
  const { data: who, error: whoError } = await admin.auth.getUser(token)
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401)
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', who.user.id)
  if (!subs?.length) return json({ error: 'No devices have notifications turned on yet.' }, 404)
  let sent = 0
  for (const s of subs as Sub[]) {
    if (await send(s, { title: 'Reminders are on! 🎉', body: 'This is what your Level Up reminders will look like.', url: '/profile', tag: 'test' })) sent++
  }
  return json({ sent, devices: subs.length })
})
