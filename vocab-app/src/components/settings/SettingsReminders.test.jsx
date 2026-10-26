import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsContext } from '../../contexts/SettingsContext';
import i18n from '../../i18n/config';
import SettingsReminders from './SettingsReminders';

const render = (overrides = {}) => {
  i18n.changeLanguage('zh-TW');
  return renderToStaticMarkup(<SettingsContext.Provider value={{ reminders: {
    state: { loading: false, busy: false, enabled: true, configured: true, supported: true,
      permission: 'granted', time: '20:00', timezone: 'Asia/Taipei', ...overrides },
    actions: {},
  } }}><SettingsReminders /></SettingsContext.Provider>);
};
describe('reminder settings', () => {
  it('shows the daily schedule, device scope and iOS installation instructions', () => {
    const html = render();
    expect(html).toContain('每日複習提醒');
    expect(html).toContain('value="20:00"');
    expect(html).toContain('Asia/Taipei');
    expect(html).toContain('主畫面');
    expect(html).toContain('傳送測試通知');
  });
  it('shows denied permissions while still allowing an existing reminder to be turned off', () => {
    const html = render({ permission: 'denied' });
    expect(html).toContain('通知權限已封鎖');
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).not.toMatch(/type="checkbox"[^>]*disabled/);
  });
  it('explains unsupported browsers and unavailable backend setup', () => {
    expect(render({ supported: false, enabled: false })).toContain('這個瀏覽器尚無法使用背景通知');
    const html = render({ configured: false, enabled: false, message: 'notConfigured' });
    expect(html).toContain('通知服務尚未完成設定');
    expect(html).toMatch(/type="checkbox"[^>]*disabled/);
  });
});
