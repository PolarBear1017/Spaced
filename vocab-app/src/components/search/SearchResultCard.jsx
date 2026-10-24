import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Info, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SearchResultHeader from './SearchResultHeader';
import SearchResultEntries from './SearchResultEntries';
import SearchSimilarList from './SearchSimilarList';
import SearchMnemonic from './SearchMnemonic';
import FolderSelectionList from './FolderSelectionList';
import AddDefinitionModal from './AddDefinitionModal';
import QuickScrollNav from './QuickScrollNav';
import { normalizeEntries } from '../../utils/data';
import { getAudioUrl } from '../../services/speechService';
import { useSettingsContext } from '../../contexts/SettingsContext';

const getEntryKey = (item) => {
  if (!item) return '|||';
  const def = (typeof item === 'string' ? item : item.definition || '')
    .trim()
    .replace(/\s+/g, ' ');
  const trans = (typeof item === 'string' ? '' : item.translation || '')
    .trim()
    .replace(/\s+/g, ' ');
  return def + '|||' + trans;
};

const SearchResultCard = ({
  searchResult,
  normalizedEntries,
  preferredAccent,
  setPreferredAccent,
  preferredSearchAudio,
  onSpeak,
  savedWordInSearch,
  saveButtonFeedback,
  folders,
  isDataLoaded = true,
  lastUsedFolderIds,
  onSaveWord,
  onUpdateWordFolders,
  onUpdateLastUsedFolderIds,
  onCreateFolder,
  syncLockRef,
  lastMutationTimeRef,
  groqApiKey,
  aiLoading,
  onGenerateMnemonic,
  setQuery,
  onSearch,
  onChangeSource,
  definitionLanguage,
  onSetDefinitionLanguage,
  relatedContext,
  audioPriority,
  savedWordsSet,
  searchTrail,
  onSelectRelatedWord,
  onBackInTrail
}) => {
  const { t } = useTranslation();
  const [saveStep, setSaveStep] = useState('idle');
  const [selectedEntryIndices, setSelectedEntryIndices] = useState(null);
  const [draftFolderIds, setDraftFolderIds] = useState(null);
  const [isConfirmingFolders, setIsConfirmingFolders] = useState(false);
  const [showDefaultTip, setShowDefaultTip] = useState(false);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [customDefinitions, setCustomDefinitions] = useState([]);
  const [deletedCustomDefs, setDeletedCustomDefs] = useState(new Set());
  const [isAddingDefinition, setIsAddingDefinition] = useState(false);
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(true);
  const isProcessingRef = useRef(false);
  const defaultTipRef = useRef(null);

  useEffect(() => {
    // A new result starts a separate save flow and must not retain draft UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveStep('idle');
    setSelectedEntryIndices(null);
    setIsSwitchingSource(false);
    setCustomDefinitions([]);
    setDeletedCustomDefs(new Set());
    setIsMnemonicOpen(true);
  }, [searchResult?.word]);

  useEffect(() => {
    if (!showDefaultTip) return;
    const handleOutsideClick = (event) => {
      if (!defaultTipRef.current) return;
      if (!defaultTipRef.current.contains(event.target)) {
        setShowDefaultTip(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDefaultTip]);

  const { selectedDefinitionSet, selectedDefOnlySet, selectedTransOnlySet } = useMemo(() => {
    if (!savedWordInSearch) {
      return {
        selectedDefinitionSet: new Set(),
        selectedDefOnlySet: new Set(),
        selectedTransOnlySet: new Set()
      };
    }
    const raw = savedWordInSearch.selectedDefinitions || savedWordInSearch.selected_definitions;
    const list = Array.isArray(raw) && raw.length > 0 ? raw : normalizeEntries(savedWordInSearch);

    const defSet = new Set();
    const defOnly = new Set();
    const transOnly = new Set();

    list.forEach((item) => {
      const key = getEntryKey(item);
      if (key !== '|||') defSet.add(key);

      const def = (typeof item === 'string' ? item : item.definition || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (def) defOnly.add(def);

      const trans = (typeof item === 'string' ? '' : item.translation || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (trans) transOnly.add(trans);
    });

    return {
      selectedDefinitionSet: defSet,
      selectedDefOnlySet: defOnly,
      selectedTransOnlySet: transOnly
    };
  }, [savedWordInSearch]);

  const isDefinitionSaved = useCallback((entry) => {
    if (!savedWordInSearch) return false;
    const key = getEntryKey(entry);
    if (key !== '|||' && selectedDefinitionSet.has(key)) return true;

    const def = (typeof entry === 'string' ? entry : entry.definition || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (def && selectedDefOnlySet.has(def)) return true;

    const trans = (typeof entry === 'string' ? '' : entry.translation || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!def && trans && selectedTransOnlySet.has(trans)) return true;

    return false;
  }, [savedWordInSearch, selectedDefinitionSet, selectedDefOnlySet, selectedTransOnlySet]);

  const orderedEntries = useMemo(() => {
    const combined = [];
    const existingKeys = new Set();
    const existingDefs = new Set();
    const existingTrans = new Set();
    const isDeleted = (item) => deletedCustomDefs.has(getEntryKey(item));

    const registerKey = (item) => {
      const key = getEntryKey(item);
      if (key !== '|||') existingKeys.add(key);
      const def = (typeof item === 'string' ? item : item.definition || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (def) existingDefs.add(def);
      const trans = (typeof item === 'string' ? '' : item.translation || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (trans) existingTrans.add(trans);
    };

    normalizedEntries.forEach(d => {
       const key = getEntryKey(d);
       if (!existingKeys.has(key)) {
         combined.push(d);
         registerKey(d);
       }
    });

    customDefinitions.forEach(d => {
       const key = getEntryKey(d);
       if (!existingKeys.has(key) && !isDeleted(d)) {
         combined.push({ ...d, isCustom: true });
         registerKey(d);
       }
    });

    const processSaved = (savedList) => {
      savedList.forEach(saved => {
        const key = getEntryKey(saved);
        const def = (typeof saved === 'string' ? saved : saved.definition || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
        const trans = (typeof saved === 'string' ? '' : saved.translation || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();

        const alreadyExists = existingKeys.has(key)
          || (def && existingDefs.has(def))
          || (!def && trans && existingTrans.has(trans));

        if (key !== '|||' && !alreadyExists && !isDeleted(saved)) {
          combined.push({ ...saved, isCustom: true });
          registerKey(saved);
        }
      });
    };

    if (savedWordInSearch?.selectedDefinitions) {
      processSaved(savedWordInSearch.selectedDefinitions);
    } else if (savedWordInSearch?.selected_definitions) {
      processSaved(savedWordInSearch.selected_definitions);
    }

    if (combined.length === 0) return [];

    const pinned = [];
    const rest = [];

    combined.forEach((entry) => {
      if (isDefinitionSaved(entry)) {
        pinned.push(entry);
      } else {
        rest.push(entry);
      }
    });

    return [...pinned, ...rest].map(entry => ({
      ...entry,
      isSaved: isDefinitionSaved(entry)
    }));
  }, [normalizedEntries, isDefinitionSaved, customDefinitions, savedWordInSearch, deletedCustomDefs]);

  const selectedEntries = useMemo(() => {
    if (orderedEntries.length === 0) return [];
    if (selectedEntryIndices === null) return orderedEntries;
    return orderedEntries.filter((_, index) => selectedEntryIndices.has(index));
  }, [orderedEntries, selectedEntryIndices]);

  const hasDefinitionChanges = useMemo(() => {
    if (!savedWordInSearch) return false;
    const currentDefs = selectedEntries.map(getEntryKey).filter(k => k !== '|||');
    const originalDefsRaw = (Array.isArray(savedWordInSearch.selectedDefinitions) && savedWordInSearch.selectedDefinitions.length > 0)
      ? savedWordInSearch.selectedDefinitions
      : ((Array.isArray(savedWordInSearch.selected_definitions) && savedWordInSearch.selected_definitions.length > 0)
        ? savedWordInSearch.selected_definitions
        : normalizeEntries(savedWordInSearch));
    const originalDefs = originalDefsRaw.map(getEntryKey).filter(k => k !== '|||');
    if (currentDefs.length !== originalDefs.length) return true;
    const originalSet = new Set(originalDefs);
    for (const def of currentDefs) {
      if (!originalSet.has(def)) return true;
    }
    return false;
  }, [savedWordInSearch, selectedEntries]);

  const handleToggleEntry = useCallback((index) => {
    setSelectedEntryIndices((prev) => {
      const total = orderedEntries.length;
      if (total === 0) return prev;
      if (prev === null) {
        const next = new Set(Array.from({ length: total }, (_, i) => i));
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next.size === total ? null : next;
      }
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next.size === total ? null : next;
    });
  }, [orderedEntries.length]);

  const handleToggleAll = useCallback(() => {
    setSelectedEntryIndices((prev) => {
      if (orderedEntries.length === 0) return prev;
      return prev === null ? new Set() : null;
    });
  }, [orderedEntries.length]);

  const resetSaveFlow = useCallback(() => {
    setSaveStep('idle');
    setSelectedEntryIndices(null);
    setDraftFolderIds(null);
  }, []);

  const handleSaveWord = useCallback((folderId, overrideWord = null) => {
    const cleanExample = (value) => {
      if (!value) return '';
      if (typeof value === 'object') {
        const cleaned = {
          text: (value.text || '').replace(/\s*\n\s*/g, ' ').trim()
        };
        if (value.translation) cleaned.translation = value.translation.trim();
        if (value.collocation) cleaned.collocation = value.collocation.trim();
        return cleaned;
      }
      return (value || '')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
    };

    const selectedDefinitions = selectedEntries.map((entry) => {
      const fallbackExample = entry.example ? [entry.example] : [];
      const rawExamples = Array.isArray(entry.examples) ? entry.examples : fallbackExample;
      const primaryEx = typeof entry.example === 'object'
        ? (entry.example.translation ? `${entry.example.text}\n${entry.example.translation}` : entry.example.text)
        : (entry.example || '').replace(/\s*\n\s*/g, '\n').trim();

      return {
        definition: entry.definition || '',
        translation: entry.translation || '',
        example: primaryEx,
        examples: rawExamples.map(cleanExample).filter(Boolean),
        pos: entry.pos || searchResult.pos || ''
      };
    });
    return onSaveWord(folderId, selectedDefinitions, { showToast: false }, overrideWord);
  }, [onSaveWord, searchResult.pos, selectedEntries]);

  const handleConfirmFolders = useCallback(async ({ addIds, removeIds, selectedIds }) => {
    if (isProcessingRef.current || isConfirmingFolders) return;
    if (!isDataLoaded) {
      toast.error(t('card.dataLoadingToast'));
      return;
    }
    isProcessingRef.current = true;
    setIsConfirmingFolders(true);
    if (syncLockRef) syncLockRef.current += 1;

    const removeList = Array.isArray(removeIds) ? removeIds : [];
    const addList = Array.isArray(addIds) ? addIds : [];
    const selectedList = Array.isArray(selectedIds) ? selectedIds : [];

    let isSaved = false;
    let hasError = false;

    try {
      if (!savedWordInSearch) {
        // --- CASE 1: Word is NOT saved yet ---
        const firstFolderId = selectedList[0] || null;
        const savedWord = await handleSaveWord(firstFolderId, searchResult);
        
        if (savedWord) {
          isSaved = true;
          // Associate folder mappings for all selected folders
          if (onUpdateWordFolders) {
            const updateSuccess = await onUpdateWordFolders(savedWord, selectedList);
            if (updateSuccess === false) {
              hasError = true;
            }
          }
        } else {
          hasError = true;
        }
      } else {
        // --- CASE 2: Word is ALREADY saved ---
        let currentWord = savedWordInSearch;
        
        // If definitions changed, update them first
        if (hasDefinitionChanges) {
          const targetFolderId = selectedList[0] || null;
          const updatedWord = await handleSaveWord(targetFolderId, savedWordInSearch);
          if (updatedWord) {
            currentWord = updatedWord;
            isSaved = true;
          } else {
            hasError = true;
          }
        }

        // Update folder mappings
        if (!hasError && onUpdateWordFolders) {
          const updateSuccess = await onUpdateWordFolders(currentWord, selectedList);
          if (updateSuccess === false) {
            hasError = true;
          } else {
            isSaved = true;
          }
        }
      }

      if (!hasError) {
        const hasAdd = addList.length > 0;
        const hasRemove = removeList.length > 0;
        if (hasAdd && hasRemove) {
          toast.success(t('card.foldersUpdatedToast'));
        } else if (hasAdd) {
          toast.success(t('card.folderAddedToast'));
        } else if (hasRemove) {
          toast.success(t('card.folderRemovedToast'));
        }

        if (hasDefinitionChanges && isSaved) {
          toast.success(t('card.definitionsUpdatedToast'));
        }

        if (addList.length > 0) {
          onUpdateLastUsedFolderIds?.(addList);
        }
      }
    } catch (err) {
      console.error('儲存單字至資料夾失敗:', err);
      toast.error(t('card.saveFailedToast'));
      hasError = true;
    } finally {
      if (syncLockRef) {
        syncLockRef.current = Math.max(0, syncLockRef.current - 1);
      }
      if (lastMutationTimeRef) {
        lastMutationTimeRef.current = Date.now();
      }
      setIsConfirmingFolders(false);
      isProcessingRef.current = false;
      if (!hasError) {
        resetSaveFlow();
      }
    }
  }, [
    handleSaveWord,
    hasDefinitionChanges,
    isConfirmingFolders,
    onUpdateWordFolders,
    onUpdateLastUsedFolderIds,
    resetSaveFlow,
    savedWordInSearch,
    searchResult,
    syncLockRef,
    lastMutationTimeRef,
    isDataLoaded,
    t
  ]);

  const applySavedSelection = useCallback(() => {
    if (orderedEntries.length === 0) {
      setSelectedEntryIndices(new Set());
      return;
    }
    const indices = [];
    orderedEntries.forEach((entry, index) => {
      if (entry.isSaved) indices.push(index);
    });
    if (indices.length === 0) {
      // Default to saving only the first definition for new words.
      setSelectedEntryIndices(new Set([0]));
      return;
    }
    if (indices.length === orderedEntries.length) {
      setSelectedEntryIndices(null);
      return;
    }
    setSelectedEntryIndices(new Set(indices));
  }, [orderedEntries]);

  const handleStartSave = useCallback(() => {
    if (saveStep !== 'idle') return;
    applySavedSelection();
    setDraftFolderIds(null);
    setSaveStep('folder');
  }, [applySavedSelection, saveStep]);

  const { state: settingsState } = useSettingsContext();
  const playAudioShortcut = settingsState?.playAudioShortcut || 'Tab';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === playAudioShortcut.toLowerCase()) {
        if (searchResult?.word && onSpeak) {
          event.preventDefault();
          const effectivePriority = [preferredAccent, ...audioPriority.filter(p => p !== preferredAccent)];
          onSpeak(searchResult.word, getAudioUrl(searchResult, effectivePriority));
          return;
        }
      }

      if (saveStep !== 'idle') return;
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
      if (isTypingField) return;

      event.preventDefault();
      handleStartSave();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleStartSave, saveStep, searchResult, onSpeak, preferredAccent, audioPriority, playAudioShortcut]);

  const handleCancelSave = useCallback(() => {
    resetSaveFlow();
  }, [resetSaveFlow]);

  const handleNextSave = useCallback(() => {
    setSaveStep('folder');
  }, []);

  const handleEditDefinitions = useCallback(() => {
    setSaveStep('selecting');
  }, []);

  const handleChangeSource = useCallback(async (source, targetLang) => {
    if (!onChangeSource || !searchResult?.word) return;
    setIsSwitchingSource(true);
    try {
      await onChangeSource(searchResult.word, source, targetLang);
    } finally {
      setIsSwitchingSource(false);
    }
  }, [onChangeSource, searchResult]);

  const handleChangeDefinitionLanguage = useCallback(async (lang) => {
    if (!lang || lang === definitionLanguage) return;
    onSetDefinitionLanguage?.(lang);
    if (!searchResult?.word || !onChangeSource) return;
    setIsSwitchingSource(true);
    try {
      await onChangeSource(searchResult.word, searchResult.source, lang);
    } finally {
      setIsSwitchingSource(false);
    }
  }, [definitionLanguage, onSetDefinitionLanguage, onChangeSource, searchResult?.word, searchResult?.source]);

  const handleAddDefinition = useCallback((newDefinition) => {
    // Ensure examples array exists for rendering
    const definitionWithExamples = {
      ...newDefinition,
      examples: newDefinition.example ? [newDefinition.example] : []
    };
    setCustomDefinitions(prev => [...prev, definitionWithExamples]);

    // Automatically select the new definition
    // We need to wait for the next render for orderedEntries to update, 
    // but we can predict it will be appended or pinned.
    // Actually, simpler is to add it to selectedDefinitionSet conceptually,
    // but selectedDefinitionSet is derived from savedWordInSearch which we don't update here immediately.
    // Instead, we manually update selectedEntryIndices.

    // Since we can't easily predict the index in orderedEntries immediately due to sorting,
    // we can use a simpler approach: 
    // Just add to customDefinitions. The user can then select it.
    // OR: we can try to force select it. 

    // Let's rely on the user selecting it for now, or we can improve UX later.
    // IMPROVEMENT: Auto-select needs access to the new index. 
    // Let's just scroll to bottom or show a toast? 
    // For now, just add it.
  }, []);

  const headerStep = saveStep;
  const isSelectingView = saveStep === 'selecting';
  const canGoBack = Array.isArray(searchTrail) && searchTrail.length > 1;
  const previousWord = canGoBack ? searchTrail[searchTrail.length - 2] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div id="search-section-header">
        <SearchResultHeader
          searchResult={searchResult}
          preferredAccent={preferredAccent}
          onAccentChange={setPreferredAccent}
          preferredSearchAudio={preferredSearchAudio}
          onSpeak={onSpeak}
          savedWordInSearch={savedWordInSearch}
          saveButtonFeedback={saveButtonFeedback}
          saveStep={headerStep}
          onStartSave={handleStartSave}
          onCancelSave={handleCancelSave}
          onNextSave={handleNextSave}
          onBackSave={handleEditDefinitions}
          onSearchFullDefinition={(altWord) => onSearch(altWord || searchResult.word)}
          availableSources={['Cambridge', 'Cambridge Learner', 'Yahoo', 'Google Translate', 'Groq AI']}
          onChangeSource={handleChangeSource}
          isSwitchingSource={isSwitchingSource}
          definitionLanguage={definitionLanguage}
          onChangeDefinitionLanguage={handleChangeDefinitionLanguage}
          relatedContext={relatedContext}
          audioPriority={audioPriority}
          playAudioShortcut={playAudioShortcut}
          previousWord={previousWord}
          onBackInTrail={onBackInTrail}
        />
      </div>

      <div className={`p-6 space-y-6${isSelectingView ? ' max-h-[70vh] overflow-y-auto' : ''}`}>
        <div id="search-section-definitions">
          <SearchResultEntries
            normalizedEntries={orderedEntries}
            searchWord={searchResult.word}
            selectedEntryIndices={selectedEntryIndices}
            onToggleEntry={handleToggleEntry}
            onToggleAll={handleToggleAll}
            allSelected={selectedEntryIndices === null}
            readOnly={!isSelectingView}
            onDeleteEntry={(entry) => {
              setCustomDefinitions(prev => prev.filter(d => 
                getEntryKey(d) !== getEntryKey(entry)
              ));
              setDeletedCustomDefs(prev => {
                const next = new Set(prev);
                next.add(getEntryKey(entry));
                return next;
              });
            }}
            onSearchCollocation={onSelectRelatedWord || onSearch}
          />
        </div>

        {saveStep === 'idle' && (
          <div id="search-section-mnemonic">
            <SearchMnemonic
              mnemonics={searchResult.mnemonics}
              groqApiKey={groqApiKey}
              aiLoading={aiLoading}
              onGenerate={onGenerateMnemonic}
              isOpen={isMnemonicOpen}
              onToggleOpen={() => setIsMnemonicOpen(prev => !prev)}
            />
          </div>
        )}

        {isSelectingView && (
          <button
            onClick={() => setIsAddingDefinition(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('card.addCustomDefinition')}
          </button>
        )}

        {saveStep === 'idle' && (
          <div id="search-section-relations">
            <SearchSimilarList
              currentWord={searchResult.word}
              verbForms={searchResult.verbForms}
              wordFamily={searchResult.wordFamily}
              similarWords={searchResult.similar}
              savedWordsSet={savedWordsSet}
              historyTrail={searchTrail}
              onSelect={(word) => {
                if (onSelectRelatedWord) {
                  onSelectRelatedWord(word);
                } else {
                  setQuery(word);
                  onSearch({ preventDefault: () => { } }, word);
                }
              }}
              onBack={onBackInTrail}
            />
          </div>
        )}

        {saveStep === 'idle' && (
          <QuickScrollNav
            hasMnemonic={Boolean(searchResult.mnemonics || groqApiKey)}
            hasRelations={Boolean(
              (searchResult.verbForms && searchResult.verbForms.length > 0) ||
              (searchResult.wordFamily && (
                searchResult.wordFamily.nouns?.length > 0 ||
                searchResult.wordFamily.verbs?.length > 0 ||
                searchResult.wordFamily.adjectives?.length > 0 ||
                searchResult.wordFamily.adverbs?.length > 0 ||
                searchResult.wordFamily.others?.length > 0
              )) ||
              (searchResult.similar && searchResult.similar.length > 0)
            )}
          />
        )}

        {saveStep === 'folder' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={handleCancelSave} />
            <div className="relative z-50 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
              <FolderSelectionList
                folders={folders}
                isDataLoaded={isDataLoaded}
                savedFolderIds={savedWordInSearch?.folderIds}
                lastUsedFolderIds={lastUsedFolderIds}
                initialSelectedIds={draftFolderIds}
                searchWord={searchResult.word}
                onConfirm={handleConfirmFolders}
                onSelectionChange={setDraftFolderIds}
                onCancel={handleCancelSave}
                onEditDefinitions={handleEditDefinitions}
                hasDefinitionChanges={hasDefinitionChanges}
                onCreateFolder={onCreateFolder}
              />
            </div>
          </div>
        )}
      </div>


      <AddDefinitionModal
        isOpen={isAddingDefinition}
        onClose={() => setIsAddingDefinition(false)}
        onConfirm={(def) => {
          handleAddDefinition(def);
          // Optional: Toggle selection for this new def if possible,
          // but for now let's just let it appear.
        }}
      />
    </div >
  );
};

export default SearchResultCard;
