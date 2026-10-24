import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));
vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession }, functions: { invoke: mocks.invoke } },
  supabaseAnonKey: 'sb_publishable_test'
}));

import { AI_ERROR_CODES, fetchDefinition, fetchMnemonic, fetchStory } from './aiService';
import { hasAuthenticatedUser } from '../../../supabase/functions/ai-dictionary/auth.ts';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'user-session-jwt' } }, error: null });
  mocks.invoke.mockResolvedValue({ data: { data: {}, source: 'AI' }, error: null });
});

describe('AI request authentication', () => {
  it.each([
    ['definition', () => fetchDefinition({ groqKey: 'test-groq-key', word: 'apple' })],
    ['mnemonic', () => fetchMnemonic({ groqKey: 'test-groq-key', word: 'apple', definition: 'fruit' })],
    ['story', () => fetchStory({ groqKey: 'test-groq-key', words: ['apple'] })]
  ])('uses the session JWT and separate publishable key for %s', async (promptType, call) => {
    await call();
    expect(mocks.invoke).toHaveBeenCalledWith('ai-dictionary', expect.objectContaining({
      headers: { Authorization: 'Bearer user-session-jwt', apikey: 'sb_publishable_test' },
      body: expect.objectContaining({ promptType })
    }));
  });

  it('does not invoke AI when the session is missing', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(fetchStory({ groqKey: 'test-groq-key', words: ['apple'] }))
      .rejects.toMatchObject({ code: AI_ERROR_CODES.AUTH_REQUIRED });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('does not invoke AI when session retrieval fails', async () => {
    const error = new Error('Session refresh failed');
    mocks.getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(fetchStory({ groqKey: 'test-groq-key', words: ['apple'] })).rejects.toBe(error);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('reads the current session for each request after a token refresh', async () => {
    await fetchStory({ groqKey: 'test-groq-key', words: ['apple'] });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'refreshed-user-jwt' } }, error: null });
    await fetchStory({ groqKey: 'test-groq-key', words: ['apple'] });
    expect(mocks.invoke.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed-user-jwt');
  });

  it('preserves the missing Groq key error without making a request', async () => {
    await expect(fetchStory({ words: ['apple'] })).rejects.toMatchObject({ code: AI_ERROR_CODES.MISSING_API_KEYS });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe('Edge Function user verification', () => {
  it.each([null, 'Basic token', 'Bearer sb_publishable_test', 'Bearer sb_secret_test'])(
    'rejects missing or non-user credentials: %s', async (authorization) => {
      const getUser = vi.fn();
      const req = new Request('https://example.test', { headers: authorization ? { Authorization: authorization } : {} });
      expect(await hasAuthenticatedUser(req, { auth: { getUser } })).toBe(false);
      expect(getUser).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])('accepts a verified user, including anonymous=%s', async (isAnonymous) => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-id', is_anonymous: isAnonymous } }, error: null });
    const req = new Request('https://example.test', { headers: { Authorization: 'Bearer user-session-jwt' } });
    expect(await hasAuthenticatedUser(req, { auth: { getUser } })).toBe(true);
    expect(getUser).toHaveBeenCalledWith('user-session-jwt');
  });

  it('rejects an invalid or expired JWT', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Invalid JWT') });
    const req = new Request('https://example.test', { headers: { Authorization: 'Bearer expired-jwt' } });
    expect(await hasAuthenticatedUser(req, { auth: { getUser } })).toBe(false);
  });
});
