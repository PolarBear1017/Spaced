import { useCallback, useMemo } from 'react';
import useToast from './useToast';
import useNavigation from './features/useNavigation';
import useSettings from './features/useSettings';
import useLibrary from './features/useLibrary';
import useSearch from './features/useSearch';
import useReview from './features/useReview';
import useAudioPreferences from './useAudioPreferences';
import useReviewReminders from './features/useReviewReminders';
import { toSearchResultFromLibrary } from '../domain/mappers/searchResultMapper';

const useVocabularyApp = () => {
  const toast = useToast();
  const navigation = useNavigation();
  const settings = useSettings();
  const reminders = useReviewReminders(settings.state.session, settings.state.sessionReady, settings.state.uiLanguage);
  const preferences = useAudioPreferences();

  const apiKeys = useMemo(() => ({
    groqKey: settings.state.groqApiKey
  }), [settings.state.groqApiKey]);

  const library = useLibrary({
    session: settings.state.session,
    apiKeys,
    definitionLanguage: settings.state.definitionLanguage,
    showToast: toast.showToast,
    onRequireApiKeys: () => navigation.actions.setActiveTab('settings')
  });

  const search = useSearch({
    apiKeys,
    settings,
    definitionLanguage: settings.state.definitionLanguage,
    onSearchStart: () => navigation.actions.setReturnFolderId(null),
    onRequireApiKeys: () => navigation.actions.setActiveTab('settings')
  });

  const review = useReview({
    vocabData: library.state.vocabData,
    updateWord: library.actions.updateWord,
    session: settings.state.session,
    requestRetention: settings.state.requestRetention,
    folders: library.state.folders,
    allFolderIds: library.derived.index.allFolderIds,
    setActiveTab: navigation.actions.setActiveTab,
    activeTab: navigation.state.activeTab,
    preferredAccent: preferences.state.preferredAccent,
    audioPriority: settings.state.audioSourcePriority,
    playAudioShortcut: settings.state.playAudioShortcut
  });

  const openWordDetails = useCallback((word) => {
    const details = toSearchResultFromLibrary(word);
    search.actions.setQuerySilently(word.word);
    search.actions.setSearchResult(details);
    navigation.actions.setActiveTab('search');
    if (library.state.viewingFolderId) {
      navigation.actions.setReturnFolderId(library.state.viewingFolderId);
    }
    library.actions.setViewingFolderId(null);
  }, [library.actions, library.state.viewingFolderId, navigation.actions, search.actions]);

  const handleSaveFromSearch = useCallback(async (folderId, selectedDefinitions, options = {}, overrideWord = null) => {
    const base = overrideWord || search.state.searchResult;
    const wordData = base
      ? {
        ...base,
        audio: base.audioUrl || null,
        us_audio: base.usAudioUrl || null,
        uk_audio: base.ukAudioUrl || null
      }
      : base;
    const saved = await library.actions.saveWordToFolder(wordData, folderId, selectedDefinitions, options);
    if (saved) {
      search.actions.triggerSaveButtonFeedback();
    }
    return saved;
  }, [library.actions, search.actions, search.state.searchResult]);

  return {
    navigation,
    settings: { ...settings, reminders },
    preferences,
    library: {
      ...library,
      actions: {
        ...library.actions,
        openWordDetails
      }
    },
    search: {
      ...search,
      actions: {
        ...search.actions,
        saveFromSearch: handleSaveFromSearch
      }
    },
    review,
    toast
  };
};

export default useVocabularyApp;
