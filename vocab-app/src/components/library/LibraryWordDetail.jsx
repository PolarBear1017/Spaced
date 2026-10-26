import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Pencil, Search, Sparkles, Trash2, Volume2, Play, X, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProficiencyDots from '../common/ProficiencyDots';
import WordUsefulness from '../common/WordUsefulness';
import SearchResultEntries from '../search/SearchResultEntries';
import { normalizeEntries } from '../../utils/data';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { toast } from 'react-hot-toast';

const LibraryWordDetail = ({
  entry,
  onSpeak,
  onNavigateToSearch,
  onPrevWord,
  onNextWord,
  hasPrevWord,
  hasNextWord,
  onEditWord,
  onDeleteWord,
  isPlaying = false,
  onClose,
  onToggleStar,
  onSaveDefinitions
}) => {
  const { t } = useTranslation();
  const [preferredAccent, setPreferredAccent] = useState('us');
  const [tipOpen, setTipOpen] = useState(false);
  const [isSavingDefinition, setIsSavingDefinition] = useState(false);
  const savingRef = useRef(false);
  const tipRef = useRef(null);
  const entries = useMemo(() => {
    const selectedDefs = Array.isArray(entry?.selectedDefinitions)
      ? entry.selectedDefinitions
      : (Array.isArray(entry?.selected_definitions)
        ? entry.selected_definitions
        : null);
    if (selectedDefs) {
      return normalizeEntries({ entries: selectedDefs });
    }
    return normalizeEntries(entry || {});
  }, [entry]);

  const { state: settingsState } = useSettingsContext();
  const playAudioShortcut = settingsState?.playAudioShortcut || 'Tab';

  const masteryLevel = Number.isFinite(entry?.proficiencyScore) ? entry.proficiencyScore : 0;
  const hasAccentToggle = true;
  const generalSource = entry?.audioUrl || entry?.audio_url || null;
  const usSource = entry?.usAudioUrl || entry?.us_audio_url || null;
  const ukSource = entry?.ukAudioUrl || entry?.uk_audio_url || null;
  const hasUsAudio = Boolean(usSource || generalSource);
  const hasUkAudio = Boolean(ukSource || generalSource);
  const preferredAudio = preferredAccent === 'uk'
    ? (ukSource || generalSource || usSource)
    : (usSource || generalSource || ukSource);
  const hasAnyAudio = Boolean(usSource || ukSource || generalSource);
  const resolvedSource = entry?.source
    || (entry?.isAiGenerated ? 'Groq AI' : (hasAnyAudio ? 'Cambridge' : 'Library'));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.target?.closest?.('[role="menu"], [aria-haspopup="menu"]')) return;
      if (event.key.toLowerCase() === playAudioShortcut.toLowerCase()) {
        event.preventDefault();
        onSpeak?.(entry.word, preferredAudio);
        return;
      }
      if (event.defaultPrevented) return;
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
      if (event.key === 'ArrowLeft' && hasPrevWord) {
        event.preventDefault();
        onPrevWord?.();
      }
      if (event.key === 'ArrowRight' && hasNextWord) {
        event.preventDefault();
        onNextWord?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNextWord, hasPrevWord, onNextWord, onPrevWord, entry?.word, preferredAudio, onSpeak, playAudioShortcut]);

  useEffect(() => {
    if (!tipOpen) return;
    const handlePointerDown = (event) => {
      if (!tipRef.current) return;
      if (tipRef.current.contains(event.target)) return;
      setTipOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [tipOpen]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-3">
              {entry.word}
              <button
                type="button"
                onClick={() => onSpeak?.(entry.word, preferredAudio)}
                className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 active:scale-95 transition"
                title={`${t('library.playAudio')} (${playAudioShortcut})`}
                aria-label={`${t('library.playAudio')} (${playAudioShortcut})`}
              >
                <Volume2 className="w-5 h-5 text-blue-600" />
              </button>
              <button
                type="button"
                onClick={() => onToggleStar?.(entry)}
                className={`p-2 bg-white rounded-full shadow-sm active:scale-95 transition-all duration-200 ${
                  entry.isStarred 
                    ? 'text-amber-500 hover:text-amber-600 hover:scale-110' 
                    : 'text-gray-300 hover:text-amber-400 hover:scale-110'
                }`}
                title={entry.isStarred ? t('library.unstar') : t('library.star')}
                aria-label={entry.isStarred ? t('library.unstar') : t('library.star')}
              >
                <Star className={`w-5 h-5 ${entry.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
              {hasAccentToggle && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => hasUsAudio && setPreferredAccent('us')}
                    className={`px-2 py-0.5 rounded-full border transition ${preferredAccent === 'us' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
                      } ${hasUsAudio ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    US
                  </button>
                  <button
                    type="button"
                    onClick={() => hasUkAudio && setPreferredAccent('uk')}
                    className={`px-2 py-0.5 rounded-full border transition ${preferredAccent === 'uk' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
                      } ${hasUkAudio ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    UK
                  </button>
                </div>
              )}
              <div className="ml-1 flex flex-col items-start">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{t('card.mastery')}</span>
                <ProficiencyDots score={masteryLevel} />
              </div>
            </h2>
            <WordUsefulness word={entry.word} className="mt-2" />
            {isPlaying && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full animate-pulse my-1">
                <Play className="w-3 h-3 fill-current" />
                <span>{t('library.autoPlaying')}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
              <span className="italic font-serif bg-white px-2 py-0.5 rounded border border-gray-200">{entry.pos}</span>
              <span>{entry.phonetic}</span>
              {resolvedSource === 'Cambridge' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">🛡️ Cambridge</span>
              )}
              {resolvedSource === 'Cambridge Learner' && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">📖 Cambridge Learner</span>
              )}
              {resolvedSource === 'Groq AI' && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Groq AI
                </span>
              )}
              {resolvedSource === 'AI' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI
                </span>
              )}
              {resolvedSource === 'Library' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  📚 Library
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateToSearch?.(entry.word)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition"
            >
              <Search className="w-3.5 h-3.5" />
              {t('card.viewFullDefinition')}
            </button>
          </div>
          {(onPrevWord || onNextWord || onEditWord || onDeleteWord || onClose) && (
            <div className="flex items-center gap-2">
              {(onPrevWord || onNextWord) && (
                <div className="flex items-center gap-1 mr-1">
                  <div className="relative" ref={tipRef}>
                    <button
                      type="button"
                      onClick={() => setTipOpen((prev) => !prev)}
                      onMouseEnter={() => setTipOpen(true)}
                      onMouseLeave={() => setTipOpen(false)}
                      onFocus={() => setTipOpen(true)}
                      onBlur={() => setTipOpen(false)}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-full text-gray-500 bg-white hover:bg-gray-50 transition"
                      aria-label={t('library.showTip')}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {tipOpen && (
                      <div
                        role="tooltip"
                        className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg bg-white px-3 py-2 text-xs text-gray-900 shadow-lg"
                      >
                        {t('library.keyboardNavTip')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onPrevWord || undefined}
                    className={`p-2 rounded-full transition ${hasPrevWord ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                      }`}
                    title={t('common.prev')}
                    disabled={!hasPrevWord}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextWord || undefined}
                    className={`p-2 rounded-full transition ${hasNextWord ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                      }`}
                    title={t('common.next')}
                    disabled={!hasNextWord}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {onEditWord && (
                <button
                  type="button"
                  onClick={onEditWord}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition"
                  title={t('library.editWord')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onDeleteWord && (
                <button
                  type="button"
                  onClick={onDeleteWord}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition"
                  title={t('library.deleteWord')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                  title={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <SearchResultEntries key={entry.id} normalizedEntries={entries.map(item => ({ ...item, isSaved: true }))} searchWord={entry.word} readOnly
          isSavingDefinition={isSavingDefinition}
          onToggleSavedDefinition={onSaveDefinitions ? async (definition) => {
            if (savingRef.current) return;
            savingRef.current = true;
            setIsSavingDefinition(true);
            try {
              const targetIndex = entries.findIndex(item => item.definition === definition.definition && item.translation === definition.translation);
              const remaining = entries.filter((_, index) => index !== targetIndex);
              const result = await onSaveDefinitions(entry, remaining);
              if (result) toast.success(t('card.definitionRemovedToast'));
            } catch {
              toast.error(t('card.saveFailedToast'));
            } finally {
              savingRef.current = false;
              setIsSavingDefinition(false);
            }
          } : undefined} />

        {(entry.mnemonics || entry.notes) && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-gray-700 space-y-2">
            {entry.mnemonics && (
              <div>
                <div className="text-xs font-bold text-amber-700 uppercase mb-1">{t('library.mnemonics')}</div>
                <p>{entry.mnemonics}</p>
              </div>
            )}
            {entry.notes && (
              <div>
                <div className="text-xs font-bold text-amber-700 uppercase mb-1">{t('library.notes')}</div>
                <p>{entry.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryWordDetail;
