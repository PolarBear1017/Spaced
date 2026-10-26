import React from 'react';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SpellingFront = ({
    primaryReviewEntry,
    currentReviewWord,
    userAnswer,
    answerHint,
    handleAnswerChange,
    checkAnswer,
    giveHint,
    feedback,
    isSummaryQuiz = false
}) => {
    const { t } = useTranslation();

    const translationText = primaryReviewEntry.translation || currentReviewWord.translation;
    const definitionText = primaryReviewEntry.definition || currentReviewWord.definition;
    const mainPrompt = translationText || definitionText;
    const subPrompt = translationText && definitionText ? definitionText : null;

    return (
        <div className="space-y-4 w-full">
            <div className="text-xl font-bold text-gray-800">{mainPrompt}</div>
            {subPrompt && (
                <div className="text-base text-gray-600">{subPrompt}</div>
            )}
            {currentReviewWord.pos && (
                <div className="text-sm text-gray-500 font-serif italic lowercase">{currentReviewWord.pos}</div>
            )}
            <div className="relative w-full">
                <input
                    type="text"
                    className="w-full border-b-2 border-gray-300 focus:border-blue-500 outline-none text-2xl text-center py-2 bg-transparent placeholder:text-gray-400"
                    value={userAnswer}
                    placeholder={answerHint}
                    onChange={e => handleAnswerChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); checkAnswer(); } }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                />
                {!isSummaryQuiz && (
                    <button
                        onClick={giveHint}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors p-2"
                        title={t('review.showHint')}
                    >
                        <Lightbulb className="w-5 h-5" />
                    </button>
                )}
            </div>
            {!isSummaryQuiz && feedback === 'incorrect' && (
                <p className="text-sm text-red-500">{t('review.spellingRetryHint')}</p>
            )}
        </div>
    );
};

export default SpellingFront;
