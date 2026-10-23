import { compareRecentFolders } from '../../utils/folderActivity';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Circle, FileText, Info, Plus, Search, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FolderSelectionList = ({
  folders,
  isDataLoaded = true,
  savedFolderIds,
  lastUsedFolderIds,
  initialSelectedIds,
  searchWord,
  onConfirm,
  onCancel,
  onEditDefinitions,
  onSelectionChange,
  hasDefinitionChanges,
  onCreateFolder
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [folderSortBy, setFolderSortBy] = useState('created_desc');
  const [isCreating, setIsCreating] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showShortcutTip, setShowShortcutTip] = useState(false);
  const tooltipRef = useRef(null);
  const shortcutTipRef = useRef(null);
  const lastNotifiedSelection = useRef('');
  const confirmLockRef = useRef(false);

  const normalizedQuery = query.trim();
  const normalizedCreateValue = createValue.trim();

  const savedFolderIdList = useMemo(() => (
    Array.isArray(savedFolderIds) ? savedFolderIds : []
  ), [savedFolderIds]);

  const savedIdSet = useMemo(() => new Set(
    savedFolderIdList.map((id) => id?.toString()).filter(Boolean)
  ), [savedFolderIdList]);

  const validFolderIdSet = useMemo(() => new Set(
    (folders || []).map((folder) => folder?.id?.toString()).filter(Boolean)
  ), [folders]);

  const initialSelected = useMemo(() => {
    const combined = new Set();

    // Add saved folders (Green)
    if (savedIdSet.size > 0) {
      savedIdSet.forEach(id => combined.add(id));
    }

    // Add last used folders (Blue)
    if (Array.isArray(lastUsedFolderIds)) {
      lastUsedFolderIds.forEach(id => {
        const strId = id?.toString();
        if (strId) combined.add(strId);
      });
    }

    // Filter by valid folders
    return Array.from(combined).filter((id) => validFolderIdSet.has(id));
  }, [lastUsedFolderIds, savedIdSet, validFolderIdSet]);

  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelected));

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validFolderIdSet.has(id)));
      if (onSelectionChange) {
        const snapshot = Array.from(next).sort().join('|');
        if (snapshot !== lastNotifiedSelection.current) {
          lastNotifiedSelection.current = snapshot;
          onSelectionChange(Array.from(next));
        }
      }
      return next;
    });
  }, [validFolderIdSet, onSelectionChange]);

  useEffect(() => {
    if (!showTooltip) return;
    const handleOutsideClick = (event) => {
      if (!tooltipRef.current) return;
      if (!tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showTooltip]);

  useEffect(() => {
    if (!showShortcutTip) return;
    const handleOutsideClick = (event) => {
      if (!shortcutTipRef.current) return;
      if (!shortcutTipRef.current.contains(event.target)) {
        setShowShortcutTip(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showShortcutTip]);

  const sortedFolders = useMemo(() => {
    let copy = [...(folders || [])];
    if (folderSortBy === 'recent_desc') {
      return copy.sort(compareRecentFolders);
    }
    if (folderSortBy === 'name_asc') {
      copy.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
    } else {
      if (copy.length > 0 && copy[0].created_at) {
        copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      } else {
        copy.reverse();
      }
    }
    const saved = [];
    const newlySelected = [];
    const unsaved = [];
    copy.forEach((folder) => {
      const idStr = folder.id?.toString();
      if (savedIdSet.has(idStr)) {
        saved.push(folder);
      } else if (selectedIds.has(idStr)) {
        newlySelected.push(folder);
      } else {
        unsaved.push(folder);
      }
    });
    return [...newlySelected, ...saved, ...unsaved];
  }, [folders, savedIdSet, selectedIds, folderSortBy]);

  const filteredFolders = useMemo(() => {
    if (!normalizedQuery) return sortedFolders;
    const needle = normalizedQuery.toLowerCase();
    return sortedFolders.filter((folder) => (folder.name || '').toLowerCase().includes(needle));
  }, [normalizedQuery, sortedFolders]);

  const hasExactMatch = useMemo(() => {
    if (!normalizedQuery) return false;
    const needle = normalizedQuery.toLowerCase();
    return (folders || []).some((folder) => (folder.name || '').toLowerCase() === needle);
  }, [folders, normalizedQuery]);

  const showCreateFromQuery = normalizedQuery.length > 0 && !hasExactMatch;

  const handleCreate = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed || !onCreateFolder) return;

    setIsSubmitting(true);
    try {
      const created = await onCreateFolder({ name: trimmed });
      const createdId = typeof created === 'string' ? created : created?.id;
      if (!createdId) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(createdId?.toString());
        if (onSelectionChange) {
          const snapshot = Array.from(next).sort().join('|');
          if (snapshot !== lastNotifiedSelection.current) {
            lastNotifiedSelection.current = snapshot;
            onSelectionChange(Array.from(next));
          }
        }
        return next;
      });
      setQuery('');
      setCreateValue('');
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFolder = (folderId) => {
    const normalizedId = folderId?.toString();
    if (!normalizedId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      if (onSelectionChange) {
        const snapshot = Array.from(next).sort().join('|');
        if (snapshot !== lastNotifiedSelection.current) {
          lastNotifiedSelection.current = snapshot;
          onSelectionChange(Array.from(next));
        }
      }
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    const selected = selectedIds;
    if (selected.size !== savedIdSet.size) return true;
    for (const id of selected) {
      if (!savedIdSet.has(id)) return true;
    }
    return false;
  }, [savedIdSet, selectedIds]);

  const handleConfirm = async () => {
    if (!onConfirm || isConfirming || confirmLockRef.current) return;
    confirmLockRef.current = true;
    const selected = Array.from(selectedIds).filter((id) => validFolderIdSet.has(id));
    const addIds = selected.filter((id) => !savedIdSet.has(id));
    const removeIds = Array.from(savedIdSet).filter((id) => !selectedIds.has(id));

    setIsConfirming(true);
    try {
      await onConfirm({
        addIds,
        removeIds,
        selectedIds: selected,
        searchWord
      });
    } finally {
      setIsConfirming(false);
      confirmLockRef.current = false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (!onConfirm) return;
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
      if (isTypingField) return;
      if (!(hasChanges || hasDefinitionChanges) || isConfirming || (selectedIds.size === 0 && savedIdSet.size === 0)) return;
      event.preventDefault();
      handleConfirm();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm, hasChanges, hasDefinitionChanges, isConfirming, onConfirm, onCancel, selectedIds.size, savedIdSet.size]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-gray-500">{t('card.saveTo')}</h4>
          <button
            type="button"
            onClick={() => setShowShortcutTip((prev) => !prev)}
            className="relative group"
            ref={shortcutTipRef}
            aria-label={t('card.shortcutTips')}
          >
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div
              className={`absolute left-0 top-full mt-2 w-64 p-3 bg-white text-gray-700 text-xs rounded-xl shadow-xl border border-gray-100 transition-all duration-200 z-50 space-y-2 ${showShortcutTip ? 'opacity-100 visible' : 'opacity-0 invisible'
                } group-hover:opacity-100 group-hover:visible`}
            >
              <div className="font-bold text-gray-800 flex items-center gap-1.5">
                <span>{t('card.shortcutTitle')}</span>
              </div>
              <div className="space-y-1.5 text-gray-600">
                <div className="flex items-center justify-between gap-2">
                  <span>{t('card.confirmSave')}</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[11px] font-mono text-gray-700 shadow-sm">Enter</kbd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t('card.closeOrCancel')}</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[11px] font-mono text-gray-700 shadow-sm">ESC</kbd>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                {t('card.shortcutNote')}
              </p>
              <div className="absolute left-3 bottom-full w-0 h-0 border-4 border-transparent border-b-white" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowTooltip((prev) => !prev)}
            className="relative group"
            ref={tooltipRef}
          >
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className={`absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg transition-all duration-200 z-50 pointer-events-none ${showTooltip ? 'opacity-100 visible' : 'opacity-0 invisible'
              } group-hover:opacity-100 group-hover:visible`}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span>{t('card.greenCheckTip')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-blue-400" />
                <span>{t('card.blueCheckTip')}</span>
              </div>
              <div className="absolute left-2 top-full w-0 h-0 border-4 border-transparent border-t-gray-800" />
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {onEditDefinitions && (
            <button
              type="button"
              onClick={onEditDefinitions}
              title={t('card.editSavedDefinitions')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating((prev) => !prev)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${isCreating
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('card.searchOrCreateFolder')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-600 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4" />
          <select
            className="border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={folderSortBy}
            onChange={(e) => setFolderSortBy(e.target.value)}
          >
            <option value="recent_desc">{t('card.sortRecent')}</option>
            <option value="created_desc">{t('card.sortLatest')}</option>
            <option value="name_asc">{t('card.sortNameAsc')}</option>
          </select>
        </div>
      </div>

      {isCreating && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={createValue}
            onChange={(event) => setCreateValue(event.target.value)}
            placeholder={t('card.inputFolderName')}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={() => handleCreate(normalizedCreateValue)}
            disabled={isSubmitting || !normalizedCreateValue}
            className="px-3 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.create')}
          </button>
        </div>
      )}

      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {showCreateFromQuery && (
          <button
            type="button"
            onClick={() => handleCreate(normalizedQuery)}
            disabled={isSubmitting}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 transition"
          >
            <Plus className="w-4 h-4" />
            {t('card.createNamedFolder', { name: normalizedQuery })}
          </button>
        )}

        {filteredFolders.length === 0 && !showCreateFromQuery && (
          <div className="px-4 py-3 text-sm text-gray-400 text-center">
            {t('card.noMatchingFolders')}
          </div>
        )}

        {filteredFolders.map((folder) => {
          const normalizedId = folder.id?.toString();
          const isSelected = selectedIds.has(normalizedId);
          const isPreExisting = savedIdSet.has(normalizedId);
          const status = isSelected ? (isPreExisting ? 'preexisting' : 'new') : 'unselected';
          const rowClassName = status === 'preexisting'
            ? 'bg-green-50 border-green-200 hover:bg-green-100'
            : status === 'new'
              ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
              : 'bg-white border-gray-200 hover:bg-gray-50';
          const textClassName = status === 'preexisting'
            ? 'text-green-700'
            : status === 'new'
              ? 'text-blue-700'
              : 'text-gray-800';
          const iconClassName = status === 'preexisting'
            ? 'text-green-600'
            : status === 'new'
              ? 'text-blue-600'
              : 'text-gray-300';
          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => handleToggleFolder(folder.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition flex items-center justify-between gap-3 ${rowClassName}`}
            >
              <span className={`font-medium ${textClassName}`}>{folder.name}</span>
              {isSelected ? (
                <CheckCircle className={`w-4 h-4 ${iconClassName}`} />
              ) : (
                <Circle className={`w-4 h-4 ${iconClassName}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            {t('common.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isDataLoaded || !(hasChanges || hasDefinitionChanges) || isConfirming || (selectedIds.size === 0 && savedIdSet.size === 0)}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConfirming ? t('common.saving') : !isDataLoaded ? t('common.loadingData') : t('common.confirm')}
        </button>
      </div>
    </div>
  );
};

export default FolderSelectionList;
