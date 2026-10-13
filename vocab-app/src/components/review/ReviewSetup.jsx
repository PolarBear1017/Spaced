import React from 'react';
import { ArrowRight, Folder, Book, RefreshCw, Settings, Mic, Star } from 'lucide-react';
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
    { id: 'flashcard', name: t('review.modes.flashcard.name'), icon: Book, desc: t('review.modes.flashcard.desc') },
    { id: 'spelling', name: t('review.modes.spelling.name'), icon: RefreshCw, desc: t('review.modes.spelling.desc') },
    { id: 'cloze', name: t('review.modes.cloze.name'), icon: Settings, desc: t('review.modes.cloze.desc') },
    { id: 'dictation', name: t('review.modes.dictation.name'), icon: Mic, desc: t('review.modes.dictation.desc') }
  ];

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
      {sessionSummary && (
        <section className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6" role="status">
          <h2 className="font-bold text-green-800 text-lg">{t('review.daily.sessionDone', { count: sessionSummary.count })}</h2>
          <p className="text-green-700 mt-2">{t(todayStats.checkedIn ? 'review.daily.checkedInDesc' : 'review.daily.keepGoing')}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={() => { setKind('daily'); startReview(selectedReviewFolders, 'flashcard', 'daily'); }} disabled={!cloudReady || !dailyBatchCount} className="bg-green-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{t('review.daily.continue')}</button>
            <button onClick={dismissSummary} className="border border-green-300 rounded-lg px-4 py-2 text-green-800">{t('review.daily.stop')}</button>
          </div>
        </section>
      )}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="text-lg font-bold text-gray-800">{t(todayStats.checkedIn ? 'review.daily.checkedIn' : 'review.daily.title')}</h2>
              <ReviewInfo label={t('review.daily.details')}>
                <p>{t('review.daily.goalDescription', { count: dailyTarget })}</p>
                <p>{t('review.daily.detailCounts', { due: dueCount, fresh: newCount, total: totalWords })}</p>
                <p>{t('review.daily.totalDays', { count: todayStats.totalDays })}<br />{t('review.daily.bestStreak', { count: todayStats.bestStreak })}</p>
                <p>{t(`review.daily.cloud.${cloudStatus}`)}</p>
                {anonymous && <p>{t('review.daily.anonymous')}</p>}
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
        <progress className="w-full h-3 mt-3 accent-blue-600" value={Math.min(todayStats.completed, dailyTarget)} max={Math.max(1, dailyTarget)} aria-label={t('review.daily.progress')} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{t('review.daily.streak', { count: todayStats.streak })}</span>
          <div className="flex items-center gap-1">
            <span>{t('review.support.protectionTitle')}</span>
            <ReviewInfo label={t('review.support.protectionTitle')}>
              <p>{t('review.support.remaining', { count: recoveryInfo.protectionRemaining })}</p>
              <p>{t('review.support.protectionRules')}</p>
              {recoveryInfo.protectedYesterday && <p className="text-green-700">{t('review.support.protectedYesterday')}</p>}
              {!recoveryInfo.active && <button onClick={() => setRecoveryMode('recovery')} disabled={!cloudReady || todayStats.checkedIn} className="text-blue-700 underline disabled:opacity-50">{t('review.support.gentle')}</button>}
            </ReviewInfo>
          </div>
        </div>
        {cloudReady && !todayStats.checkedIn && dailyBatchCount > 0 && <button onClick={() => { setKind('daily'); startReview(selectedReviewFolders, 'flashcard', 'daily'); }} className="w-full mt-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">{t('review.daily.start', { count: dailyBatchCount })}</button>}
        {(cloudStatus === 'offline' || cloudStatus === 'syncing') && (
          <div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p>{t(`review.daily.cloud.${cloudStatus}`)}</p>
            {cloudStatus === 'offline' && <button onClick={retryCloudSync} className="mt-2 text-sm text-blue-700 underline">{t('review.daily.retrySync')}</button>}
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
          <div key={mode.id} className="flex items-center rounded-xl border border-gray-200 bg-white pr-2">
          <button onClick={() => startReview(selectedReviewFolders, mode.id, kind)} disabled={!cloudReady || (kind === 'daily' ? !dailyBatchCount : kind === 'new' ? !newCount : !learnedCount)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-4 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500 transition text-left group disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="w-9 h-9 shrink-0 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition"><mode.icon className="w-5 h-5" /></div>
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
