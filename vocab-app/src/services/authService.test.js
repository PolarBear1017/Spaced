import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn()
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInAnonymously: vi.fn(),
      signInWithOAuth,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn()
    }
  }
}));

import { signInWithGoogle } from './authService';

describe('Google authentication redirect', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    vi.stubGlobal('window', {
      location: {
        origin: 'https://vocab-example-polar-bears-projects-5eff6df3.vercel.app'
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns to the current deployment origin after authentication', () => {
    signInWithGoogle();

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://vocab-example-polar-bears-projects-5eff6df3.vercel.app/'
      }
    });
  });
});
