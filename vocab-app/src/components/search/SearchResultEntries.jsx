import React from 'react';
import { Check, Volume2, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseExampleItem } from '../../utils/data';
import { highlightWord, highlightWithCollocation } from '../../utils/text.jsx';
import { speak } from '../../services/speechService';
import { useSettingsContext } from '../../contexts/SettingsContext';
import DefinitionActions from './DefinitionActions';

const SearchResultEntries = ({
  normalizedEntries,
  searchWord,
  selectedEntryIndices,
  onToggleEntry,
  onToggleAll,
  allSelected,
  readOnly = false,
  onDeleteEntry,
  onSearchCollocation,
  onToggleSavedDefinition,
  isSavingDefinition = false
}) => {
  const { t } = useTranslation();
  const { state: { audioSpeed } } = useSettingsContext();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-400 uppercase">{t('card.definitionsAndExamples')}</h3>
        {normalizedEntries.length > 0 && !readOnly && (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            {allSelected ? t('common.clear') : t('common.selectAll')}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {normalizedEntries.map((entry, index) => {
          const isSelected = readOnly
            ? true
            : (selectedEntryIndices === null
              ? true
              : selectedEntryIndices.has(index));
          const isSaved = Boolean(entry.isSaved);
          const baseClassName = 'rounded-xl p-4 transition';
          const interactiveClassName = readOnly
            ? (isSaved
              ? 'border-2 border-blue-500 bg-blue-50/20 shadow-sm'
              : 'border border-gray-100 bg-white')
            : (isSelected
              ? 'border-2 border-blue-500 bg-blue-50/50 cursor-pointer'
              : 'border border-gray-200 bg-white opacity-60 cursor-pointer');

          const content = (
            <div
              key={`${entry.definition}-${index}`}
              role={readOnly ? undefined : 'button'}
              tabIndex={readOnly ? undefined : 0}
              onClick={readOnly ? undefined : () => onToggleEntry?.(index)}
              onKeyDown={readOnly ? undefined : (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleEntry?.(index);
                }
              }}
              className={`relative ${baseClassName} ${interactiveClassName} ${onToggleSavedDefinition ? 'pb-10' : ''}`}
            >
              {!readOnly && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {entry.isCustom && onDeleteEntry && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition z-10"
                      title={t('card.deleteCustomDefinition')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-transparent'
                    }`}>
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </div>
              )}
              {readOnly && isSaved && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t('common.saved')}</span>
                </div>
              )}
              <div className={readOnly ? (isSaved ? 'pr-20' : '') : 'pr-10'}>
                {(entry.translation || entry.definition) && (
                  <p className="text-lg text-gray-800 font-medium flex items-center gap-2">
                    {entry.translation || entry.definition}
                    {entry.pos && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-serif italic">
                        {entry.pos}
                      </span>
                    )}
                  </p>
                )}
                {entry.translation && entry.definition && <p className="text-gray-600 mt-1">{entry.definition}</p>}
              </div>
              {entry.examples && entry.examples.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-2">
                  {entry.examples.map((example, exampleIndex) => {
                    const { text, collocation, lines } = parseExampleItem(example);
                    const textToSpeak = text || lines[0] || '';

                    return (
                      <div key={`${index}-ex-${exampleIndex}`} className="space-y-1">
                        {collocation && (
                          <div className="pl-7">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSearchCollocation) onSearchCollocation(collocation);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-100/90 hover:bg-amber-200 text-amber-800 hover:text-amber-900 rounded-full border border-amber-200/80 shadow-2xs transition-all cursor-pointer group"
                              title={`${t('common.search', '搜尋')} "${collocation}"`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block group-hover:scale-125 transition-transform" />
                              {t('card.collocation', '搭配')}: {collocation}
                              <Search className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 ml-0.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-start gap-2 group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              speak(textToSpeak, null, { rate: audioSpeed || 1.0 });
                            }}
                            className="mt-0.5 p-1 text-gray-300 hover:text-amber-600 hover:bg-amber-100 rounded-full transition-colors focus:opacity-100"
                            title={t('card.playExampleAudio')}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <p className="text-gray-700 flex-1 leading-relaxed">
                            {lines.map((line, lineIndex) => {
                              const isEnglishSentence = lineIndex === 0;
                              return (
                                <React.Fragment key={`${index}-ex-${exampleIndex}-line-${lineIndex}`}>
                                  {isEnglishSentence
                                    ? highlightWithCollocation(line, searchWord, collocation)
                                    : highlightWord(line, searchWord)}
                                  {lineIndex < lines.length - 1 && <br />}
                                </React.Fragment>
                              );
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          return onToggleSavedDefinition ? (
            <DefinitionActions key={`${entry.definition}-${index}`} isSaved={isSaved}
              disabled={isSavingDefinition} onToggle={() => onToggleSavedDefinition(entry)}>
              {content}
            </DefinitionActions>
          ) : content;
        })}
        {normalizedEntries.length === 0 && (
          <p className="text-gray-500">{t('card.noDefinitions')}</p>
        )}
      </div>
    </div>
  );
};

export default SearchResultEntries;
