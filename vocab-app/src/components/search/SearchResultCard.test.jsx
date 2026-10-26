// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchResultCard from './SearchResultCard';
import LibraryWordDetail from '../library/LibraryWordDetail';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));
vi.mock('../../contexts/SettingsContext', () => ({ useSettingsContext: () => ({ state: {} }) }));
vi.mock('../../services/speechService', () => ({ speak: vi.fn(), getAudioUrl: vi.fn() }));
vi.mock('./SearchResultHeader', () => ({ default: () => null }));
vi.mock('./SearchSimilarList', () => ({ default: () => null }));
vi.mock('./SearchMnemonic', () => ({ default: () => null }));
vi.mock('./QuickScrollNav', () => ({ default: () => null }));
vi.mock('./AddDefinitionModal', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const first = { definition: 'a financial institution', translation: '銀行', examples: ['a bank'] };
const second = { definition: 'the side of a river', translation: '河岸', examples: ['river bank'] };
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function render(savedWordInSearch, onSaveWord, normalizedEntries = [first, second]) {
  act(() => root.render(<SearchResultCard searchResult={{ word: 'bank', pos: 'noun' }}
    normalizedEntries={normalizedEntries} savedWordInSearch={savedWordInSearch}
    onSaveWord={onSaveWord} audioPriority={[]} />));
}
async function choose(index) {
  act(() => host.querySelectorAll('[aria-haspopup="menu"]')[index].click());
  await act(async () => document.querySelector('[role="menuitem"]').click());
}
describe('saving individual definitions', () => {
  it('removes a saved bilingual meaning from a translation-only dictionary result', async () => {
    const saved = { word: 'bank', selectedDefinitions: [first, second], folderIds: ['one'] };
    const save = vi.fn().mockResolvedValue({});
    render(saved, save, [{ translation: first.translation, examples: [] }]);
    await choose(0);
    expect(save).toHaveBeenCalledWith(['one'], [second], { showToast: false }, saved);
  });
  it('removes only the chosen meaning in the library detail view', async () => {
    const entry = { id: 'bank', word: 'bank', selectedDefinitions: [first, second] };
    const save = vi.fn().mockResolvedValue({});
    act(() => root.render(<LibraryWordDetail entry={entry} onSaveDefinitions={save} />));
    await choose(0);
    expect(save).toHaveBeenCalledWith(entry, [second]);
  });
  it('shows no definitions in the library after the final removal', () => {
    act(() => root.render(<LibraryWordDetail entry={{ id: 'bank', word: 'bank', definition: first.definition, selectedDefinitions: [] }} />));
    expect(host.textContent).toContain('card.noDefinitions');
    expect(host.textContent).not.toContain(first.definition);
  });
  it('saves only the chosen meaning of a new word', async () => {
    const save = vi.fn().mockResolvedValue({});
    render(null, save);
    await choose(1);
    expect(save).toHaveBeenCalledWith([], [second], { showToast: false }, expect.objectContaining({ word: 'bank' }));
  });
  it('adds a meaning while retaining saved meanings and every folder', async () => {
    const saved = { word: 'bank', selectedDefinitions: [first], folderIds: ['one', 'two'] };
    const save = vi.fn().mockResolvedValue({});
    render(saved, save);
    await choose(1);
    expect(save).toHaveBeenCalledWith(['one', 'two'], [first, second], { showToast: false }, saved);
  });
  it('removes the last meaning and keeps an explicit empty selection after reload', async () => {
    const saved = { word: 'bank', selectedDefinitions: [first], folderIds: ['one'] };
    const save = vi.fn().mockResolvedValue({});
    render(saved, save);
    await choose(0);
    expect(save).toHaveBeenCalledWith(['one'], [], { showToast: false }, saved);
    render({ ...saved, definition: first.definition, selectedDefinitions: [] }, save);
    act(() => host.querySelector('[aria-haspopup="menu"]').click());
    expect(document.querySelector('[role=menuitem]').textContent).toBe('card.saveDefinition');
  });
  it('retains the saved status when persistence fails', async () => {
    const save = vi.fn().mockResolvedValue(false);
    render({ word: 'bank', selectedDefinitions: [first] }, save);
    await choose(0);
    act(() => host.querySelector('[aria-haspopup="menu"]').click());
    expect(document.querySelector('[role=menuitem]').textContent).toBe('card.removeSavedDefinition');
  });
});
