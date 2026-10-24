import { supabase } from '../supabase';

const fetchDictionaryEntry = async (word, source = 'Cambridge', targetLang = 'zh-TW') => {
  const res = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}&source=${encodeURIComponent(source)}&targetLang=${encodeURIComponent(targetLang)}`);
  if (!res.ok) return null;
  return res.json();
};

const fetchSuggestions = async (query, options = {}) => {
  if (!query.trim() || query.length < 2) return [];
  const { signal } = options;
  const limit = 5;
  let supabaseResults = [];

  try {
    const { data, error } = await supabase
      .rpc('suggest_words', { query_text: query, max_results: limit })
      .abortSignal(signal);

    if (error) throw error;

    if (data && data.length > 0) {
      supabaseResults = data;
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) return [];
    console.warn('Suggestion fetch failed (supabase)', error);
  }

  const supabasePrefixMatches = supabaseResults.filter(
    (item) => item.match_type === 'exact' || item.match_type === 'prefix'
  ).length;

  let datamuseResults = [];
  if (supabaseResults.length < limit || supabasePrefixMatches < 2) {
    try {
      const res = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(query)}`, { signal });
      if (res.ok) {
        const extData = await res.json();
        datamuseResults = extData;
      }
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) return [];
      console.warn('Suggestion fetch failed (datamuse)', error);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const normalizeItem = (item, fallbackMatchType = null) => {
    const word = typeof item === 'string' ? item : item.word;
    if (!word) return null;
    return {
      word,
      matchType: item?.match_type ?? item?.matchType ?? fallbackMatchType,
      score: item?.score ?? null
    };
  };

  const seen = new Set();
  const merged = [];
  const appendUnique = (items, fallbackMatchType = null) => {
    items.forEach((item) => {
      const normalized = normalizeItem(item, fallbackMatchType);
      if (!normalized) return;
      const key = normalized.word.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(normalized);
    });
  };

  appendUnique(supabaseResults);
  appendUnique(datamuseResults, 'prefix');

  const prefixCount = merged.filter((item) => item.word.toLowerCase().startsWith(normalizedQuery)).length;
  const filtered = prefixCount >= 2
    ? merged.filter((item) => item.matchType !== 'fuzzy')
    : merged;

  const rankItem = (item) => {
    const lowerWord = item.word.toLowerCase();
    if (lowerWord === normalizedQuery) return { tier: 0, length: lowerWord.length, score: item.score ?? 0 };
    if (lowerWord.startsWith(normalizedQuery)) return { tier: 1, length: lowerWord.length, score: item.score ?? 0 };
    return { tier: 2, length: lowerWord.length, score: item.score ?? 0 };
  };

  const sorted = [...filtered].sort((a, b) => {
    const ra = rankItem(a);
    const rb = rankItem(b);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    if (ra.tier === 1 && ra.length !== rb.length) return ra.length - rb.length;
    if (rb.score !== ra.score) return rb.score - ra.score;
    return a.word.localeCompare(b.word);
  });

  return sorted.slice(0, limit);
};

const getWordStems = (word) => {
  const w = word.toLowerCase().trim();
  const stems = new Set([w]);

  let base = w;
  if (base.endsWith('ingly')) base = base.slice(0, -5);
  else if (base.endsWith('fully')) base = base.slice(0, -5);
  else if (base.endsWith('ically')) base = base.slice(0, -6);
  else if (base.endsWith('ently') || base.endsWith('antly')) {
    stems.add(base.slice(0, -3)); // conveniently -> convenien
    base = base.slice(0, -5);
  }
  else if (base.endsWith('ation') || base.endsWith('ition')) base = base.slice(0, -5);
  else if (base.endsWith('sion') || base.endsWith('tion')) base = base.slice(0, -4);
  else if (base.endsWith('ment') || base.endsWith('ness')) base = base.slice(0, -4);
  else if (base.endsWith('able') || base.endsWith('ible')) base = base.slice(0, -4);
  else if (base.endsWith('ence') || base.endsWith('ance')) {
    stems.add(base.slice(0, -2)); // convenience -> convenien
    base = base.slice(0, -4); // difference -> differ
  }
  else if (base.endsWith('ency') || base.endsWith('ancy')) {
    stems.add(base.slice(0, -2)); // frequency -> frequen, efficiency -> efficien
    base = base.slice(0, -4);
  }
  else if ((base.endsWith('ent') || base.endsWith('ant')) && base.length > 4) {
    stems.add(base.slice(0, -1)); // convenient -> convenien
    base = base.slice(0, -3); // dependent -> depend
  }
  else if (base.endsWith('ful') || base.endsWith('ive') || base.endsWith('ing') || base.endsWith('ity')) base = base.slice(0, -3);
  else if (base.endsWith('ed') || base.endsWith('ly') || base.endsWith('ty')) base = base.slice(0, -2);
  else if (base.endsWith('er') || base.endsWith('or')) base = base.slice(0, -2);
  else if (base.endsWith('e') && base.length > 3) base = base.slice(0, -1);

  if (base.length >= 3) {
    stems.add(base);
    if (base.endsWith('d')) {
      stems.add(base.slice(0, -1) + 's');
    } else if (base.endsWith('s')) {
      stems.add(base.slice(0, -1) + 'd');
    }
  }

  return Array.from(stems);
};

