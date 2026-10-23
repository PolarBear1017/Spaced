import { compareRecentFolders, libraryDataReducer } from '../../utils/folderActivity';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  loadCachedFolders,
  loadCachedVocab,
  saveCachedFolders,
  saveCachedVocab,
  loadLastUsedFolders,
  saveLastUsedFolders,
  loadFolderSortBy,
  saveFolderSortBy,
  loadWordSortBy,
  saveWordSortBy
} from '../../services/storageService';
import { fetchStory } from '../../services/aiService';
import useLibraryIndex from './useLibraryIndex';
import useFolderCRUD from '../useFolderCRUD';
import useWordStorage from '../useWordStorage';
import useSync from '../useSync';
import i18n from '../../i18n/config';

const useLibrary = ({ session, apiKeys, definitionLanguage = 'zh-TW', showToast, onRequireApiKeys }) => {
  const [{ folders, vocabData }, dispatchData] = useReducer(libraryDataReducer, null, () => {
    const cached = loadCachedVocab();
    return {
      folders: loadCachedFolders(),
      vocabData: (Array.isArray(cached) ? cached : []).map(word => word && !word.source && word.isAiGenerated
        ? { ...word, source: 'Groq AI' } : word)
    };
  });
  const setFolders = useCallback(value => dispatchData({ field: 'folders', value }), []);
  const setVocabData = useCallback(value => dispatchData({ field: 'vocabData', value }), []);
  const mutateFolders = useCallback(value => dispatchData({ field: 'folders', value, modifiedAt: Date.now() }), []);
  const mutateVocabData = useCallback(value => dispatchData({ field: 'vocabData', value, modifiedAt: Date.now() }), []);
  const [viewingFolderId, setViewingFolderId] = useState(null);
  const [story, setStory] = useState(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [folderSortBy, setFolderSortBy] = useState(() => loadFolderSortBy());
  const [wordSortBy, setWordSortBy] = useState(() => loadWordSortBy());
  const [lastUsedFolderIds, setLastUsedFolderIds] = useState(() => loadLastUsedFolders());
  const pendingSavesRef = useRef(new Set());
  const syncLockRef = useRef(0); // Tracks active database write operations to prevent background sync race conditions
  const lastMutationTimeRef = useRef(0); // Tracks timestamp of last local data write operation

  const index = useLibraryIndex({ folders, vocabData });

  const sync = useSync({
    session,
    setFolders,
    setVocabData,
    vocabData,
    syncLockRef,
    lastMutationTimeRef
  });

  const { actions: folderActions } = useFolderCRUD({
    session,
    folders,
    setFolders: mutateFolders,
    viewingFolderId,
    setViewingFolderId,
    vocabData,
    setVocabData: mutateVocabData,
    lastMutationTimeRef
  });

  const { actions: wordActions } = useWordStorage({
    session,
    folders,
    vocabData,
    setVocabData: mutateVocabData,
    showToast,
    pendingSavesRef,
    syncLockRef,
    lastMutationTimeRef,
    isDataLoaded: sync.state.isDataLoaded
  });

  const activeFolder = viewingFolderId ? folders.find(folder => folder.id === viewingFolderId) : null;

  const sortedFolders = useMemo(() => {
    const copy = [...folders];
    switch (folderSortBy) {
      case 'recent_desc':
        return copy.sort(compareRecentFolders);
      case 'name_asc':
        return copy.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
      case 'count_desc':
        return copy.sort((a, b) => {
          const aCount = index.statsByFolderId[a.id]?.count || 0;
          const bCount = index.statsByFolderId[b.id]?.count || 0;
          return bCount - aCount;
        });
      case 'created_desc':
      default:
        return copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
  }, [folders, folderSortBy, index.statsByFolderId]);

  const sortedActiveFolderWords = useMemo(() => {
    if (!activeFolder) return [];
    const words = index.entriesByFolderId[activeFolder.id] || [];
    const copy = [...words];
    switch (wordSortBy) {
      case 'alphabetical_asc':
        return copy.sort((a, b) => (a.word || '').localeCompare(b.word || '', 'en'));
      case 'proficiency_asc':
        return copy.sort((a, b) => (a.proficiencyScore || 0) - (b.proficiencyScore || 0));
      case 'next_review_asc':
        return copy.sort((a, b) => new Date(a.nextReview || 0) - new Date(b.nextReview || 0));
      case 'added_desc':
      default:
        return copy.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
    }
  }, [activeFolder, index.entriesByFolderId, wordSortBy]);

  useEffect(() => {
    saveCachedFolders(folders);
    saveCachedVocab(vocabData);
  }, [folders, vocabData]);

  useEffect(() => {
    saveLastUsedFolders(lastUsedFolderIds);
  }, [lastUsedFolderIds]);

  useEffect(() => {
    saveFolderSortBy(folderSortBy);
  }, [folderSortBy]);

  useEffect(() => {
    saveWordSortBy(wordSortBy);
  }, [wordSortBy]);

  const generateFolderStory = useCallback(async (folder) => {
    if (!apiKeys?.groqKey) {
      if (onRequireApiKeys) onRequireApiKeys();
      alert(i18n.t('library.storyRequireGroq', '請先設定 Groq API Key 才能使用故事生成功能！'));
      return;
    }

    const wordsInFolder = (index.entriesByFolderId[folder.id] || []).map(word => word.word);
    if (wordsInFolder.length < 3) {
      alert(i18n.t('library.storyMinWords', '資料夾內至少需要 3 個單字才能生成故事喔！'));
      return;
    }

    const targetWords = wordsInFolder.slice(0, 10);

    setIsGeneratingStory(true);
    setStory(null);

    try {
      const storyText = await fetchStory({
        groqKey: apiKeys.groqKey,
        words: targetWords,
        targetLang: definitionLanguage
      });
      setStory(storyText);
    } catch (error) {
      alert(`${i18n.t('library.storyGenerationFailed', '故事生成失敗')}: ${error.message}`);
    } finally {
      setIsGeneratingStory(false);
    }
  }, [apiKeys, definitionLanguage, index.entriesByFolderId, onRequireApiKeys]);

  const updateLastUsedFolderIds = useCallback((folderIds) => {
    const normalized = (Array.isArray(folderIds) ? folderIds : [])
      .map(id => id?.toString())
      .filter(Boolean);
    const validSet = new Set(folders.map(folder => folder.id?.toString()).filter(Boolean));
    const unique = Array.from(new Set(normalized)).filter(id => validSet.has(id));
    setLastUsedFolderIds(unique);
  }, [folders]);

  return {
    state: {
      folders,
      vocabData,
      isDataLoaded: sync.state.isDataLoaded,
      loadError: sync.state.loadError,
      viewingFolderId,
      story,
      isGeneratingStory,
      folderSortBy,
      wordSortBy,
      lastUsedFolderIds
    },
    derived: {
      activeFolder,
      sortedFolders,
      sortedActiveFolderWords,
      index
    },
    actions: {
      setViewingFolderId,
      setStory,
      setIsGeneratingStory,
      setFolderSortBy,
      setWordSortBy,
      loadData: sync.actions.loadData,
      handleManualSync: sync.actions.handleManualSync,
      createFolder: folderActions.createFolder,
      handleDeleteFolder: folderActions.handleDeleteFolder,
      handleDeleteFolders: folderActions.handleDeleteFolders,
      handleEditFolder: folderActions.handleEditFolder,
      saveWordToFolder: wordActions.saveWordToFolder,
      updateWordFolders: wordActions.updateWordFolders,
      handleRemoveWordFromFolder: wordActions.handleRemoveWordFromFolder,
      handleRemoveWordsFromFolder: wordActions.handleRemoveWordsFromFolder,
      handleMoveWordsToFolder: wordActions.handleMoveWordsToFolder,
      generateFolderStory,
      updateWord: wordActions.updateWord,
      toggleWordStar: wordActions.toggleWordStar,
      updateLastUsedFolderIds
    },
    refs: {
      syncLockRef,
      lastMutationTimeRef
    }
  };
};

export default useLibrary;
