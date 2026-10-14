import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from './i18n/config';
import VocabularyApp from './App';

const { app } = vi.hoisted(() => ({ app: {} }));
vi.mock('./hooks/useVocabularyApp', () => ({ default: () => app }));
vi.mock('./providers/AppProviders', () => ({ default: ({ children }) => children }));
vi.mock('./components/layout/Navigation', () => ({ default: () => null }));
vi.mock('./components/common/Toast', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ Toaster: () => null }));
vi.mock('./components/search/SearchTab', () => ({ default: () => <p>Search page</p> }));
vi.mock('./components/settings/SettingsTab', () => ({ default: () => <p>Settings page</p> }));
vi.mock('./components/library/LibraryTab', () => ({ default: () => <p>Loaded library</p> }));
vi.mock('./pages/ReviewPage', () => ({ default: () => <p>Loaded review</p> }));
const render = () => renderToStaticMarkup(<VocabularyApp />);

describe('initial data loading', () => {
  beforeEach(() => {
    i18n.changeLanguage('zh-TW');
    Object.assign(app, {
      navigation: { state: { activeTab: 'library' } },
      settings: { state: { sessionReady: true } },
      library: { state: { isDataLoaded: false, loadError: false }, actions: {} },
      review: { state: { cloudReady: false, cloudStatus: 'syncing' }, actions: {} },
      toast: {},
    });
  });

  it('hides partial folder data until the complete library is loaded', () => {
    expect(render()).toContain('Loading');
    expect(render()).not.toContain('Loaded library');
    app.library.state.isDataLoaded = true;
    expect(render()).toContain('Loaded library');
  });

  it('waits for both the library and daily progress before displaying review', () => {
    app.navigation.state.activeTab = 'review';
    app.review.state.cloudReady = true;
    expect(render()).not.toContain('Loaded review');
    app.library.state.isDataLoaded = true;
    app.review.state.cloudReady = false;
    expect(render()).not.toContain('Loaded review');
    app.review.state.cloudReady = true;
    expect(render()).toContain('Loaded review');
  });

  it('waits for session restoration even if local data is ready', () => {
    app.settings.state.sessionReady = false;
    app.library.state.isDataLoaded = true;
    expect(render()).toContain('Loading');
  });

  it('shows retry after a failed initial sync and leaves settings accessible', () => {
    app.library.state.loadError = true;
    expect(render()).toContain('重新同步');
    expect(render()).not.toContain('Loaded library');
    app.navigation.state.activeTab = 'settings';
    expect(render()).toContain('Settings page');
  });
});
