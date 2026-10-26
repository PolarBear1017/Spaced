import React from 'react';
import { useTranslation } from 'react-i18next';

const ReviewControls = ({
    reviewMode,
    isFlipped,
    setIsFlipped,
    checkAnswer,
    processRating,
    advanceToNextCard,
    isAwaitingNext,
    isLastCard = false,
    isSummaryQuiz = false
}) => {
    const { t } = useTranslation();

    if (!isFlipped) {
        return (
            <button
                onClick={() => reviewMode === 'flashcard' ? setIsFlipped(true) : checkAnswer()}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm"
            >
                {reviewMode === 'flashcard' ? t('review.showAnswer') : t('review.check')}
            </button>
        );
    }

    if (reviewMode === 'flashcard') {
        return (
            <div>
                <p className="text-center text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">
                    {t('review.selfAssessment')}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    <button
                        onClick={() => processRating(1)}
                        className="px-4 py-3 rounded-lg font-bold bg-red-100 text-red-700 hover:bg-red-200 transition"
                    >
                        {t('review.again')}
                    </button>
                    <button
                        onClick={() => processRating(2)}
                        className="px-4 py-3 rounded-lg font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 transition"
                    >
                        {t('review.hard')}
                    </button>
                    <button
                        onClick={() => processRating(3)}
                        className="px-5 py-3 rounded-lg font-extrabold bg-green-100 text-green-700 hover:bg-green-200 transition"
                    >
                        {t('review.good')}
                    </button>
                    <button
                        onClick={() => processRating(4)}
                        className="px-4 py-3 rounded-lg font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                    >
                        {t('review.easy')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={advanceToNextCard}
            disabled={!isAwaitingNext}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
        >
            {isSummaryQuiz && isLastCard ? t('review.summaryQuiz.viewResults') : t('review.nextCard')}
        </button>
    );
};

export default ReviewControls;
