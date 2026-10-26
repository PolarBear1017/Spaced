import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsContext } from '../../contexts/SettingsContext';

export default function SettingsReminders() {
  const { t } = useTranslation();
  const { reminders } = useSettingsContext();
  const { state, actions } = reminders;
  const locked = state.loading || state.busy;
  const canEnable = state.supported && state.configured && state.permission !== 'denied';
  const zones = [...new Set([state.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', 'UTC',
    ...(Intl.supportedValuesOf?.('timeZone') || ['Asia/Taipei'])])].sort();
  const message = !state.supported ? 'unsupported' : state.permission === 'denied' ? 'denied' : state.message;

  return (
    <section className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200" aria-labelledby="reminder-heading">
      <h2 id="reminder-heading" className="font-bold text-lg mb-3 flex items-center gap-2">
        <Bell className="w-5 h-5 text-blue-600" />{t('reminders.title')}
      </h2>
      <p className="text-sm text-gray-600 mb-4">{t('reminders.description')}</p>
      <label className="flex items-center justify-between gap-4 font-bold text-gray-800">
        {t('reminders.enable')}
        <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={state.enabled}
          disabled={locked || (!state.enabled && !canEnable)} onChange={event => actions.save(event.target.checked)} />
      </label>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          {t('reminders.time')}
          <input type="time" required value={state.time} disabled={locked || !state.supported}
            onChange={event => { if (event.target.validity.valid && event.target.value) actions.setTime(event.target.value); }}
            className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2 bg-white" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t('reminders.timezone')}
          <select value={state.timezone} disabled={locked || !state.supported}
            onChange={event => actions.setTimezone(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2 bg-white">
            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" disabled={locked || !state.enabled || !canEnable} onClick={() => actions.save(true)}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-50">{t('reminders.save')}</button>
        <button type="button" disabled={locked || !state.enabled || !canEnable} onClick={actions.test}
          className="rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50">{t('reminders.test')}</button>
      </div>
      {state.loading && <p role="status" className="text-sm mt-4 text-gray-600">{t('reminders.loading')}</p>}
      {message && <p role="status" className="text-sm mt-4 text-gray-700">{t(`reminders.${message}`)}</p>}
      {['unavailable', 'notConfigured', 'saveFailed', 'testFailed'].includes(state.message) &&
        <button disabled={locked} onClick={actions.refresh} className="text-blue-700 underline text-sm mt-2">{t('reminders.retry')}</button>}
      <p className="mt-4 text-xs text-gray-500">{t('reminders.deviceNote')}</p>
      <p className="mt-2 text-xs text-gray-500">{t('reminders.iosNote')}</p>
    </section>
  );
}
