import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DataLoading({ failed = false, onRetry }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-busy={!failed} className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 text-center">
      {!failed && <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-blue-600" />}
      <p className="font-semibold text-gray-800">{failed ? t('sync.initialFailed', 'Unable to sync data') : t('sync.initialLoading', 'Loading…')}</p>
      <p className="text-sm text-gray-500">{failed ? t('sync.initialFailedDescription', 'Check your connection and try again.') : t('sync.initialLoadingDescription', 'Syncing your library and review progress…')}</p>
      {failed && <button onClick={onRetry} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{t('sync.retry', 'Retry')}</button>}
    </div>
  );
}
