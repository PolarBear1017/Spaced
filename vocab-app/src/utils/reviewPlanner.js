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
  goal: [5, 10, 20].includes(value?.goal) ? value.goal : 10,
  days: value?.days && typeof value.days === 'object' && !Array.isArray(value.days)
    ? Object.fromEntries(Object.entries(value.days).sort(([a], [b]) => a.localeCompare(b)).filter(([key, day]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(day?.words)).map(([key, day]) => [key, { words: [...new Set(day.words.filter(id => typeof id === 'string'))].sort(), introduced: Array.isArray(day.introduced) ? [...new Set(day.introduced.filter(id => typeof id === 'string'))].sort() : [], checkedIn: day.checkedIn === true, ...(Number.isInteger(day.target) && day.target > 0 && day.target <= 20 ? { target: day.target } : {}) }]))
    : {}
});
export const recordReview = (progress, id, now = new Date(), introduced = false, availableCount = Infinity) => {
  const key = localDayKey(now);
  const day = progress.days[key] || { words: [], checkedIn: false };
  const words = [...new Set([...day.words, String(id)])];
  const target = Math.max(1, Math.min(progress.goal, availableCount));
  return { ...progress, days: { ...progress.days, [key]: { words, target, introduced: introduced ? [...new Set([...(day.introduced || []), String(id)])] : day.introduced || [], checkedIn: day.checkedIn || words.length >= target } } };
};
export const changeDailyGoal = (progress, goal, now = new Date(), availableCount = Infinity) => {
  if (![5, 10, 20].includes(goal)) return progress;
  const key = localDayKey(now);
  const day = progress.days[key];
  return { ...progress, goal, days: day ? { ...progress.days, [key]: { ...day, target: Math.max(1, Math.min(goal, availableCount)), checkedIn: day.checkedIn || day.words.length >= Math.min(goal, availableCount) } } : progress.days };
};
export const dailyReviewStats = (progress, now = new Date()) => {
  const today = localDayKey(now);
  const day = progress.days[today];
  const completed = day?.words.length || 0;
  const cursor = new Date(now);
  let streak = 0;
  if (!day?.checkedIn) cursor.setDate(cursor.getDate() - 1);
  while (progress.days[localDayKey(cursor)]?.checkedIn) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const dates = Object.keys(progress.days).filter(key => progress.days[key].checkedIn).sort();
  let bestStreak = 0;
  let run = 0;
  let previous = null;
  dates.forEach(key => {
    const [year, month, date] = key.split('-').map(Number);
    const before = new Date(year, month - 1, date);
    before.setDate(before.getDate() - 1);
    run = previous === localDayKey(before) ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = key;
  });
  return { completed, checkedIn: !!day?.checkedIn, streak, bestStreak, totalDays: Object.values(progress.days).filter(d => d.checkedIn).length };
};

// Share the same folder/star scope between the setup counts and the actual queue.
export const filterReviewWords = (words, { folderIds = ['all'], allFolderIds = [], onlyStarred = false } = {}) => {
  const allSelected = folderIds.includes('all') || (allFolderIds.length > 0 && allFolderIds.every(id => folderIds.includes(id)));
  return words.filter(word => (!onlyStarred || word.isStarred) && (allSelected || word.folderIds?.some(id => folderIds.includes(id))));
};

export const planReview = ({ words, kind = 'daily', size = 5, now = new Date(), completedIds = [], goal = 10, newIntroduced = 0 }) => {
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
    const newAllowance = overdueCount > goal * 3 ? 0 : Math.max(0, 2 - newIntroduced);
    candidates = [...relearningDue, ...unreviewedDue, ...fresh.filter(w => !completedIds.includes(wordReviewId(w))).slice(0, newAllowance)];
  }
  return { batch: candidates.slice(0, Math.max(0, size)), dueCount: due.length, newCount: fresh.length, learnedCount: learned.length, overdueCount };
};
