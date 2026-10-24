import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MoveWordsModal = ({
  folders,
  currentFolderId,
  onSubmit,
  onClose,
  isSaving
}) => {
  const { t } = useTranslation();
  const availableFolders = useMemo(
    () => (folders || []).filter(folder => folder.id !== currentFolderId),
    [currentFolderId, folders]
  );
  const [targetId, setTargetId] = useState(availableFolders[0]?.id || '');

  useEffect(() => {
    // Reset the destination when the source folder changes while this modal is open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetId(availableFolders[0]?.id || '');
  }, [availableFolders]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          disabled={isSaving}
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-blue-700 mb-4">{t('library.batchMoveWords')}</h2>

        {availableFolders.length === 0 ? (
          <p className="text-sm text-gray-500">{t('library.noTargetFolders')}</p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!targetId) return;
              onSubmit(targetId);
            }}
            className="space-y-4"
          >
            <label className="block text-sm text-gray-600">
              {t('library.targetFolder')}
              <select
                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                disabled={isSaving}
              >
                {availableFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                disabled={isSaving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                disabled={isSaving || !targetId}
              >
                {isSaving ? t('library.moving') : t('library.move')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MoveWordsModal;
