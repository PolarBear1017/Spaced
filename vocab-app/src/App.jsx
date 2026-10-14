import React, { useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import useVocabularyApp from './hooks/useVocabularyApp';
import Navigation from './components/layout/Navigation';
import SearchTab from './components/search/SearchTab';
// const SearchTab = () => <div>Dummy Search Tab</div>;
import LibraryTab from './components/library/LibraryTab';
import SettingsTab from './components/settings/SettingsTab';
import ReviewPage from './pages/ReviewPage';
import Toast from './components/common/Toast';
import AppProviders from './providers/AppProviders';
import DataLoading from './components/common/DataLoading';


export default function VocabularyApp() {
  const app = useVocabularyApp();

  const tabMap = useMemo(() => ({
    search: SearchTab,
    library: LibraryTab,
    review: ReviewPage,
    review_session: ReviewPage,
    settings: SettingsTab
  }), []);

  const ActivePage = tabMap[app.navigation.state.activeTab] || SearchTab;
  const tab = app.navigation.state.activeTab;
  const needsLibrary = ['library', 'review', 'review_session'].includes(tab);
  const needsReview = ['review', 'review_session'].includes(tab);
  const waitingForLibrary = !app.library.state.isDataLoaded;
  const waitingForReview = needsReview && !app.review.state.cloudReady;
  const waiting = needsLibrary && (!app.settings.state.sessionReady || waitingForLibrary || waitingForReview);
  const failed = app.settings.state.sessionReady && (
    (waitingForLibrary && app.library.state.loadError) ||
    (waitingForReview && app.review.state.cloudStatus === 'offline')
  );
  const retry = () => {
    if (waitingForLibrary) app.library.actions.handleManualSync();
    if (waitingForReview) void app.review.actions.retryCloudSync();
  };

  return (
    <AppProviders app={app}>
      <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-gray-50 text-gray-800 font-sans pb-16 md:pb-0">
        <Navigation />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {waiting ? <DataLoading failed={failed} onRetry={retry} /> : <ActivePage />}
          <Toast toast={app.toast.toast} />
          <Toaster position="bottom-right" />
        </main>
      </div>
    </AppProviders>
  );
}
