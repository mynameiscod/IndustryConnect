import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { heartbeatFresh } from '../src/worker-heartbeat.js';
process.env.AUTH_PEPPER ??= 'operations-test-pepper-at-least-32-characters';

describe('proxy and worker operations', () => {
  const config = () => ({
    ...readConfig(),
    AUTH_PEPPER: 'operations-test-pepper-at-least-32-characters',
  });
  it('accepts only the immediate configured proxy and rejects further forwarded hops', () => {
    const app = createApp({ ...config(), TRUSTED_PROXY_IP: '127.0.0.1' });
    const trust = app.get('trust proxy fn');
    expect(trust('::ffff:127.0.0.1', 0)).toBe(true);
    expect(trust('127.0.0.1', 1)).toBe(false);
    expect(trust('198.51.100.2', 0)).toBe(false);
    const untrusted = createApp({ ...config(), TRUSTED_PROXY_IP: '192.0.2.1' });
    expect(untrusted.get('trust proxy fn')('::ffff:127.0.0.1', 0)).toBe(false);
  });
  it('isolates per-client quotas when requests arrive from the trusted proxy', async () => {
    const app = createApp({ ...config(), TRUSTED_PROXY_IP: '127.0.0.1' });
    for (let i = 0; i < 180; i++)
      expect(
        (await request(app).get('/api/config').set('X-Forwarded-For', '203.0.113.10')).status,
      ).toBe(200);
    expect(
      (await request(app).get('/api/config').set('X-Forwarded-For', '203.0.113.10')).status,
    ).toBe(429);
    expect(
      (await request(app).get('/api/config').set('X-Forwarded-For', '203.0.113.11')).status,
    ).toBe(200);
  });
  it('rejects missing, stale, future and malformed heartbeat observations', () => {
    const now = 1000000;
    expect(heartbeatFresh({ lastSuccess: now - 5000 }, now)).toBe(true);
    for (const value of [
      null,
      {},
      { lastSuccess: 'now' },
      { lastSuccess: now + 1 },
      { lastSuccess: now - 600000 },
    ])
      expect(heartbeatFresh(value, now)).toBe(false);
  });
});
