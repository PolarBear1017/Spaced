import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { createVocabularyWord } from '../domain/models';
import {
  updateUserLibraryFoldersByLibraryId,
  updateUserLibrarySourceByLibraryId,
  saveWordWithPreferences,
  deleteUserLibraryEntry,
  toggleUserLibraryStar
} from '../services/libraryService';
import { entryToWord } from '../utils/mapper';
import i18n from '../i18n/config';

const useWordStorage = ({
  session,
  vocabData,
  setVocabData,
  showToast,
  pendingSavesRef,
  syncLockRef,
  lastMutationTimeRef,
  isDataLoaded
}) => {
  const saveWordToFolder = useCallback(async (searchResult, folderId, selectedDefinitions = null, options = {}) => {
    if (!searchResult) return false;
    if (session?.user && !isDataLoaded) {
      showToast?.(i18n.t('toast.loadingData', '資料載入中，請稍後再試'), 'info');
      return false;
    }
    const showToastFlag = options?.showToast !== false;

    const normalizedFolderIds = Array.isArray(folderId)
      ? folderId.map(id => id?.toString()).filter(Boolean)
      : (folderId ? [folderId.toString()] : []);
    const primaryFolderId = normalizedFolderIds[0] || null;

    const existingWord = vocabData.find(word => (word.word || '').toLowerCase() === (searchResult.word || '').toLowerCase());

    const normalizedSelectedDefinitions = Array.isArray(selectedDefinitions) ? selectedDefinitions : null;
    const pendingKey = `${session?.user?.id || 'guest'}::${(searchResult.word || '').toLowerCase()}::${normalizedFolderIds.join(',')}`;
    if (pendingSavesRef.current.has(pendingKey)) return false;
    pendingSavesRef.current.add(pendingKey);

    const nowIso = new Date().toISOString();

    try {
      if (syncLockRef) syncLockRef.current += 1;
      if (!session) {
        let resultWord;
        if (existingWord) {
          const nextFolderIds = Array.from(new Set([...(existingWord.folderIds || []).map(id => id?.toString()), ...normalizedFolderIds])).filter(Boolean);
          resultWord = createVocabularyWord({
            ...existingWord,
            folderIds: nextFolderIds,
            selectedDefinitions: normalizedSelectedDefinitions ?? existingWord.selectedDefinitions ?? null,
            source: existingWord.source ?? searchResult.source ?? null,
            isAiGenerated: existingWord.isAiGenerated ?? searchResult.isAiGenerated ?? false,
            _lastModified: Date.now()
          });
          setVocabData(prev => prev.map(word => word.id === existingWord.id ? { ...resultWord, isLocal: true } : word));
        } else {
          const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          resultWord = createVocabularyWord({
            ...searchResult,
            id: tempId,
            folderIds: normalizedFolderIds,
            selectedDefinitions: normalizedSelectedDefinitions,
            addedAt: nowIso,
            nextReview: nowIso,
            due: nowIso,
            proficiencyScore: 0,
            source: searchResult.source ?? null,
            isAiGenerated: searchResult.isAiGenerated ?? false,
            _lastModified: Date.now()
          });
          setVocabData(prev => [...prev, { ...resultWord, isLocal: true }]);
        }
        if (lastMutationTimeRef) lastMutationTimeRef.current = Date.now();
        if (showToastFlag) {
          toast.success(i18n.t('toast.guestCached', '已暫存於本機 (訪客模式)'));
        }
        return resultWord;
      }

      // Logged in mode
      try {
        const { data, error } = await saveWordWithPreferences({
          wordData: existingWord ? { ...existingWord, source: searchResult.source, isAiGenerated: searchResult.isAiGenerated } : searchResult,
          userId: session.user.id,
          folderId: primaryFolderId,
          selectedDefinitions
        });

        if (error) throw error;

        const libraryEntry = Array.isArray(data) ? data[0] : data;
        if (!libraryEntry) throw new Error("儲存失敗 (無回傳資料)");

        const reconciledWord = entryToWord({
          entry: libraryEntry,
          baseWord: existingWord || searchResult,
          normalizedFolderId: primaryFolderId,
          normalizedSelectedDefinitions,
          nowIso
        });

        const finalFolderIds = Array.from(new Set([
          ...(reconciledWord.folderIds || []),
          ...normalizedFolderIds
        ]));
        reconciledWord.folderIds = finalFolderIds;

        if (libraryEntry?.id && searchResult?.source) {
          try {
            await updateUserLibrarySourceByLibraryId({
              libraryId: libraryEntry.id,
              source: searchResult.source,
              isAiGenerated: Boolean(searchResult.isAiGenerated)
            });
          } catch (error) {
            if (!error?.message?.includes('column "source"')) {
              console.warn('更新來源失敗', error);
            }
          }
        }

        const wordWithTimestamp = { ...reconciledWord, _lastModified: Date.now() };

        setVocabData(prev => {
          const exists = prev.find(word => (word.word || '').toLowerCase() === (searchResult.word || '').toLowerCase());
          if (exists) {
            return prev.map(word => word.id === exists.id ? wordWithTimestamp : word);
          }
          return [...prev, wordWithTimestamp];
        });

        if (lastMutationTimeRef) {
          lastMutationTimeRef.current = Date.now();
        }

        if (showToastFlag) {
          toast.success(i18n.t('toast.addedToLibrary', '已加入單字庫！'));
        }
        return wordWithTimestamp;
      } catch (error) {
        console.error("儲存失敗:", error);

        let message = error?.message || "請稍後再試";
        if (message.includes("row-level security")) {
          message = "資料庫權限不足。請在 Supabase SQL Editor 執行 RLS 政策指令以開放寫入權限。";
        } else if (message.includes('column "selected_definitions" of relation "user_library" does not exist')) {
          message = "資料庫尚未更新。請先新增 selected_definitions 欄位。";
        }
        console.error("儲存失敗細節:", message);
        toast.error(i18n.t('toast.saveFailedRetry', '儲存失敗，請再試一次'));
        return false;
      }
    } finally {
      pendingSavesRef.current.delete(pendingKey);
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
    }
  }, [pendingSavesRef, session, setVocabData, showToast, vocabData, syncLockRef, lastMutationTimeRef, isDataLoaded]);

  const updateWordFolders = useCallback(async (word, folderIds) => {
    if (!word) return false;
    if (session?.user && !isDataLoaded) {
      showToast?.(i18n.t('toast.loadingData', '資料載入中，請稍後再試'), 'info');
      return false;
    }
    const normalizedFolderIds = (Array.isArray(folderIds) ? folderIds : [])
      .map(id => id?.toString())
      .filter(Boolean);

    try {
      if (syncLockRef) syncLockRef.current += 1;
      if (normalizedFolderIds.length === 0) {
        if (session?.user) {
          if (!word.libraryId) {
            throw new Error("找不到單字的 libraryId，無法刪除單字");
          }
          const { error } = await deleteUserLibraryEntry({
            userId: session.user.id,
            libraryId: word.libraryId
          });
          if (error) throw error;
        }
        setVocabData(prev => prev.filter(item => item.id !== word.id));
        if (lastMutationTimeRef) lastMutationTimeRef.current = Date.now();
        return true;
      }

      if (session?.user) {
        if (!word.libraryId) {
          throw new Error("找不到單字的 libraryId，無法更新資料夾");
        }
        const { error } = await updateUserLibraryFoldersByLibraryId({
          userId: session.user.id,
          libraryId: word.libraryId,
          folderIds: normalizedFolderIds
        });

        if (error) throw error;
      }

      const now = Date.now();
      setVocabData(prev => prev.map(item => item.id === word.id ? { ...item, folderIds: normalizedFolderIds, _lastModified: now } : item));
      if (lastMutationTimeRef) lastMutationTimeRef.current = now;
      return true;
    } finally {
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
    }
  }, [session, setVocabData, syncLockRef, lastMutationTimeRef, isDataLoaded, showToast]);

  const handleRemoveWordFromFolder = useCallback(async (word, folderId) => {
    const currentFolders = Array.isArray(word.folderIds) ? word.folderIds.map(id => id?.toString()) : [];
    const normalizedFolderId = folderId?.toString();
    if (!normalizedFolderId || currentFolders.length === 0) return;

    if (!currentFolders.includes(normalizedFolderId)) return;

    const nextFolders = currentFolders.filter(id => id !== normalizedFolderId);

    try {
      if (syncLockRef) syncLockRef.current += 1;
      if (nextFolders.length === 0) {
        if (session?.user) {
          const { error } = await deleteUserLibraryEntry({
            userId: session.user.id,
            libraryId: word.libraryId
          });

          if (error) {
            alert(`${i18n.t('library.removeFailed', '移除失敗')}: ${error.message}`);
            return;
          }
        }

        setVocabData(prev => prev.filter(item => item.id !== word.id));
        return;
      }

      if (session?.user) {
        const { error } = await updateUserLibraryFoldersByLibraryId({
          userId: session.user.id,
          libraryId: word.libraryId,
          folderIds: nextFolders
        });

        if (error) {
          alert(`${i18n.t('library.removeFailed', '移除失敗')}: ${error.message}`);
          return;
        }
      }

      setVocabData(prev => prev.map(item => item.id === word.id ? { ...item, folderIds: nextFolders } : item));
    } finally {
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
    }
  }, [session, setVocabData, syncLockRef]);

  const handleRemoveWordsFromFolder = useCallback(async (words, folderId) => {
    const normalizedFolderId = folderId?.toString();
    if (!normalizedFolderId) return false;
    const targets = Array.isArray(words) ? words : [];
    if (targets.length === 0) return false;

    try {
      if (syncLockRef) syncLockRef.current += 1;
      const updates = [];
      const deletes = new Set();
      const failed = [];

      for (const word of targets) {
        const currentFolders = Array.isArray(word.folderIds) ? word.folderIds.map(id => id?.toString()) : [];
        if (!currentFolders.includes(normalizedFolderId)) continue;
        const nextFolders = currentFolders.filter(id => id !== normalizedFolderId);

        if (session?.user) {
          if (!word.libraryId) {
            failed.push(word.id);
            continue;
          }
          
          let error;
          if (nextFolders.length === 0) {
            const res = await deleteUserLibraryEntry({
              userId: session.user.id,
              libraryId: word.libraryId
            });
            error = res.error;
          } else {
            const res = await updateUserLibraryFoldersByLibraryId({
              userId: session.user.id,
              libraryId: word.libraryId,
              folderIds: nextFolders
            });
            error = res.error;
          }

          if (error) {
            failed.push(word.id);
            continue;
          }
        }

        if (nextFolders.length === 0) {
          deletes.add(word.id);
        } else {
          updates.push({ id: word.id, folderIds: nextFolders });
        }
      }

      if (updates.length > 0 || deletes.size > 0) {
        setVocabData(prev => prev
          .filter(item => !deletes.has(item.id))
          .map(item => {
            const update = updates.find(entry => entry.id === item.id);
            return update ? { ...item, folderIds: update.folderIds } : item;
          })
        );
      }

      if (failed.length > 0) {
        alert(`${i18n.t('library.removeFailed', '移除失敗')}: ${failed.length}`);
      }

      return updates.length > 0 || deletes.size > 0;
    } finally {
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
    }
  }, [session, setVocabData, syncLockRef]);

  const handleMoveWordsToFolder = useCallback(async (words, fromFolderId, toFolderId) => {
    const normalizedFromId = fromFolderId?.toString();
    const normalizedToId = toFolderId?.toString();
    if (!normalizedFromId || !normalizedToId) return false;
    if (normalizedFromId === normalizedToId) return false;

    const targets = Array.isArray(words) ? words : [];
    if (targets.length === 0) return false;

    try {
      if (syncLockRef) syncLockRef.current += 1;
      const updates = [];
      const failed = [];

      for (const word of targets) {
        const currentFolders = Array.isArray(word.folderIds) ? word.folderIds.map(id => id?.toString()) : [];
        if (!currentFolders.includes(normalizedFromId)) continue;

        const withoutFrom = currentFolders.filter(id => id !== normalizedFromId);
        const nextFolders = Array.from(new Set([...withoutFrom, normalizedToId]));

        if (session?.user) {
          if (!word.libraryId) {
            failed.push(word.id);
            continue;
          }
          const { error } = await updateUserLibraryFoldersByLibraryId({
            userId: session.user.id,
            libraryId: word.libraryId,
            folderIds: nextFolders
          });

          if (error) {
            failed.push(word.id);
            continue;
          }
        }

        updates.push({ id: word.id, folderIds: nextFolders });
      }

      if (updates.length > 0) {
        setVocabData(prev => prev.map(item => {
          const update = updates.find(entry => entry.id === item.id);
          return update ? { ...item, folderIds: update.folderIds } : item;
        }));
      }

      if (failed.length > 0) {
        alert(`${i18n.t('library.moveFailed', '移動失敗')}: ${failed.length}`);
      }

      return updates.length > 0;
    } finally {
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
    }
  }, [session, setVocabData, syncLockRef]);

  const updateWord = useCallback((wordId, updates) => {
    setVocabData(prev => prev.map(word => word.id === wordId ? { ...word, ...updates } : word));
  }, [setVocabData]);

  const toggleWordStar = useCallback(async (word) => {
    if (!word) return false;
    const nextStarred = !word.isStarred;
    
    setVocabData(prev => prev.map(item => item.id === word.id ? { ...item, isStarred: nextStarred } : item));
    
    if (session?.user) {
      if (!word.libraryId) {
        console.warn("找不到單字的 libraryId，無法更新星號至雲端");
        return false;
      }
      try {
        if (syncLockRef) syncLockRef.current += 1;
        const { error } = await toggleUserLibraryStar({
          libraryId: word.libraryId,
          isStarred: nextStarred
        });
        if (error) throw error;
      } catch (error) {
        console.error("同步星號狀態失敗:", error);
        setVocabData(prev => prev.map(item => item.id === word.id ? { ...item, isStarred: word.isStarred } : item));
        toast.error(i18n.t('toast.starSyncFailed', '星號同步失敗，請稍後再試'));
        return false;
      } finally {
        if (syncLockRef) {
          syncLockRef.current = Math.max(0, syncLockRef.current - 1);
        }
      }
    } else {
      toast.success(nextStarred ? i18n.t('toast.starredGuest', '已標註星號 (訪客模式)') : i18n.t('toast.unstarredGuest', '已取消星號 (訪客模式)'));
    }
    return true;
  }, [session, setVocabData, syncLockRef]);

  return {
    actions: {
      saveWordToFolder,
      updateWordFolders,
      handleRemoveWordFromFolder,
      handleRemoveWordsFromFolder,
      handleMoveWordsToFolder,
      updateWord,
      toggleWordStar
    },
    state: {
      vocabData
    }
  };
};

export default useWordStorage;
