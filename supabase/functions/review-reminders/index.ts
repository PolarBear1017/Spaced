import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
import webpush from 'npm:web-push@3.6.7';
import { notificationPayload, validPushEndpoint, validReminder } from './validation.js';

type Reminder = {
  id: string; endpoint: string; p256dh: string; auth: string; language: string;
  lease_token: string; attempt_day: string;
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const scheduler = req.headers.get('x-review-scheduler');
    let userId: string | null = null;
    if (scheduler) {
      const { data, error } = await client.rpc('authorize_review_reminder_dispatch', { p_token: scheduler });
      if (error || data !== true) return reply({ error: 'Unauthorized' }, 401);
    } else {
      const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!token || token.startsWith('sb_')) return reply({ error: 'Unauthorized' }, 401);
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return reply({ error: 'Unauthorized' }, 401);
      userId = data.user.id; // Valid anonymous Auth sessions are supported.
    }
    const raw = await req.text();
    if (raw.length > 8192) return reply({ error: 'Request too large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid request' }, 400);
    if ((body.action === 'dispatch') !== Boolean(scheduler)) return reply({ error: 'Forbidden' }, 403);

    const publicKey = Deno.env.get('REVIEW_VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('REVIEW_VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('REVIEW_VAPID_SUBJECT');
    const configured = Boolean(publicKey && privateKey && subject);
    const check = (result: { error: unknown }) => { if (result.error) throw new Error('Database operation failed'); };

    // Keep encryption/signing in the Web Push library; use fetch for Deno transport.
    const send = async (row: { endpoint: string; p256dh: string; auth: string; language: string }, test = false) => {
      if (!validPushEndpoint(row.endpoint)) throw new Error('Invalid endpoint');
      const request = webpush.generateRequestDetails({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(notificationPayload(row.language, test)), {
          TTL: 3600, urgency: 'normal', topic: test ? 'spaced-review-test' : 'spaced-daily-review',
          vapidDetails: { subject: subject!, publicKey: publicKey!, privateKey: privateKey! },
        });
      const response = await fetch(request.endpoint, {
        method: 'POST', headers: request.headers, body: request.body,
        redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      await response.body?.cancel();
      return response.status;
    };

    if (body.action === 'get') {
      const { data, error } = await client.from('review_reminders')
        .select('enabled,reminder_time,timezone,language').eq('user_id', userId).eq('endpoint', body.endpoint || '').maybeSingle();
      check({ error });
      return reply({ configured, publicKey: configured ? publicKey : null, reminder: data });
    }
    if (body.action === 'disable') {
      check(await client.from('review_reminders').delete().eq('user_id', userId).eq('endpoint', body.endpoint || ''));
      return reply({ ok: true });
    }
    if (!configured) return reply({ error: 'Notifications not configured', code: 'NOT_CONFIGURED' }, 503);
    if (body.action === 'save') {
      if (!validReminder(body)) return reply({ error: 'Invalid reminder' }, 400);
      const endpoint = body.subscription.endpoint;
      const { data: existing, error } = await client.from('review_reminders').select('id,user_id').eq('endpoint', endpoint).maybeSingle();
      check({ error });
      if (existing && existing.user_id !== userId) return reply({ error: 'Subscription belongs to another account' }, 409);
      if (!existing) {
        const { count, error: countError } = await client.from('review_reminders').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        check({ error: countError });
        if ((count || 0) >= 10) return reply({ error: 'Too many devices' }, 409);
      }
      const values = {
        user_id: userId, endpoint, p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth,
        enabled: body.enabled, reminder_time: body.time, timezone: body.timezone, language: body.language,
      };
      // Do not upsert an endpoint across owners, even if two saves race.
      check(existing
        ? await client.from('review_reminders').update(values).eq('id', existing.id).eq('user_id', userId)
        : await client.from('review_reminders').insert(values));
      return reply({ ok: true });
    }
    if (body.action === 'test') {
      // Atomic cooldown prevents concurrent requests from bypassing the limit.
      const { data: row, error } = await client.from('review_reminders').update({ last_test_at: new Date().toISOString() })
        .eq('user_id', userId).eq('endpoint', body.endpoint || '').eq('enabled', true)
        .or(`last_test_at.is.null,last_test_at.lt.${new Date(Date.now() - 60000).toISOString()}`).select().maybeSingle();
      check({ error });
      if (!row) return reply({ error: 'Enable notifications first, or wait one minute' }, 429);
      const status = await send(row, true);
      if (status === 404 || status === 410) check(await client.from('review_reminders').delete().eq('id', row.id));
      return status >= 200 && status < 300 ? reply({ ok: true }) : reply({ error: 'Push delivery failed' }, 502);
    }
    if (body.action === 'dispatch') {
      const { data: rows, error } = await client.rpc('claim_review_reminders', { p_limit: 50 });
      check({ error });
      let sent = 0;
      // Bounded concurrency keeps a batch within the Edge Function runtime limit.
      for (let index = 0; index < (rows || []).length; index += 10) {
        await Promise.all(rows.slice(index, index + 10).map(async (row: Reminder) => {
          let status = 0;
          try { status = await send(row); } catch { /* Retry transient failures on the next cron tick. */ }
          const query = client.from('review_reminders');
          if (status === 404 || status === 410) {
            check(await query.delete().eq('id', row.id).eq('lease_token', row.lease_token));
          } else if (status >= 200 && status < 300) {
            check(await query.update({ last_sent_day: row.attempt_day, lease_until: null, lease_token: null })
              .eq('id', row.id).eq('lease_token', row.lease_token));
            sent++;
          } else {
            check(await query.update({ lease_until: new Date(Date.now() + 60000).toISOString() })
              .eq('id', row.id).eq('lease_token', row.lease_token));
          }
        }));
      }
      return reply({ sent, claimed: rows?.length || 0 });
    }
    return reply({ error: 'Unknown action' }, 400);
  } catch {
    // Never log requests, push credentials, endpoint URLs or secret material.
    return reply({ error: 'Notification service unavailable' }, 500);
  }
});
