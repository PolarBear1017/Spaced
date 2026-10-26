import { afterEach, describe, expect, it, vi } from 'vitest';
const { getSession, invoke } = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth: { getSession }, functions: { invoke } } }));
import { applicationServerKey, detachBrowserSubscription, reminderRequest, supportsReviewPush } from './reminderService';
import { notificationPayload, validPushEndpoint, validReminder } from '../../../supabase/functions/review-reminders/validation';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('background review notifications', () => {
  it('requires a matching account before calling the Edge Function', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'other' } } } });
    await expect(reminderRequest('owner', { action: 'test' })).rejects.toThrow('ACCOUNT_CHANGED');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('sends the verified session JWT explicitly, including anonymous sessions', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'guest', is_anonymous: true }, access_token: 'user-jwt' } } });
    invoke.mockResolvedValue({ data: { ok: true } });
    await expect(reminderRequest('guest', { action: 'get' })).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('review-reminders', { body: { action: 'get' }, headers: { Authorization: 'Bearer user-jwt' } });
  });
  it('does not expose service errors to the UI', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'guest' }, access_token: 'jwt' } } });
    invoke.mockResolvedValue({ error: new Error('sensitive server details') });
    await expect(reminderRequest('guest', {})).rejects.toThrow('UNAVAILABLE');
  });
  it('unsubscribes on account changes even without a server request', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const removeItem = vi.fn();
    vi.stubGlobal('window', { isSecureContext: true, Notification: {}, PushManager: {} });
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: async () => ({ unsubscribe }) } }) } });
    vi.stubGlobal('localStorage', { removeItem });
    await detachBrowserSubscription();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(removeItem).toHaveBeenCalledWith('spaced_push_owner');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('checks browser capabilities and converts URL-safe public keys', () => {
    vi.stubGlobal('window', { isSecureContext: false });
    expect(supportsReviewPush()).toBe(false);
    expect([...applicationServerKey('AQID-_8')]).toEqual([1, 2, 3, 251, 255]);
  });
  it('rejects non-push hosts, credentials, ports and host suffix attacks', () => {
    for (const endpoint of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://127.0.0.1/a',
      'https://fcm.googleapis.com.evil.test/a', 'https://user@fcm.googleapis.com/a', 'https://web.push.apple.com:444/a']) {
      expect(validPushEndpoint(endpoint)).toBe(false);
    }
    expect(validPushEndpoint('https://web.push.apple.com/test')).toBe(true);
    expect(validPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test')).toBe(true);
  });
  it('validates schedules, zones, language and subscription key sizes', () => {
    const value = { subscription: { endpoint: 'https://fcm.googleapis.com/wp/test', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } },
      time: '20:00', timezone: 'Asia/Taipei', language: 'zh-TW', enabled: true };
    expect(validReminder(value)).toBe(true);
    for (const change of [{ time: '25:00' }, { time: '9:00' }, { timezone: 'invalid' }, { language: 'fr' }, { enabled: 'true' }, { subscription: {} }]) {
      expect(validReminder({ ...value, ...change })).toBe(false);
    }
    expect(validReminder(null)).toBe(false);
  });
  it('localizes payloads and always uses the daily review deep link', () => {
    expect(notificationPayload('en').body).toContain('review');
    expect(notificationPayload('zh-TW').body).toContain('複習');
    expect(notificationPayload('en', true).tag).toBe('spaced-review-test');
    expect(notificationPayload('zh-TW').url).toBe('/?review=daily');
  });
});
