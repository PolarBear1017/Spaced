import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Click/tap disclosure also supports keyboard focus, Escape and outside clicks.
export default function ReviewInfo({ label, children }) {
  const { t } = useTranslation();
  return (
    <Popover as="span" className="inline-flex shrink-0">
      <PopoverButton aria-label={label} className="rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500">
        <Info className="h-4 w-4" aria-hidden="true" />
      </PopoverButton>
      <PopoverPanel anchor="bottom end" portal className="z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-xl [--anchor-gap:8px] [--anchor-padding:16px]">
        {({ close }) => (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-800">{label}</h3>
              <button type="button" onClick={() => close()} aria-label={t('common.close')} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 leading-relaxed">{children}</div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
