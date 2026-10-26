import React from 'react';
import { ArrowRight, Folder, Copy, CaseSensitive, TextCursorInput, Headphones, Star, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReviewFoldersSelector from './ReviewFoldersSelector';
import ReviewInfo from './ReviewInfo';

const ReviewSetup = ({
  cloudStatus,
  cloudReady,
  anonymous,
  retryCloudSync,
  recoveryInfo,
  setRecoveryMode,
  dailyGoal,
  dailyTarget,
  setDailyGoal,
  todayStats,
  summaryQuizCount = Math.min(5, todayStats.completed),
  sessionSummary,
  dismissSummary,
  setupNotice,
  dailyBatchCount,
  newCount,
  learnedCount,
  reviewSetupView,
  setReviewSetupView,
  dueCount,
  totalWords,
  selectedFolderLabel,
  selectedReviewFolders,
  startReview,
  startDailySummaryQuiz,
  sortedFolders,
  allFoldersSelected,
  toggleReviewFolder,
  allFolderIds,
  setSelectedReviewFolders,
  onlyStarred,
  setOnlyStarred
}) => {
  const { t } = useTranslation();
  const [kind, setKind] = React.useState('daily');
  const goalReached = todayStats.completed >= dailyTarget;

  if (reviewSetupView === 'folders') {
    return (
      <ReviewFoldersSelector
        sortedFolders={sortedFolders}
        allFoldersSelected={allFoldersSelected}
        selectedReviewFolders={selectedReviewFolders}
        allFolderIds={allFolderIds}
        setSelectedReviewFolders={setSelectedReviewFolders}
        toggleReviewFolder={toggleReviewFolder}
        onBack={() => setReviewSetupView('main')}
      />
    );
  }

  const reviewModes = [
    { id: 'flashcard', name: t('review.modes.flashcard.name'), icon: Copy, desc: t('review.modes.flashcard.desc') },
    { id: 'spelling', name: t('review.modes.spelling.name'), icon: CaseSensitive, desc: t('review.modes.spelling.desc') },
    { id: 'cloze', name: t('review.modes.cloze.name'), icon: TextCursorInput, desc: t('review.modes.cloze.desc') },
    { id: 'dictation', name: t('review.modes.dictation.name'), icon: Headphones, desc: t('review.modes.dictation.desc') }
  ];
  const modeColors = {
    flashcard: { card: 'border-blue-200 bg-blue-50/40', button: 'hover:bg-blue-50 focus-visible:outline-blue-500', icon: 'bg-blue-400 text-white group-hover:bg-blue-500' },
    spelling: { card: 'border-violet-200 bg-violet-50/40', button: 'hover:bg-violet-50 focus-visible:outline-violet-500', icon: 'bg-violet-400 text-white group-hover:bg-violet-500' },
    cloze: { card: 'border-amber-200 bg-amber-50/40', button: 'hover:bg-amber-50 focus-visible:outline-amber-500', icon: 'bg-amber-400 text-white group-hover:bg-amber-500' },
    dictation: { card: 'border-emerald-200 bg-emerald-50/40', button: 'hover:bg-emerald-50 focus-visible:outline-emerald-500', icon: 'bg-emerald-400 text-white group-hover:bg-emerald-500' }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">{t('review.title')}</h1>
        <ReviewInfo label={t('review.audioHintTitle')}>
          <p>{t('review.audioHint')}</p>
        </ReviewInfo>
      </div>
      {recoveryInfo.active && (
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-1">
            <h2 className="font-bold text-blue-900">{t(todayStats.checkedIn ? 'review.support.recoveryDone' : 'review.support.welcome')}</h2>
            <ReviewInfo label={t('review.support.welcome')}>
              <p>{t(todayStats.checkedIn ? 'review.support.recoveryDoneDesc' : 'review.support.recoveryDesc', { count: dailyTarget })}</p>
            </ReviewInfo>
          </div>
          <button onClick={() => setRecoveryMode('regular')} disabled={!cloudReady} className="text-blue-800 underline text-sm mt-3 disabled:opacity-50">{t('review.support.regular')}</button>
        </section>
      )}
      {sessionSummary?.kind === 'summaryQuiz' && (
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6" role="status">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="font-bold text-blue-900 text-lg">{t('review.summaryQuiz.completed')}</h2>
              <p className="text-blue-800 mt-1">{t('review.summaryQuiz.score', {
                correct: sessionSummary.correctCount,
                total: sessionSummary.count
              })}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-blue-800">{t('review.summaryQuiz.encouragement')}</p>
          {sessionSummary.incorrectWords?.length > 0 && (
            <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-blue-900">
              {t('review.summaryQuiz.reviewAgain', { words: sessionSummary.incorrectWords.join('、') })}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            {sessionSummary.incorrectWords?.length > 0 && (
              <button onClick={() => startDailySummaryQuiz('mistakes')} disabled={!cloudReady} className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{t('review.summaryQuiz.practiceMistakes')}</button>
            )}
            <button onClick={() => startDailySummaryQuiz()} disabled={!cloudReady || !summaryQuizCount} className="border border-blue-300 rounded-lg px-4 py-2 text-blue-800 disabled:opacity-50">{t('review.summaryQuiz.retry', { count: summaryQuizCount })}</button>
            <button onClick={dismissSummary} className="border border-blue-300 rounded-lg px-4 py-2 text-blue-800">{t('review.summaryQuiz.done')}</button>
          </div>
        </section>
      )}
      {sessionSummary && sessionSummary.kind !== 'summaryQuiz' && (
        <section className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6" role="status">
          <h2 className="font-bold text-green-800 text-lg">{t('review.daily.sessionDone', { count: sessionSummary.count })}</h2>
          <p className="text-green-700 mt-2">{t('review.daily.sessionAdded', { count: sessionSummary.addedCount })}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            {dailyBatchCount > 0 && <button onClick={() => { setKind('daily'); startReview(selectedReviewFolders, 'flashcard', 'daily'); }} disabled={!cloudReady} className="bg-green-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{t('review.daily.continue')}</button>}
            <button onClick={dismissSummary} className="border border-green-300 rounded-lg px-4 py-2 text-green-800">{t('review.daily.stop')}</button>
          </div>
        </section>
      )}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="text-lg font-bold text-gray-800">{t('review.daily.title')}</h2>
              <ReviewInfo label={t('review.daily.details')}>
                <p>{t('review.daily.goalDescription', { count: dailyTarget })}</p>
                <p>{t('review.daily.uniqueProgress')}</p>
                <p>{t(recoveryInfo.active ? 'review.daily.recoveryGoalHint' : 'review.daily.goalImmediate')}</p>
                <p>{t('review.daily.detailCounts', { due: dueCount, fresh: newCount, total: totalWords })}</p>
                <p>{t('review.daily.totalDays', { count: todayStats.totalDays })}<br />{t('review.daily.bestStreak', { count: todayStats.bestStreak })}</p>
                <p>{t(`review.daily.cloud.${cloudStatus}`)}</p>
                {anonymous && <p>{t('review.daily.anonymous')}</p>}
                <p>{t('review.support.remaining', { count: recoveryInfo.protectionRemaining })}</p>
                <p>{t('review.support.protectionRules')}</p>
                {recoveryInfo.protectedYesterday && <p>{t('review.support.protectedYesterday')}</p>}
                {!recoveryInfo.active && <button onClick={() => setRecoveryMode('recovery')} disabled={!cloudReady || todayStats.checkedIn} className="text-blue-700 underline disabled:opacity-50">{t('review.support.gentle')}</button>}
              </ReviewInfo>
            </div>
          </div>
          <label className="shrink-0 text-sm text-gray-600">
            {t('review.daily.goal')}
            <select disabled={!cloudReady} value={dailyGoal} onChange={e => setDailyGoal(Number(e.target.value))} className="block border border-gray-200 rounded-lg p-2 mt-1 bg-white">
              {[5, 10, 20].map(count => <option key={count} value={count}>{t('review.daily.words', { count })}</option>)}
            </select>
          </label>
        </div>
        <div className="text-3xl font-bold text-blue-600 mt-5">{todayStats.completed} / {dailyTarget}</div>
        {todayStats.checkedIn && <p className="text-sm text-green-700 mt-2">{t('review.daily.checkedIn')}</p>}
        {todayStats.checkedIn && !goalReached && <p role="status" className="text-sm text-gray-600 mt-1">{t('review.daily.checkInRetained')}</p>}
        <progress className="w-full h-3 mt-3 accent-blue-600" value={Math.min(todayStats.completed, dailyTarget)} max={Math.max(1, dailyTarget)} aria-label={t('review.daily.progress')} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{t('review.daily.streak', { count: todayStats.streak })}</span>
        </div>
        {cloudReady && !goalReached && dailyBatchCount > 0 && <button onClick={() => { setKind('daily'); startReview(selectedReviewFolders, 'flashcard', 'daily'); }} className="w-full mt-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">{t('review.daily.start', { count: dailyBatchCount })}</button>}
        {cloudReady && !goalReached && dailyBatchCount === 0 && totalWords > 0 && (
          <div role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            <p>{t('review.daily.queueEmpty')}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              {learnedCount > 0 && <button onClick={() => { setKind('practice'); startReview(selectedReviewFolders, 'flashcard', 'practice'); }} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{t('review.daily.kind.practice')}</button>}
              {newCount > 0 && <button onClick={() => { setKind('new'); startReview(selectedReviewFolders, 'flashcard', 'new'); }} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{t('review.daily.kind.new')}</button>}
            </div>
          </div>
        )}
        {(cloudStatus === 'offline' || (cloudStatus === 'syncing' && !cloudReady)) && (
          <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p>{t(`review.daily.cloud.${cloudStatus}`)}</p>
            {cloudStatus === 'offline' && <button onClick={retryCloudSync} className="mt-2 text-sm text-blue-700 underline">{t('review.daily.retrySync')}</button>}
          </div>
        )}
        {todayStats.completed > 0 && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-blue-950">{t('review.summaryQuiz.title')}</h3>
                <p className="mt-1 text-sm text-blue-800">{t('review.summaryQuiz.description', { count: summaryQuizCount })}</p>
                {!todayStats.checkedIn && <p className="mt-2 text-xs text-blue-700">{t('review.summaryQuiz.locked')}</p>}
                <button
                  onClick={() => startDailySummaryQuiz()}
                  disabled={!cloudReady || !todayStats.checkedIn || !summaryQuizCount}
                  className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('review.summaryQuiz.start', { count: summaryQuizCount })}
                </button>
                <p className="mt-2 text-xs text-blue-700">{t('review.summaryQuiz.noImpact')}</p>
              </div>
            </div>
          </div>
        )}
      </section>
      {totalWords === 0 && <p className="bg-blue-50 rounded-xl p-4 mb-4 text-blue-800">{t('review.daily.empty')}</p>}
      {setupNotice && <p role="status" className="bg-blue-50 rounded-xl p-4 mb-4 text-blue-800">{setupNotice}</p>}
      <button
        onClick={() => setReviewSetupView('folders')}
        className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition mb-3"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <Folder className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-bold text-gray-800">{t('review.selectFolder')}</div>
            <div className="text-sm text-gray-500">{selectedFolderLabel}</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-300" />
      </button>

      {/* 只複習星號單字 Toggle */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition mb-3">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${onlyStarred ? 'bg-amber-100 text-amber-500' : 'bg-gray-100 text-gray-400'}`}>
            <Star className={`w-5 h-5 ${onlyStarred ? 'fill-amber-500' : ''}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1 font-bold text-gray-800">{t('review.onlyStarred')}<ReviewInfo label={t('review.onlyStarred')}><p>{t('review.onlyStarredDesc')}</p></ReviewInfo></div>

          </div>
        </div>
        <button
          onClick={() => setOnlyStarred(!onlyStarred)}
          className={`w-12 h-6 shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-250 ease-in-out focus-visible:outline-2 focus-visible:outline-blue-500 ${
            onlyStarred ? 'bg-amber-500' : 'bg-gray-300'
          }`}
          aria-label={t('review.onlyStarred')}
          role="switch"
          aria-checked={onlyStarred}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-250 ease-in-out ${
              onlyStarred ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <fieldset className="mt-6 mb-5">
        <legend className="mb-3">
          <span className="flex items-center gap-1 font-bold text-gray-700">
            {t('review.daily.chooseTask')}
            <ReviewInfo label={t(`review.daily.kind.${kind}`)}>
              <p>{t(`review.daily.kindDesc.${kind}`)}</p>
              <p>{t(kind === 'practice' ? 'review.daily.practiceNote' : kind === 'new' ? 'review.daily.newNote' : recoveryInfo.active ? 'review.support.recoveryNote' : 'review.daily.dailyNote', { count: dailyBatchCount })}</p>
            </ReviewInfo>
          </span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {['daily', 'practice', 'new'].map(option => (
            <button type="button" key={option} aria-pressed={kind === option} onClick={() => setKind(option)} className={`text-center rounded-xl border px-2 py-3 text-sm ${kind === option ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <span className="font-bold block">{t(`review.daily.kind.${option}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <h3 className="font-bold text-gray-700 mb-4">{t('review.selectMode')}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reviewModes.map(mode => (
          <div key={mode.id} className={`flex items-center rounded-xl border pr-2 ${modeColors[mode.id].card}`}>
          <button onClick={() => startReview(selectedReviewFolders, mode.id, kind)} disabled={!cloudReady || (kind === 'daily' ? !dailyBatchCount : kind === 'new' ? !newCount : !learnedCount)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-4 focus-visible:outline-2 transition text-left group disabled:opacity-50 disabled:cursor-not-allowed ${modeColors[mode.id].button}`}>
            <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition ${modeColors[mode.id].icon}`}><mode.icon className="w-6 h-6" aria-hidden="true" /></div>
            <div>
              <div className="font-bold text-gray-800">{mode.name}</div>
            </div>
          </button>
          <ReviewInfo label={mode.name}><p>{mode.desc}</p></ReviewInfo>
          </div>
        ))}
      </div>
    </>
  );
};

export default ReviewSetup;
