import React from 'react';
import { RefreshCw, ArrowUpDown, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FolderCard from './FolderCard';
import LibraryWordDetail from './LibraryWordDetail';
import { isWordMatch } from '../../utils/data';
import { speak } from '../../services/speechService';

const LibraryOverview = ({
  sortedFolders,
  folderSortBy,
  setFolderSortBy,
  onOpenCreateFolder,
  handleManualSync,
  isDataLoaded,
  isSelectionMode,
  onToggleSelectionMode,
  setSelectedReviewFolders,
  setReviewSetupView,
  setActiveTab,
  generateFolderStory,
  handleDeleteFolder,
  handleEditFolder,
  setViewingFolderId,
  selectedFolderIds,
  onToggleFolder,
  onEnterSelectionMode,
  dragHandleProps,
  entriesByFolderId,
  statsByFolderId,
  onRemoveWordFromFolder,
  onToggleStar,
  onSearchWord
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewingWord, setViewingWord] = React.useState(null);

  const filteredFolders = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedFolders;
    const query = searchQuery.toLowerCase().trim();

    return sortedFolders.filter(folder => {
      // Check for folder name match
      if (folder.name.toLowerCase().includes(query)) return true;

      // Check for matching words inside the folder
      const words = entriesByFolderId[folder.id] || [];
      return words.some(word => isWordMatch(word, searchQuery));
    });
  }, [sortedFolders, searchQuery, entriesByFolderId]);

  return (
    <>
      <header className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t('library.title')}</h1>
            <button onClick={handleManualSync} className="p-2 text-gray-400 hover:text-blue-600 transition rounded-full hover:bg-blue-50" title={t('library.manualSync')}>
              <RefreshCw className={`w-5 h-5 ${!isDataLoaded ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            {searchQuery && (
              <span className="text-gray-500 text-sm">
                {t('library.foundFoldersCount', { count: filteredFolders.length })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onToggleSelectionMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${isSelectionMode ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              {isSelectionMode ? t('library.cancelSelect') : t('library.select')}
            </button>
            <button onClick={onOpenCreateFolder} className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition">
              <Plus className="w-4 h-4" /> {t('library.newFolder')}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('library.searchFolders')}
              autoCapitalize="off"
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
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white w-full sm:w-auto"
              value={folderSortBy}
              onChange={(e) => setFolderSortBy(e.target.value)}
            >
              <option value="recent_desc">{t('card.sortRecent')}</option>
              <option value="created_desc">{t('card.sortLatest')}</option>
              <option value="name_asc">{t('card.sortNameAsc')}</option>
              <option value="count_desc">{t('library.sortWordCount')}</option>
            </select>
          </div>
        </div>
      </header>

      {filteredFolders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFolders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              folderWords={entriesByFolderId[folder.id] || []}
              folderStats={statsByFolderId[folder.id]}
              isSelectionMode={isSelectionMode}
              isSelected={selectedFolderIds.includes(folder.id)}
              dragHandleProps={dragHandleProps}
              onToggleSelect={onToggleFolder}
              onEnterSelectionMode={onEnterSelectionMode}
              onOpen={() => setViewingFolderId(folder.id)}
              onDelete={() => handleDeleteFolder(folder.id)}
              onEdit={() => handleEditFolder(folder)}
              onStartReview={() => {
                setSelectedReviewFolders([folder.id]);
                setReviewSetupView('main');
                setActiveTab('review');
              }}
              onGenerateStory={() => generateFolderStory(folder)}
              searchQuery={searchQuery}
              onOpenWordDetail={(word) => setViewingWord(word)}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
          {searchQuery ? (
            <>
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p>{t('library.noMatchingFoldersForQuery', { query: searchQuery })}</p>
              <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-600 hover:underline text-sm">
                {t('library.clearSearch')}
              </button>
            </>
          ) : (
            <p>{t('library.noFolders')}</p>
          )}
        </div>
      )}

      {viewingWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <LibraryWordDetail
                entry={viewingWord}
                onSpeak={speak}
                onClose={() => setViewingWord(null)}
                onNavigateToSearch={(word) => {
                  if (onSearchWord) onSearchWord(word);
                  setViewingWord(null);
                }}
                onDeleteWord={() => {
                  const folderId = Object.keys(entriesByFolderId).find(fid =>
                    entriesByFolderId[fid].some(w => w.id === viewingWord.id)
                  );
                  if (confirm(t('library.confirmRemoveWordFromDb', { word: viewingWord.word }))) {
                    if (folderId && onRemoveWordFromFolder) {
                      onRemoveWordFromFolder(viewingWord, folderId);
                    }
                    setViewingWord(null);
                  }
                }}
                onToggleStar={onToggleStar}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LibraryOverview;
