import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LibraryOverview from './LibraryOverview';
import FolderDetail from './FolderDetail';
import StoryModal from './StoryModal';
import FolderFormModal from './FolderFormModal';
import MoveWordsModal from './MoveWordsModal';
import SelectionActionBar from './SelectionActionBar';
import { useLibraryContext } from '../../contexts/LibraryContext';
import { useReviewContext } from '../../contexts/ReviewContext';
import { useNavigationContext } from '../../contexts/NavigationContext';
import { useSearchContext } from '../../contexts/SearchContext';
import useSelection from '../../hooks/useSelection';
import useDragSelect from '../../hooks/useDragSelect';

const LibraryTab = () => {
  const { t } = useTranslation();
  const library = useLibraryContext();
  const review = useReviewContext();
  const navigation = useNavigationContext();
  const search = useSearchContext();

  const {
    activeFolder,
    sortedFolders,
    sortedActiveFolderWords,
    index
  } = library.derived;

  const {
    folderSortBy,
    wordSortBy,
    story,
    isGeneratingStory,
    isDataLoaded,
    folders
  } = library.state;

  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isMovingWords, setIsMovingWords] = useState(false);

  const {
    isSelectionMode: isFolderSelectionMode,
    selectedIds: selectedFolderIds,
    count: selectedFolderCount,
    enterSelectionMode: enterFolderSelectionMode,
    exitSelectionMode: exitFolderSelectionMode,
    toggleSelectionMode: toggleFolderSelectionMode,
    toggleSelection: toggleFolderSelection,
    setSelection: setFolderSelection
  } = useSelection();
  const {
    isSelectionMode: isWordSelectionMode,
    selectedIds: selectedWordIds,
    count: selectedWordCount,
    enterSelectionMode: enterWordSelectionMode,
    exitSelectionMode: exitWordSelectionMode,
    toggleSelectionMode: toggleWordSelectionMode,
    toggleSelection: toggleWordSelection,
    setSelection: setWordSelection
  } = useSelection();

  useEffect(() => {
    exitWordSelectionMode();
  }, [activeFolder?.id, exitWordSelectionMode]);

  useEffect(() => {
    const validFolderIds = new Set(sortedFolders.map(folder => folder.id));
    const nextSelection = selectedFolderIds.filter(id => validFolderIds.has(id));
    if (nextSelection.length !== selectedFolderIds.length) {
      setFolderSelection(nextSelection);
    }
  }, [sortedFolders, selectedFolderIds, setFolderSelection]);

  useEffect(() => {
    const validWordIds = new Set(sortedActiveFolderWords.map(word => word.id));
    const nextSelection = selectedWordIds.filter(id => validWordIds.has(id));
    if (nextSelection.length !== selectedWordIds.length) {
      setWordSelection(nextSelection);
    }
  }, [sortedActiveFolderWords, selectedWordIds, setWordSelection]);

  const openCreateFolder = () => {
    setEditingFolder(null);
    setIsFolderFormOpen(true);
  };

  const openEditFolder = (folder) => {
    setEditingFolder(folder);
    setIsFolderFormOpen(true);
  };

  const handleSubmitFolder = async (values) => {
    setIsSavingFolder(true);
    const success = editingFolder
      ? await library.actions.handleEditFolder(editingFolder, values)
      : await library.actions.createFolder(values);
    setIsSavingFolder(false);
    if (success) {
      setIsFolderFormOpen(false);
      setEditingFolder(null);
    }
  };

  const selectAllFolders = () => {
    const selectableIds = sortedFolders.map(folder => folder.id);
    if (selectedFolderIds.length === selectableIds.length) {
      setFolderSelection([]);
      return;
    }
    setFolderSelection(selectableIds);
  };

  const selectFolderId = (folderId) => {
    if (!folderId) return;
    if (!selectedFolderIds.includes(folderId)) {
      toggleFolderSelection(folderId);
    }
  };

  const deleteSelectedFolders = async () => {
    const deletableIds = selectedFolderIds;
    if (deletableIds.length === 0) {
      alert(t('library.selectFoldersToDelete'));
      return;
    }
    if (!confirm(t('library.confirmDeleteFolders', { count: deletableIds.length }))) {
      return;
    }
    const success = await library.actions.handleDeleteFolders(deletableIds);
    if (success) exitFolderSelectionMode();
  };

  const selectAllWords = () => {
    const wordIds = sortedActiveFolderWords.map(word => word.id);
    if (selectedWordIds.length === wordIds.length) {
      setWordSelection([]);
      return;
    }
    setWordSelection(wordIds);
  };

  const selectWordId = (wordId) => {
    if (!wordId) return;
    if (!selectedWordIds.includes(wordId)) {
      toggleWordSelection(wordId);
    }
  };

  const handleFolderToggle = (folderId, event) => {
    toggleFolderSelection(folderId, event, sortedFolders);
  };

  const handleWordToggle = (wordId, event) => {
    toggleWordSelection(wordId, event, sortedActiveFolderWords);
  };

  const removeSelectedWords = async () => {
    if (!activeFolder) return;
    const selectedWords = sortedActiveFolderWords.filter(word => selectedWordIds.includes(word.id));
    if (selectedWords.length === 0) {
      alert(t('library.selectWordsToRemove'));
      return;
    }
    if (!confirm(t('library.confirmRemoveWords', { count: selectedWords.length }))) {
      return;
    }
    const success = await library.actions.handleRemoveWordsFromFolder(selectedWords, activeFolder.id);
    if (success) exitWordSelectionMode();
  };

  const openMoveModal = () => {
    if (!activeFolder) return;
    if (selectedWordIds.length === 0) {
      alert(t('library.selectWordsToMove'));
      return;
    }
    const availableTargets = folders.filter(folder => folder.id !== activeFolder.id);
    if (availableTargets.length === 0) {
      alert(t('library.noTargetFolders'));
      return;
    }
    setIsMoveModalOpen(true);
  };

  const handleMoveWords = async (targetFolderId) => {
    if (!activeFolder) return;
    const selectedWords = sortedActiveFolderWords.filter(word => selectedWordIds.includes(word.id));
    if (selectedWords.length === 0) return;
    setIsMovingWords(true);
    const success = await library.actions.handleMoveWordsToFolder(selectedWords, activeFolder.id, targetFolderId);
    setIsMovingWords(false);
    if (success) {
      setIsMoveModalOpen(false);
      exitWordSelectionMode();
    }
  };

  const folderDrag = useDragSelect({
    enabled: isFolderSelectionMode,
    onSelect: selectFolderId,
    onToggle: handleFolderToggle
  });

  const wordDrag = useDragSelect({
    enabled: isWordSelectionMode,
    onSelect: selectWordId,
    onToggle: handleWordToggle
  });

  return (
    <div className="max-w-4xl mx-auto">
      {!activeFolder ? (
        <LibraryOverview
          sortedFolders={sortedFolders}
          folderSortBy={folderSortBy}
          setFolderSortBy={library.actions.setFolderSortBy}
          onOpenCreateFolder={openCreateFolder}
          handleManualSync={library.actions.handleManualSync}
          isDataLoaded={isDataLoaded}
          isSelectionMode={isFolderSelectionMode}
          onToggleSelectionMode={toggleFolderSelectionMode}
          setSelectedReviewFolders={review.actions.setSelectedReviewFolders}
          setReviewSetupView={review.actions.setReviewSetupView}
          setActiveTab={navigation.actions.setActiveTab}
          generateFolderStory={library.actions.generateFolderStory}
          handleDeleteFolder={library.actions.handleDeleteFolder}
          handleEditFolder={openEditFolder}
          setViewingFolderId={library.actions.setViewingFolderId}
          selectedFolderIds={selectedFolderIds}
          onToggleFolder={handleFolderToggle}
          onEnterSelectionMode={enterFolderSelectionMode}
          dragHandleProps={folderDrag.dragHandleProps}
          entriesByFolderId={index.entriesByFolderId}
          statsByFolderId={index.statsByFolderId}
          onRemoveWordFromFolder={library.actions.handleRemoveWordFromFolder}
          onToggleStar={library.actions.toggleWordStar}
          onSaveDefinitions={(word, definitions) => library.actions.saveWordToFolder(word, word.folderIds, definitions, { showToast: false })}
          onSearchWord={(word) => {
            navigation.actions.setActiveTab('search');
            search.actions.handleSearch(word);
          }}
        />
      ) : (
        <FolderDetail
          activeFolder={activeFolder}
          wordSortBy={wordSortBy}
          setWordSortBy={library.actions.setWordSortBy}
          sortedActiveFolderWords={sortedActiveFolderWords}
          activeFolderStats={index.statsByFolderId[activeFolder.id]}
          onBack={() => library.actions.setViewingFolderId(null)}
          isSelectionMode={isWordSelectionMode}
          onToggleSelectionMode={toggleWordSelectionMode}
          onEditFolder={() => openEditFolder(activeFolder)}
          onDeleteFolder={() => library.actions.handleDeleteFolder(activeFolder.id)}
          selectedWordIds={selectedWordIds}
          onToggleWord={handleWordToggle}
          onEnterSelectionMode={enterWordSelectionMode}
          dragHandleProps={wordDrag.dragHandleProps}
          onRemoveWordFromFolder={library.actions.handleRemoveWordFromFolder}
          onToggleStar={library.actions.toggleWordStar}
          onSaveDefinitions={(word, definitions) => library.actions.saveWordToFolder(word, word.folderIds, definitions, { showToast: false })}
          onGoSearch={() => {
            navigation.actions.setActiveTab('search');
            library.actions.setViewingFolderId(null);
          }}
          onSearchWord={(word) => {
            navigation.actions.setActiveTab('search');
            library.actions.setViewingFolderId(null);
            search.actions.handleSearch(word);
            if (activeFolder?.id) {
              navigation.actions.setReturnFolderId(activeFolder.id);
            }
          }}
        />
      )}

      {(story || isGeneratingStory) && (
        <StoryModal
          story={story}
          isGeneratingStory={isGeneratingStory}
          onClose={() => { library.actions.setStory(null); library.actions.setIsGeneratingStory(false); }}
        />
      )}

      {isFolderFormOpen && (
        <FolderFormModal
          title={editingFolder ? t('library.editFolder') : t('library.newFolder')}
          initialValues={editingFolder || { name: '', description: '' }}
          onSubmit={handleSubmitFolder}
          onClose={() => {
            if (!isSavingFolder) {
              setIsFolderFormOpen(false);
              setEditingFolder(null);
            }
          }}
          isSaving={isSavingFolder}
        />
      )}

      {isMoveModalOpen && (
        <MoveWordsModal
          folders={folders}
          currentFolderId={activeFolder?.id}
          onSubmit={handleMoveWords}
          onClose={() => {
            if (!isMovingWords) setIsMoveModalOpen(false);
          }}
          isSaving={isMovingWords}
        />
      )}

      {!activeFolder && isFolderSelectionMode && (
        <SelectionActionBar
          count={selectedFolderCount}
          onSelectAll={selectAllFolders}
          selectAllLabel={selectedFolderIds.length === sortedFolders.length ? t('common.deselectAll') : t('common.selectAll')}
          onClear={exitFolderSelectionMode}
          actions={[
            { key: 'delete', label: t('common.delete'), variant: 'danger', onClick: deleteSelectedFolders, icon: 'delete', disabled: selectedFolderCount === 0 }
          ]}
        />
      )}

      {activeFolder && isWordSelectionMode && (
        <SelectionActionBar
          count={selectedWordCount}
          onSelectAll={selectAllWords}
          selectAllLabel={selectedWordIds.length === sortedActiveFolderWords.length ? t('common.deselectAll') : t('common.selectAll')}
          onClear={exitWordSelectionMode}
          actions={[
            { key: 'move', label: t('library.move'), variant: 'primary', onClick: openMoveModal, icon: 'move', disabled: selectedWordCount === 0 },
            { key: 'remove', label: t('library.remove'), variant: 'danger', onClick: removeSelectedWords, icon: 'delete', disabled: selectedWordCount === 0 }
          ]}
        />
      )}
    </div>
  );
};

export default LibraryTab;
