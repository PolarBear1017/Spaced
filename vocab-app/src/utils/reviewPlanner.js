import { getReviewTimestamp, isReviewDue } from './data';

export const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
// Use the account's timezone on every device; the proxy is only for calendar
// helpers. FSRS scheduling still uses the real instant.
export const reviewCalendarDate = (now = new Date(), timezone) => {
  if (!timezone) return now;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = type => Number(parts.find(part => part.type === type).value);
  return new Date(get('year'), get('month') - 1, get('day'), 12);
};
export const wordReviewId = word => String(word.libraryId ?? word.id);
export const isNewWord = word => !word.last_review && !(word.reps > 0) && !(word.proficiencyScore > 0) && (word.state == null || word.state === 0);
export const normalizeDailyReview = value => ({
  ...(typeof value?.timezone === 'string' ? { timezone: value.timezone } : {}),
  ...(Number.isInteger(value?.protectionRemaining) ? { protectionRemaining: Math.max(0, Math.min(2, value.protectionRemaining)) } : {}),
  goal: [5, 10, 20].includes(value?.goal) ? value.goal : 10,
  days: value?.days && typeof value.days === 'object' && !Array.isArray(value.days)
    ? Object.fromEntries(Object.entries(value.days).sort(([a], [b]) => a.localeCompare(b)).filter(([key, day]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(day?.words)).map(([key, day]) => [key, { words: [...new Set(day.words.filter(id => typeof id === 'string'))].sort(), introduced: Array.isArray(day.introduced) ? [...new Set(day.introduced.filter(id => typeof id === 'string'))].sort() : [], checkedIn: day.checkedIn === true, ...(typeof day.protected === 'boolean' ? { protected: day.protected } : {}), ...(typeof day.recovery === 'boolean' ? { recovery: day.recovery } : {}), ...(Number.isInteger(day.target) && day.target > 0 && day.target <= 20 ? { target: day.target } : {}) }]))
    : {}
});
export const recordReview = (progress, id, now = new Date(), introduced = false, availableCount = Infinity) => {
  const key = localDayKey(now);
  const day = progress.days[key] || { words: [], checkedIn: false };
  const words = [...new Set([...day.words, String(id)])];
  const target = reviewDailyTarget(progress, now, availableCount);
  return { ...progress, days: { ...progress.days, [key]: { ...day, words, target, introduced: introduced ? [...new Set([...(day.introduced || []), String(id)])] : day.introduced || [], checkedIn: day.checkedIn || words.length >= target } } };
};
export const changeDailyGoal = (progress, goal, now = new Date(), availableCount = Infinity) => {
  if (![5, 10, 20].includes(goal)) return progress;
  const key = localDayKey(now);
  const day = progress.days[key];
  return { ...progress, goal, days: day ? { ...progress.days, [key]: { ...day, target: Math.max(1, Math.min(day.recovery ? 5 : goal, availableCount)), checkedIn: day.checkedIn || day.words.length >= Math.max(1, Math.min(day.recovery ? 5 : goal, availableCount)) } } : progress.days };
};
export const dailyReviewStats = (progress, now = new Date()) => {
  const today = localDayKey(now);
  const day = progress.days[today];
  const completed = day?.words.length || 0;
  const cursor = new Date(now);
  let streak = 0;
  if (!day?.checkedIn) cursor.setDate(cursor.getDate() - 1);
  while (progress.days[localDayKey(cursor)]?.checkedIn || progress.days[localDayKey(cursor)]?.protected) {
    if (progress.days[localDayKey(cursor)]?.checkedIn) streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const dates = Object.keys(progress.days).filter(key => progress.days[key].checkedIn || progress.days[key].protected).sort();
  let bestStreak = 0;
  let run = 0;
  let previous = null;
  dates.forEach(key => {
    const [year, month, date] = key.split('-').map(Number);
    const before = new Date(year, month - 1, date);
    before.setDate(before.getDate() - 1);
    const increment = progress.days[key].checkedIn ? 1 : 0;
    run = previous === localDayKey(before) ? run + increment : increment;
    bestStreak = Math.max(bestStreak, run);
    previous = key;
  });
  return { completed, checkedIn: !!day?.checkedIn, streak, bestStreak, totalDays: Object.values(progress.days).filter(d => d.checkedIn).length };
};

export const reviewDailyTarget = (progress, now = new Date(), availableCount = Infinity) =>
  Math.max(1, Math.min(progress.days[localDayKey(now)]?.recovery ? 5 : progress.goal, availableCount));

export const recoveryProgress = (progress, now = new Date()) => {
  const today = localDayKey(now);
  const prior = Object.keys(progress.days).filter(key => key < today && progress.days[key].checkedIn).sort().at(-1);
  return {
    active: !!progress.days[today]?.recovery,
    lastLearnedDay: prior || null,
    protectedYesterday: !!progress.days[localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))]?.protected,
    protectionRemaining: progress.protectionRemaining ?? 0
  };
};

