import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { LEARNING_GOALS, normalizeUsefulnessSettings } from '../../utils/wordUsefulness';

const SettingsUsefulness = () => {
  const { t } = useTranslation();
  const { state, actions } = useSettingsContext();
  const value = normalizeUsefulnessSettings(state.wordUsefulness);
  const update = (change) => actions.setWordUsefulness({ ...value, ...change });
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="space-y-6 text-gray-800">
      <h2 className="text-xl font-bold">{t('usefulness.settingsTitle')}</h2>
      <label className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <span className="font-medium">{t('usefulness.showIndicators')}</span>
        <input type="checkbox" checked={value.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="w-5 h-5 accent-emerald-600" />
      </label>
      <div className="space-y-2">
        <label htmlFor="learning-goal" className="block text-sm font-semibold">{t('usefulness.learningGoal')}</label>
        <select id="learning-goal" value={value.goal} onChange={(e) => update({ goal: e.target.value })} className={inputClass}>
          {LEARNING_GOALS.map((goal) => <option key={goal} value={goal}>{t(`usefulness.goals.${goal}`)}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="core-rank" className="block text-sm font-semibold">{t('usefulness.coreRange')}</label>
        <select id="core-rank" value={value.coreRank} onChange={(e) => update({ coreRank: Number(e.target.value) })} className={inputClass}>
          {[1000, 3000, 5000].map((rank) => <option key={rank} value={rank}>{t('usefulness.topWords', { count: rank })}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="priority-words" className="block text-sm font-semibold">{t('usefulness.priorityWords')}</label>
        <textarea id="priority-words" value={value.priorityWords} maxLength={10000} rows={4} onChange={(e) => update({ priorityWords: e.target.value })} placeholder={t('usefulness.wordsPlaceholder')} className={`${inputClass} resize-y`} />
      </div>
      <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 leading-relaxed">
        <p>{t('usefulness.localPreference')}</p>
      </div>
    </div>
  );
};
export default SettingsUsefulness;
