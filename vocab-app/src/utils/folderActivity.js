const timestamp = value => {
  if (value == null) return 0;
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

export const folderActivityTime = folder => Math.max(
  timestamp(folder._lastModified), timestamp(folder.updated_at), timestamp(folder.created_at)
);

export const compareRecentFolders = (a, b) => folderActivityTime(b) - folderActivityTime(a)
  || (a.name || '').localeCompare(b.name || '', 'zh-Hant')
  || String(a.id).localeCompare(String(b.id));

// Keep mutation tracking atomic with the data change. Background sync never counts as use.
export const libraryDataReducer = (state, { field, value, modifiedAt }) => {
  const next = typeof value === 'function' ? value(state[field]) : value;
  if (field === 'folders') {
    const previous = new Map(state.folders.map(folder => [folder.id, folder]));
    return { ...state, folders: next.map(folder => {
      const old = previous.get(folder.id);
      return { ...folder, _lastModified: modifiedAt && old !== folder
        ? modifiedAt : Math.max(timestamp(folder._lastModified), timestamp(old?._lastModified)) };
    }) };
  }
  if (!modifiedAt) return { ...state, vocabData: next };
  const before = new Map(state.vocabData.map(word => [word.id, word]));
  const after = new Map(next.map(word => [word.id, word]));
  const affected = new Set();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(id) === after.get(id)) continue;
    for (const word of [before.get(id), after.get(id)]) {
      for (const folderId of word?.folderIds || []) affected.add(String(folderId));
    }
  }
  return { folders: state.folders.map(folder => affected.has(String(folder.id))
    ? { ...folder, _lastModified: modifiedAt } : folder), vocabData: next };
};
