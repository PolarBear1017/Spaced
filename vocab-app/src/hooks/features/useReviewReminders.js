import { useCallback, useEffect, useRef, useState } from 'react';
import {
  browserSubscription, detachBrowserSubscription, reminderRequest, setSubscriptionOwner,
  subscribeBrowser, subscriptionOwner, supportsReviewPush,
} from '../../services/reminderService';

export default function useReviewReminders(session, sessionReady, language) {
  const userId = session?.user?.id;
  const owner = useRef(userId);
  const busyOwner = useRef(null);
  useEffect(() => { owner.current = userId; }, [userId]);
  const [state, setState] = useState({
    accountId: null,
    loading: true, busy: false, enabled: false, configured: false,
    time: '20:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    permission: 'default', message: '', publicKey: null,
  });
  const supported = supportsReviewPush();
  const refresh = useCallback(async () => {
    if (!sessionReady) return;
    if (userId && busyOwner.current === userId) return;
    if (!supported) { setState(s => ({ ...s, accountId: userId || null, loading: false, busy: false, enabled: false })); return; }
    try {
      if (subscriptionOwner() && subscriptionOwner() !== userId) await detachBrowserSubscription();
      if (!userId) { setState(s => ({ ...s, accountId: null, loading: false, busy: false, enabled: false })); return; }
      const subscription = await browserSubscription();
      const data = await reminderRequest(userId, { action: 'get', endpoint: subscription?.endpoint });
      if (owner.current !== userId || busyOwner.current === userId) return;
      setState(s => ({
        ...s, accountId: userId, loading: false, busy: false, configured: data.configured, publicKey: data.publicKey,
        permission: Notification.permission,
        enabled: Boolean(subscription && data.reminder?.enabled),
        time: data.reminder?.reminder_time?.slice(0, 5) || '20:00',
        timezone: data.reminder?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        message: data.configured ? '' : 'notConfigured',
      }));
    } catch {
      if (owner.current === userId) setState(s => ({ ...s, accountId: userId || null, loading: false, busy: false,
        enabled: s.accountId === userId && s.enabled, configured: false, message: 'unavailable' }));
    }
  }, [sessionReady, supported, userId]);
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', refresh); };
  }, [refresh]);

  const save = async (enabled) => {
    if (state.busy || busyOwner.current === userId) return;
    busyOwner.current = userId;
    setState(s => ({ ...s, busy: true, message: '' }));
    let created = null;
    try {
      // Request immediately from the user's click, before any network awaits (iOS).
      if (enabled) {
        const permission = await Notification.requestPermission();
        if (owner.current !== userId) return;
        setState(s => ({ ...s, permission }));
        if (permission !== 'granted') {
          setState(s => ({ ...s, enabled: false, message: permission === 'denied' ? 'denied' : 'permissionNeeded' }));
          return;
        }
        if (subscriptionOwner() !== userId) await detachBrowserSubscription();
        const existing = await browserSubscription();
        const subscription = existing || await subscribeBrowser(state.publicKey);
        if (!existing) created = subscription;
        if (owner.current !== userId) { if (created) await created.unsubscribe(); return; }
        await reminderRequest(userId, {
          action: 'save', subscription: subscription.toJSON(), enabled: true,
          time: state.time, timezone: state.timezone, language: language === 'en' ? 'en' : 'zh-TW',
        });
        if (owner.current !== userId) { await subscription.unsubscribe(); return; }
        setSubscriptionOwner(userId);
      } else {
        const subscription = await browserSubscription();
        if (subscription) await reminderRequest(userId, { action: 'disable', endpoint: subscription.endpoint });
        await detachBrowserSubscription();
      }
      if (owner.current === userId) setState(s => ({ ...s, enabled, message: 'saved' }));
    } catch {
      if (created) await created.unsubscribe().catch(() => {});
      if (owner.current === userId) setState(s => ({ ...s, message: 'saveFailed' }));
    } finally {
      if (busyOwner.current === userId) busyOwner.current = null;
      if (owner.current === userId) setState(s => ({ ...s, busy: false }));
    }
  };
  const test = async () => {
    if (state.busy || busyOwner.current === userId) return;
    busyOwner.current = userId;
    setState(s => ({ ...s, busy: true, message: '' }));
    try {
      const subscription = await browserSubscription();
      if (!subscription) throw new Error('No subscription');
      await reminderRequest(userId, { action: 'test', endpoint: subscription.endpoint });
      if (owner.current === userId) setState(s => ({ ...s, message: 'testSent' }));
    } catch {
      if (owner.current === userId) setState(s => ({ ...s, message: 'testFailed' }));
    } finally {
      if (busyOwner.current === userId) busyOwner.current = null;
      if (owner.current === userId) setState(s => ({ ...s, busy: false }));
    }
  };
  return {
    state: { ...state, supported, loading: state.loading || state.accountId !== (userId || null) },
    actions: {
      save, test, refresh,
      setTime: time => setState(s => ({ ...s, time, message: '' })),
      setTimezone: timezone => setState(s => ({ ...s, timezone, message: '' })),
    },
  };
}
