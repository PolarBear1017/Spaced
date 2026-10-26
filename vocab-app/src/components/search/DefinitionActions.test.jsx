// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DefinitionActions from './DefinitionActions';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key }) }));
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});
function pointer(type, x = 20, y = 20) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: 'touch', clientX: x, clientY: y });
  return event;
}
const render = (props = {}) => act(() => root.render(
  <DefinitionActions onToggle={() => {}} {...props}><p>meaning</p></DefinitionActions>
));

describe('definition context menu', () => {
  it('opens on right click and saves only after choosing the action', () => {
    const onToggle = vi.fn();
    render({ onToggle });
    act(() => host.querySelector('p').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    expect(onToggle).not.toHaveBeenCalled();
    expect(document.querySelector('[role=menuitem]').textContent).toContain('card.saveDefinition');
    act(() => document.querySelector('[role=menuitem]').click());
    expect(onToggle).toHaveBeenCalledOnce();
    expect(document.querySelector('[role=menu]')).toBeNull();
  });
  it('offers removal for a saved meaning and restores focus with Escape', () => {
    render({ isSaved: true });
    const trigger = host.querySelector('button');
    act(() => trigger.click());
    expect(document.querySelector('[role=menuitem]').textContent).toContain('card.removeSavedDefinition');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.querySelector('[role=menu]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('opens on a stationary long press and cancels when scrolling starts', () => {
    vi.useFakeTimers();
    render();
    const meaning = host.querySelector('p');
    act(() => {
      meaning.dispatchEvent(pointer('pointerdown'));
      vi.advanceTimersByTime(500);
    });
    expect(document.querySelector('[role=menu]')).not.toBeNull();
    act(() => window.dispatchEvent(new Event('scroll')));
    act(() => {
      meaning.dispatchEvent(pointer('pointerdown'));
      meaning.dispatchEvent(pointer('pointermove', 20, 50));
      vi.advanceTimersByTime(600);
    });
    expect(document.querySelector('[role=menu]')).toBeNull();
  });
  it('dismisses outside and disables writes while a save is pending', () => {
    const onToggle = vi.fn();
    render({ disabled: true, onToggle });
    act(() => host.querySelector('button').click());
    act(() => document.querySelector('[role=menuitem]').click());
    expect(onToggle).not.toHaveBeenCalled();
    act(() => document.body.dispatchEvent(pointer('pointerdown')));
    expect(document.querySelector('[role=menu]')).toBeNull();
  });
});