const filterDistinctForms = (words) => {
  const seen = new Set();
  const result = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (seen.has(lower)) continue;
    // 避免重複放入純複數形
    if (lower.endsWith('s') && seen.has(lower.slice(0, -1))) continue;
    if (lower.endsWith('es') && seen.has(lower.slice(0, -2))) continue;
    seen.add(lower);
    result.push(lower);
    if (result.length >= 4) break;
  }
  return result;
};

const fetchRelatedWords = async (word, options = {}) => {
  if (!word || typeof word !== 'string' || word.trim().length < 2) {
    return {
      wordFamily: { noun: [], verb: [], adjective: [], adverb: [] },
      synonyms: []
    };
  }

  const { signal } = options;
  const cleanWord = word.trim().toLowerCase();
  const stems = getWordStems(cleanWord);

  try {
    const stemPromises = stems.map((s) =>
      fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(s + '*')}&md=p&max=60`, { signal })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
    );

    const synonymsPromise = fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}&max=10`, { signal })
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);

    const [stemResults, rawSynonyms] = await Promise.all([
      Promise.all(stemPromises),
      synonymsPromise
    ]);

    const allStemItems = stemResults.flat();
    allStemItems.sort((a, b) => (b.score || 0) - (a.score || 0));

    const rawFamily = { noun: [], verb: [], adjective: [], adverb: [] };

    allStemItems.forEach((item) => {
      const w = (item.word || '').trim().toLowerCase();
      if (!w || w.includes(' ') || w.length < 3) return;
      const score = item.score !== undefined ? item.score : 500;
      const tags = item.tags || [];

      if (tags.includes('n') && (score > 100 || w === cleanWord)) {
        rawFamily.noun.push(w);
      }
      if (tags.includes('v') && !w.endsWith('ed') && !w.endsWith('ing') && !w.endsWith('s') && (score > 100 || w === cleanWord)) {
        rawFamily.verb.push(w);
      }
      if (tags.includes('adj') && !w.endsWith('ed') && !w.endsWith('ing') && (score > 100 || w === cleanWord)) {
        rawFamily.adjective.push(w);
      }
      if (tags.includes('adv') && score > 5) {
        rawFamily.adverb.push(w);
      }
    });

    const wordFamily = {
      noun: filterDistinctForms(rawFamily.noun),
      verb: filterDistinctForms(rawFamily.verb),
      adjective: filterDistinctForms(rawFamily.adjective),
      adverb: filterDistinctForms(rawFamily.adverb)
    };

    let synonyms = [];
    let synData = Array.isArray(rawSynonyms) ? rawSynonyms : [];

    if (synData.length === 0) {
      try {
        const mlRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(cleanWord)}&max=8`, { signal });
        if (mlRes.ok) {
          synData = await mlRes.json();
        }
      } catch {
        // Continue with the dictionary response when related-word lookup fails.
      }
    }

    if (Array.isArray(synData)) {
      synData.forEach((item) => {
        const w = (item.word || '').trim().toLowerCase();
        if (w && w !== cleanWord && !synonyms.includes(w)) {
          synonyms.push(w);
        }
      });
    }

    return {
      wordFamily,
      synonyms: synonyms.slice(0, 8)
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) return null;
    console.warn('fetchRelatedWords failed', error);
    return {
      wordFamily: { noun: [], verb: [], adjective: [], adverb: [] },
      synonyms: []
    };
  }
};

export { fetchDictionaryEntry, fetchSuggestions, fetchRelatedWords };


