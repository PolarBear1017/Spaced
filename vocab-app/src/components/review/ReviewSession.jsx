import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../services/speechService';
import { useSettingsContext } from '../../contexts/SettingsContext';

// Sub-components
import ReviewCardBack from './ReviewCardBack';
import ReviewControls from './ReviewControls';
import FlashcardFront from './modes/FlashcardFront';
import SpellingFront from './modes/SpellingFront';
import ClozeFront from './modes/ClozeFront';
import DictationFront from './modes/DictationFront';

const ReviewSession = ({
  reviewQueue,
  currentCardIndex,
  reviewMode,
  sessionKind,
  isFlipped,
  userAnswer,
  feedback,
  lastResult,
  isAwaitingNext,
  answerHint,
  hasMistake,
  currentReviewWord,
  currentReviewEntries,
  primaryReviewEntry,
  clozeExampleMain,
  clozeTranslation,
  clozeCollocation,
  preferredReviewAudio,
  preferredAccent,
  setPreferredAccent,
  setActiveTab,
  setIsFlipped,
  handleAnswerChange,
  checkAnswer,
  processRating,
  advanceToNextCard,
  giveHint
}) => {
  const { t } = useTranslation();
  const {
    state: { audioSpeed, chineseAudioSpeed, playAudioShortcut }
  } = useSettingsContext();

  // Auto-speak word when entering dictation mode
  useEffect(() => {
    if (reviewMode === 'dictation' && !isFlipped && currentReviewWord?.word) {
      speak(currentReviewWord.word, preferredReviewAudio, { rate: audioSpeed || 1.0 });
    }
  }, [currentReviewWord, isFlipped, preferredReviewAudio, audioSpeed, reviewMode]);

  const renderFrontContent = () => {
    switch (reviewMode) {
      case 'flashcard':
        return <FlashcardFront currentReviewWord={currentReviewWord} />;
      case 'spelling':
        return (
          <SpellingFront
            primaryReviewEntry={primaryReviewEntry}
            currentReviewWord={currentReviewWord}
            userAnswer={userAnswer}
            answerHint={answerHint}
            handleAnswerChange={handleAnswerChange}
            checkAnswer={checkAnswer}
            giveHint={giveHint}
            feedback={feedback}
            isSummaryQuiz={sessionKind === 'summaryQuiz'}
            hasMistake={hasMistake}
          />
        );
      case 'cloze':
        return (
          <ClozeFront
            clozeExampleMain={clozeExampleMain}
            clozeTranslation={clozeTranslation}
            clozeCollocation={clozeCollocation}
            currentReviewWord={currentReviewWord}
            userAnswer={userAnswer}
            answerHint={answerHint}
            handleAnswerChange={handleAnswerChange}
            checkAnswer={checkAnswer}
            giveHint={giveHint}
            feedback={feedback}
          />
        );
      case 'dictation':
        return (
          <DictationFront
            currentReviewWord={currentReviewWord}
            userAnswer={userAnswer}
            answerHint={answerHint}
            handleAnswerChange={handleAnswerChange}
            checkAnswer={checkAnswer}
            giveHint={giveHint}
            feedback={feedback}
            preferredReviewAudio={preferredReviewAudio}
            audioSpeed={audioSpeed}
            speak={speak}
            playAudioShortcut={playAudioShortcut}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setActiveTab('review')} className="text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          {sessionKind === 'summaryQuiz' && <div className="text-xs font-bold text-blue-600">{t('review.summaryQuiz.sessionTitle')}</div>}
          <div className="text-sm font-medium text-gray-500">{currentCardIndex + 1} / {reviewQueue.length}</div>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-200 relative overflow-hidden flex flex-col">
        <div className={`flex-1 flex flex-col p-8 overflow-y-auto ${isFlipped ? 'items-center justify-start text-center' : 'items-center justify-center text-center'}`}>
          {!isFlipped ? (
            renderFrontContent()
          ) : (
            <ReviewCardBack
              currentReviewWord={currentReviewWord}
              currentReviewEntries={currentReviewEntries}
              lastResult={lastResult}
              feedback={feedback}
              reviewMode={reviewMode}
              isSummaryQuiz={sessionKind === 'summaryQuiz'}
              preferredReviewAudio={preferredReviewAudio}
              preferredAccent={preferredAccent}
              setPreferredAccent={setPreferredAccent}
              audioSpeed={audioSpeed}
              chineseAudioSpeed={chineseAudioSpeed}
              speak={speak}
              playAudioShortcut={playAudioShortcut}
            />
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <ReviewControls
            reviewMode={reviewMode}
            isFlipped={isFlipped}
            setIsFlipped={setIsFlipped}
            checkAnswer={checkAnswer}
            processRating={processRating}
            advanceToNextCard={advanceToNextCard}
            isAwaitingNext={isAwaitingNext}
            isLastCard={currentCardIndex === reviewQueue.length - 1}
            isSummaryQuiz={sessionKind === 'summaryQuiz'}
          />
        </div>
      </div>
    </div>
  );
};

export default ReviewSession;
