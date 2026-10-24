import React from 'react';
import { Combobox } from '@headlessui/react';
import { Search, X, Loader2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SearchForm = ({
  query,
  onQueryChange,
  onSearch,
  suggestions,
  setSuggestions,
  clearSearchHistory,
  isSearching,
  inputRef,
  onTabAudio,
  playAudioShortcut = 'Tab'
}) => {
  const { t } = useTranslation();
  const userNavigatedRef = React.useRef(false);
  const suggestionOptions = suggestions.map((s) => (
    typeof s === 'string'
      ? { word: s, isHistory: false, matchType: null }
      : {
        word: s.word,
        isHistory: Boolean(s.isHistory),
        matchType: s.matchType ?? null
      }
  ));
  const hasSuggestions = suggestionOptions.length > 0;
  const hasHistory = suggestionOptions.some((item) => item.isHistory);
  const trimmedQuery = query.trim();

  React.useEffect(() => {
    userNavigatedRef.current = false;
  }, [suggestions]);

  const renderHighlightedWord = (word) => {
    if (!trimmedQuery) return word;
    const lowerWord = word.toLowerCase();
    const lowerQuery = trimmedQuery.toLowerCase();
    if (!lowerWord.startsWith(lowerQuery)) return word;
    const prefix = word.slice(0, trimmedQuery.length);
    const rest = word.slice(trimmedQuery.length);
    return (
      <>
        <span className="font-bold">{prefix}</span>
        <span>{rest}</span>
      </>
    );
  };

  return (
    <Combobox
      value={query}
      onChange={(value) => {
        if (!value) return;
        onSearch(value);
        setSuggestions([]);
        inputRef.current?.blur();
      }}
      as="div"
      className="relative"
    >
      {({ activeOption, open }) => {
        const handleKeyDown = (e) => {
          const targetKey = (playAudioShortcut || 'Tab').toLowerCase();
          if (e.key.toLowerCase() === targetKey && onTabAudio) {
            e.preventDefault();
            onTabAudio();
            return;
          }

          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            userNavigatedRef.current = true;
            return;
          }

          if (e.key === 'Enter') {
            // If user hasn't explicitly navigated with keys,
            // treat it as a submission of the current input value, not the selected option
            if (!userNavigatedRef.current) {
              e.preventDefault();
              e.stopPropagation();
              onSearch(query);
              setSuggestions([]);
              inputRef.current?.blur();
              return;
            }

            // Otherwise standard behavior (selects active option)
            if (activeOption) return;

            // Fallback for no active option
            e.preventDefault();
            onSearch(query);
            setSuggestions([]);
            inputRef.current?.blur();
          }
        };

        return (
          <>
            <Combobox.Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                userNavigatedRef.current = false;
                onQueryChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              autoCapitalize="none"
              placeholder={t('search.inputPlaceholder')}
              className={`w-full p-4 pl-12 pr-32 shadow-sm border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition outline-none ${open && hasSuggestions ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}`}
            />
            <Search className="absolute left-4 top-4 text-gray-400" />

            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('');
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                className="absolute right-24 top-4 text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              disabled={isSearching}
              onClick={() => {
                onSearch(query);
                setSuggestions([]);
                inputRef.current?.blur();
              }}
              className="absolute right-3 top-2.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : t('search.searchBtn')}
            </button>

            {open && hasSuggestions && (
              <Combobox.Options className="absolute top-full left-0 right-0 bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-xl z-50 overflow-hidden divide-y divide-gray-100">
                {suggestionOptions.map((item, index) => (
                  <Combobox.Option
                    key={`${item.word}-${index}`}
                    value={item.word}
                    className={({ active }) => `px-4 py-3 cursor-pointer text-gray-700 flex items-center gap-2 transition ${active ? 'bg-blue-50' : ''}`}
                  >
                    <Search className="w-4 h-4 text-gray-300" />
                    <span className={item.isHistory ? 'text-gray-700' : ''}>
                      {renderHighlightedWord(item.word)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {item.matchType === 'fuzzy' && (
                        <span className="text-xs text-gray-400">{t('search.fuzzyCorrection')}</span>
                      )}
                      {item.isHistory && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('search.history')}
                        </span>
                      )}
                    </span>
                  </Combobox.Option>
                ))}
                {hasHistory && (
                  <div className="flex justify-end px-4 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearSearchHistory?.();
                        setSuggestions([]);
                        inputRef.current?.blur();
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      {t('search.clearHistory')}
                    </button>
                  </div>
                )}
              </Combobox.Options>
            )}
          </>
        );
      }}
    </Combobox>
  );
};

export default SearchForm;
