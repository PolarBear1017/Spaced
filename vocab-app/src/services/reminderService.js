import { supabase } from '../supabase';

const OWNER_KEY = 'spaced_push_owner';
export const supportsReviewPush = () => typeof window !== 'undefined' && window.isSecureContext
  && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export async function reminderRequest(userId, body) {
  const { data: auth, error } = await supabase.auth.getSession();
  if (error || !userId || auth.session?.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  const result = await supabase.functions.invoke('review-reminders', {
    body, headers: { Authorization: `Bearer ${auth.session.access_token}` },
  });
  if (result.error) throw new Error('UNAVAILABLE');
  return result.data;
}

export async function browserSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

export function subscriptionOwner() { return localStorage.getItem(OWNER_KEY); }
export function setSubscriptionOwner(userId) { localStorage.setItem(OWNER_KEY, userId); }

// Unsubscribe locally even when offline, so an old account cannot notify the next user.
export async function detachBrowserSubscription() {
  if (!supportsReviewPush()) return;
  const subscription = await browserSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('UNSUBSCRIBE_FAILED');
  localStorage.removeItem(OWNER_KEY);
}

export function applicationServerKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

export async function subscribeBrowser(publicKey) {
  await navigator.serviceWorker.register('/review-sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing || registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey),
  });
}
