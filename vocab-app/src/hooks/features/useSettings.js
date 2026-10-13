import { useCallback, useEffect, useState } from 'react';
import {
  ensureStorageVersion,
  loadWordUsefulness,
  saveWordUsefulness,
  loadGroqKey,
  loadRequestRetention,
  loadDictionaryPriority,
  saveGroqKey,
  saveRequestRetention,
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
} from '../../services/storageService';
import i18n from '../../i18n/config';
import {
  getSession,
  onAuthStateChange,
  signInAnonymously,
  signInWithGoogle,
  signInWithPassword,
  signUpWithEmail,
  signOut
} from '../../services/authService';

const useSettings = () => {
  const [settingsView, setSettingsView] = useState('main');
  const [wordUsefulness, setWordUsefulness] = useState(() => loadWordUsefulness());
  useEffect(() => {
    saveWordUsefulness(wordUsefulness);
  }, [wordUsefulness]);
  const [groqApiKey, setGroqApiKey] = useState(() => loadGroqKey());
  const [requestRetention, setRequestRetention] = useState(() => loadRequestRetention());
  const [dictionaryPriority, setDictionaryPriority] = useState(() => loadDictionaryPriority());
  const [audioSourcePriority, setAudioSourcePriority] = useState(() => loadAudioSourcePriority());
  const [audioSpeed, setAudioSpeed] = useState(() => loadAudioSpeed());
  const [chineseAudioSpeed, setChineseAudioSpeed] = useState(() => loadChineseAudioSpeed());
  const [uiLanguage, setUiLanguageState] = useState(() => i18n.resolvedLanguage || loadUiLanguage());
  const [definitionLanguage, setDefinitionLanguage] = useState(() => loadDefinitionLanguage());
  const [playAudioShortcut, setPlayAudioShortcut] = useState(() => loadPlayAudioShortcut());

  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    ensureStorageVersion();
  }, []);

  useEffect(() => {
    savePlayAudioShortcut(playAudioShortcut);
  }, [playAudioShortcut]);

  useEffect(() => {
    saveGroqKey(groqApiKey);
  }, [groqApiKey]);

  useEffect(() => {
    saveRequestRetention(requestRetention);
  }, [requestRetention]);

  useEffect(() => {
    saveDictionaryPriority(dictionaryPriority);
  }, [dictionaryPriority]);

  useEffect(() => {
    saveAudioSourcePriority(audioSourcePriority);
  }, [audioSourcePriority]);

  useEffect(() => {
    saveAudioSpeed(audioSpeed);
  }, [audioSpeed]);

  useEffect(() => {
    saveChineseAudioSpeed(chineseAudioSpeed);
  }, [chineseAudioSpeed]);

  useEffect(() => {
    saveDefinitionLanguage(definitionLanguage);
  }, [definitionLanguage]);

  const setUiLanguage = useCallback((lang) => {
    setUiLanguageState(lang);
    saveUiLanguage(lang);
    i18n.changeLanguage(lang);
  }, []);

  useEffect(() => {
    getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        signInAnonymously().catch(console.error);
      }
    });

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback(async () => {
    const { error } = await signInWithGoogle();
    if (error) alert(`${i18n.t('settings.loginFailed', '登入失敗')}: ${error.message}`);
  }, []);

  const handleLogout = useCallback(async () => {
    const { error } = await signOut();
    if (error) alert(`${i18n.t('settings.logoutFailed', '登出失敗')}: ${error.message}`);
  }, []);

  const handleEmailSignUp = useCallback(async () => {
    if (!email || !password) return alert(i18n.t('settings.enterEmailAndPassword', '請輸入 Email 和密碼'));
    setAuthLoading(true);
    const { error } = await signUpWithEmail({ email, password });
    setAuthLoading(false);
    if (error) {
      alert(`${i18n.t('settings.signUpFailed', '註冊失敗')}: ${error.message}`);
    } else {
      alert(i18n.t('settings.signUpSuccess', '註冊成功！請檢查您的信箱以驗證帳號 (若 Supabase 未關閉驗證信功能)。'));
    }
  }, [email, password]);

  const handleEmailSignIn = useCallback(async () => {
    if (!email || !password) return alert(i18n.t('settings.enterEmailAndPassword', '請輸入 Email 和密碼'));
    setAuthLoading(true);
    const { error } = await signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      alert(`${i18n.t('settings.loginFailed', '登入失敗')}: ${error.message}`);
    } else {
      setEmail('');
      setPassword('');
    }
  }, [email, password]);

  return {
    state: {
      wordUsefulness,
      settingsView,
      groqApiKey,
      requestRetention,
      dictionaryPriority,
      audioSourcePriority,
      audioSpeed,
      chineseAudioSpeed,
      uiLanguage,
      definitionLanguage,
      playAudioShortcut,
      session,
      email,
      password,
      authLoading
    },
    actions: {
      setWordUsefulness,
      setSettingsView,
      setGroqApiKey,
      setRequestRetention,
      setDictionaryPriority,
      setAudioSourcePriority,
      setAudioSpeed,
      setChineseAudioSpeed,
      setUiLanguage,
      setDefinitionLanguage,
      setPlayAudioShortcut,
      setEmail,
      setPassword,
      handleLogin,
      handleLogout,
      handleEmailSignUp,
      handleEmailSignIn
    }
  };
};

export default useSettings;
