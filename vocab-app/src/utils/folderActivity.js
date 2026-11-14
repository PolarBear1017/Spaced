const timestamp = value => {
  if (value == null) return 0;
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

export const folderActivityTime = folder => {
  const cloudActivity = timestamp(folder.last_activity_at);
  if (cloudActivity > 0) return Math.max(cloudActivity, timestamp(folder._pendingActivityAt));
  return Math.max(
    timestamp(folder._lastModified),
    timestamp(folder.updated_at),
    timestamp(folder.created_at)
  );
};

export const compareRecentFolders = (a, b) => folderActivityTime(b) - folderActivityTime(a)
  || (a.name || '').localeCompare(b.name || '', 'zh-Hant')
  || String(a.id).localeCompare(String(b.id));

const touchFolder = (folder, modifiedAt) => timestamp(folder.last_activity_at)
  ? { ...folder, _pendingActivityAt: modifiedAt }
  : { ...folder, _lastModified: modifiedAt };

const wordDetailsChanged = (before, after) =>
  Boolean(before.isStarred) !== Boolean(after.isStarred)
  || (before.source ?? null) !== (after.source ?? null)
  || Boolean(before.isAiGenerated) !== Boolean(after.isAiGenerated)
  || JSON.stringify(before.selectedDefinitions ?? null) !== JSON.stringify(after.selectedDefinitions ?? null);

// Keep mutation tracking atomic with the data change. Background sync never counts as use.
export const libraryDataReducer = (state, { field, value, modifiedAt }) => {
  const next = typeof value === 'function' ? value(state[field]) : value;
  if (field === 'folders') {
    const previous = new Map(state.folders.map(folder => [folder.id, folder]));
    return { ...state, folders: next.map(folder => {
      const old = previous.get(folder.id);
      const cloudActivity = timestamp(folder.last_activity_at);
      const previousCloudActivity = timestamp(old?.last_activity_at);
      if (cloudActivity < previousCloudActivity && cloudActivity > 0) return old;
      if (cloudActivity > previousCloudActivity) {
        return { ...folder, _lastModified: 0, _pendingActivityAt: undefined };
      }
      if (modifiedAt && (!old || old.name !== folder.name || (old.description ?? null) !== (folder.description ?? null))) {
        return touchFolder(folder, modifiedAt);
      }
      if (cloudActivity) {
        return { ...folder, _lastModified: 0, _pendingActivityAt: old?._pendingActivityAt };
      }
      return { ...folder, _lastModified: Math.max(timestamp(folder._lastModified), timestamp(old?._lastModified)) };
    }) };
  }
  if (!modifiedAt) return { ...state, vocabData: next };
  const before = new Map(state.vocabData.map(word => [word.id, word]));
  const after = new Map(next.map(word => [word.id, word]));
  const affected = new Set();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const previousWord = before.get(id);
    const nextWord = after.get(id);
    if (previousWord === nextWord) continue;
    const previousIds = new Set(previousWord?.folderIds?.map(String));
    const nextIds = new Set(nextWord?.folderIds?.map(String));
    const detailsChanged = previousWord && nextWord && wordDetailsChanged(previousWord, nextWord);
    for (const folderId of previousIds) {
      if (detailsChanged || !nextIds.has(folderId)) affected.add(folderId);
    }
    for (const folderId of nextIds) {
      if (detailsChanged || !previousIds.has(folderId)) affected.add(folderId);
    }
  }
  return { folders: state.folders.map(folder => affected.has(String(folder.id))
    ? touchFolder(folder, modifiedAt) : folder), vocabData: next };
};
