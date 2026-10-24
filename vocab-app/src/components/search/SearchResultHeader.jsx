import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Volume2, Sparkles, ChevronDown, Languages, Loader2 } from 'lucide-react';
import ProficiencyDots from '../common/ProficiencyDots';
import WordUsefulness from '../common/WordUsefulness';
import { getAudioUrl } from '../../services/speechService';
import { useTranslation } from 'react-i18next';

const SOURCE_OPTIONS = [
  { value: 'Cambridge', label: 'Cambridge', icon: '🛡️' },
  { value: 'Cambridge Learner', label: "Cambridge Learner's", icon: '📖' },
  { value: 'Yahoo', label: 'Yahoo Dictionary', icon: 'Y!' },
  { value: 'Google Translate', label: 'Google Translate', icon: 'G' },
  { value: 'Groq AI', label: 'Groq AI', icon: '✨' }
];

const EXTERNAL_LINKS = [
  { label: 'Cambridge', url: (word) => `https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(word.toLowerCase().trim())}` },
  { label: "Cambridge Learner's", url: (word) => `https://dictionary.cambridge.org/dictionary/learner-english/${encodeURIComponent(word.toLowerCase().trim())}` },
  { label: 'Oxford Learner\'s', url: (word) => `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.toLowerCase().trim())}` },
  { label: 'Longman', url: (word) => `https://www.ldoceonline.com/dictionary/${encodeURIComponent(word.toLowerCase().trim())}` },
  { label: 'Merriam-Webster', url: (word) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.toLowerCase().trim())}` },
];

const SearchResultHeader = ({
  searchResult,
  preferredAccent,
  onAccentChange,
  onSpeak,
  savedWordInSearch,
  saveButtonFeedback,
  saveButtonLabel,
  saveStep,
  onStartSave,
  onCancelSave,
  onNextSave,
  onBackSave,
  onSearchFullDefinition,
  availableSources,
  onChangeSource,
  isSwitchingSource,
  definitionLanguage = 'zh-TW',
  onChangeDefinitionLanguage,
  relatedContext,
  audioPriority,
  playAudioShortcut = 'Tab',
  previousWord = null,
  onBackInTrail = null
}) => {
  const { t } = useTranslation();
  const shortcutLabel = playAudioShortcut || 'Tab';
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [isExternalLinksOpen, setIsExternalLinksOpen] = useState(false);
  const [isRelatedOpen, setIsRelatedOpen] = useState(false);
  const sourceMenuRef = useRef(null);
  const canSwitchSource = Array.isArray(availableSources) && availableSources.length > 1 && onChangeSource;

  useEffect(() => {
    if (!isSourceMenuOpen) return;
    const handleOutsideClick = (event) => {
      if (!sourceMenuRef.current) return;
      if (!sourceMenuRef.current.contains(event.target)) {
        setIsSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSourceMenuOpen]);

  const renderSourceBadge = (badgeClassName, content) => (
    <div className="relative inline-flex" ref={sourceMenuRef}>
      <button
        type="button"
        onClick={() => {
          if (!canSwitchSource) return;
          setIsSourceMenuOpen((prev) => !prev);
        }}
        disabled={isSwitchingSource || !canSwitchSource}
        className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ${badgeClassName} ${canSwitchSource ? 'hover:opacity-90 cursor-pointer' : ''} disabled:opacity-60`}
        aria-label={t('card.switchSource')}
      >
        <span className="inline-flex items-center gap-1">{content}</span>
        <span className="text-[10px] opacity-75 font-normal tracking-tight">
          ({definitionLanguage === 'en' ? 'EN' : t('card.defZhTwShort', '繁中')})
        </span>
        {canSwitchSource && (
          isSwitchingSource ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ChevronDown className={`w-3 h-3 transition ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
          )
        )}
      </button>
      {canSwitchSource && (
        <div className={`absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30 transition ${isSourceMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
          <div className="py-1">
            {SOURCE_OPTIONS.filter((option) => availableSources.includes(option.value)).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setIsSourceMenuOpen(false);
                  onChangeSource(option.value);
                }}
                disabled={isSwitchingSource || searchResult.source === option.value}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed ${searchResult.source === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
              >
                <span className="text-base">{option.icon}</span>
                {option.label}
                {searchResult.source === option.value && <span className="ml-auto text-[10px] text-blue-600">{t('card.current')}</span>}
              </button>
            ))}
          </div>

          {onChangeDefinitionLanguage && (
            <div className="border-t border-gray-100 p-2 bg-gray-50/70">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5 px-1">
                <span className="flex items-center gap-1 font-medium text-gray-600">
                  <Languages className="w-3.5 h-3.5 text-emerald-600" />
                  {t('card.defLang', '釋義語言')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSourceMenuOpen(false);
                    onChangeDefinitionLanguage('zh-TW');
                  }}
                  disabled={isSwitchingSource || definitionLanguage === 'zh-TW'}
                  className={`py-1 text-xs rounded-md transition text-center ${definitionLanguage === 'zh-TW' ? 'bg-white text-gray-800 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 font-medium'}`}
                >
                  {t('card.defZhTwShort', '繁中')}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSourceMenuOpen(false);
                    onChangeDefinitionLanguage('en');
                  }}
                  disabled={isSwitchingSource || definitionLanguage === 'en'}
                  className={`py-1 text-xs rounded-md transition text-center ${definitionLanguage === 'en' ? 'bg-white text-gray-800 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 font-medium'}`}
                >
                  {t('card.defEnShort', 'EN')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
      {previousWord && onBackInTrail && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onBackInTrail}
            className="group inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>
              {t('card.backToPrevious', '回到上一字')}: <span className="underline font-semibold">{previousWord}</span>
            </span>
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-3">
            {searchResult.word}
            <button
              type="button"
              onClick={() => {
                const effectivePriority = [preferredAccent, ...audioPriority.filter(p => p !== preferredAccent)];
                onSpeak(searchResult.word, getAudioUrl(searchResult, effectivePriority));
              }}
              title={`${t('library.playAudio')} (${shortcutLabel})`}
              aria-label={`${t('library.playAudio')} (${shortcutLabel})`}
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 active:scale-95 transition"
            >
              <Volume2 className="w-5 h-5 text-blue-600" />
            </button>
            {(searchResult.usAudioUrl || searchResult.ukAudioUrl) && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onAccentChange('us');
                    onSpeak(searchResult.word, getAudioUrl(searchResult, ['us']));
                  }}
                  disabled={!searchResult.usAudioUrl}
                  className={`px-2 py-0.5 rounded-full border transition ${preferredAccent === 'us' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
                >
                  US
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAccentChange('uk');
                    onSpeak(searchResult.word, getAudioUrl(searchResult, ['uk']));
                  }}
                  disabled={!searchResult.ukAudioUrl}
                  className={`px-2 py-0.5 rounded-full border transition ${preferredAccent === 'uk' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'} disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`}
                >
                  UK
                </button>
              </div>
            )}
            {savedWordInSearch && (
              <div className="ml-4 flex flex-col items-start">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{t('card.mastery')}</span>
                <ProficiencyDots score={savedWordInSearch.proficiencyScore} />
              </div>
            )}
          </h2>
          <WordUsefulness word={searchResult.word} className="mt-2" />
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
            <span className="italic font-serif bg-white px-2 py-0.5 rounded border border-gray-200">{searchResult.pos}</span>
            <span>{searchResult.phonetic}</span>
            {searchResult.source === 'Cambridge' && renderSourceBadge('bg-blue-100 text-blue-700', '🛡️ Cambridge')}
            {searchResult.source === 'Cambridge Learner' && renderSourceBadge('bg-indigo-100 text-indigo-700', "📖 Cambridge Learner's")}
            {searchResult.source === 'Yahoo' && renderSourceBadge('bg-purple-100 text-purple-700', 'Y! Yahoo')}
            {searchResult.source === 'Groq AI' && renderSourceBadge('bg-teal-100 text-teal-700', (
              <>
                <Sparkles className="w-3 h-3" /> Groq AI
              </>
            ))}
            {searchResult.source === 'Google Translate' && renderSourceBadge('bg-green-100 text-green-700', 'G Google Translate')}
            {searchResult.source === 'Library' && renderSourceBadge('bg-gray-100 text-gray-600', '📚 Library')}
            {searchResult.translatedFrom && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
                {searchResult.translatedFrom} &rarr; {searchResult.word}
              </span>
            )}
          </div>

          {/* Related Words / Context - Collapsible */}
          {((relatedContext?.alternatives?.length > 0) || (searchResult.alternatives && searchResult.alternatives.length > 0)) && (
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              <button
                onClick={() => setIsRelatedOpen(!isRelatedOpen)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition w-full group py-1"
              >
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span className="font-medium">{t('card.relatedWords')}</span>
                {relatedContext && <span className="text-gray-400 font-normal">({t('card.relatedTo', { word: relatedContext.originalWord })})</span>}
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ml-auto ${isRelatedOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRelatedOpen && (
                <div className="mt-2 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  {(relatedContext ? relatedContext.alternatives : searchResult.alternatives).map((alt) => {
                    const isActive = alt.toLowerCase() === searchResult.word.toLowerCase();
                    return (
                      <button
                        key={alt}
                        onClick={() => onSearchFullDefinition ? onSearchFullDefinition(alt) : window.location.search = `?q=${alt}`}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all shadow-sm
                          ${isActive
                            ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-100'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        {alt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {searchResult.source === 'Library' && onSearchFullDefinition && (
            <button
              type="button"
              onClick={onSearchFullDefinition}
              className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('card.viewFullDefinition')}
            </button>
          )}

          {/* External Links - Collapsible */}
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <button
              onClick={() => setIsExternalLinksOpen(!isExternalLinksOpen)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition group"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{t('card.externalLinks')}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExternalLinksOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExternalLinksOpen && (
              <div className="mt-2 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                {EXTERNAL_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.url(searchResult.word)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline bg-white px-2 py-1 rounded border border-blue-100 hover:border-blue-300 transition shadow-sm"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        {saveStep === 'idle' && (
          <button
            onClick={onStartSave}
            className="flex-shrink-0 whitespace-nowrap flex w-auto sm:w-auto items-center justify-center gap-2 bg-green-600 text-white px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg hover:bg-green-700 transition shadow-sm"
          >
            {saveButtonFeedback ? t('card.added') : (saveButtonLabel || t('common.save'))}
          </button>
        )}
        {saveStep === 'selecting' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onCancelSave}
              className="whitespace-nowrap px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onNextSave}
              className="whitespace-nowrap px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              {t('common.next')}
            </button>
          </div>
        )}
        {saveStep === 'folder' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onBackSave}
              className="whitespace-nowrap px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              {t('common.prev')}
            </button>
            <button
              onClick={onCancelSave}
              className="whitespace-nowrap px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>
    </div >
  );
};

export default SearchResultHeader;
