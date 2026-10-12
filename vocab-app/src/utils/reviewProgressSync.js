import { normalizeDailyReview, localDayKey, reviewCalendarDate } from './reviewPlanner';

// Recovery choices apply to one account calendar day, including offline retries.
const validRecoveryChoice = (value, progress) => {
  const today = localDayKey(reviewCalendarDate(new Date(), progress.timezone));
  const choice = typeof value === 'string' ? {mode: value, day: today} : value;
  return choice && ['regular', 'recovery'].includes(choice.mode) && choice.day === today ? choice : null;
};

export function mergeReviewProgress(remote, local, preserveLocalGoal = false, preserveLocalRecovery = false) {
  const result = normalizeDailyReview(remote);
  for (const [key, day] of Object.entries(local.days)) {
    const existing = result.days[key] || { words: [], introduced: [], checkedIn: false };
    result.days[key] = {
      words: [...new Set([...existing.words, ...day.words])],
      introduced: [...new Set([...existing.introduced, ...(day.introduced || [])])],
      checkedIn: existing.checkedIn || day.checkedIn,
      ...(typeof existing.protected === 'boolean' ? { protected: existing.protected } : {}),
      ...(typeof existing.recovery === 'boolean' || (preserveLocalRecovery && typeof day.recovery === 'boolean') ? { recovery: preserveLocalRecovery ? day.recovery ?? existing.recovery : existing.recovery } : {}),
      ...(existing.target || day.target ? { target: existing.target || day.target } : {})
    };
  }
  if (preserveLocalGoal) result.goal = local.goal;
  return normalizeDailyReview(result);
}

// One serial, retryable stream per account. Local persistence is a cache/outbox;
// the server merges sets under an account lock and returns authoritative goals.
export function createReviewProgressSync({ initial, pendingGoal = null, pendingRecovery = null, userId, remote, persist }) {
  let snapshot = { progress: normalizeDailyReview(initial), status: userId ? 'syncing' : 'local' };
  let goal = [5, 10, 20].includes(pendingGoal) ? pendingGoal : null;
  let recoveryChoice = validRecoveryChoice(pendingRecovery, snapshot.progress);
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
  const save = () => persist(snapshot.progress, goal, recoveryChoice);
  const flush = () => {
    if (!userId || !active) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      try {
        let repeat;
        do {
          recoveryChoice = validRecoveryChoice(recoveryChoice, snapshot.progress);
          const version = revision;
          const sent = snapshot.progress;
          publish(sent, 'syncing');
          const outgoing = { ...sent, days: Object.fromEntries([...dirtyDays].map(day => [day, sent.days[day]])) };
          const response = await remote({ userId, progress: outgoing, pendingGoal: goal, ...(recoveryChoice !== null ? {pendingRecovery: recoveryChoice} : {}) });
          if (!active) return;
          repeat = version !== revision;
          const next = mergeReviewProgress(response, snapshot.progress, repeat && goal !== null, repeat && recoveryChoice !== null);
          if (!repeat) { goal = null; recoveryChoice = null; dirtyDays.clear(); }
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
    ingest: (cached, pending, recovery = null) => {
      recovery = validRecoveryChoice(recovery, snapshot.progress);
      const next = mergeReviewProgress(snapshot.progress, normalizeDailyReview(cached), pending !== null, recovery !== null);
      if (JSON.stringify(next) === JSON.stringify(snapshot.progress) && pending === goal && JSON.stringify(recovery) === JSON.stringify(recoveryChoice)) return;
      if (pending !== null) goal = pending;
      if (recovery !== null) recoveryChoice = validRecoveryChoice(recovery, snapshot.progress);
      markChanges(next);
      revision++;
      publish(next, userId ? 'syncing' : 'local');
      void flush();
    },
    update: (transform, goalChanged = false, recovery = null) => {
      const next = transform(snapshot.progress);
      if (goalChanged) goal = next.goal;
      if (recovery !== null) recoveryChoice = validRecoveryChoice(recovery, snapshot.progress);
      markChanges(next);
      revision++;
      publish(next, userId ? 'syncing' : 'local');
      save();
      void flush();
    }
  };
}
