// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useReview from './useReview';
import { localDayKey, normalizeDailyReview, reviewCalendarDate } from '../../utils/reviewPlanner';

const daily = vi.hoisted(() => ({ progress: null, key: 'review_daily_v1:guest', ready: true, controller: null }));
vi.mock('./useDailyReviewProgress', () => ({ default: () => ({
  progress: daily.progress, progressKey: daily.key, controller: daily.controller,
  cloudReady: daily.ready, status: 'synced', anonymous: false
}) }));
vi.mock('../../services/libraryService', () => ({ updateUserLibraryProgress: vi.fn() }));
vi.mock('../../services/speechService', () => ({ speak: vi.fn(), getAudioUrl: () => null }));
vi.mock('../../i18n/config', () => ({ default: { t: key => key } }));

let root, container, review, props, day;
const Probe = () => { review = useReview(props); return null; };
const run = action => act(action);
const render = () => run(() => root.render(<Probe />));
const submit = answer => {
  run(() => review.actions.handleAnswerChange(answer));
  run(() => review.actions.checkAnswer());
};
const answerQuestion = answer => {
  submit(answer);
  if (review.state.hasMistake && !review.state.isAwaitingNext) {
    submit(review.derived.currentReviewWord.word);
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T04:00:00Z'));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  day = localDayKey(reviewCalendarDate(new Date(), 'Asia/Taipei'));
  daily.key = 'review_daily_v1:guest';
  daily.ready = true;
  daily.progress = normalizeDailyReview({ goal: 10, timezone: 'Asia/Taipei', days: {
    [day]: { words: Array.from({ length: 12 }, (_, i) => String(i)), introduced: Array.from({ length: 10 }, (_, i) => String(i)), checkedIn: true }
  } });
  daily.controller = {
    getSnapshot: () => ({ progress: daily.progress }),
    update: vi.fn(transform => { daily.progress = transform(daily.progress); }),
    flush: vi.fn()
  };
  props = {
    vocabData: Array.from({ length: 13 }, (_, i) => ({
      id: String(i), word: `vocabulary${i}`, translation: `字義 ${i}`,
      reps: i < 10 ? 0 : 2, state: i < 10 ? 0 : 2,
      folderIds: ['other'], isStarred: false
    })),
    updateWord: vi.fn(), session: null, requestRetention: 0.9,
    folders: [], allFolderIds: ['other', 'selected'], setActiveTab: vi.fn(), activeTab: 'review_session'
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render();
});

afterEach(() => {
  run(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('daily spelling summary quiz', () => {
  it('samples 4 new and 1 old reviewed words, regardless of setup filters', () => {
    run(() => {
      review.actions.setSelectedReviewFolders(['selected']);
      review.actions.setOnlyStarred(true);
    });
    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.reviewMode).toBe('spelling');
    expect(review.state.sessionKind).toBe('summaryQuiz');
    expect(review.state.reviewQueue).toHaveLength(5);
    expect(review.state.reviewQueue.filter(word => Number(word.id) < 10)).toHaveLength(4);
    expect(review.state.reviewQueue.some(word => word.id === '12')).toBe(false);
    expect(review.state.summaryQuizCount).toBe(5);
    expect(props.setActiveTab).toHaveBeenLastCalledWith('review_session');
  });

  it('scores first attempts including typos without changing progress, check-in or scheduling', () => {
    const before = structuredClone(daily.progress);
    run(() => review.actions.startDailySummaryQuiz());
    run(() => review.actions.advanceToNextCard());
    expect(review.state.currentCardIndex).toBe(0);

    const incorrectWords = [];
    for (let index = 0; index < 5; index += 1) {
      const word = review.derived.currentReviewWord.word;
      if (index < 2) incorrectWords.push(word);
      answerQuestion(index === 0 ? 'wrong' : index === 1 ? `${word}x` : ` ${word.toUpperCase()} `);
      expect(review.state.isFlipped).toBe(true);
      expect(review.state.isAwaitingNext).toBe(true);
      // Repeated submissions cannot replace the first result or add another score.
      run(() => review.actions.checkAnswer());
      run(() => {
        review.actions.advanceToNextCard();
        review.actions.advanceToNextCard();
      });
    }

    expect(review.state.sessionSummary).toMatchObject({
      kind: 'summaryQuiz', count: 5, correctCount: 3, incorrectWords, day
    });
    expect(props.setActiveTab).toHaveBeenLastCalledWith('review');
    expect(daily.controller.update).not.toHaveBeenCalled();
    expect(props.updateWord).not.toHaveBeenCalled();
    expect(daily.progress).toEqual(before);
  });

  it('draws untested words next and only repeats the missed words when requested', () => {
    run(() => review.actions.startDailySummaryQuiz());
    const firstIds = review.state.reviewQueue.map(word => word.id);
    const missedIds = firstIds.slice(0, 2);
    for (let index = 0; index < 5; index += 1) {
      answerQuestion(index < 2 ? 'wrong' : review.derived.currentReviewWord.word);
      run(() => review.actions.advanceToNextCard());
    }
    expect(review.state.sessionSummary.incorrectIds).toEqual(missedIds);
    run(() => review.actions.startDailySummaryQuiz('mistakes'));
    expect(review.state.reviewQueue.map(word => word.id).sort()).toEqual([...missedIds].sort());
    for (let index = 0; index < 2; index += 1) {
      submit(review.derived.currentReviewWord.word);
      run(() => review.actions.advanceToNextCard());
    }
    expect(review.state.sessionSummary).toMatchObject({ count: 2, correctCount: 2, incorrectIds: [] });
    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.reviewQueue.every(word => !firstIds.includes(word.id))).toBe(true);
    expect(daily.controller.update).not.toHaveBeenCalled();
    expect(props.updateWord).not.toHaveBeenCalled();
  });

  it('uses actual available words for the question count and blocks stale mistake practice', () => {
    daily.progress.days[day].words = ['0', '1', 'deleted'];
    render();
    expect(review.state.summaryQuizCount).toBe(2);
    run(() => review.actions.startDailySummaryQuiz());
    for (let index = 0; index < 2; index += 1) {
      answerQuestion('wrong');
      run(() => review.actions.advanceToNextCard());
    }
    vi.setSystemTime(new Date('2026-10-27T04:00:00Z'));
    daily.progress.days['2026-10-27'] = { words: ['0', '1'], checkedIn: true, introduced: [] };
    run(() => window.dispatchEvent(new Event('focus')));
    render();
    expect(review.state.sessionSummary).toBeNull();
    props.setActiveTab.mockClear();
    run(() => review.actions.startDailySummaryQuiz('mistakes'));
    expect(props.setActiveTab).not.toHaveBeenCalled();
  });

  it('starts a fresh quiz when taking the test again', () => {
    daily.progress.days[day].words = ['0'];
    render();
    run(() => review.actions.startDailySummaryQuiz());
    answerQuestion('wrong');
    run(() => review.actions.advanceToNextCard());
    expect(review.state.sessionSummary.correctCount).toBe(0);

    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.sessionSummary).toBeNull();
    expect(review.state.userAnswer).toBe('');
    submit(review.derived.currentReviewWord.word);
    run(() => review.actions.advanceToNextCard());
    expect(review.state.sessionSummary).toMatchObject({ count: 1, correctCount: 1, incorrectWords: [] });
  });

  it.each(['wrong', 'typo'])('requires exact correction after a %s answer and preserves the first result', kind => {
    daily.progress.days[day].words = ['0'];
    render();
    run(() => review.actions.startDailySummaryQuiz());
    const word = review.derived.currentReviewWord.word;
    run(() => review.actions.giveHint());
    expect(review.state.answerHint).toBe(`${word[0]}...`);
    submit(kind === 'typo' ? `${word}x` : 'wrong');
    expect(review.state.answerHint).toBe(word);
    expect(review.state.hasMistake).toBe(true);
    expect(review.state.isFlipped).toBe(false);
    expect(review.state.isAwaitingNext).toBe(false);
    run(() => review.actions.advanceToNextCard());
    expect(review.state.sessionSummary).toBeNull();
    submit(`${word}x`);
    expect(review.state.isAwaitingNext).toBe(false);
    submit(word);
    expect(review.state.isAwaitingNext).toBe(true);
    run(() => review.actions.advanceToNextCard());
    expect(review.state.sessionSummary).toMatchObject({ count: 1, correctCount: 0, incorrectWords: [word] });
    expect(daily.controller.update).not.toHaveBeenCalled();
    expect(props.updateWord).not.toHaveBeenCalled();
  });

  it('allows a correct first answer after a letter hint without requiring correction', () => {
    run(() => review.actions.startDailySummaryQuiz());
    run(() => review.actions.giveHint());
    submit(review.derived.currentReviewWord.word);
    expect(review.state.hasMistake).toBe(false);
    expect(review.state.isAwaitingNext).toBe(true);
    run(() => review.actions.advanceToNextCard());
    expect(review.state.hasMistake).toBe(false);
    expect(review.state.answerHint).toBe('');
  });

  it('requires check-in and available reviewed words before starting', () => {
    daily.progress.days[day].checkedIn = false;
    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.reviewQueue).toEqual([]);
    daily.progress.days[day].checkedIn = true;
    daily.progress.days[day].words = ['deleted-word'];
    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.reviewQueue).toEqual([]);
    expect(props.setActiveTab).not.toHaveBeenCalled();
  });

  it('does not include yesterday’s words when a new day begins', () => {
    vi.setSystemTime(new Date('2026-10-27T04:00:00Z'));
    run(() => review.actions.startDailySummaryQuiz());
    expect(review.state.reviewQueue).toEqual([]);
  });

  it('discards the quiz when switching accounts', () => {
    run(() => review.actions.startDailySummaryQuiz());
    daily.key = 'review_daily_v1:another-account';
    render();
    expect(review.state.reviewQueue).toEqual([]);
    expect(review.state.sessionSummary).toBeNull();
    expect(props.setActiveTab).toHaveBeenLastCalledWith('review');
  });

  it('still checks in through normal review alone when the daily target is reached', () => {
    daily.progress.goal = 5;
    daily.progress.days[day] = { words: ['0', '1', '2', '3'], introduced: [], checkedIn: false };
    render();
    run(() => review.actions.startReview(['all'], 'flashcard', 'practice'));
    run(() => review.actions.processRating(3));
    expect(daily.progress.days[day].checkedIn).toBe(true);
    expect(daily.progress.days[day].words).toHaveLength(5);
    expect(review.state.sessionKind).toBe('practice');
  });
});
