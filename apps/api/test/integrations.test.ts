import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { readConfig } from '../src/config.js';
import {
  effectiveProviderConfig,
  integrationMetadata,
  parseIntegrationUpdate,
  saveIntegration,
} from '../src/integrations.js';
process.env.AUTH_PEPPER ??= 'integration-config-test-pepper-at-least-32-characters';
const directories: string[] = [];
function config() {
  const directory = mkdtempSync(join(tmpdir(), 'industryconnect-integrations-'));
  directories.push(directory);
  return {
    ...readConfig(),
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    EMAIL_FROM: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_CALENDAR_CLIENT_ID: '',
    GOOGLE_CALENDAR_CLIENT_SECRET: '',
    GOOGLE_CALENDAR_REFRESH_TOKEN: '',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_VERIFY_SERVICE_SID: '',
    PROVIDER_CONFIG_PATH: join(directory, 'providers.enc'),
    PROVIDER_CONFIG_KEY: randomBytes(32).toString('hex'),
  };
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    const file = join(directory, 'providers.enc');
    if (existsSync(file)) unlinkSync(file);
    rmdirSync(directory);
  }
});
describe('encrypted admin integration configuration', () => {
  it('encrypts secrets, returns presence only and exposes saved settings across config instances', () => {
    const c = config();
    const body = parseIntegrationUpdate('email', {
      revision: 0,
      enabled: true,
      fields: {
        SMTP_HOST: 'smtp.example.invalid',
        SMTP_PORT: 587,
        SMTP_USER: 'sender',
        SMTP_PASSWORD: 'a-secret-password',
        EMAIL_FROM: 'sender@example.invalid',
      },
      password: 'admin-password',
    });
    const result = saveIntegration(c, 'email', body);
    expect(readFileSync(c.PROVIDER_CONFIG_PATH, 'utf8')).not.toContain('a-secret-password');
    expect(JSON.stringify(result)).not.toContain('a-secret-password');
    expect(effectiveProviderConfig({ ...c }).SMTP_PASSWORD).toBe('a-secret-password');
    expect(result.providers.find((p) => p.id === 'email')?.configured).toBe(true);
    expect(
      result.providers.find((p) => p.id === 'email')?.fields.find((f) => f.key === 'SMTP_PASSWORD'),
    ).toMatchObject({ value: '', configured: true });
    expect(result.revision).toBe(1);
  });
  it('preserves blank secret inputs, supports disabling and explicit clearing, and rejects stale revisions', () => {
    const c = config();
    const update = (
      revision: number,
      enabled: boolean,
      fields: Record<string, unknown>,
      clearSecrets: string[] = [],
    ) =>
      parseIntegrationUpdate('phone', {
        revision,
        enabled,
        fields,
        clearSecrets,
        password: 'admin-password',
      });
    saveIntegration(
      c,
      'phone',
      update(0, true, {
        TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32),
        TWILIO_VERIFY_SERVICE_SID: 'VA' + 'b'.repeat(32),
        TWILIO_AUTH_TOKEN: 'token-secret',
      }),
    );
    saveIntegration(c, 'phone', update(1, true, { TWILIO_AUTH_TOKEN: '' }));
    expect(effectiveProviderConfig(c).TWILIO_AUTH_TOKEN).toBe('token-secret');
    expect(() => saveIntegration(c, 'phone', update(1, false, {}))).toThrow(/changed/);
    saveIntegration(c, 'phone', update(2, false, {}, ['TWILIO_AUTH_TOKEN']));
    expect(effectiveProviderConfig(c).TWILIO_AUTH_TOKEN).toBe('');
    expect(integrationMetadata(c).providers.find((p) => p.id === 'phone')?.configured).toBe(false);
    expect(() => saveIntegration(c, 'phone', update(3, true, {}))).toThrow(/required/);
  });
  it('rejects unknown fields and tampered storage without exposing plaintext', () => {
    const c = config();
    expect(() =>
      parseIntegrationUpdate('google', {
        revision: 0,
        enabled: true,
        fields: { AUTH_PEPPER: 'attack' },
        password: 'admin-password',
      }),
    ).toThrow();
    saveIntegration(
      c,
      'google',
      parseIntegrationUpdate('google', {
        revision: 0,
        enabled: true,
        fields: { GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com' },
        password: 'admin-password',
      }),
    );
    const envelope = JSON.parse(readFileSync(c.PROVIDER_CONFIG_PATH, 'utf8'));
    envelope.tag = Buffer.alloc(16).toString('base64');
    writeFileSync(c.PROVIDER_CONFIG_PATH, JSON.stringify(envelope));
    expect(() => effectiveProviderConfig(c)).toThrow(/securely/);
  });
});
