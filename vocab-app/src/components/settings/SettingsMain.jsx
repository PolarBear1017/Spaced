import React from 'react';
import { ArrowRight, User, Key, Brain, BookOpen, Volume2, Globe, Keyboard, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettingsMain = ({
  session,
  groqApiKey,
  uiLanguage = 'zh-TW',
  definitionLanguage = 'zh-TW',
  onSelectView
}) => {
  const { t } = useTranslation();

  const uiLangLabel = uiLanguage === 'en' ? t('settings.langEn') : t('settings.langZhTw');
  const defLangLabel = definitionLanguage === 'en' ? t('settings.defEn') : t('settings.defZhTw');

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>
      <div className="space-y-4">
        <button onClick={() => onSelectView('usefulness')} className="w-full bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700"><Target className="w-5 h-5" /></div>
            <div className="font-bold text-gray-800">{t('usefulness.settingsTitle')}</div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>
        {/* 語言設定 */}
        <button
          onClick={() => onSelectView('language')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.languageSection')}</div>
              <div className="text-sm text-gray-500">
                {`${uiLangLabel} · ${defLangLabel}`}
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('account')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.account')}</div>
              <div className="text-sm text-gray-500">
                {session?.user && !session.user.is_anonymous
                  ? session.user.email
                  : t('settings.guestMode')}
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('api')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
              <Key className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.api')}</div>
              <div className="text-sm text-gray-500">
                {groqApiKey ? t('settings.configured') : t('settings.notConfigured')}
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('dictionary')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.dictionary')}</div>
              <div className="text-sm text-gray-500">{t('settings.dictionaryDesc')}</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('audio')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <Volume2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.audio')}</div>
              <div className="text-sm text-gray-500">{t('settings.audioDesc')}</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('review')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <Brain className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.review')}</div>
              <div className="text-sm text-gray-500">{t('settings.reviewDesc')}</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => onSelectView('shortcuts')}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <Keyboard className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800">{t('settings.shortcuts', '快捷鍵設定')}</div>
              <div className="text-sm text-gray-500">{t('settings.shortcutsDesc', '自訂單字發音與全站快捷鍵')}</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>Made by Spaced</p>
      </div>
    </>
  );
};

export default SettingsMain;
