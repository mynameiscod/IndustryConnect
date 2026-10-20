import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { splitMoney, effectivePolicy, captureDisposition, serviceInput } from '@market/contracts';
import { verifyHmac } from '../src/providers.js';
import { paymentBlockers, readConfig } from '../src/config.js';
describe('financial and booking invariants', () => {
  it('conserves money for rounding, zero and 100% commission', () => {
    for (const gross of [1, 101, 99999, 10000000])
      for (const bps of [0, 1, 3333, 10000]) {
        const m = splitMoney(gross, bps);
        expect(m.commissionPaise + m.expertPaise).toBe(gross);
        expect(Number.isInteger(m.commissionPaise)).toBe(true);
      }
  });
  it('rejects negative, fractional and invalid commission inputs', () => {
    for (const [gross, bps] of [
      [-1, 100],
      [100.5, 100],
      [100, 10001],
      [NaN, 0],
      [100, -1],
    ])
      expect(() => splitMoney(gross, bps)).toThrow();
  });
  it('enforces admin precedence and service preference', () => {
    expect(effectivePolicy('force_auto', 'manual', 'manual')).toBe('auto');
    expect(effectivePolicy('force_manual', 'auto', 'auto')).toBe('manual');
    expect(effectivePolicy('expert_choice', 'manual', 'auto')).toBe('auto');
    expect(effectivePolicy('expert_choice', 'manual')).toBe('manual');
  });
  it('never revives expired or cancelled bookings after capture', () => {
    const now = new Date();
    expect(captureDisposition('held', new Date(+now - 1), now, 'auto').paymentStatus).toBe(
      'refund_required',
    );
    expect(captureDisposition('cancelled', new Date(+now + 1), now, 'auto').status).toBe(
      'cancelled',
    );
    expect(captureDisposition('held', new Date(+now + 1), now, 'manual').status).toBe(
      'pending_confirmation',
    );
  });
  it('checks HMAC over exact bytes and rejects malformed signatures', () => {
    const raw = '{"event":"payment.captured"}';
    const signature = createHmac('sha256', 'secret').update(raw).digest('hex');
    expect(verifyHmac(raw, signature, 'secret')).toBe(true);
    expect(verifyHmac(`${raw} `, signature, 'secret')).toBe(false);
    expect(verifyHmac(raw, 'bad', 'secret')).toBe(false);
    expect(verifyHmac(raw, signature, '')).toBe(false);
  });
  it('rejects missing in-person location and non-granular duration', () => {
    expect(
      serviceInput.safeParse({
        categoryId: 'a'.repeat(24),
        title: 'Office hours',
        description: 'Detailed business advice for you',
        durationMinutes: 17,
        pricePaise: 10000,
        mode: 'in_person',
        location: '',
      }).success,
    ).toBe(false);
  });
  it('cannot enable live checkout with only a live key and flag', () => {
    process.env.AUTH_PEPPER = 'test-pepper-that-is-longer-than-32-characters';
    const c = {
      ...readConfig(),
      PAYMENTS_MODE: 'live' as const,
      LIVE_TRANSACTIONS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_live_fake',
      RAZORPAY_KEY_SECRET: 'test',
      RAZORPAY_WEBHOOK_SECRET: 'test',
    };
    expect(paymentBlockers(c)).toContain(
      'Source release lock: provider certification and operational P0 work remain',
    );
    expect(paymentBlockers(c).length).toBeGreaterThan(1);
  });
});
