import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '../../services/storageService';
import { syncDailyReview } from '../../services/reviewProgressService';
import { createReviewProgressSync } from '../../utils/reviewProgressSync';

export default function useDailyReviewProgress(session) {
  const userId = session?.user?.id || null;
  const progressKey = `review_daily_v1:${userId || 'guest'}`;
  const pendingKey = `review_daily_pending_v1:${userId || 'guest'}`;
  const controller = useMemo(() => createReviewProgressSync({
    userId,
    initial: readJSON(progressKey, null),
    pendingGoal: typeof readJSON(pendingKey, null) === 'object' ? readJSON(pendingKey, null)?.goal ?? null : readJSON(pendingKey, null),
    pendingRecovery: readJSON(pendingKey, null)?.recoveryChoice ?? null,
    remote: syncDailyReview,
    persist: (progress, goal, recoveryChoice) => {
      const pending = recoveryChoice ? {goal, recoveryChoice} : goal;
      if (JSON.stringify(readJSON(progressKey, null)) !== JSON.stringify(progress)) writeJSON(progressKey, progress);
      if (JSON.stringify(readJSON(pendingKey, null)) !== JSON.stringify(pending)) writeJSON(pendingKey, pending);
    }
  }), [userId, progressKey, pendingKey]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.connect();
    const refresh = () => { void controller.flush(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    // Other tabs trigger an authoritative cloud refresh, not a stale overwrite.
    const storage = event => {
      if (event.key === progressKey || event.key === pendingKey) {
        const pending = readJSON(pendingKey, null);
        controller.ingest(readJSON(progressKey, null), typeof pending === 'object' ? pending?.goal ?? null : pending, pending?.recoveryChoice ?? null);
      }
    };
    window.addEventListener('storage', storage);
    return () => {
      controller.disconnect();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('storage', storage);
    };
  }, [controller, progressKey, pendingKey]);
  return { ...snapshot, cloudReady: snapshot.ready, controller, progressKey, anonymous: !!session?.user?.is_anonymous };
}
