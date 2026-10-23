import { describe, expect, it } from 'vitest';
import { compareRecentFolders, libraryDataReducer } from './folderActivity';

describe('recent folder activity', () => {
  const state = { folders: [{ id: 'a', _lastModified: 10 }, { id: 'b', _lastModified: 20 }, { id: 'c' }], vocabData: [{ id: 'word', folderIds: ['a'] }] };
  it('touches both source and destination after a move, leaving other folders alone', () => {
    const next = libraryDataReducer(state, { field: 'vocabData', value: [{ id: 'word', folderIds: ['b'] }], modifiedAt: 100 });
    expect(next.folders.map(f => f._lastModified)).toEqual([100, 100, undefined]);
  });
  it('tracks removal of the last word from a folder', () => {
    const next = libraryDataReducer(state, { field: 'vocabData', value: [], modifiedAt: 100 });
    expect(next.folders[0]._lastModified).toBe(100);
  });
  it('preserves activity on refresh without treating sync as a modification', () => {
    const next = libraryDataReducer(state, { field: 'folders', value: [{ id: 'a', name: 'Synced' }] });
    expect(next.folders[0]._lastModified).toBe(10);
    expect(libraryDataReducer(state, { field: 'vocabData', value: [] }).folders).toBe(state.folders);
  });
  it('tracks edits and creation', () => {
    const next = libraryDataReducer(state, { field: 'folders', value: prev => [...prev.map(f => f.id === 'a' ? { ...f, name: 'Renamed' } : f), { id: 'new' }], modifiedAt: 100 });
    expect(next.folders.map(f => f._lastModified)).toEqual([100, 20, 0, 100]);
  });
  it('tracks adding and editing words in every containing folder', () => {
    const added = libraryDataReducer(state, { field: 'vocabData', value: prev => [...prev, { id: 'new', folderIds: ['b', 'c'] }], modifiedAt: 100 });
    expect(added.folders.map(f => f._lastModified)).toEqual([10, 100, 100]);
    const edited = libraryDataReducer(added, { field: 'vocabData', value: prev => prev.map(word => word.id === 'new' ? { ...word, selectedDefinitions: [{ definition: 'Changed' }] } : word), modifiedAt: 200 });
    expect(edited.folders.map(f => f._lastModified)).toEqual([10, 200, 200]);
  });
  it('keeps activity unchanged for a no-op mutation and after cache reload', () => {
    const unchanged = libraryDataReducer(state, { field: 'vocabData', value: prev => [...prev], modifiedAt: 100 });
    expect(unchanged.folders).toEqual(state.folders);
    const reloaded = JSON.parse(JSON.stringify(state));
    const synced = libraryDataReducer(reloaded, { field: 'folders', value: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    expect(synced.folders.slice(0, 2).sort(compareRecentFolders).map(f => f.id)).toEqual(['b', 'a']);
  });
  it('sorts by modification with creation fallback and tolerates invalid dates', () => {
    const folders = [{ id: 'old', created_at: '2025-01-01' }, { id: 'invalid', updated_at: 'invalid' }, { id: 'edited', _lastModified: Date.parse('2026-10-01'), created_at: '2024-01-01' }];
    expect(folders.sort(compareRecentFolders).map(f => f.id)).toEqual(['edited', 'old', 'invalid']);
  });
});
