import { normalizeDailyReview } from './reviewPlanner';

export function mergeReviewProgress(remote, local, preserveLocalGoal = false) {
  const result = normalizeDailyReview(remote);
  for (const [key, day] of Object.entries(local.days)) {
    const existing = result.days[key] || { words: [], introduced: [], checkedIn: false };
    result.days[key] = {
      words: [...new Set([...existing.words, ...day.words])],
      introduced: [...new Set([...existing.introduced, ...(day.introduced || [])])],
      checkedIn: existing.checkedIn || day.checkedIn,
      ...(existing.target || day.target ? { target: existing.target || day.target } : {})
    };
  }
  if (preserveLocalGoal) result.goal = local.goal;
  return normalizeDailyReview(result);
}

// One serial, retryable stream per account. Local persistence is a cache/outbox;
// the server merges sets under an account lock and returns authoritative goals.
export function createReviewProgressSync({ initial, pendingGoal = null, userId, remote, persist }) {
  let snapshot = { progress: normalizeDailyReview(initial), status: userId ? 'syncing' : 'local' };
  let goal = [5, 10, 20].includes(pendingGoal) ? pendingGoal : null;
  const dirtyDays = new Set(Object.keys(snapshot.progress.days));
  const markChanges = next => {
    for (const [day, value] of Object.entries(next.days)) {
      if (JSON.stringify(snapshot.progress.days[day]) !== JSON.stringify(value)) dirtyDays.add(day);
    }
  };
  let revision = 0;
  let running = null;
  let active = false;
  const listeners = new Set();
  const publish = (progress, status) => {
    snapshot = { progress, status };
    for (const listener of listeners) listener();
  };
  const save = () => persist(snapshot.progress, goal);
  const flush = () => {
    if (!userId || !active) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      try {
        let repeat;
        do {
          const version = revision;
          const sent = snapshot.progress;
          publish(sent, 'syncing');
          const outgoing = { ...sent, days: Object.fromEntries([...dirtyDays].map(day => [day, sent.days[day]])) };
          const response = await remote({ userId, progress: outgoing, pendingGoal: goal });
          if (!active) return;
          repeat = version !== revision;
          const next = mergeReviewProgress(response, snapshot.progress, repeat && goal !== null);
          if (!repeat) { goal = null; dirtyDays.clear(); }
          publish(next, repeat ? 'syncing' : 'synced');
          save();
        } while (repeat && active);
      } catch {
        if (active) publish(snapshot.progress, 'offline');
      } finally {
        running = null;
      }
    })();
    return running;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    connect: () => { active = true; return flush(); },
    disconnect: () => { active = false; },
    flush,
    ingest: (cached, pending) => {
      const next = mergeReviewProgress(snapshot.progress, normalizeDailyReview(cached), pending !== null);
      if (JSON.stringify(next) === JSON.stringify(snapshot.progress) && pending === goal) return;
      if (pending !== null) goal = pending;
      markChanges(next);
      revision++;
      publish(next, userId ? 'syncing' : 'local');
      void flush();
    },
    update: (transform, goalChanged = false) => {
      const next = transform(snapshot.progress);
      if (goalChanged) goal = next.goal;
      markChanges(next);
      revision++;
      publish(next, userId ? 'syncing' : 'local');
      save();
      void flush();
    }
  };
}
