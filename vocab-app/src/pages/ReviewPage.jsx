
import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewContext } from '../contexts/ReviewContext';
import { LibraryContext } from '../contexts/LibraryContext';
import { NavigationContext } from '../contexts/NavigationContext';
import { PreferencesContext } from '../contexts/PreferencesContext';
import ReviewSetup from '../components/review/ReviewSetup';
import ReviewSession from '../components/review/ReviewSession';
import { planReview, filterReviewWords } from '../utils/reviewPlanner';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ReviewPage Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const t = this.props.t || ((key, fallback) => fallback || key);
            return (
                <div className="p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">{t('review.errorTitle', '發生錯誤')}</h2>
                    <p className="text-gray-600 mb-4">{t('review.errorDesc', '無法載入複習模式')}</p>
                    <pre className="text-left bg-gray-100 p-4 rounded overflow-auto text-xs mb-4">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {t('common.refresh', '重新整理')}
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ReviewPage = () => {
    const { t } = useTranslation();
    const { state: reviewState, derived: reviewDerived, actions: reviewActions } = useContext(ReviewContext);
    const { state: libraryState, derived: libraryDerived } = useContext(LibraryContext);
    const { state: navState, actions: navActions } = useContext(NavigationContext);
    const preferences = useContext(PreferencesContext);

    const activeTab = navState.activeTab;

    const filteredWords = useMemo(() => filterReviewWords(libraryState.vocabData || [], {
        folderIds: reviewState.selectedReviewFolders,
        allFolderIds: libraryDerived?.index?.allFolderIds || [],
        onlyStarred: reviewState.onlyStarred
    }), [libraryState.vocabData, reviewState, libraryDerived]);

    const plan = useMemo(() => planReview({
        words: filteredWords, now: reviewState.reviewClock,
        completedIds: reviewState.todayIds, goal: reviewState.dailyGoal,
        newIntroduced: reviewState.newIntroduced,
        size: reviewState.todayStats.checkedIn ? 5 : Math.min(5, Math.max(0, reviewState.dailyTarget - reviewState.todayStats.completed))
    }), [filteredWords, reviewState]);
    const dueCount = plan.dueCount;

    const totalWords = filteredWords.length;

    const foldersWithStats = useMemo(() => {
        if (!libraryState.folders || !libraryDerived?.index?.statsByFolderId) {
            return libraryState.folders || [];
        }
        return libraryState.folders.map(folder => {
            const stats = libraryDerived.index.statsByFolderId[folder.id];
            return {
                ...folder,
                wordCount: stats?.count || 0,
                dueCount: stats?.dueCount || 0
            };
        });
    }, [libraryState.folders, libraryDerived]);

    if (activeTab === 'review_session') {
        return (
            <ErrorBoundary t={t}>
                <ReviewSession
                    {...reviewState}
                    {...reviewDerived}
                    {...reviewActions}
                    setActiveTab={navActions.setActiveTab}
                    preferredAccent={preferences?.state?.preferredAccent || 'us'}
                    setPreferredAccent={preferences?.actions?.setPreferredAccent}
                />
            </ErrorBoundary>
        );
    }

    return (

        <ReviewSetup
            {...reviewState}
            {...reviewDerived}
            {...reviewActions}
            dueCount={dueCount}
            dailyBatchCount={plan.batch.length}
            newCount={plan.newCount}
            learnedCount={plan.learnedCount}
            totalWords={totalWords}
            sortedFolders={foldersWithStats}
            allFolderIds={libraryDerived?.index?.allFolderIds || []}
        />
    );
};

export default ReviewPage;
