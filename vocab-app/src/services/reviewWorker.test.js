import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const worker = () => {
  const handlers = {};
  const clients = { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() };
  const showNotification = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync(new URL('../../public/review-sw.js', import.meta.url), 'utf8'), {
    URL, clients, self: { clients, location: { origin: 'https://spaced.test' }, registration: { showNotification },
      skipWaiting: vi.fn(), addEventListener: (name, handler) => { handlers[name] = handler; } },
  });
  return { handlers, clients, showNotification };
};
describe('review service worker', () => {
  it('shows received pushes while the page is closed', async () => {
    const { handlers, showNotification } = worker();
    await new Promise(resolve => handlers.push({ data: { json: () => ({ title: 'Review', body: 'Come back', url: 'https://evil.test' }) }, waitUntil: resolve }));
    expect(showNotification).toHaveBeenCalledWith('Review', expect.objectContaining({ body: 'Come back', data: { url: '/?review=daily' } }));
  });
  it('still displays a notification for malformed payloads', async () => {
    const { handlers, showNotification } = worker();
    await new Promise(resolve => handlers.push({ data: { json: () => { throw new Error(); } }, waitUntil: resolve }));
    expect(showNotification).toHaveBeenCalledOnce();
  });
  it('opens daily review when no application window is open', async () => {
    const { handlers, clients } = worker();
    await new Promise(resolve => handlers.notificationclick({ notification: { close: vi.fn() }, waitUntil: resolve }));
    expect(clients.openWindow).toHaveBeenCalledWith('/?review=daily');
  });
  it('navigates and focuses an existing window even if the page is still loading', async () => {
    const { handlers, clients } = worker();
    const existing = { url: 'https://spaced.test/', navigate: vi.fn(), focus: vi.fn() };
    clients.matchAll.mockResolvedValue([existing]);
    await new Promise(resolve => handlers.notificationclick({ notification: { close: vi.fn() }, waitUntil: resolve }));
    expect(existing.navigate).toHaveBeenCalledWith('/?review=daily');
    expect(existing.focus).toHaveBeenCalledOnce();
    expect(clients.openWindow).not.toHaveBeenCalled();
  });
});
