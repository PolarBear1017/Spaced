import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n/config';
import ReviewSetup from './ReviewSetup';
import { changeDailyGoal, dailyReviewStats, normalizeDailyReview, reviewDailyTarget } from '../../utils/reviewPlanner';

const now = new Date(2026, 9, 14, 12);
const base = {
  cloudStatus: 'synced', cloudReady: true, recoveryInfo: { active: false, protectionRemaining: 2 },
  dailyGoal: 10, dailyTarget: 10, todayStats: { completed: 2, checkedIn: false, streak: 0 },
  dailyBatchCount: 0, newCount: 8, learnedCount: 2, totalWords: 10,
  selectedReviewFolders: ['all'], sortedFolders: [], allFolderIds: [],
};
const render = props => renderToStaticMarkup(<ReviewSetup {...base} {...props} />);

describe('daily review progress display', () => {
  beforeEach(() => i18n.changeLanguage('zh-TW'));

  it('offers other tasks when the daily queue is empty before reaching the goal', () => {
    const html = render();
    expect(html).toContain('目前沒有可複習的單字');
    expect(html).not.toContain('同一單字每天只計一次');
    expect(html).toMatch(/<button[^>]*>自由練習<\/button>/);
    expect(html).toMatch(/<button[^>]*>學習新字<\/button>/);
  });

  it('applies a raised goal immediately while retaining the check-in and allowing daily review', () => {
    const progress = changeDailyGoal(normalizeDailyReview({ goal: 5, days: {
      '2026-10-14': { words: ['a','b','c','d','e'], checkedIn: true, target: 5 }
    }}), 20, now, 30);
    const target = reviewDailyTarget(progress, now, 30);
    expect(target).toBe(20);
    const html = render({ dailyGoal: progress.goal, dailyTarget: target,
      todayStats: dailyReviewStats(progress, now), dailyBatchCount: 5 });
    expect(html).toContain('今日已打卡');
    expect(html).toContain('新目標尚未完成');
    expect(html).toContain('開始這一輪');
    expect(html).not.toContain('今天的目標已完成');
  });

  it('checks in immediately when lowering the target to the completed count', () => {
    const progress = changeDailyGoal(normalizeDailyReview({ goal: 20, days: {
      '2026-10-14': { words: ['a','b','c','d','e'], checkedIn: false, target: 20 }
    }}), 5, now, 30);
    expect(dailyReviewStats(progress, now).checkedIn).toBe(true);
    expect(reviewDailyTarget(progress, now, 30)).toBe(5);
  });

  it('keeps background sync quiet but shows initial loading and offline recovery', () => {
    expect(render({ cloudStatus: 'syncing', cloudReady: true })).not.toContain('正在同步每日目標');
    expect(render({ cloudStatus: 'syncing', cloudReady: false })).toContain('正在同步每日目標');
    const offline = render({ cloudStatus: 'offline' });
    expect(offline).toContain('雲端同步尚未完成');
    expect(offline).toContain('重新同步');
  });

  it('distinguishes repeated practice from newly counted words in both languages', async () => {
    const props = { sessionSummary: { count: 5, addedCount: 0 } };
    expect(render(props)).toContain('本輪練習 5 字');
    expect(render(props)).toContain('今日進度 +0 字');
    await i18n.changeLanguage('en');
    expect(render(props)).toContain('Practiced 5 words');
    expect(render(props)).toContain('Today’s progress +0 words');
  });
});
