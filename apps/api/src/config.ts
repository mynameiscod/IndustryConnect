import { config as dotenv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
dotenv({ path: resolve(process.cwd(), '.env'), quiet: true });
dotenv({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/expert_marketplace?replicaSet=rs0'),
  AUTH_PEPPER: z.string().min(32),
  BETA_ACCESS_MODE: z.enum(['invite', 'open']).default('invite'),
  PAYMENTS_MODE: z.enum(['disabled', 'test', 'live']).default('disabled'),
  LIVE_TRANSACTIONS_ENABLED: z.string().default('false'),
  RELEASE_COMMIT: z.string().default(''),
  RELEASE_EVIDENCE_PATH: z.string().default(''),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  ROUTE_ENABLED: z.string().default('false'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALENDAR_REFRESH_TOKEN: z.string().default(''),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  EMAIL_FROM: z.string().default(''),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_VERIFY_SERVICE_SID: z.string().default(''),
});
export type Config = z.infer<typeof schema>;
export function readConfig() {
  const c = schema.parse(process.env);
  if (c.NODE_ENV === 'production' && c.AUTH_PEPPER.startsWith('replace-with-'))
    throw new Error('Replace the sample AUTH_PEPPER before deploying');
  return c;
}
export function paymentBlockers(c: Config): string[] {
  if (c.PAYMENTS_MODE === 'disabled') return ['Checkout is disabled'];
  const blockers: string[] = [];
  if (!c.RAZORPAY_KEY_SECRET || !c.RAZORPAY_WEBHOOK_SECRET)
    blockers.push('Razorpay secrets missing');
  if (!c.RAZORPAY_KEY_ID.startsWith(c.PAYMENTS_MODE === 'live' ? 'rzp_live_' : 'rzp_test_'))
    blockers.push('Razorpay key mode mismatch');
  if (c.PAYMENTS_MODE === 'live') {
    if (c.LIVE_TRANSACTIONS_ENABLED !== 'true') blockers.push('Live transaction switch is off');
    if (c.BETA_ACCESS_MODE !== 'invite') blockers.push('Beta must be invite-only');
    if (!c.APP_ORIGIN.startsWith('https://')) blockers.push('HTTPS is required');
    const evidenceSchema = z.object({
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      reviewer: z.string().min(3),
      reviewedAt: z.iso.datetime(),
      security: z.literal('pass'),
      reconciliation: z.literal('pass'),
      deployment: z.literal('pass'),
      evidenceLinks: z.array(z.url()).min(3),
    });
    try {
      if (!existsSync(c.RELEASE_EVIDENCE_PATH)) throw new Error();
      const e = evidenceSchema.parse(JSON.parse(readFileSync(c.RELEASE_EVIDENCE_PATH, 'utf8')));
      if (
        e.commit !== c.RELEASE_COMMIT ||
        Date.parse(e.reviewedAt) > Date.now() ||
        Date.now() - Date.parse(e.reviewedAt) > 7 * 86400000
      )
        throw new Error();
    } catch {
      blockers.push(
        'Current exact-commit security, reconciliation and deployment sign-off missing',
      );
    }
    // Remove only in a reviewed release after the documented P0 gaps are closed.
    blockers.push('Source release lock: provider certification and operational P0 work remain');
  }
  return blockers;
}