// Share the same folder/star scope between the setup counts and the actual queue.
export const filterReviewWords = (words, { folderIds = ['all'], allFolderIds = [], onlyStarred = false } = {}) => {
  const allSelected = folderIds.includes('all') || (allFolderIds.length > 0 && allFolderIds.every(id => folderIds.includes(id)));
  return words.filter(word => {
    const definitions = word.selectedDefinitions ?? word.selected_definitions;
    if (Array.isArray(definitions) && definitions.length === 0) return false;
    return (!onlyStarred || word.isStarred) && (allSelected || word.folderIds?.some(id => folderIds.includes(id)));
  });
};

// A daily summary quiz recaps what was actually completed today, regardless
// of the folder/star filters currently selected on the setup screen.
export const DAILY_SUMMARY_QUIZ_SIZE = 5;

export const dailySummaryWords = (words, completedIds) => {
  const completed = new Set((completedIds || []).map(String));
  return [...new Map(
    (words || [])
      .filter(word => word.word?.trim() && completed.has(wordReviewId(word)))
      .map(word => [wordReviewId(word), word])
  ).values()];
};

export const buildDailySummaryQuiz = (words, completedIds, {
  introducedIds = [], seenIds = [], random = Math.random
} = {}) => {
  const unique = dailySummaryWords(words, completedIds);
  const shuffle = items => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  };
  // A newly learned word already has FSRS history by quiz time. Use today's
  // introduction record rather than its current scheduling state.
  const introduced = new Set(introducedIds.map(String));
  const seen = new Set(seenIds.map(String));
  const fresh = unique.filter(word => introduced.has(wordReviewId(word)));
  const old = unique.filter(word => !introduced.has(wordReviewId(word)));
  const size = Math.min(DAILY_SUMMARY_QUIZ_SIZE, unique.length);
  const freshCount = fresh.length && old.length && size > 1
    ? Math.min(fresh.length, size - 1, Math.max(1, size - old.length, Math.round(size * fresh.length / unique.length)))
    : Math.min(size, fresh.length);
  const pick = (pool, count) => [
    ...shuffle(pool.filter(word => !seen.has(wordReviewId(word)))),
    ...shuffle(pool.filter(word => seen.has(wordReviewId(word))))
  ].slice(0, count);
  return shuffle([...pick(fresh, freshCount), ...pick(old, size - freshCount)]);
};

export const planReview = ({ words, kind = 'daily', size = 5, now = new Date(), completedIds = [], goal = 10, newIntroduced = 0, recovery = false }) => {
  const unique = [...new Map(words.map(word => [wordReviewId(word), word])).values()];
  const fresh = unique.filter(isNewWord);
  const learned = unique.filter(word => !isNewWord(word));
  const due = learned.filter(word => isReviewDue(word.nextReview ?? word.due, now)).sort((a, b) => {
    const shortTerm = word => word.state === 1 || word.state === 3 ? 0 : 1;
    return shortTerm(a) - shortTerm(b) || getReviewTimestamp(a.nextReview ?? a.due) - getReviewTimestamp(b.nextReview ?? b.due);
  });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const overdueCount = due.filter(word => isReviewDue(word.nextReview ?? word.due, yesterday)).length;
  let candidates;
  if (kind === 'practice') {
    // Rotate through learned words; repeats are available after all have been practiced.
    candidates = [...learned.filter(w => !completedIds.includes(wordReviewId(w))), ...learned.filter(w => completedIds.includes(wordReviewId(w)))];
  } else if (kind === 'new') {
    candidates = fresh;
  } else {
    const unreviewedDue = due.filter(w => !completedIds.includes(wordReviewId(w)));
    const relearningDue = due.filter(w => completedIds.includes(wordReviewId(w)) && (w.state === 1 || w.state === 3));
    // Stop automatic new words when the overdue workload exceeds three daily goals.
    const newAllowance = recovery || overdueCount > goal * 3 ? 0 : Math.max(0, 2 - newIntroduced);
    candidates = [...relearningDue, ...unreviewedDue, ...fresh.filter(w => !completedIds.includes(wordReviewId(w))).slice(0, newAllowance)];
  }
  return { batch: candidates.slice(0, Math.max(0, size)), dueCount: due.length, newCount: fresh.length, learnedCount: learned.length, overdueCount };
};
