import { createECDH } from 'node:crypto';
import webpush from 'npm:web-push@3.6.7';

const assert = (value: unknown, message = 'Assertion failed') => { if (!value) throw new Error(message); };
const keys = webpush.generateVAPIDKeys();
Deno.env.set('SUPABASE_URL', 'https://project.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key');
Deno.env.set('REVIEW_VAPID_PUBLIC_KEY', keys.publicKey);
Deno.env.set('REVIEW_VAPID_PRIVATE_KEY', keys.privateKey);
Deno.env.set('REVIEW_VAPID_SUBJECT', 'https://spaced.test');
let handler: (req: Request) => Promise<Response>;
const originalServe = Deno.serve;
// Capture the real entry point without binding a TCP port.
Deno.serve = ((fn: typeof handler) => { handler = fn; return {}; }) as typeof Deno.serve;
await import('./index.ts');
Deno.serve = originalServe;

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const row = { id: 'row-1', endpoint: 'https://fcm.googleapis.com/wp/test',
  p256dh: ecdh.getPublicKey().toString('base64url'), auth: 'A'.repeat(22), language: 'en',
  lease_token: 'lease-1', attempt_day: '2026-10-24' };
type Call = { url: string; method: string; body: string };
let calls: Call[] = [];
let validUser = true;
let validScheduler = true;
let pushStatus = 201;
const originalFetch = globalThis.fetch;
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
const reset = () => {
  calls = []; validUser = true; validScheduler = true; pushStatus = 201;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', body: String(init?.body || '') });
    if (url.endsWith('/auth/v1/user')) return validUser
      ? response({ id: 'user-1', is_anonymous: true }) : response({ message: 'Invalid JWT' }, 401);
    if (url.includes('/rpc/authorize_review_reminder_dispatch')) return response(validScheduler);
    if (url.includes('/rpc/claim_review_reminders')) return response([row]);
    if (url === row.endpoint) {
      assert(init?.redirect === 'error', 'Push redirects must not be followed');
      assert(init?.body && typeof init.body !== 'string', 'Push payload must be encrypted');
      return new Response(null, { status: pushStatus });
    }
    if (url.includes('/review_reminders')) {
      if (init?.method === 'PATCH' || init?.method === 'DELETE' || init?.method === 'POST') return new Response(null, { status: 204 });
      return response(null);
    }
    throw new Error('Unexpected network request');
  }) as typeof fetch;
};
const request = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer user-token' }) => handler!(
  new Request('https://project.supabase.co/functions/v1/review-reminders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }));

Deno.test('missing/invalid user JWT cannot read configuration or subscriptions', async () => {
  reset();
  assert((await request({ action: 'get' }, {})).status === 401);
  assert(calls.length === 0);
  validUser = false;
  assert((await request({ action: 'get' })).status === 401);
  assert(calls.every(c => c.url.endsWith('/auth/v1/user')));
  globalThis.fetch = originalFetch;
});
Deno.test('valid anonymous session can read public configuration, never private keys', async () => {
  reset();
  const res = await request({ action: 'get' });
  const data = await res.json();
  assert(res.status === 200 && data.configured && data.publicKey === keys.publicKey);
  assert(!JSON.stringify(data).includes(keys.privateKey));
  assert(calls.some(c => c.url.includes('user_id=eq.user-1')));
  globalThis.fetch = originalFetch;
});
Deno.test('users cannot dispatch and invalid scheduler secrets cannot claim rows', async () => {
  reset();
  assert((await request({ action: 'dispatch' })).status === 403);
  validScheduler = false;
  assert((await request({ action: 'dispatch' }, { 'x-review-scheduler': 'bad' })).status === 401);
  assert(!calls.some(c => c.url.includes('/claim_review_reminders')));
  globalThis.fetch = originalFetch;
});
Deno.test('malformed subscriptions cannot make server-side network requests', async () => {
  reset();
  assert((await request({ action: 'save', subscription: { endpoint: 'https://localhost/private' } })).status === 400);
  assert(calls.length === 1 && calls[0].url.endsWith('/auth/v1/user'));
  globalThis.fetch = originalFetch;
});
Deno.test('scheduler encrypts push and records successful delivery with the lease token', async () => {
  reset();
  const res = await request({ action: 'dispatch' }, { 'x-review-scheduler': 'valid-test-secret' });
  const data = await res.json();
  assert(res.status === 200 && data.sent === 1);
  const update = calls.find(c => c.method === 'PATCH');
  assert(update?.url.includes('lease_token=eq.lease-1'));
  assert(update?.body.includes('"last_sent_day":"2026-10-24"'));
  globalThis.fetch = originalFetch;
});
Deno.test('expired subscriptions are deleted and transient failures are retried', async () => {
  reset(); pushStatus = 410;
  await request({ action: 'dispatch' }, { 'x-review-scheduler': 'valid-test-secret' });
  assert(calls.some(c => c.method === 'DELETE' && c.url.includes('lease_token=eq.lease-1')));
  reset(); pushStatus = 503;
  const data = await (await request({ action: 'dispatch' }, { 'x-review-scheduler': 'valid-test-secret' })).json();
  assert(data.sent === 0);
  const update = calls.find(c => c.method === 'PATCH');
  assert(update?.body.includes('lease_until') && !update.body.includes('last_sent_day'));
  globalThis.fetch = originalFetch;
});
