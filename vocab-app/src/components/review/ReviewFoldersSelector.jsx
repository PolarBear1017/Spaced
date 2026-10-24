import { loadFolderPickerSortBy, saveFolderPickerSortBy } from '../../services/storageService';
import { compareRecentFolders } from '../../utils/folderActivity';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, Check, Folder, Search, X, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useSelection from '../../hooks/useSelection';
import useDragSelect from '../../hooks/useDragSelect';

const ReviewFoldersSelector = ({
  sortedFolders, // This is the default sorted list from parent (usually by defaults)
  selectedReviewFolders,
  allFolderIds, // This might need to be ignored in favor of filtered IDs for "Select All"
  setSelectedReviewFolders,
  onBack
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(() => loadFolderPickerSortBy('review'));

  // Filter and Sort Logic
  const processedFolders = useMemo(() => {
    let result = [...sortedFolders];

    // 1. Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(folder => folder.name.toLowerCase().includes(query));
    }

    // 2. Sort
    switch (sortBy) {
      case 'recent_desc':
        result.sort(compareRecentFolders);
        break;
      case 'name_asc':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
        break;
      case 'count_desc':
        result.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
        break;
      case 'created_desc':
      default:
        // Assuming sortedFolders is already sorted by created_desc or similar from parent
        // But if we need to force it:
        // result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        // For now, we rely on parent's sort for 'default' or assume sortedFolders is adequate if no specific sort 
        // actually, let's implement it if data is available, otherwise allow fallback
        result.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        break;
    }
    return result;
  }, [sortedFolders, searchQuery, sortBy]);

  const processedFolderIds = useMemo(() => processedFolders.map(f => f.id), [processedFolders]);

  const {
    selectedIds,
    setSelection,
    toggleSelection
  } = useSelection();

  // Sync props to internal state only on mount
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      const ids = selectedReviewFolders.includes('all') ? allFolderIds : selectedReviewFolders;
      setSelection(ids);
      isFirstRender.current = false;
    }
  }, [allFolderIds, selectedReviewFolders, setSelection]);

  // Sync internal state to parent
  useEffect(() => {
    if (!isFirstRender.current) {
      setSelectedReviewFolders(selectedIds);
    }
  }, [selectedIds, setSelectedReviewFolders]);

  const dragStateRef = useRef({ active: false, mode: 'select' });

  // Handle drag selection logic
  const handleDragSelect = (id) => {
    if (!dragStateRef.current.active) {
      const isSelected = selectedIds.includes(id);
      dragStateRef.current = { active: true, mode: isSelected ? 'deselect' : 'select' };
    }

    const { mode } = dragStateRef.current;
    if (mode === 'select') {
      if (!selectedIds.includes(id)) {
        toggleSelection(id, null, processedFolderIds); // Use processed IDs for drag
      }
    } else {
      if (selectedIds.includes(id)) {
        toggleSelection(id, null, processedFolderIds);
      }
    }
  };

  const { dragHandleProps } = useDragSelect({
    enabled: true,
    onSelect: handleDragSelect,
    onToggle: (id, event) => toggleSelection(id, event, processedFolderIds) // Use processed IDs for Shift-click
  });

  // Reset drag state on pointer up
  const handlePointerUp = (e) => {
    if (dragHandleProps.onPointerUp) dragHandleProps.onPointerUp(e);
    dragStateRef.current = { active: false, mode: 'select' };
  };

  // Select All now applies to Filtered results if search is active? 
  // Standard behavior: Select All usually selects all visible items or all items globally.
  // Let's implement "Select All Visible" for clarity when searching.
  const isAllVisibleSelected = processedFolderIds.length > 0 && processedFolderIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllVisibleSelected) {
      // Deselect visible
      const newSelected = selectedIds.filter(id => !processedFolderIds.includes(id));
      setSelection(newSelected);
    } else {
      // Select visible
      const newSelected = [...new Set([...selectedIds, ...processedFolderIds])];
      setSelection(newSelected);
    }
  };

  return (
    <div className="animate-in slide-in-from-right duration-300 flex flex-col h-full bg-white sm:bg-transparent">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('review.backToSetup')}</span>
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('review.searchFolders')}
              className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-shrink-0">
            <ArrowUpDown className="w-4 h-4" />
            <select
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white w-full sm:w-auto focus:outline-none focus:border-blue-500"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                saveFolderPickerSortBy('review', e.target.value);
              }}
            >
              <option value="recent_desc">{t('card.sortRecent')}</option>
              <option value="created_desc">{t('review.sortLatest')}</option>
              <option value="name_asc">{t('review.sortName')}</option>
              <option value="count_desc">{t('review.sortCount')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Actions */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
          <div className="text-sm font-medium text-gray-700">
            {selectedIds.length > 0 ? t('review.selectedFoldersCount', { count: selectedIds.length }) : t('review.pleaseSelectFolder')}
            {searchQuery && <span className="text-gray-400 font-normal ml-2">{t('review.searchResultsCount', { count: processedFolders.length })}</span>}
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
          >
            {isAllVisibleSelected ? t('common.deselectAll') : t('common.selectAll')}
          </button>
        </div>

        {/* Scrollable List */}
        <div
          className="flex-1 overflow-y-auto"
        >
          <div className="divide-y divide-gray-100">
            {processedFolders.map(folder => (
              <div
                key={folder.id}
                data-select-id={folder.id}
                {...dragHandleProps}
                onPointerDown={(e) => {
                  const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
                  const isCheckbox = e.target.closest('.selection-trigger');

                  if (isTouch && !isCheckbox) {
                    return;
                  }
                  if (dragHandleProps.onPointerDown) dragHandleProps.onPointerDown(e);
                }}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ ...dragHandleProps.style, touchAction: 'pan-y' }}
                onClick={(e) => {
                  toggleSelection(folder.id, e, processedFolderIds);
                }}
                className={`
                group flex items-center gap-3 p-4 hover:bg-gray-50 transition cursor-pointer select-none
                ${selectedIds.includes(folder.id) ? 'bg-blue-50/30' : ''}
              `}
              >
                {/* Checkbox / Drag Handle */}
                <div className="selection-trigger relative flex-shrink-0 flex items-center justify-center py-2 px-1" style={{ touchAction: 'none' }}>
                  <div className={`
                    w-5 h-5 rounded border transition flex items-center justify-center
                    ${selectedIds.includes(folder.id)
                      ? 'bg-blue-600 border-blue-600 shadow-sm'
                      : 'border-gray-300 group-hover:border-blue-400 bg-white'}
                 `}>
                    {selectedIds.includes(folder.id) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <div className={`
                     p-2 rounded-lg flex-shrink-0 transition-colors
                     ${selectedIds.includes(folder.id) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}
                 `}>
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate text-base">{folder.name}</div>
                    {folder.wordCount !== undefined && (
                      <div className="text-sm text-gray-500">{t('common.wordCount', { count: folder.wordCount })}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {processedFolders.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {searchQuery ? t('review.noMatchingFolders', { query: searchQuery }) : t('review.noAvailableFolders')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewFoldersSelector;
