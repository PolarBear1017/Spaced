import { describe, expect, it, vi } from 'vitest';
import { createReviewProgressSync, mergeReviewProgress } from './reviewProgressSync';
import { reviewCalendarDate, localDayKey, normalizeDailyReview, recordReview } from './reviewPlanner';

const date = new Date(2026, 9, 13, 12);
const cloud = { goal: 10, timezone: 'Asia/Taipei', days: {} };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function setup(options = {}) {
  const persist = vi.fn();
  const remote = vi.fn(async ({progress, pendingGoal}) => ({ ...progress, goal: pendingGoal ?? 10, timezone: 'Asia/Taipei' }));
  const controller = createReviewProgressSync({ initial: cloud, userId: 'a', remote, persist, ...options });
  return { controller, remote, persist };
}

describe('cloud daily review synchronization', () => {
  it('merges independent device progress and preserves earned check-ins', () => {
    const a = { goal: 5, days: { '2026-10-13': { words: ['a', 'b'], introduced: ['a'], checkedIn: true } } };
    const b = { goal: 20, timezone: 'Asia/Taipei', days: { '2026-10-13': { words: ['b', 'c'], introduced: ['c'], checkedIn: false } } };
    expect(mergeReviewProgress(b, a)).toEqual({ goal: 20, timezone: 'Asia/Taipei', days: { '2026-10-13': { words: ['a', 'b', 'c'], introduced: ['a', 'c'], checkedIn: true } } });
  });
  it('retains a historical target when merging a delayed device upload', () => {
    const remote = {goal:20, days:{'2026-10-12':{words:['a','b','c'],target:5}}};
    const local = {goal:20, days:{'2026-10-12':{words:['d','e'],target:5}}};
    const day = mergeReviewProgress(remote, normalizeDailyReview(local)).days['2026-10-12'];
    expect(day.target).toBe(5);
    expect(day.words).toHaveLength(5);
  });
  it('reads the authoritative goal without treating cached settings as a new edit', async () => {
    const {controller, remote} = setup({ initial: { ...cloud, goal: 5 } });
    await controller.connect();
    expect(remote.mock.calls[0][0].pendingGoal).toBeNull();
    expect(controller.getSnapshot().progress.goal).toBe(10);
    expect(controller.getSnapshot().status).toBe('synced');
  });
  it('retries persisted offline progress and pending goal changes after reload', async () => {
    const remote = vi.fn().mockRejectedValue(new Error('offline'));
    const {controller, persist} = setup({ remote });
    await controller.connect();
    controller.update(p => ({ ...recordReview(p, 'word', date), goal: 5 }), true);
    await controller.flush();
    expect(controller.getSnapshot().status).toBe('offline');
    const [initial, pendingGoal] = persist.mock.calls.at(-1);
    const restored = setup({initial, pendingGoal});
    await restored.controller.connect();
    expect(restored.remote.mock.calls[0][0]).toMatchObject({pendingGoal: 5, progress: { days: { '2026-10-13': {words:['word']} } }});
    expect(restored.persist.mock.calls.at(-1)[1]).toBeNull();
  });
  it('does not lose work or a goal edit made while a request is in flight', async () => {
    const first = defer();
    const remote = vi.fn().mockReturnValueOnce(first.promise).mockImplementation(async ({progress, pendingGoal}) => ({ ...progress, goal: pendingGoal ?? 10 }));
    const {controller} = setup({remote});
    const syncing = controller.connect();
    controller.update(p => ({ ...recordReview(p, 'new-word', date), goal: 20 }), true);
    first.resolve(cloud);
    await syncing;
    expect(remote).toHaveBeenCalledTimes(2);
    expect(remote.mock.calls[1][0]).toMatchObject({pendingGoal:20, progress:{days:{'2026-10-13':{words:['new-word']}}}});
    expect(controller.getSnapshot().progress.goal).toBe(20);
  });
  it('ignores a response for a disconnected account', async () => {
    const response = defer();
    const {controller, persist} = setup({remote:()=>response.promise});
    const syncing = controller.connect();
    controller.disconnect();
    response.resolve({...cloud, goal:20});
    await syncing;
    expect(controller.getSnapshot().progress.goal).toBe(10);
    expect(persist).not.toHaveBeenCalled();
  });
  it('merges changes from another tab and does not create a refresh loop for identical cache events', async () => {
    const {controller, remote} = setup();
    await controller.connect();
    controller.ingest(recordReview(normalizeDailyReview(cloud), 'other-tab', date), null);
    await controller.flush();
    const count = remote.mock.calls.length;
    controller.ingest(controller.getSnapshot().progress, null);
    expect(remote).toHaveBeenCalledTimes(count);
    expect(controller.getSnapshot().progress.days['2026-10-13'].words).toEqual(['other-tab']);
  });
  it('keeps guests local and never sends guest history to another account', async () => {
    const {controller, remote} = setup({ userId:null });
    await controller.connect();
    controller.update(p => recordReview(p, 'guest-word', date));
    expect(remote).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('local');
  });
  it('uses the same account calendar day on devices across midnight', () => {
    const instant = new Date('2026-10-12T16:30:00Z');
    expect(localDayKey(reviewCalendarDate(instant, 'Asia/Taipei'))).toBe('2026-10-13');
    expect(localDayKey(reviewCalendarDate(instant, 'America/New_York'))).toBe('2026-10-12');
  });
});
