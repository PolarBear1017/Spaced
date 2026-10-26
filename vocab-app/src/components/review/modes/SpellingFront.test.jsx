import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n/config';
import SpellingFront from './SpellingFront';

const render = props => renderToStaticMarkup(<SpellingFront
    primaryReviewEntry={{ translation: '蘋果' }} currentReviewWord={{ word: 'apple' }}
    userAnswer="" answerHint="" isSummaryQuiz {...props}
/>);

describe('summary spelling prompts', () => {
    beforeEach(() => i18n.changeLanguage('zh-TW'));

    it('offers the letter hint in both summary and regular spelling modes', () => {
        expect(render()).toContain('aria-label="顯示提示 (首字母)"');
        expect(render({ isSummaryQuiz: false })).toContain('aria-label="顯示提示 (首字母)"');
    });

    it('keeps the correct answer visible while the user types their correction', () => {
        const html = render({ hasMistake: true, userAnswer: 'app', feedback: null });
        expect(html).toContain('正確拼法是 apple');
        expect(html).toContain('請自己再輸入一次正確拼法');
        expect(html).toContain('value="app"');
        expect(html).toContain('保留第一次作答的結果');
    });

    it('does not reveal the answer before a mistake', () => {
        expect(render()).not.toContain('正確拼法是 apple');
    });
});
