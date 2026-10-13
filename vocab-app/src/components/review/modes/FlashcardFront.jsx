import React from 'react';
import WordUsefulness from '../../common/WordUsefulness';

const FlashcardFront = ({ currentReviewWord }) => {
    return (
        <div className="w-full space-y-3">
            <h2 className="text-4xl font-bold text-gray-800 break-words">{currentReviewWord.word}</h2>
            <WordUsefulness word={currentReviewWord.word} className="[&>summary]:justify-center" />
        </div>
    );
};

export default FlashcardFront;
