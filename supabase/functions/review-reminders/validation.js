// Restrict outbound requests to browser push services, including redirects.
export function validPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && endpoint.length <= 2048 && (
        url.hostname === 'fcm.googleapis.com'
        || url.hostname === 'updates.push.services.mozilla.com'
        || url.hostname === 'web.push.apple.com'
        || url.hostname.endsWith('.notify.windows.com')
      );
  } catch { return false; }
}

export function validReminder(value) {
  if (!validPushEndpoint(value?.subscription?.endpoint)
    || !/^[A-Za-z0-9_-]{87}$/.test(value.subscription?.keys?.p256dh)
    || !/^[A-Za-z0-9_-]{22}$/.test(value.subscription?.keys?.auth)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    || !['en', 'zh-TW'].includes(value.language)
    || typeof value.enabled !== 'boolean'
    || typeof value.timezone !== 'string' || value.timezone.length > 100) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); return true; }
  catch { return false; }
}

export function notificationPayload(language, test = false) {
  const en = language === 'en';
  return {
    title: en ? 'Spaced · Daily review' : 'Spaced · 每日複習',
    body: test
      ? (en ? 'Notifications are ready. See you at review time!' : '通知設定成功，到時間會提醒你回來複習！')
      : (en ? 'Take a few minutes to review your words today.' : '花幾分鐘複習今天的單字，累積一點進步吧！'),
    tag: test ? 'spaced-review-test' : 'spaced-daily-review',
    url: '/?review=daily',
  };
}
