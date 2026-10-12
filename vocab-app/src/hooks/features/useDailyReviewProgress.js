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
    pendingGoal: readJSON(pendingKey, null),
    remote: syncDailyReview,
    persist: (progress, goal) => {
      if (JSON.stringify(readJSON(progressKey, null)) !== JSON.stringify(progress)) writeJSON(progressKey, progress);
      if (readJSON(pendingKey, null) !== goal) writeJSON(pendingKey, goal);
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
        controller.ingest(readJSON(progressKey, null), readJSON(pendingKey, null));
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
  return { ...snapshot, cloudReady: !userId || !!snapshot.progress.timezone, controller, progressKey, anonymous: !!session?.user?.is_anonymous };
}
