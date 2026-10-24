import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFolderPickerSortBy, saveFolderPickerSortBy, loadFolderSortBy, saveFolderSortBy } from '../../services/storageService';
import FolderSelectionList from '../search/FolderSelectionList';
import ReviewFoldersSelector from './ReviewFoldersSelector';
import '../../i18n/config';

const folders = [{ id: 'old', name: 'Older folder', _lastModified: 10 }, { id: 'new', name: 'Recent folder', _lastModified: 20 }];
const renderPicker = picker => renderToStaticMarkup(picker === 'save'
  ? <FolderSelectionList folders={folders} savedFolderIds={[]} lastUsedFolderIds={[]} />
  : <ReviewFoldersSelector sortedFolders={folders} selectedReviewFolders={[]} allFolderIds={['old', 'new']} setSelectedReviewFolders={() => {}} />);

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('folder picker sort persistence', () => {
  it.each(['save', 'review'])('restores Recent on every %s picker mount and applies the order', picker => {
    saveFolderPickerSortBy(picker, 'recent_desc');
    for (let mount = 0; mount < 2; mount += 1) {
      const html = renderPicker(picker);
      expect(html).toMatch(/value="recent_desc" selected=""/);
      expect(html.indexOf('Recent folder')).toBeLessThan(html.indexOf('Older folder'));
    }
  });
  it('pins blue and green folders above unselected folders in Recent order', () => {
    saveFolderPickerSortBy('save', 'recent_desc');
    const items = [
      { id: 'plain-new', name: 'Plain newest', _lastModified: 600 },
      { id: 'green-old', name: 'Green older', _lastModified: 10 },
      { id: 'blue-old', name: 'Blue older', _lastModified: 20 },
      { id: 'green-new', name: 'Green newer', _lastModified: 30 },
      { id: 'blue-new', name: 'Blue newer', _lastModified: 40 },
      { id: 'plain-old', name: 'Plain older', _lastModified: 500 }
    ];
    const html = renderToStaticMarkup(<FolderSelectionList folders={items}
      savedFolderIds={['green-old', 'green-new']}
      lastUsedFolderIds={['blue-old', 'blue-new', 'green-new']} />);
    const order = ['Blue newer', 'Blue older', 'Green newer', 'Green older', 'Plain newest', 'Plain older'];
    for (let index = 1; index < order.length; index += 1) {
      expect(html.indexOf(order[index - 1])).toBeGreaterThanOrEqual(0);
      expect(html.indexOf(order[index - 1])).toBeLessThan(html.indexOf(order[index]));
    }
  });
  it('keeps Save, Review and Library preferences independent', () => {
    saveFolderSortBy('count_desc');
    saveFolderPickerSortBy('save', 'recent_desc');
    saveFolderPickerSortBy('review', 'name_asc');
    expect(loadFolderSortBy()).toBe('count_desc');
    expect(loadFolderPickerSortBy('save')).toBe('recent_desc');
    expect(loadFolderPickerSortBy('review')).toBe('name_asc');
  });
  it('restores other supported orders and subsequent changes', () => {
    for (const picker of ['save', 'review']) {
      for (const sort of ['recent_desc', 'name_asc', 'created_desc']) {
        saveFolderPickerSortBy(picker, sort);
        expect(loadFolderPickerSortBy(picker)).toBe(sort);
      }
    }
    saveFolderPickerSortBy('review', 'count_desc');
    expect(loadFolderPickerSortBy('review')).toBe('count_desc');
  });
  it('uses the original default for missing or invalid preferences', () => {
    expect(loadFolderPickerSortBy('save')).toBe('created_desc');
    localStorage.setItem('save_folder_sort_by', 'count_desc');
    expect(loadFolderPickerSortBy('save')).toBe('created_desc');
    localStorage.setItem('review_folder_sort_by', 'invalid');
    expect(loadFolderPickerSortBy('review')).toBe('created_desc');
  });
  it('opens safely when browser storage cannot be read', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(loadFolderPickerSortBy('save')).toBe('created_desc');
    expect(loadFolderPickerSortBy('review')).toBe('created_desc');
  });
});
