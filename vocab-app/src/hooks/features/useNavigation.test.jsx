import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useNavigation from './useNavigation';

afterEach(() => vi.unstubAllGlobals());
const Probe = () => <span>{useNavigation().state.activeTab}</span>;
describe('notification deep link', () => {
  it('opens daily review on a fresh page load', () => {
    vi.stubGlobal('window', { location: { search: '?review=daily' } });
    expect(renderToStaticMarkup(<Probe />)).toContain('review');
  });
  it('keeps normal app entry on search', () => {
    vi.stubGlobal('window', { location: { search: '?unrelated=1' } });
    expect(renderToStaticMarkup(<Probe />)).toContain('search');
  });
});
