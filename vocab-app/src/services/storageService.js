import { normalizeUsefulnessSettings } from '../utils/wordUsefulness';

const STORAGE_VERSION = 1;
const STORAGE_KEYS = {
  version: 'vocab_storage_version',
  folders: 'vocab_folders',
  vocabData: 'vocab_data',
  lastUsedFolders: 'last_used_folders',
  groqKey: 'groq_api_key',
  requestRetention: 'request_retention',
  folderSortBy: 'folder_sort_by',
  wordSortBy: 'word_sort_by',
  dictionaryPriority: 'dictionary_priority',
  audioSourcePriority: 'audio_source_priority',
  audioSpeed: 'audio_speed',
  chineseAudioSpeed: 'chinese_audio_speed',
  uiLanguage: 'ui_language',
  definitionLanguage: 'definition_language',
  playAudioShortcut: 'vocab_shortcut_play_audio'
};

const ensureStorageVersion = () => {
  const raw = localStorage.getItem(STORAGE_KEYS.version);
  const current = raw ? Number(raw) : 0;
  if (!Number.isFinite(current) || current < STORAGE_VERSION) {
    localStorage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION));
  }
};

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse storage key: ${key}`, error);
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write JSON for key ${key} to localStorage:`, error);
  }
};

const readString = (key, fallback = '') => {
  const value = localStorage.getItem(key);
  return value ?? fallback;
};

const writeString = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to write string for key ${key} to localStorage:`, error);
  }
};

const loadCachedFolders = () => readJSON(STORAGE_KEYS.folders, []);
const saveCachedFolders = (folders) => writeJSON(STORAGE_KEYS.folders, folders);

const loadCachedVocab = () => readJSON(STORAGE_KEYS.vocabData, []);
const saveCachedVocab = (vocabData) => writeJSON(STORAGE_KEYS.vocabData, vocabData);

const loadLastUsedFolders = () => readJSON(STORAGE_KEYS.lastUsedFolders, []);
const saveLastUsedFolders = (folderIds) => writeJSON(STORAGE_KEYS.lastUsedFolders, folderIds);

const loadGroqKey = () => readString(STORAGE_KEYS.groqKey, '');
const saveGroqKey = (value) => writeString(STORAGE_KEYS.groqKey, value);

const loadRequestRetention = () => {
  const raw = readString(STORAGE_KEYS.requestRetention, '0.9');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0.9;
};
const saveRequestRetention = (value) => writeString(STORAGE_KEYS.requestRetention, String(value));

const loadFolderSortBy = () => readString(STORAGE_KEYS.folderSortBy, 'created_desc');
const saveFolderSortBy = (value) => writeString(STORAGE_KEYS.folderSortBy, value);

const loadWordSortBy = () => readString(STORAGE_KEYS.wordSortBy, 'added_desc');
const saveWordSortBy = (value) => writeString(STORAGE_KEYS.wordSortBy, value);

const DEFAULT_DICTIONARY_PRIORITY = ['Cambridge', 'Cambridge Learner', 'Yahoo', 'Google Translate', 'Groq AI'];
const loadDictionaryPriority = () => {
  const loaded = readJSON(STORAGE_KEYS.dictionaryPriority, DEFAULT_DICTIONARY_PRIORITY);
  if (Array.isArray(loaded)) {
    if (!loaded.includes('Cambridge Learner')) {
      const cambridgeIdx = loaded.indexOf('Cambridge');
      if (cambridgeIdx !== -1) {
        loaded.splice(cambridgeIdx + 1, 0, 'Cambridge Learner');
      } else {
        loaded.unshift('Cambridge Learner');
      }
    }
    return loaded;
  }
  return DEFAULT_DICTIONARY_PRIORITY;
};
const saveDictionaryPriority = (value) => writeJSON(STORAGE_KEYS.dictionaryPriority, value);

const loadAudioSourcePriority = () => readJSON(STORAGE_KEYS.audioSourcePriority, ['us', 'uk', 'google', 'yahoo', 'general']);
const saveAudioSourcePriority = (value) => writeJSON(STORAGE_KEYS.audioSourcePriority, value);

const loadAudioSpeed = () => {
  const raw = readString(STORAGE_KEYS.audioSpeed, '1.0');
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 1.0;
};
const saveAudioSpeed = (value) => writeString(STORAGE_KEYS.audioSpeed, String(value));

const loadChineseAudioSpeed = () => {
  const raw = readString(STORAGE_KEYS.chineseAudioSpeed, '1.0');
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 1.0;
};
const saveChineseAudioSpeed = (value) => writeString(STORAGE_KEYS.chineseAudioSpeed, String(value));

const loadUiLanguage = () => readString(STORAGE_KEYS.uiLanguage, 'zh-TW');
const saveUiLanguage = (value) => writeString(STORAGE_KEYS.uiLanguage, value);

const loadDefinitionLanguage = () => readString(STORAGE_KEYS.definitionLanguage, 'zh-TW');
const saveDefinitionLanguage = (value) => writeString(STORAGE_KEYS.definitionLanguage, value);

const loadPlayAudioShortcut = () => readString(STORAGE_KEYS.playAudioShortcut, 'Tab');
const savePlayAudioShortcut = (value) => writeString(STORAGE_KEYS.playAudioShortcut, value);

const loadWordUsefulness = () => normalizeUsefulnessSettings(readJSON('word_usefulness', null));
const saveWordUsefulness = (value) => writeJSON('word_usefulness', normalizeUsefulnessSettings(value));

export {
  loadWordUsefulness,
  saveWordUsefulness,
  STORAGE_VERSION,
  STORAGE_KEYS,
  ensureStorageVersion,
  readJSON,
  writeJSON,
  readString,
  writeString,
  loadCachedFolders,
  saveCachedFolders,
  loadCachedVocab,
  saveCachedVocab,
  loadLastUsedFolders,
  saveLastUsedFolders,
  loadGroqKey,
  saveGroqKey,
  loadRequestRetention,
  saveRequestRetention,
  loadFolderSortBy,
  saveFolderSortBy,
  loadWordSortBy,
  saveWordSortBy,
  loadDictionaryPriority,
  saveDictionaryPriority,
  loadAudioSourcePriority,
  saveAudioSourcePriority,
  loadAudioSpeed,
  saveAudioSpeed,
  loadChineseAudioSpeed,
  saveChineseAudioSpeed,
  loadUiLanguage,
  saveUiLanguage,
  loadDefinitionLanguage,
  saveDefinitionLanguage,
  loadPlayAudioShortcut,
  savePlayAudioShortcut
};
