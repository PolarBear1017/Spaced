import React from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsReminders from './SettingsReminders';

const SettingsReview = ({ requestRetention, setRequestRetention }) => {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">{t('settings.review')}</h1>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-amber-600" /> {t('settings.reviewDifficulty')}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-gray-800">{t('settings.retentionRate')}</div>
            <div className="text-sm text-gray-500">{t('settings.retentionRateDesc')}</div>
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            value={requestRetention}
            onChange={(e) => setRequestRetention(Number(e.target.value))}
          >
            <option value={0.8}>0.8 ({t('settings.retentionLight')})</option>
            <option value={0.9}>0.9 ({t('settings.retentionStandard')})</option>
            <option value={0.95}>0.95 ({t('settings.retentionIntense')})</option>
          </select>
        </div>
      </div>
      <SettingsReminders />
    </>
  );
};

export default SettingsReview;
