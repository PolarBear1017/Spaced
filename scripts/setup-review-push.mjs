import { createECDH } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A persistent VAPID key pair identifies this application to browser push services.
// Never print private keys or rotate automatically: that invalidates subscriptions.
const file = fileURLToPath(new URL('../.env.review-push.local', import.meta.url));
if (existsSync(file)) {
  console.log('Push key file already exists; keeping the existing keys.');
} else {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  writeFileSync(file, [
    `REVIEW_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`,
    `REVIEW_VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`,
    'REVIEW_VAPID_SUBJECT=https://spaced-vocabulary.vercel.app',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created ignored .env.review-push.local. Keep it private and backed up.');
}
