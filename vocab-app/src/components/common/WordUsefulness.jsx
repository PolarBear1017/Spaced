import React from 'react';
import { BarChart3, Target, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { getWordUsefulness, normalizeUsefulnessSettings } from '../../utils/wordUsefulness';

const levelStyles = {
  core: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  extended: 'bg-sky-50 text-sky-800 border-sky-200',
  lessCommon: 'bg-gray-50 text-gray-600 border-gray-200',
  unknown: 'bg-gray-50 text-gray-500 border-gray-200'
};

const WordUsefulness = ({ word, className = '' }) => {
  const { t } = useTranslation();
  const { state: { wordUsefulness } } = useSettingsContext();
  const preferences = normalizeUsefulnessSettings(wordUsefulness);
  if (!preferences.enabled || !word) return null;
  const result = getWordUsefulness(word, preferences);
  const details = result.rank === null ? t('usefulness.unknownDetail')
    : t('usefulness.rankDetail', { rank: result.rank.toLocaleString(), cutoff: preferences.coreRank.toLocaleString() });

  return (
    <details className={`text-xs font-medium max-w-full ${className}`}>
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <span title={details} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${levelStyles[result.level]}`}>
        <BarChart3 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />{t(`usefulness.levels.${result.level}`)}
      </span>
      {result.goalMatch && (
        <span title={t('usefulness.goalDetail', { goal: t(`usefulness.goals.${result.goal}`) })} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">
          <Target aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />{t('usefulness.goalPriority', { goal: t(`usefulness.goals.${result.goal}`) })}
        </span>
      )}
      {result.personalPriority && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-800">
          <Star aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />{t('usefulness.personalPriority')}
        </span>
      )}
      </summary>
      <div className="mt-2 text-left text-gray-600 font-normal leading-relaxed max-w-lg space-y-1">
        <p>{details}</p>
        {result.goalMatch && <p>{t('usefulness.goalDetail', { goal: t(`usefulness.goals.${result.goal}`) })}</p>}
      </div>
    </details>
  );
};
export default WordUsefulness;
