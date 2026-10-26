import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ArrowUpDown, Folder, Trash2, Book, Pencil, Search, X, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVocabularyPlayer } from '../../hooks/useVocabularyPlayer';
import { speak } from '../../services/speechService';
import LibraryWordDetail from './LibraryWordDetail';
import { isWordMatch } from '../../utils/data';
import WordRow from './WordRow';
import VocabularyPlayerControls from '../common/VocabularyPlayerControls';

const HighlightedText = ({ text, query }) => {
  if (!query || !text) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={index} className="font-bold text-blue-600 bg-blue-50/50 rounded-sm px-0.5">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

const FolderDetail = ({
  activeFolder,
  wordSortBy,
  setWordSortBy,
  sortedActiveFolderWords,
  activeFolderStats,
  onBack,
  isSelectionMode,
  onToggleSelectionMode,
  onEditFolder,
  onDeleteFolder,
  selectedWordIds,
  onToggleWord,
  onEnterSelectionMode,
  dragHandleProps,
  onRemoveWordFromFolder,
  onToggleStar,
  onSaveDefinitions,
  onGoSearch,
  onSearchWord
}) => {
  const { t } = useTranslation();
  const [viewingWord, setViewingWord] = useState(null); // Keep this state for word detail view
  const [searchQuery, setSearchQuery] = useState('');

  // Filter words based on search query
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return sortedActiveFolderWords;
    return sortedActiveFolderWords.filter(word => isWordMatch(word, searchQuery));
  }, [sortedActiveFolderWords, searchQuery]);

  // Vocabulary Player
  const {
    isPlaying,
    currentWord,
    closePlayer,
    togglePlayback,
    playNext,
    playPrevious,
    playbackState
  } = useVocabularyPlayer(filteredWords);

  // Sync player word with viewing word
  useEffect(() => {
    if (isPlaying && currentWord) {
      // The player owns currentWord; mirror it so detail navigation retains the last played word.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewingWord(currentWord);
    }
  }, [isPlaying, currentWord]);

  const viewingIndex = viewingWord
    ? filteredWords.findIndex((word) => word.id === viewingWord.id)
    : -1;
  const previousWord = viewingIndex > 0 ? filteredWords[viewingIndex - 1] : null;
  const nextWord = viewingIndex >= 0 && viewingIndex < filteredWords.length - 1
    ? filteredWords[viewingIndex + 1]
    : null;

  return (
    <div className="animate-in fade-in slide-in-from-right duration-300">
      {viewingWord ? (
        <div className="mb-4">
          <button
            onClick={() => setViewingWord(null)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
            title={t('library.backToWordList')}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('library.backToWordList')}
          </button>
        </div>
      ) : (
        <header className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition group"
                title={t('library.backToFolders')}
              >
                <ArrowLeft className="w-6 h-6 text-gray-600 group-hover:text-blue-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Folder className="w-6 h-6 text-blue-500" />
                  {activeFolder.name}
                </h1>
                <p className="text-gray-500 text-sm">
                  {searchQuery ? t('library.foundWordsCount', { count: filteredWords.length }) : t('library.wordsCount', { count: activeFolderStats?.count ?? sortedActiveFolderWords.length })}
                </p>
                {activeFolder.description ? (
                  <p className="text-xs text-gray-400 mt-1">{activeFolder.description}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${isPlaying
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                title={isPlaying ? t('library.stopPlayback') : t('library.loopPlayback')}
              >
                <Play className="w-4 h-4 fill-current" />
                {isPlaying ? t('library.playing') : t('library.play')}
              </button>

              <button
                onClick={onToggleSelectionMode}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${isSelectionMode ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {isSelectionMode ? t('library.cancelSelect') : t('library.select')}
              </button>
              {onEditFolder && !isSelectionMode && (
                <button
                  onClick={onEditFolder}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition"
                  title={t('library.editFolder')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onDeleteFolder && !isSelectionMode && (
                <button
                  onClick={onDeleteFolder}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition"
                  title={t('library.deleteFolder')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('library.searchWordsInFolder')}
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
                value={wordSortBy}
                onChange={(e) => setWordSortBy(e.target.value)}
              >
                <option value="added_desc">{t('library.sortAddedDesc')}</option>
                <option value="alphabetical_asc">{t('library.sortAlphaAsc')}</option>
                <option value="proficiency_asc">{t('library.sortProficiencyAsc')}</option>
                <option value="next_review_asc">{t('library.sortNextReviewAsc')}</option>
              </select>
            </div>
          </div>
        </header>
      )}

      {viewingWord ? (
        <LibraryWordDetail
          entry={viewingWord}
          onSpeak={speak}
          onNavigateToSearch={onSearchWord}
          onPrevWord={previousWord ? () => setViewingWord(previousWord) : null}
          onNextWord={nextWord ? () => setViewingWord(nextWord) : null}
          hasPrevWord={Boolean(previousWord)}
          hasNextWord={Boolean(nextWord)}
          isPlaying={isPlaying}
          onDeleteWord={() => {
            if (confirm(t('library.confirmRemoveWordFromFolder', { word: viewingWord.word, folder: activeFolder.name }))) {
              onRemoveWordFromFolder(viewingWord, activeFolder.id);
              setViewingWord(null);
            }
          }}
          onToggleStar={onToggleStar}
          onSaveDefinitions={async (word, definitions) => {
            const saved = await onSaveDefinitions?.(word, definitions);
            if (saved) setViewingWord(current => current?.id === word.id ? saved : current);
            return saved;
          }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredWords.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredWords.map(word => (
                <WordRow
                  key={word.id}
                  word={word}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedWordIds.includes(word.id)}
                  dragHandleProps={dragHandleProps}
                  onToggleSelect={onToggleWord}
                  onEnterSelectionMode={onEnterSelectionMode}
                  onOpenDetail={setViewingWord}
                  onRemoveWordFromFolder={onRemoveWordFromFolder}
                  activeFolder={activeFolder}
                  searchQuery={searchQuery}
                  onToggleStar={onToggleStar}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 mb-3 opacity-20" />
                  <p>{t('library.noMatchingWordsForQuery', { query: searchQuery })}</p>
                  <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-600 hover:underline text-sm">
                    {t('library.clearSearch')}
                  </button>
                </>
              ) : (
                <>
                  <Book className="w-12 h-12 mb-3 opacity-20" />
                  <p>{t('library.folderEmpty')}</p>
                  <button onClick={onGoSearch} className="mt-4 text-blue-600 hover:underline text-sm">
                    {t('library.goSearchAndAdd')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <VocabularyPlayerControls
        isPlaying={isPlaying}
        currentWord={currentWord}
        playbackState={playbackState}
        onTogglePlay={togglePlayback}
        onNext={playNext}
        onPrev={playPrevious}
        onClose={closePlayer}
      />
    </div>
  );
};

export default FolderDetail;
