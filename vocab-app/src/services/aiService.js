import { supabase, supabaseAnonKey } from '../supabase';
import i18n from '../i18n/config';

const AI_ERROR_CODES = {
  MISSING_API_KEYS: 'MISSING_API_KEYS',
  AUTH_REQUIRED: 'AUTH_REQUIRED'
};

const callAi = async ({ groqKey, word, definition, words, promptType, targetLang = 'zh-TW' }) => {
  if (!groqKey) {
    const error = new Error(i18n.t('search.requireGroqKey', '請在設定頁面輸入 Groq API Key。'));
    error.code = AI_ERROR_CODES.MISSING_API_KEYS;
    throw error;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    const error = new Error(i18n.t('search.aiAuthRequired'));
    error.code = AI_ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  const { data, error } = await supabase.functions.invoke('ai-dictionary', {
    body: {
      word,
      definition,
      words,
      promptType,
      targetLang,
      apiKeys: {
        groqKey
      }
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey
    }
  });

  if (error) {
    let serverMessage = error.message;
    if (error.context) {
      try {
        const errorJson = await error.context.json();
        if (errorJson?.error) {
          serverMessage = errorJson.error;
        }
      } catch {
        try {
          const text = await error.context.text();
          if (text) serverMessage = text;
        } catch {
          // The response body may already have been consumed.
        }
      }
    }
    const err = new Error(serverMessage || 'AI Edge Function failed');
    err.code = error.code;
    throw err;
  }

  return data;
};

const escapeNewlinesInStrings = (input) => {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      result += ch;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      result += '\\n';
      continue;
    }
    result += ch;
  }
  return result;
};

const extractJsonObject = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';
  return text.slice(start, end + 1);
};

const parseJsonContent = (text) => {
  const cleanJson = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleanJson);
  } catch (error) {
    try {
      const extracted = extractJsonObject(cleanJson);
      if (!extracted) {
        return { rawText: cleanJson, parseError: error.message };
      }
      const escaped = escapeNewlinesInStrings(extracted);
      return JSON.parse(escaped);
    } catch (secondError) {
      return { rawText: cleanJson, parseError: secondError.message };
    }
  }
};

const normalizeDefinition = (word, data) => {
  if (!data || typeof data !== 'object') {
    return {
      word,
      pos: '',
      phonetic: '',
      definition: '',
      translation: '',
      examples: [],
      practicalTips: '',
      memoryZone: ''
    };
  }
  const rawText = data.rawText || data.raw || '';
  return {
    word: data.word || word,
    pos: data.pos || '',
    phonetic: data.phonetic || '',
    definition: data.definition || rawText || '',
    translation: data.translation || '',
    examples: Array.isArray(data.examples) ? data.examples : (data.example ? [data.example] : []),
    practicalTips: data.practicalTips || data.practical_tips || '',
    memoryZone: data.memoryZone || data.memory_zone || '',
    wordFamily: data.wordFamily || data.word_family || null,
    synonyms: Array.isArray(data.synonyms) ? data.synonyms : (Array.isArray(data.similar) ? data.similar : [])
  };
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
};

const formatEtymology = (data) => {
  if (!data || typeof data !== 'object') return null;

  // Check unique keys for Etymology schema
  if (!data.Root && !data.Decomposition && !data['Linking memory aid'] && !data['memory aid']) return null;

  const parts = [];
  if (data.Root) {
    let rootPart = `**Root**: ${data.Root}`;
    const extras = [];
    if (data.Prefix) extras.push(`Prefix: ${data.Prefix}`);
    if (data.Suffix) extras.push(`Suffix: ${data.Suffix}`);
    if (extras.length > 0) rootPart += ` (${extras.join(', ')})`;
    parts.push(rootPart);
  }

  if (data.Decomposition) {
    parts.push(`**Decomposition**: ${data.Decomposition}`);
  }

  const memoryAid = data['Linking memory aid'] || data['memory aid'] || data.memory_aid;
  if (memoryAid) {
    parts.push(`**Memory Aid**: ${memoryAid}`);
  }

  return parts.join('\n\n');
};

const getStructuredDetails = (data) => {
  if (!data) return null;
  const memoryZone = data.memoryZone || data;
  if (memoryZone.prefix || memoryZone.root || memoryZone.suffix) {
    return {
      prefix: memoryZone.prefix || '',
      prefixMeaning: memoryZone.prefixMeaning || '',
      root: memoryZone.root || '',
      rootMeaning: memoryZone.rootMeaning || '',
      suffix: memoryZone.suffix || '',
      suffixMeaning: memoryZone.suffixMeaning || '',
    };
  }
  return null;
};

const normalizeMnemonic = (data) => {
  if (!data) {
    return { method: 'Etymology', content: '' };
  }

  let structuredData = data;
  if (typeof data === 'string' && data.trim().startsWith('{')) {
    try { structuredData = JSON.parse(data); } catch { /* Keep the original text. */ }
  } else if (data.mnemonics && typeof data.mnemonics === 'string' && data.mnemonics.trim().startsWith('{')) {
    try { structuredData = JSON.parse(data.mnemonics); } catch { /* Keep the original text. */ }
  }

  const details = getStructuredDetails(structuredData);

  const formatted = formatEtymology(structuredData);
  if (formatted) {
    const method = data.method || data.strategy || 'Etymology';
    return { method, content: formatted, details };
  }

  if (typeof data === 'string') {
    return { method: 'Etymology', content: data.trim(), details: null };
  }
  if (typeof data.mnemonics === 'string') {
    return { method: 'Etymology', content: data.mnemonics.trim(), details: null };
  }
  const content = data.content
    || data.story
    || data.memoryZone?.story
    || (typeof data.memoryZone === 'string' ? data.memoryZone : '')
    || data.memoryZoneContent
    || data.memory_aid
    || data['memory aid']
    || '';
  const method = data.method || data.strategy || 'Etymology';
  const fallback = data.rawText || data.raw || '';

  const finalContent = safeString(content || fallback);
  return { method, content: finalContent.trim(), details };
};

const fetchDefinition = async ({ groqKey, word, targetLang = 'zh-TW' }) => {
  const response = await callAi({ groqKey, word, promptType: 'definition', targetLang });
  const raw = response?.data;
  const parsed = typeof raw === 'string' ? parseJsonContent(raw) : raw;
  return {
    data: normalizeDefinition(word, parsed),
    source: response?.source || 'AI'
  };
};

const fetchMnemonic = async ({ groqKey, word, definition, targetLang = 'zh-TW' }) => {
  const response = await callAi({
    groqKey,
    word,
    definition,
    promptType: 'mnemonic',
    targetLang
  });
  const raw = response?.data;
  const parsed = typeof raw === 'string' ? parseJsonContent(raw) : raw;
  return normalizeMnemonic(parsed);
};

const fetchStory = async ({ groqKey, words, targetLang = 'zh-TW' }) => {
  const response = await callAi({
    groqKey,
    words,
    promptType: 'story',
    targetLang
  });
  return response?.data || '';
};

export {
  AI_ERROR_CODES,
  fetchDefinition,
  fetchMnemonic,
  fetchStory
};
