import { describe, expect, it } from 'vitest';
import { changeDailyGoal, dailyReviewStats, filterReviewWords, isNewWord, localDayKey, normalizeDailyReview, planReview, recordReview } from './reviewPlanner';

const now = new Date(2026, 9, 12, 12);
const old = (id, due = new Date(2026, 9, 11), extra = {}) => ({ id, reps: 2, state: 2, nextReview: due.toISOString(), ...extra });
const fresh = id => ({ id, proficiencyScore: 0 });
const completedDay = { words: ['1', '2', '3', '4', '5'], checkedIn: true };

describe('daily review planner', () => {
  it('uses the same folder and star scope, including explicit selection of all folders', () => {
    const words = [old('unfiled'), { ...old('a'), folderIds: ['a'], isStarred: true }, { ...old('b'), folderIds: ['b'] }];
    expect(filterReviewWords(words, { folderIds: ['a'], onlyStarred: true }).map(w => w.id)).toEqual(['a']);
    expect(filterReviewWords(words, { folderIds: ['a', 'b'], allFolderIds: ['a', 'b'] })).toHaveLength(3);
    expect(filterReviewWords(words, { folderIds: [] })).toHaveLength(0);
  });
  it('does not fill even a small batch with words that are not due', () => {
    const plan = planReview({ words: [old('due'), old('future', new Date(2026, 9, 13)), old('laterToday', new Date(2026, 9, 12, 18))], now });
    expect(plan.batch.map(w => w.id)).toEqual(['due']);
    expect(plan.dueCount).toBe(1);
  });
  it('prioritizes learning/relearning and then the oldest due word', () => {
    const words = [old('oldest', new Date(2026, 9, 1)), old('recent'), old('learning', new Date(2026, 9, 12, 11), { state: 1 }), fresh('new')];
    expect(planReview({ words, now, size: 3 }).batch.map(w => w.id)).toEqual(['learning', 'oldest', 'recent']);
  });
  it('does not classify a forgotten or legacy learned word as new', () => {
    expect(isNewWord(old('forgotten', now, { proficiencyScore: 0 }))).toBe(false);
    expect(isNewWord({ id: 'legacy', proficiencyScore: 1 })).toBe(false);
    expect(isNewWord({ id: 'legacy', last_review: now.toISOString(), proficiencyScore: 0 })).toBe(false);
    expect(isNewWord(fresh('new'))).toBe(true);
  });
  it('limits automatically introduced words across rounds', () => {
    const words = [fresh('a'), fresh('b'), fresh('c')];
    expect(planReview({ words, now }).batch).toHaveLength(2);
    expect(planReview({ words, now, newIntroduced: 1 }).batch).toHaveLength(1);
    expect(planReview({ words, now, newIntroduced: 2 }).batch).toHaveLength(0);
  });
  it('pauses automatic new words during a backlog but allows voluntary learning', () => {
    const words = [...Array.from({ length: 16 }, (_, i) => old(String(i))), fresh('new')];
    expect(planReview({ words, now, goal: 5, size: 20 }).batch.some(isNewWord)).toBe(false);
    expect(planReview({ words, now, kind: 'new' }).batch.map(w => w.id)).toEqual(['new']);
  });
  it('keeps due short-term repetitions available without selecting a mature word twice', () => {
    const words = [old('mature'), old('again', now, { state: 3 })];
    expect(planReview({ words, now, completedIds: ['mature', 'again'] }).batch.map(w => w.id)).toEqual(['again']);
  });
  it('free practice excludes new words, rotates learned words, and deduplicates library entries', () => {
    const words = [old('a'), old('b'), old('b'), fresh('new')];
    expect(planReview({ words, now, kind: 'practice', completedIds: ['a'] }).batch.map(w => w.id)).toEqual(['b', 'a']);
  });
});

describe('daily goals and check-ins', () => {
  it('counts a word once per local day and checks in automatically', () => {
    let progress = changeDailyGoal(normalizeDailyReview(null), 5, now);
    for (let i = 0; i < 5; i++) progress = recordReview(progress, String(i), now, i === 0);
    progress = recordReview(progress, '0', now, true);
    expect(dailyReviewStats(progress, now)).toEqual({ completed: 5, checkedIn: true, streak: 1, bestStreak: 1, totalDays: 1 });
    expect(progress.days[localDayKey(now)].introduced).toEqual(['0']);
  });
  it('resets today’s count at local midnight, preserving yesterday’s streak until the day ends', () => {
    const progress = normalizeDailyReview({ days: { '2026-10-11': completedDay } });
    expect(dailyReviewStats(progress, now)).toEqual({ completed: 0, checkedIn: false, streak: 1, bestStreak: 1, totalDays: 1 });
    expect(dailyReviewStats(progress, new Date(2026, 9, 13)).streak).toBe(0);
  });
  it('preserves past effort after a missed day and starts a new streak', () => {
    let progress = normalizeDailyReview({ goal: 5, days: { '2026-10-09': completedDay, '2026-10-10': completedDay } });
    for (let i = 0; i < 5; i++) progress = recordReview(progress, String(i), now);
    expect(dailyReviewStats(progress, now)).toMatchObject({ streak: 1, bestStreak: 2, totalDays: 3 });
  });
  it('allows lowering a goal and does not revoke an earned check-in when raising it', () => {
    let progress = normalizeDailyReview(null);
    for (let i = 0; i < 5; i++) progress = recordReview(progress, String(i), now);
    expect(dailyReviewStats(progress, now).checkedIn).toBe(false);
    progress = changeDailyGoal(progress, 5, now);
    progress = changeDailyGoal(progress, 20, now);
    expect(progress.goal).toBe(20);
    expect(dailyReviewStats(progress, now).checkedIn).toBe(true);
  });
  it('makes goals achievable for a small library', () => {
    let progress = normalizeDailyReview(null);
    progress = recordReview(progress, 'only-word', now, true, 1);
    expect(dailyReviewStats(progress, now)).toMatchObject({ completed: 1, checkedIn: true });
  });
  it('preserves yesterday’s target when today’s goal changes', () => {
    let progress = changeDailyGoal(normalizeDailyReview(null), 5, now);
    progress = recordReview(progress, 'a', now);
    progress = changeDailyGoal(progress, 20, new Date(2026, 9, 13));
    expect(normalizeDailyReview(progress).days[localDayKey(now)].target).toBe(5);
  });
  it('handles malformed saved settings without counting invalid history', () => {
    expect(normalizeDailyReview({ goal: -1, days: { bad: completedDay, '2026-10-12': { words: null } } })).toEqual({ goal: 10, days: {} });
  });
});
