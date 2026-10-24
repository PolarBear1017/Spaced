import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AI_ERROR_CODES, fetchDefinition, fetchMnemonic } from '../../services/aiService';
import { fetchDictionaryEntry, fetchSuggestions, fetchRelatedWords } from '../../services/dictionaryService';
import { MOCK_DICTIONARY_DB } from '../../utils/mockData';
import {
  toSearchResultFromAi,
  toSearchResultFromDictionary
} from '../../domain/mappers/searchResultMapper';
import { createSearchResult } from '../../domain/models';
import { normalizeEntries } from '../../utils/data';
import i18n from '../../i18n/config';
import { toast } from 'react-hot-toast';

const SEARCH_HISTORY_KEY = 'vocab_search_history';
const HISTORY_LIMIT = 50;
const SUGGESTION_LIMIT = 5;

const loadSearchHistory = () => {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.word === 'string');
  } catch (error) {
    console.warn('Failed to load search history', error);
    return [];
  }
};

const saveSearchHistory = (history) => {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save search history', error);
  }
};

const removeSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.warn('Failed to remove search history', error);
  }
};

const useSearch = ({ apiKeys, settings, definitionLanguage: propDefLang, onSearchStart, onRequireApiKeys }) => {
  const definitionLanguage = propDefLang || settings?.state?.definitionLanguage || 'zh-TW';
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory());
  const [saveButtonFeedback, setSaveButtonFeedback] = useState(false);
  const [relatedContext, setRelatedContext] = useState(null);
  const [searchTrail, setSearchTrail] = useState([]);

  const ignoreNextQueryUpdate = useRef(false);
  const searchInputRef = useRef(null);
  const activeSearchWordRef = useRef('');
  const searchResultRef = useRef(searchResult);

  useEffect(() => {
    searchResultRef.current = searchResult;
  }, [searchResult]);

  useEffect(() => {
    // Feedback belongs to the currently displayed result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveButtonFeedback(false);
  }, [searchResult?.word]);

  useEffect(() => {
    if (ignoreNextQueryUpdate.current) {
      ignoreNextQueryUpdate.current = false;
      return;
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 2) {
      // Clear stale suggestions immediately when the query is no longer searchable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }

    const historyMatches = searchHistory
      .filter((item) => item.word.toLowerCase().startsWith(normalizedQuery))
      .map((item) => ({ word: item.word, isHistory: true }))
      .slice(0, SUGGESTION_LIMIT);

    setSuggestions(historyMatches);

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const data = await fetchSuggestions(normalizedQuery, { signal: controller.signal });
        if (!controller.signal.aborted) {
          const remoteSuggestions = (data || [])
            .map((item) => ({
              word: typeof item === 'string' ? item : item.word,
              isHistory: false,
              matchType: typeof item === 'string' ? null : item.match_type,
              score: typeof item === 'string' ? null : item.score
            }))
            .filter((item) => item.word);

          const seen = new Set();
          const merged = [...historyMatches, ...remoteSuggestions].filter((item) => {
            const key = item.word.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          setSuggestions(merged.slice(0, SUGGESTION_LIMIT));
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Suggestion fetch failed', error);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, searchHistory]);

  const updateSearchHistory = useCallback((word) => {
    const normalized = word.trim();
    if (!normalized) return;
    setSearchHistory((prev) => {
      const next = [
        { word: normalized, lastUsed: Date.now() },
        ...prev.filter((item) => item.word.toLowerCase() !== normalized.toLowerCase())
      ].slice(0, HISTORY_LIMIT);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    removeSearchHistory();
  }, []);

  const setQuerySilently = useCallback((value) => {
    ignoreNextQueryUpdate.current = true;
    setQuery(value);
  }, []);

  const createSourceFallback = useCallback((word, source, message) => {
    const fallback = {
      word,
      pos: 'unknown',
      phonetic: '/?/',
      definition: message,
      translation: '',
      example: '',
      similar: [],
      audioUrl: null,
      usAudioUrl: null,
      ukAudioUrl: null,
      mnemonics: null,
      isAiGenerated: false,
      source
    };

    return createSearchResult({
      ...fallback,
      entries: normalizeEntries(fallback)
    });
  }, []);

  const triggerAutoMnemonic = useCallback(async (word, definition) => {
    if (!apiKeys?.groqKey || !word) return;

    setAiLoading(true);
    try {
      const mnemonics = await fetchMnemonic({
        groqKey: apiKeys.groqKey,
        word,
        definition: definition || '',
        targetLang: definitionLanguage
      });

      if (activeSearchWordRef.current.trim().toLowerCase() === word.trim().toLowerCase()) {
        setSearchResult((prev) => {
          if (!prev || prev.word.trim().toLowerCase() !== word.trim().toLowerCase()) return prev;
          return {
            ...prev,
            mnemonics,
            isAiGenerated: true
          };
        });
      }
    } catch (error) {
      console.warn(`[AutoMnemonic] Failed to fetch mnemonic for ${word}:`, error);
    } finally {
      setAiLoading(false);
    }
  }, [apiKeys, definitionLanguage]);

  const triggerWordRelations = useCallback(async (word, existingFamily = null, existingSimilar = []) => {
    if (!word || word.trim().length < 2) return;
    const clean = word.trim().toLowerCase();

    const hasFamily = existingFamily && Object.values(existingFamily).some((arr) => Array.isArray(arr) && arr.length > 0);
    const hasSimilar = Array.isArray(existingSimilar) && existingSimilar.length > 0;
    if (hasFamily && hasSimilar) return;

    try {
      const rel = await fetchRelatedWords(clean);
      if (!rel) return;

      if (activeSearchWordRef.current.trim().toLowerCase() === clean) {
        setSearchResult((prev) => {
          if (!prev || prev.word.trim().toLowerCase() !== clean) return prev;
          return {
            ...prev,
            wordFamily: prev.wordFamily || rel.wordFamily,
            similar: (Array.isArray(prev.similar) && prev.similar.length > 0) ? prev.similar : rel.synonyms
          };
        });
      }
    } catch (e) {
      console.warn('[WordRelations] fetch failed:', e);
    }
  }, []);

  const runSearch = useCallback(async ({ searchTerm, forceSource, targetLangOverride }) => {
    activeSearchWordRef.current = searchTerm;
    updateSearchHistory(searchTerm);
    setSuggestions([]);
    if (onSearchStart) onSearchStart();

    setIsSearching(true);
    setSearchResult(null);
    setSearchError(null);
    setAiError(null);

    const lowerQuery = searchTerm.toLowerCase();
    const activeTargetLang = targetLangOverride || definitionLanguage;

    const updateResult = (result) => {
      setSearchResult(result);
      triggerWordRelations(result.word, result.wordFamily, result.similar);

      if (result.translatedFrom) {
        if (result.alternatives?.length > 0) {
          setRelatedContext({
            originalWord: result.translatedFrom,
            alternatives: result.alternatives
          });
        } else {
          setRelatedContext(null);
        }
      } else if (relatedContext) {
        const isRelated = relatedContext.alternatives.some(
          alt => alt.trim().toLowerCase() === result.word.trim().toLowerCase()
        );
        if (!isRelated) {
          setRelatedContext(null);
        }
      } else {
        setRelatedContext(null);
      }
    };

    try {
      if (MOCK_DICTIONARY_DB[lowerQuery]) {
        setTimeout(() => {
          const mock = MOCK_DICTIONARY_DB[lowerQuery];
          const res = { ...mock, entries: normalizeEntries(mock), isAiGenerated: false };
          updateResult(res);
          setIsSearching(false);
          if (apiKeys?.groqKey && !res.mnemonics) {
            triggerAutoMnemonic(res.word, res.definition || '');
          }
        }, 500);
        return;
      }

      const priorityList = settings?.state?.dictionaryPriority || ['Cambridge', 'Cambridge Learner', 'Yahoo', 'Google Translate', 'Groq AI'];
      const sourcesToTry = forceSource ? [forceSource] : priorityList;
      let lastError = null;

      for (const source of sourcesToTry) {
        if (source === 'Groq AI') {
          if (!apiKeys?.groqKey) {
            console.warn("Skipping Groq AI: Missing API Key");
            if (forceSource === 'Groq AI') {
              const error = new Error(i18n.t('search.requireGroqKey', '請先在設定頁面輸入 Groq API Key'));
              error.code = AI_ERROR_CODES.MISSING_API_KEYS;
              throw error;
            }
            continue;
          }
          setIsAiLoading(true);
          try {
            const { data, source: aiSource } = await fetchDefinition({
              groqKey: apiKeys.groqKey,
              word: lowerQuery,
              targetLang: activeTargetLang
            });
            const res = toSearchResultFromAi(data, aiSource);
            updateResult(res);
            setIsAiLoading(false);
            if (apiKeys?.groqKey && !res.mnemonics) {
              triggerAutoMnemonic(res.word, res.definition || '');
            }
            return;
          } catch (error) {
            setIsAiLoading(false);
            console.warn(`Groq AI search failed for ${lowerQuery}`, error);
            lastError = error;
            if (forceSource === 'Groq AI') throw error;
          }
        } else {
          try {
            const data = await fetchDictionaryEntry(lowerQuery, source, activeTargetLang);
            if (data) {
              const normalized = normalizeEntries(data);
              const isValid = normalized.length > 0 || (data.source === 'Google Translate' && data.definition);

              if (isValid) {
                const res = toSearchResultFromDictionary(data);
                if (
                  searchResultRef.current?.word?.trim().toLowerCase() === res.word.trim().toLowerCase() &&
                  searchResultRef.current?.mnemonics
                ) {
                  res.mnemonics = searchResultRef.current.mnemonics;
                }
                updateResult(res);
                if (apiKeys?.groqKey && !res.mnemonics) {
                  triggerAutoMnemonic(res.word, res.definition || '');
                }
                return;
              }
            }
            console.log(`${source} returned no result for ${lowerQuery}`);
          } catch (error) {
            console.warn(`${source} search failed for ${lowerQuery}`, error);
            lastError = error;
          }
        }
      }

      if (forceSource) {
        const msg = lastError?.code === AI_ERROR_CODES.MISSING_API_KEYS
          ? lastError.message
          : i18n.t('search.sourceNotFound', { source: forceSource, defaultValue: `${forceSource} 查無此字，請嘗試切換來源。` });
        setSearchError(msg);
        if (forceSource !== 'Groq AI') {
          updateResult(createSourceFallback(searchTerm, forceSource, msg));
        } else if (lastError?.code === AI_ERROR_CODES.MISSING_API_KEYS) {
          onRequireApiKeys?.();
        }
      } else {
        const notFoundMsg = i18n.t('search.allSourcesNotFound', '所有來源皆查無此字。');
        setSearchError(notFoundMsg);
        updateResult(createSourceFallback(searchTerm, 'system', notFoundMsg));
      }

    } catch (error) {
      console.error(error);
      setSearchError(`${i18n.t('search.queryFailed', '查詢失敗')}: ${error.message}`);
      setAiError({ code: error.code || 'UNKNOWN_ERROR', message: error.message });
      if (error.code === AI_ERROR_CODES.MISSING_API_KEYS) {
        onRequireApiKeys?.();
      }
      setRelatedContext(null);
    } finally {
      setIsSearching(false);
      setIsAiLoading(false);
    }
  }, [apiKeys, createSourceFallback, onRequireApiKeys, onSearchStart, settings, updateSearchHistory, relatedContext, definitionLanguage, triggerAutoMnemonic, triggerWordRelations]);

  const handleSearch = useCallback(async (e, targetLangOverride) => {
    if (e && e.preventDefault) e.preventDefault();

    const searchTerm = (typeof e === 'string' ? e : query).trim();
    if (!searchTerm) return;

    if (typeof e === 'string') {
      setQuerySilently(searchTerm);
    }

    setSearchTrail([searchTerm]);
    await runSearch({ searchTerm, forceSource: null, targetLangOverride });
  }, [query, runSearch, setQuerySilently]);

  const handleSelectRelatedWord = useCallback(async (targetWord) => {
    const term = (targetWord || '').trim();
    if (!term) return;

    setSearchTrail((prev) => {
      const current = activeSearchWordRef.current.trim();
      const base = prev.length > 0 ? prev : (current ? [current] : []);
      if (base[base.length - 1]?.toLowerCase() === term.toLowerCase()) {
        return base;
      }
      return [...base, term];
    });

    setQuerySilently(term);
    await runSearch({ searchTerm: term, forceSource: null });
  }, [runSearch, setQuerySilently]);

  const handleBackInTrail = useCallback(async () => {
    if (searchTrail.length <= 1) return;
    const nextTrail = searchTrail.slice(0, -1);
    const prevWord = nextTrail[nextTrail.length - 1];
    setSearchTrail(nextTrail);
    setQuerySilently(prevWord);
    await runSearch({ searchTerm: prevWord, forceSource: null });
  }, [searchTrail, runSearch, setQuerySilently]);

  const handleSearchWithSource = useCallback(async (word, source, targetLangOverride) => {
    const searchTerm = (word || query).trim();
    if (!searchTerm) return;
    setQuerySilently(searchTerm);
    await runSearch({ searchTerm, forceSource: source, targetLangOverride });
  }, [query, runSearch, setQuerySilently]);

  const generateAiMnemonic = useCallback(async () => {
    if (!searchResult) return;
    if (!apiKeys?.groqKey) {
      const error = new Error(i18n.t('search.requireGroqKey', '請先在設定頁面輸入 Groq API Key'));
      error.code = AI_ERROR_CODES.MISSING_API_KEYS;
      setAiError({ code: error.code, message: error.message });
      onRequireApiKeys?.();
      toast.error(error.message);
      return;
    }
    setAiLoading(true);
    try {
      const mnemonics = await fetchMnemonic({
        groqKey: apiKeys.groqKey,
        word: searchResult.word,
        definition: searchResult.definition || '',
        targetLang: definitionLanguage
      });

      setSearchResult(prev => ({
        ...prev,
        mnemonics,
        isAiGenerated: true
      }));
    } catch (error) {
      toast.error(`${i18n.t('search.generationFailed', '生成失敗')}: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [apiKeys, definitionLanguage, onRequireApiKeys, searchResult]);

  const triggerSaveButtonFeedback = useCallback(() => {
    setSaveButtonFeedback(true);
    setTimeout(() => setSaveButtonFeedback(false), 1000);
  }, []);

  const normalizedEntries = useMemo(() => (searchResult ? normalizeEntries(searchResult) : []), [searchResult]);

  const setSearchResultAndClearContext = useCallback((result) => {
    setSearchResult(result);
    setRelatedContext(null);
  }, []);

  return {
    state: {
      query,
      searchResult,
      isSearching,
      aiLoading,
      isAiLoading,
      aiError,
      searchError,
      suggestions,
      saveButtonFeedback,
      relatedContext,
      searchTrail
    },
    derived: {
      normalizedEntries
    },
    actions: {
      setQuery,
      setQuerySilently,
      setSearchResult: setSearchResultAndClearContext,
      setSuggestions,
      handleSearch,
      handleSelectRelatedWord,
      handleBackInTrail,
      handleSearchWithSource,
      generateAiMnemonic,
      triggerSaveButtonFeedback,
      clearSearchHistory
    },
    refs: {
      searchInputRef
    }
  };
};

export default useSearch;
