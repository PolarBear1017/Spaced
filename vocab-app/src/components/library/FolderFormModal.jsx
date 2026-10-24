import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FolderFormModal = ({
  title,
  initialValues,
  onSubmit,
  onClose,
  isSaving
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [error, setError] = useState('');

  useEffect(() => {
    // Keep the reusable modal in sync when the parent switches the edited folder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initialValues?.name || '');
    setDescription(initialValues?.description || '');
    setError('');
  }, [initialValues]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('library.folderNameNotEmpty'));
      return;
    }
    onSubmit({
      name: trimmedName,
      description: description.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          disabled={isSaving}
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-blue-700 mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-gray-600">
            {t('library.folderName')}
            <input
              type="text"
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t('library.inputFolderNamePlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              required
            />
          </label>

          <label className="block text-sm text-gray-600">
            {t('library.folderDescriptionOptional')}
            <textarea
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[96px] focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t('library.folderDescriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSaving}
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

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
              disabled={isSaving}
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderFormModal;
