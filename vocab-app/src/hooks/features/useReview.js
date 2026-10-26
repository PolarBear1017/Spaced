import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FSRS, Rating, generatorParameters } from 'ts-fsrs';
import {
  buildFsrsCard,
  serializeFsrsCard,
  calculateReviewResult,
  normalizeEntries,
  parseExampleItem
} from '../../utils/data';
import { getClozeValidAnswers } from '../../utils/text.jsx';
import { updateUserLibraryProgress } from '../../services/libraryService';
import { speak, getAudioUrl } from '../../services/speechService';
import i18n from '../../i18n/config';
import useDailyReviewProgress from './useDailyReviewProgress';
import { DAILY_SUMMARY_QUIZ_SIZE, dailySummaryWords } from '../../utils/reviewPlanner';
import { buildDailySummaryQuiz, localDayKey, reviewCalendarDate, recordReview, changeDailyGoal, dailyReviewStats, planReview, wordReviewId, isNewWord, filterReviewWords, reviewDailyTarget, recoveryProgress } from '../../utils/reviewPlanner';

const useReview = ({
  vocabData,
  updateWord,
  session,
  requestRetention,
  folders,
  allFolderIds,
  setActiveTab,
  activeTab,
  audioPriority,
  playAudioShortcut = 'Tab'
}) => {
  const availableCount = new Set(vocabData.map(wordReviewId)).size;
  const { progress, controller, progressKey, status: cloudStatus, cloudReady, anonymous } = useDailyReviewProgress(session);
  const [clock, setClock] = useState(() => new Date());
  const [sessionKind, setSessionKind] = useState('daily');
  const [sessionSummary, setSessionSummary] = useState(null);
  const [setupNotice, setSetupNotice] = useState('');
  const ratedCardsRef = useRef(new Set());
  const quizResultsRef = useRef([]);
  const quizSeenRef = useRef({ day: null, ids: new Set() });
  const roundProgressRef = useRef({ day: null, addedIds: new Set() });
  const advancedCardsRef = useRef(new Set());
  const sessionOwnerRef = useRef(progressKey);
  useEffect(() => {
    const refresh = () => setClock(new Date());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const saveProgress = useCallback((transform, goalChanged = false) => {
    controller.update(transform, goalChanged);
    setClock(new Date());
  }, [controller]);
  const setDailyGoal = useCallback(goal => {
    const value = controller.getSnapshot().progress;
    const today = reviewCalendarDate(new Date(), value.timezone);
    const day = localDayKey(today);
    const recovery = value.days[day]?.recovery;
    controller.update(current => {
      const regular = recovery ? { ...current, days: { ...current.days, [day]: { ...current.days[day], recovery: false } } } : current;
      return changeDailyGoal(regular, goal, today, availableCount);
    }, true, recovery ? { mode: 'regular', day } : null);
    setClock(new Date());
  }, [controller, availableCount]);
  const calendarDate = reviewCalendarDate(clock, progress.timezone);
  const todayStats = dailyReviewStats(progress, calendarDate);
  const recoveryInfo = recoveryProgress(progress, calendarDate);
  const setRecoveryMode = useCallback(mode => {
    const dayKey = localDayKey(reviewCalendarDate(new Date(), progress.timezone));
    controller.update(value => {
      const key = dayKey;
      const day = value.days[key] || {words: [], introduced: [], checkedIn: false};
      return {...value, days: {...value.days, [key]: {...day, recovery: mode === 'recovery', target: Math.max(1, Math.min(mode === 'recovery' ? 5 : value.goal, availableCount))}}};
    }, false, {mode, day: dayKey});
  }, [controller, availableCount, progress.timezone]);
  const todayIds = progress.days[localDayKey(calendarDate)]?.words || [];
  const [reviewQueue, setReviewQueue] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState('flashcard');
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [isAwaitingNext, setIsAwaitingNext] = useState(false);
  const [pendingAutoGrade, setPendingAutoGrade] = useState(null);
  const [answerHint, setAnswerHint] = useState('');
  const [hasMistake, setHasMistake] = useState(false);
  useEffect(() => {
    if (sessionOwnerRef.current !== progressKey) {
      sessionOwnerRef.current = progressKey;
      setReviewQueue([]);
      setSessionSummary(null);
      quizResultsRef.current = [];
      quizSeenRef.current = { day: null, ids: new Set() };
      setSetupNotice('');
      if (activeTab === 'review_session') setActiveTab('review');
    }
  }, [progressKey, activeTab, setActiveTab]);
  const [selectedReviewFolders, setSelectedReviewFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('review_selected_folders');
      return saved ? JSON.parse(saved) : ['all'];
    } catch {
      return ['all'];
    }
  });

  const [onlyStarred, setOnlyStarred] = useState(() => {
    try {
      const saved = localStorage.getItem('review_only_starred');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('review_only_starred', String(onlyStarred));
    } catch (e) {
      console.warn('Failed to save review only_starred selection', e);
    }
  }, [onlyStarred]);

  useEffect(() => {
    try {
      localStorage.setItem('review_selected_folders', JSON.stringify(selectedReviewFolders));
    } catch (e) {
      console.warn('Failed to save review folders selection', e);
    }
  }, [selectedReviewFolders]);
  const [reviewSetupView, setReviewSetupView] = useState('main');
  const processRatingRef = useRef(null);
  const advanceToNextCardRef = useRef(null);

  const fsrsParams = useMemo(() => generatorParameters({
    enable_fuzz: true,
    request_retention: requestRetention
  }), [requestRetention]);
  const fsrs = useMemo(() => new FSRS(fsrsParams), [fsrsParams]);

  const currentReviewWord = useMemo(() => reviewQueue[currentCardIndex] || {}, [reviewQueue, currentCardIndex]);
  const currentReviewEntries = useMemo(() => {
    if (reviewQueue.length === 0) return [];
    const selectedDefs = Array.isArray(currentReviewWord.selectedDefinitions)
      ? currentReviewWord.selectedDefinitions
      : (Array.isArray(currentReviewWord.selected_definitions)
        ? currentReviewWord.selected_definitions
        : null);
    if (!selectedDefs) return normalizeEntries(currentReviewWord);
    const normalizedSelected = normalizeEntries({ entries: selectedDefs });
    if (normalizedSelected.length === 0) return [];
    return [normalizedSelected[currentReviewWord.reviewEntryIndex || 0] || normalizedSelected[0]];
  }, [currentReviewWord, reviewQueue.length]);
  const primaryReviewEntry = currentReviewEntries[0] || {};
  const clozeExample = primaryReviewEntry.example || currentReviewWord.example || '';
  const parsedCloze = parseExampleItem(clozeExample);
  const clozeCollocation = parsedCloze.collocation || null;
  const clozeExampleLines = parsedCloze.lines;
  const clozeExampleMain = parsedCloze.text || clozeExampleLines[0] || '';
  const clozeTranslation = (() => {
    if (parsedCloze.translation) return parsedCloze.translation;
    if (clozeExampleLines.length > 1) return clozeExampleLines[1];
    return primaryReviewEntry.translation || currentReviewWord.translation || '';
  })();

  const preferredReviewAudio = currentReviewWord
    ? getAudioUrl(currentReviewWord, audioPriority || ['us', 'uk', 'google', 'general'])
    : null;

  const allFoldersSelected = selectedReviewFolders.includes('all')
    || (allFolderIds.length > 0 && allFolderIds.every(id => selectedReviewFolders.includes(id)));

  const selectedFolderLabel = allFoldersSelected
    ? i18n.t('library.allFolders', '全部資料夾')
    : folders
      .filter(folder => selectedReviewFolders.includes(folder.id))
      .map(folder => folder.name)
      .join(', ') || i18n.t('review.noneSelected', '尚未選擇');

  const toggleReviewFolder = useCallback((folderId) => {
    setSelectedReviewFolders(prev => {
      const base = prev.includes('all') ? allFolderIds : prev;
      if (base.includes(folderId)) {
        const next = base.filter(id => id !== folderId);
        return next.length > 0 ? next : [];
      }
      return [...base, folderId];
    });
  }, [allFolderIds, setSelectedReviewFolders]);

  const startReview = useCallback((folderSelection, mode, kind = 'daily') => {
    if (!cloudReady) return;
    const selectedIds = Array.isArray(folderSelection) ? folderSelection : [folderSelection];
    const filteredWords = filterReviewWords(vocabData, { folderIds: selectedIds, allFolderIds, onlyStarred });
    if (filteredWords.length === 0) {
      setSetupNotice(i18n.t('review.daily.noEligible'));
      return;
    }

    const now = new Date();
    const latest = controller.getSnapshot().progress;
    const today = reviewCalendarDate(now, latest.timezone);
    const stats = dailyReviewStats(latest, today);
    const remaining = Math.max(0, reviewDailyTarget(latest, today, availableCount) - stats.completed);
    const size = kind === 'daily' && remaining > 0 ? Math.min(5, remaining) : 5;
    const { batch: reviewBatch } = planReview({ words: filteredWords, kind, size, now,
      completedIds: latest.days[localDayKey(today)]?.words || [], goal: latest.goal,
      newIntroduced: latest.days[localDayKey(today)]?.introduced?.length || 0,
      recovery: !!latest.days[localDayKey(today)]?.recovery });
    if (!reviewBatch.length) {
      setSetupNotice(i18n.t('review.daily.noEligible'));
      return;
    }
    sessionOwnerRef.current = progressKey;
    ratedCardsRef.current = new Set();
    roundProgressRef.current = { day: localDayKey(today), addedIds: new Set() };
    advancedCardsRef.current = new Set();
    setSessionKind(kind);
    setSessionSummary(null);
    setSetupNotice('');
    setReviewQueue(reviewBatch.map(word => ({ ...word, reviewEntryIndex: Math.floor(Math.random() * Math.max(1, (word.selectedDefinitions || word.selected_definitions || []).length)) })));
    setCurrentCardIndex(0);
    setReviewMode(mode);
    setIsFlipped(false);
    setUserAnswer('');
    setFeedback(null);
    setIsAwaitingNext(false);
    setPendingAutoGrade(null);
    setAnswerHint('');
    setHasMistake(false);
    setActiveTab('review_session');
  }, [allFolderIds, onlyStarred, progressKey, cloudReady, controller, setActiveTab, vocabData, availableCount, setReviewMode, setIsFlipped, setAnswerHint]);

  const startDailySummaryQuiz = useCallback((mode = 'random') => {
    if (!cloudReady) return;
    const latest = controller.getSnapshot().progress;
    const today = reviewCalendarDate(new Date(), latest.timezone);
    const day = localDayKey(today);
    const completedIds = latest.days[day]?.words || [];
    if (quizSeenRef.current.day !== day) quizSeenRef.current = { day, ids: new Set() };
    const mistakesOnly = mode === 'mistakes';
    const incorrectIds = sessionSummary?.day === day ? sessionSummary.incorrectIds || [] : [];
    const quizWords = buildDailySummaryQuiz(vocabData,
      mistakesOnly ? completedIds.filter(id => incorrectIds.includes(String(id))) : completedIds, {
        introducedIds: latest.days[day]?.introduced || [],
        seenIds: [...quizSeenRef.current.ids]
      });
    if (!latest.days[day]?.checkedIn || quizWords.length === 0) {
      setSetupNotice(i18n.t('review.summaryQuiz.unavailable'));
      return;
    }

    sessionOwnerRef.current = progressKey;
    ratedCardsRef.current = new Set();
    quizResultsRef.current = [];
    advancedCardsRef.current = new Set();
    roundProgressRef.current = { day, addedIds: new Set() };
    setSessionKind('summaryQuiz');
    setSessionSummary(null);
    setSetupNotice('');
    setReviewQueue(quizWords.map(word => ({
      ...word,
      reviewEntryIndex: Math.floor(Math.random() * Math.max(1, (word.selectedDefinitions || word.selected_definitions || []).length))
    })));
    setCurrentCardIndex(0);
    setReviewMode('spelling');
    setIsFlipped(false);
    setUserAnswer('');
    setFeedback(null);
    setIsAwaitingNext(false);
    setPendingAutoGrade(null);
    setAnswerHint('');
    setHasMistake(false);
    setActiveTab('review_session');
  }, [cloudReady, controller, progressKey, setActiveTab, vocabData, sessionSummary]);

  const advanceToNextCard = useCallback(() => {
    // Every quiz question needs one submitted answer before it can be advanced.
    if (sessionKind === 'summaryQuiz' && !ratedCardsRef.current.has(currentCardIndex)) return;
    if (advancedCardsRef.current.has(currentCardIndex)) return;
    advancedCardsRef.current.add(currentCardIndex);
    if (pendingAutoGrade !== null) {
      processRatingRef.current?.(pendingAutoGrade, { advance: false });
      setPendingAutoGrade(null);
    }

    if (currentCardIndex < reviewQueue.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
      setUserAnswer('');
      setFeedback(null);
      setIsAwaitingNext(false);
      setAnswerHint('');
      setHasMistake(false);
    } else {
      const round = roundProgressRef.current;
      if (sessionKind === 'summaryQuiz') {
        const results = quizResultsRef.current;
        setSessionSummary({
          count: results.length,
          correctCount: results.filter(result => result.correct).length,
          incorrectWords: results.filter(result => !result.correct).map(result => result.word),
          incorrectIds: results.filter(result => !result.correct).map(result => result.id),
          day: round.day,
          kind: sessionKind
        });
      } else {
        setSessionSummary({ count: ratedCardsRef.current.size, addedCount: round.addedIds.size, day: round.day, kind: sessionKind });
      }
      setActiveTab('review');
    }
  }, [currentCardIndex, pendingAutoGrade, reviewQueue.length, sessionKind, setActiveTab, setIsFlipped, setAnswerHint]);

  useEffect(() => {
    advanceToNextCardRef.current = advanceToNextCard;
  }, [advanceToNextCard]);

  const handleAdvanceKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.repeat) {
      event.preventDefault();
      advanceToNextCard();
    }
  }, [advanceToNextCard]);

  useEffect(() => {
    if (!(activeTab === 'review_session' && reviewMode !== 'flashcard' && isFlipped && isAwaitingNext)) {
      return;
    }

    window.addEventListener('keydown', handleAdvanceKeyDown);
    return () => window.removeEventListener('keydown', handleAdvanceKeyDown);
  }, [activeTab, handleAdvanceKeyDown, isAwaitingNext, isFlipped, reviewMode]);

  useEffect(() => {
    if (activeTab !== 'review_session' || !isFlipped) return;
    if (!currentReviewWord?.word) return;
    speak(currentReviewWord.word, preferredReviewAudio);
  }, [activeTab, currentReviewWord?.word, isFlipped, preferredReviewAudio]);

  useEffect(() => {
    if (activeTab !== 'review_session' || isFlipped) return;
    if (reviewMode !== 'dictation') return;
    if (!currentReviewWord?.word) return;
    speak(currentReviewWord.word, preferredReviewAudio);
  }, [activeTab, currentReviewWord?.word, isFlipped, preferredReviewAudio, reviewMode]);

  const processRating = useCallback((grade, options = {}) => {
    const currentWord = reviewQueue[currentCardIndex];
    if (!currentWord) {
      setActiveTab('review');
      return;
    }

    if (sessionOwnerRef.current !== progressKey || ratedCardsRef.current.has(currentCardIndex)) return;
    if (sessionKind === 'summaryQuiz') {
      ratedCardsRef.current.add(currentCardIndex);
      quizSeenRef.current.ids.add(wordReviewId(currentWord));
      quizResultsRef.current.push({
        id: wordReviewId(currentWord),
        word: currentWord.word,
        correct: grade >= 3
      });
      if (options.advance !== false) advanceToNextCardRef.current?.();
      return;
    }
    const recordCompletion = () => {
      ratedCardsRef.current.add(currentCardIndex);
      saveProgress(value => {
        const today = reviewCalendarDate(new Date(), value.timezone);
        const day = localDayKey(today);
        const id = wordReviewId(currentWord);
        if (roundProgressRef.current.day !== day) roundProgressRef.current = { day, addedIds: new Set() };
        if (!value.days[day]?.words.includes(id)) roundProgressRef.current.addedIds.add(id);
        return recordReview(value, id, today, isNewWord(currentWord) && sessionKind !== 'practice', availableCount);
      });
    };
    if (sessionKind === 'practice') {
      recordCompletion();
      if (options.advance !== false) advanceToNextCardRef.current?.();
      return;
    }
    const prevScore = currentWord.proficiencyScore || 0;
    const now = new Date();
    const rating = grade <= 1 ? Rating.Again : grade === 2 ? Rating.Hard : grade === 3 ? Rating.Good : Rating.Easy;
    const currentCard = buildFsrsCard(currentWord);
    const schedulingCards = fsrs.repeat(currentCard, now);
    const nextCardRecord = schedulingCards[rating];
    const nextCard = nextCardRecord.card;
    const fsrsState = serializeFsrsCard(nextCard);
    const nextReviewIso = fsrsState.due;

    let scoreChange = grade - 3;
    let newScore = prevScore + scoreChange;

    if (prevScore === 0 && grade >= 3) newScore = Math.max(1, newScore);
    newScore = Math.max(0, Math.min(5, newScore));

    updateWord(currentWord.id, { ...fsrsState, nextReview: nextReviewIso, proficiencyScore: newScore });
    recordCompletion();

    if (session && currentWord.libraryId != null) {
      const updatePayload = {
        ...fsrsState,
        next_review: nextReviewIso,
        proficiency_score: newScore
      };

      updateUserLibraryProgress({ libraryId: currentWord.libraryId, payload: updatePayload }).then(({ error }) => {
        if (error && error.code === '42703') {
          setSetupNotice(i18n.t('review.daily.syncError'));
          updateUserLibraryProgress({
            libraryId: currentWord.libraryId,
            payload: {
              next_review: nextReviewIso,
              proficiency_score: newScore
            }
          }).then(({ error: retryError }) => {
            if (retryError) { console.error("更新複習進度失敗:", retryError); setSetupNotice(i18n.t('review.daily.syncError')); }
          });
        } else if (error) {
          console.error("更新複習進度失敗:", error);
          setSetupNotice(i18n.t('review.daily.syncError'));
        }
      });
    }

    const shouldAdvance = options.advance !== false;
    if (shouldAdvance) {
      advanceToNextCardRef.current?.();
    }
  }, [currentCardIndex, fsrs, reviewQueue, session, sessionKind, progressKey, saveProgress, setActiveTab, updateWord, availableCount]);

  useEffect(() => {
    processRatingRef.current = processRating;
  }, [processRating]);

  const checkAnswer = useCallback(() => {
    if (isAwaitingNext || (sessionKind === 'summaryQuiz' && ratedCardsRef.current.has(currentCardIndex))) return;
    const currentWord = reviewQueue[currentCardIndex];
    if (!currentWord) {
      setActiveTab('review');
      return;
    }
    const isStrictMode = reviewMode === 'spelling' || reviewMode === 'cloze' || reviewMode === 'dictation';
    let result = { grade: 3, feedbackType: 'correct', allowRetry: false };

    if (isStrictMode) {
      if (reviewMode === 'cloze') {
        const { validAnswers, contextMatches } = getClozeValidAnswers(clozeExampleMain, currentWord.word);
        result = validAnswers.reduce((bestResult, answer) => {
          const candidate = calculateReviewResult(userAnswer, answer);
          if (candidate.grade > bestResult.grade) return candidate;
          if (candidate.grade === bestResult.grade && candidate.allowRetry === false) return candidate;
          return bestResult;
        }, { grade: 1, feedbackType: 'incorrect', allowRetry: true });

        const normalizedAnswer = userAnswer.toLowerCase().trim();
        const targetLower = (currentWord.word || '').toLowerCase().trim();
        const contextLower = contextMatches.map((contextWord) => contextWord.toLowerCase());
        const hasContextMatch = contextLower.includes(normalizedAnswer);
        const hasDifferentContext = contextLower.some((contextWord) => contextWord && contextWord !== targetLower);
        const contextWord = contextMatches.find((contextWord) => contextWord && contextWord.toLowerCase() !== targetLower)
          || contextMatches[0]
          || '';

        if (result.grade >= 3) {
          if (normalizedAnswer === targetLower && hasDifferentContext && !hasContextMatch) {
            result = { ...result, feedbackType: 'root_match', correctContextWord: contextWord };
          } else if (hasContextMatch || normalizedAnswer === targetLower) {
            result = { ...result, feedbackType: 'exact', correctContextWord: contextWord };
          }
        }
      } else {
        result = calculateReviewResult(userAnswer, currentWord.word);
      }
    }

    const needsQuizCorrection = sessionKind === 'summaryQuiz' && result.grade < 3;
    if (needsQuizCorrection || (reviewMode !== 'flashcard' && result.allowRetry)) {
      setFeedback('incorrect');
      setLastResult(result);
      setIsFlipped(false);
      setPendingAutoGrade(null);
      setIsAwaitingNext(false);
      setUserAnswer('');
      setAnswerHint(currentWord.word);
      setHasMistake(true);
      return result;
    }

    const finalIncorrect = isStrictMode && hasMistake;
    const normalizedResult = finalIncorrect ? { ...result, feedbackType: 'incorrect', allowRetry: false } : result;
    const uiFeedback = ['exact', 'root_match'].includes(normalizedResult.feedbackType)
      ? 'correct'
      : normalizedResult.feedbackType;
    setFeedback(uiFeedback);
    setLastResult(normalizedResult);
    setIsFlipped(true);
    setAnswerHint('');

    if (reviewMode !== 'flashcard') {
      if (isAwaitingNext) return;
      const autoGrade = finalIncorrect ? 1 : result.grade;
      processRating(autoGrade, { advance: false });
      setPendingAutoGrade(null);
      setIsAwaitingNext(true);
    }
    return normalizedResult;
  }, [
    clozeExampleMain,
    currentCardIndex,
    hasMistake,
    processRating,
    isAwaitingNext,
    reviewMode,
    reviewQueue,
    sessionKind,
    setActiveTab,
    userAnswer,
    setIsFlipped,
    setAnswerHint
  ]);

  const handleReviewKeyDown = useCallback((event) => {
    if (event.repeat) return;
    const key = event.key;
    const targetShortcut = playAudioShortcut || 'Tab';
    const isAudioShortcut = key.toLowerCase() === targetShortcut.toLowerCase();

    if (isAudioShortcut) {
      if (currentReviewWord?.word) {
        event.preventDefault();
        speak(currentReviewWord.word, preferredReviewAudio);
        return;
      }
    }

    if (['1', '2', '3', '4'].includes(key) && isFlipped && reviewMode === 'flashcard') {
      event.preventDefault();
      processRating(Number(key));
      return;
    }

    if (key === 'Enter' && !isAwaitingNext) {
      if (!isFlipped) {
        event.preventDefault();
        if (reviewMode === 'flashcard') {
          setIsFlipped(true);
        } else {
          checkAnswer();
        }
        return;
      }

      if (reviewMode === 'flashcard') {
        event.preventDefault();
      }
    }
  }, [checkAnswer, currentReviewWord, isAwaitingNext, isFlipped, preferredReviewAudio, processRating, reviewMode, playAudioShortcut, setIsFlipped]);

  useEffect(() => {
    if (activeTab !== 'review_session' || reviewQueue.length === 0) return;

    window.addEventListener('keydown', handleReviewKeyDown);
    return () => window.removeEventListener('keydown', handleReviewKeyDown);
  }, [activeTab, handleReviewKeyDown, reviewQueue.length]);

  const handleAnswerChange = useCallback((value) => {
    setUserAnswer(value);
    if (feedback === 'incorrect') {
      setFeedback(null);
      setIsAwaitingNext(false);
    }
    if (answerHint) setAnswerHint('');
  }, [answerHint, feedback, setAnswerHint]);

  return {
    state: {
      cloudStatus,
      cloudReady,
      anonymous,
      dailyGoal: progress.goal,
      dailyTarget: availableCount ? reviewDailyTarget(progress, calendarDate, availableCount) : progress.goal,
      todayStats,
      summaryQuizCount: Math.min(DAILY_SUMMARY_QUIZ_SIZE, dailySummaryWords(vocabData, todayIds).length),
      recoveryInfo,
      sessionSummary: sessionSummary?.kind === 'summaryQuiz' && sessionSummary.day !== localDayKey(calendarDate)
        ? null
        : sessionSummary && { ...sessionSummary, addedCount: sessionSummary.day === localDayKey(calendarDate) ? sessionSummary.addedCount : 0 },
      setupNotice,
      reviewClock: clock,
      todayIds,
      newIntroduced: progress.days[localDayKey(calendarDate)]?.introduced?.length || 0,
      reviewQueue,
      currentCardIndex,
      reviewMode,
      sessionKind,
      isFlipped,
      userAnswer,
      feedback,
      isAwaitingNext,
      pendingAutoGrade,
      answerHint,
      hasMistake,
      lastResult,
      selectedReviewFolders,
      reviewSetupView,
      onlyStarred
    },
    derived: {
      currentReviewWord,
      currentReviewEntries,
      primaryReviewEntry,
      clozeExampleMain,
      clozeTranslation,
      clozeCollocation,
      preferredReviewAudio,
      allFoldersSelected,
      selectedFolderLabel
    },
    actions: {
      retryCloudSync: controller.flush,
      setDailyGoal,
      setRecoveryMode,
      dismissSummary: () => setSessionSummary(null),
      setReviewSetupView,
      setSelectedReviewFolders,
      setOnlyStarred,
      setReviewMode,
      setIsFlipped,
      startReview,
      startDailySummaryQuiz,
      advanceToNextCard,
      processRating,
      checkAnswer,
      handleAnswerChange,
      toggleReviewFolder,
      giveHint: () => {
        if (currentReviewWord?.word) {
          setAnswerHint(`${currentReviewWord.word[0]}...`);
        }
      }
    }
  };
};

export default useReview;
