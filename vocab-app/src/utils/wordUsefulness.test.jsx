import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import frequencyText from './english-frequency.txt?raw';
import { DEFAULT_WORD_USEFULNESS, getWordUsefulness, normalizeUsefulnessSettings } from './wordUsefulness';
import { SettingsContext } from '../contexts/SettingsContext';
import WordUsefulness from '../components/common/WordUsefulness';
import FlashcardFront from '../components/review/modes/FlashcardFront';
import ReviewCardBack from '../components/review/ReviewCardBack';
import i18n from '../i18n/config';

describe('word usefulness', () => {
  const words = frequencyText.trim().split(/\r?\n/).map((line) => line.split(' ')[0]);

  it('keeps corpus rank boundaries and applies the selected core range', () => {
    expect(words).toHaveLength(50000);
    expect(getWordUsefulness(' YOU ').rank).toBe(1);
    expect(getWordUsefulness(words[2999]).level).toBe('core');
    expect(getWordUsefulness(words[3000]).level).toBe('extended');
    expect(getWordUsefulness(words[9999]).level).toBe('extended');
    expect(getWordUsefulness(words[10000]).level).toBe('lessCommon');
    expect(getWordUsefulness(words[3000], { coreRank: 5000 }).level).toBe('core');
    expect(getWordUsefulness(words[1000], { coreRank: 1000 }).level).toBe('extended');
  });

  it('does not infer frequency for unlisted words, phrases or individual senses', () => {
    expect(getWordUsefulness('not-a-listed-vocabulary-item').level).toBe('unknown');
    expect(getWordUsefulness('check in').rank).toBeNull();
    expect(getWordUsefulness(null).rank).toBeNull();
    expect(getWordUsefulness('I\u2019m').rank).toBe(getWordUsefulness("i'm").rank);
  });

  it('changes goal matches without changing corpus frequency', () => {
    const work = getWordUsefulness('invoice', { goal: 'work' });
    const daily = getWordUsefulness('invoice', { goal: 'daily' });
    expect(work.goalMatch).toBe(true);
    expect(daily.goalMatch).toBe(false);
    expect(work.rank).toBe(daily.rank);
    expect(getWordUsefulness('research', { goal: 'academic' }).goalMatch).toBe(true);
    expect(getWordUsefulness('research', { goal: 'custom' }).goalMatch).toBe(false);
  });

  it('recognizes personal priorities across all goals including unknown phrases', () => {
    for (const goal of ['daily', 'work', 'academic', 'custom']) {
      const settings = { goal, priorityWords: ' Invoice，RESEARCH;check   in\nnot-a-listed-vocabulary-item' };
      expect(getWordUsefulness('invoice', settings).personalPriority).toBe(true);
      expect(getWordUsefulness('check in', settings).personalPriority).toBe(true);
      expect(getWordUsefulness('check', settings).personalPriority).toBe(false);
      expect(getWordUsefulness('not-a-listed-vocabulary-item', settings).level).toBe('unknown');
      expect(getWordUsefulness('not-a-listed-vocabulary-item', settings).personalPriority).toBe(true);
    }
  });

  it('recovers safely from invalid persisted settings', () => {
    expect(normalizeUsefulnessSettings(null)).toEqual(DEFAULT_WORD_USEFULNESS);
    expect(normalizeUsefulnessSettings({ goal: 'invalid', coreRank: -1, enabled: 'false', priorityWords: [] })).toEqual(DEFAULT_WORD_USEFULNESS);
    expect(normalizeUsefulnessSettings({ enabled: false }).enabled).toBe(false);
  });

  it('renders the shared indicator and respects visibility preferences', () => {
    const render = (settings) => renderToStaticMarkup(
      <SettingsContext.Provider value={{ state: { wordUsefulness: settings } }}>
        <WordUsefulness word="invoice" />
      </SettingsContext.Provider>
    );
    expect(render({ goal: 'work', priorityWords: 'invoice' })).toContain(i18n.t('usefulness.goalPriority', { goal: i18n.t('usefulness.goals.work') }));
    expect(render({ goal: 'work', priorityWords: 'invoice' })).toContain(i18n.t('usefulness.personalPriority'));
    expect(render({ enabled: false })).toBe('');
  });

  it('shows matching indicators on the flashcard front and answer side', () => {
    const currentReviewWord = { word: 'invoice', pos: 'noun' };
    const render = (child) => renderToStaticMarkup(
      <SettingsContext.Provider value={{ state: { wordUsefulness: { goal: 'work', priorityWords: 'invoice' } } }}>
        {child}
      </SettingsContext.Provider>
    );
    const front = render(<FlashcardFront currentReviewWord={currentReviewWord} />);
    const back = render(<ReviewCardBack currentReviewWord={currentReviewWord} currentReviewEntries={[]} reviewMode="flashcard" />);
    for (const markup of [front, back]) {
      expect(markup).toContain(i18n.t('usefulness.personalPriority'));
      expect(markup).toContain(i18n.t('usefulness.goalPriority', { goal: i18n.t('usefulness.goals.work') }));
    }
  });
});
