import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  fetchFolders,
  fetchUserLibrary,
  saveWordWithPreferences,
  updateUserLibrarySourceByLibraryId
} from '../services/libraryService';
import { mapLibraryRowToWord } from '../domain/mappers/libraryMapper';
import { entryToWord } from '../utils/mapper';
import i18n from '../i18n/config';

const useSync = ({ session, setFolders, setVocabData, vocabData, syncLockRef, lastMutationTimeRef }) => {
  const userId = session?.user?.id || null;
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [loadState, setLoadState] = useState({ userId: null, loaded: false, error: false });
  const isDataLoaded = loadState.userId === userId && loadState.loaded;
  const loadError = loadState.userId === userId && loadState.error;
  const isSyncing = useRef(false);

  const loadData = useCallback(async (userId) => {
    const fetchStartTime = Date.now();
    try {
      const { data: dbFolders, error: folderError } = await fetchFolders(userId);
      if (folderError) throw folderError;
      if (ownerRef.current !== userId) return false;

      const allFolders = [];
      if (dbFolders) allFolders.push(...dbFolders.map(f => ({ ...f, id: f.id?.toString(), words: [] })));
      
      if (!syncLockRef?.current && (!lastMutationTimeRef?.current || lastMutationTimeRef.current < fetchStartTime)) {
        setFolders(allFolders);
      } else {
        setFolders(prev => {
          const loadedFolderIds = new Set(allFolders.map(f => f.id));
          const prevOnly = prev.filter(f => !loadedFolderIds.has(f.id));
          return [...allFolders, ...prevOnly];
        });
      }

      const { data, error } = await fetchUserLibrary(userId);
      if (error) throw error;
      if (ownerRef.current !== userId) return false;

      if (data) {
        const loadedVocab = data.map(mapLibraryRowToWord);
        setVocabData(prev => {
          const isWritingNow = syncLockRef?.current > 0;
          const hadWriteDuringFetch = lastMutationTimeRef?.current && lastMutationTimeRef.current >= fetchStartTime;
          const hadRecentMutation = lastMutationTimeRef?.current && (Date.now() - lastMutationTimeRef.current < 15000);

          if (isWritingNow || hadWriteDuringFetch || hadRecentMutation) {
            console.log("Database write active or occurred recently, performing smart merge to preserve local changes.");
            const mergedMap = new Map();
            loadedVocab.forEach(w => {
              const key = (w.libraryId?.toString() || w.word || '').toLowerCase();
              mergedMap.set(key, w);
            });

            prev.forEach(prevWord => {
              const key = (prevWord.libraryId?.toString() || prevWord.word || '').toLowerCase();
              const isLocalOrTemp = prevWord.id?.toString().startsWith('temp-') || prevWord.isLocal;
              const isRecentlyModified = prevWord._lastModified && (Date.now() - prevWord._lastModified < 60000);

              if (isLocalOrTemp || isRecentlyModified || !mergedMap.has(key)) {
                mergedMap.set(key, prevWord);
              } else {
                const loadedWord = mergedMap.get(key);
                if (prevWord._lastModified && Array.isArray(prevWord.folderIds) && prevWord.folderIds.length > 0 && (!loadedWord.folderIds || loadedWord.folderIds.length === 0)) {
                  mergedMap.set(key, { ...loadedWord, folderIds: prevWord.folderIds });
                }
              }
            });

            return Array.from(mergedMap.values());
          }

          const pendingWords = prev.filter(word => 
            word.id?.toString().startsWith('temp-') || word.isLocal
          );
          
          const merged = [...loadedVocab];
          pendingWords.forEach(pending => {
            const exists = merged.some(w => w.word.toLowerCase() === pending.word.toLowerCase());
            if (!exists) {
              merged.push(pending);
            }
          });
          return merged;
        });
      }
      setLoadState({ userId, loaded: true, error: false });
      return true;
    } catch (error) {
      console.error("Supabase 載入失敗:", error);
      if (ownerRef.current === userId) {
        setLoadState(prev => ({ userId, loaded: prev.userId === userId && prev.loaded, error: true }));
      }
      throw error;
    }
  }, [setFolders, setVocabData, syncLockRef, lastMutationTimeRef]);

  useEffect(() => {
    if (session?.user?.id) {
      loadData(session.user.id).catch(() => { });
    } else {
      setLoadState({ userId: null, loaded: true, error: false });
    }
  }, [loadData, session?.user?.id]);

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!session?.user) return;
      if (syncLockRef?.current > 0) {
        console.log("Database write is active, skipping background sync to avoid race condition.");
        return;
      }
      if (lastMutationTimeRef?.current && (Date.now() - lastMutationTimeRef.current < 10000)) {
        console.log("Recent database write occurred (<10s), skipping focus sync to prevent overwriting local state.");
        return;
      }
      loadData(session.user.id).catch(() => { });
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [loadData, session, syncLockRef]);

  const syncLocalWords = useCallback(async () => {
    if (!session?.user?.id) return;
    if (isSyncing.current) return;

    const localWords = vocabData.filter(word => word.isLocal);
    if (localWords.length === 0) return;

    isSyncing.current = true;
    const toastId = toast.loading(i18n.t('toast.syncingLocal', '正在同步本機單字...'));

    try {
      const results = await Promise.allSettled(localWords.map(async (word) => {
        const { data, error } = await saveWordWithPreferences({
          wordData: word,
          userId: session.user.id,
          folderId: word.folderIds?.[0]?.toString() || null,
          selectedDefinitions: Array.isArray(word.selectedDefinitions) ? word.selectedDefinitions : null
        });

        if (error) throw error;

        const libraryEntry = Array.isArray(data) ? data[0] : data;
        if (!libraryEntry) throw new Error('同步失敗 (無回傳資料)');

        if (libraryEntry?.id && word?.source) {
          updateUserLibrarySourceByLibraryId({
            libraryId: libraryEntry.id,
            source: word.source,
            isAiGenerated: Boolean(word.isAiGenerated)
          }).catch((error) => {
            if (error?.message?.includes('column \"source\"')) return;
            console.warn('同步來源失敗', error);
          });
        }

        return { word, libraryEntry };
      }));

      const successfulUpdates = new Map();
      results.forEach((result, index) => {
        const sourceWord = localWords[index];
        if (!sourceWord) return;
        if (result.status === 'fulfilled') {
          successfulUpdates.set(
            sourceWord.id,
            entryToWord({
              entry: result.value.libraryEntry,
              baseWord: sourceWord,
              nowIso: sourceWord.addedAt || new Date().toISOString()
            })
          );
        } else {
          console.error('本機單字同步失敗:', result.reason);
        }
      });

      if (successfulUpdates.size > 0) {
        setVocabData(prev => prev.map(word => {
          const updated = successfulUpdates.get(word.id);
          return updated ? updated : word;
        }));
        toast.success(i18n.t('toast.syncSuccess', '本機單字已同步至雲端！'));
      } else {
        toast.error(i18n.t('toast.syncNetworkError', '同步失敗，請檢查網路連線'));
      }
    } finally {
      toast.dismiss(toastId);
      isSyncing.current = false;
    }
  }, [session?.user?.id, setVocabData, vocabData]);

  useEffect(() => {
    if (session?.user?.id) {
      syncLocalWords();
    }
  }, [session?.user?.id, syncLocalWords]);

  const handleManualSync = useCallback(() => {
    if (session?.user) {
      setLoadState({ userId: session.user.id, loaded: false, error: false });
      loadData(session.user.id)
        .then(() => alert(i18n.t('sync.syncComplete', '同步完成！')))
        .catch((error) => {
          const message = error?.message || '請稍後再試';
          alert(`${i18n.t('sync.syncFailed', '同步失敗')}: ${message}`);
        });
    } else {
      alert(i18n.t('sync.loginRequired', '請先登入才能同步資料！'));
    }
  }, [loadData, session]);

  return {
    state: {
      isDataLoaded,
      loadError
    },
    actions: {
      loadData,
      syncLocalWords,
      handleManualSync
    }
  };
};

export default useSync;
