import {
  randomBytes,
  randomInt,
  createHash,
  createHmac,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import type { Types } from 'mongoose';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from './config.js';
import { Challenge, Invite, Session, User } from './models.js';
import { assert, type Providers } from './providers.js';
const scrypt = promisify(scryptCallback);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await scrypt(password, salt, 64)) as Buffer).toString('hex')}`;
}
export async function checkPassword(password: string, stored?: string | null) {
  const [salt, hash] = (stored ?? '00000000000000000000000000000000:' + '00'.repeat(64)).split(':');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected) && !!stored;
}
export const publicUser = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  emailVerified: u.emailVerified,
  roles: u.roles,
  accountPurpose: u.roles?.includes('expert') ? 'expert' : (u.accountPurpose ?? 'customer'),
});
async function hasBetaAccess(c: Config, email?: string | null, newExpert = false) {
  if (c.BETA_ACCESS_MODE === 'open') return true;
  if (!email) return false;
  const invite = await Invite.findOne({ email }).select('active');
  if (invite) return invite.active; // Explicit revocation always wins over expert self-registration.
  if (c.EXPERT_SIGNUP_ENABLED !== 'true') return false;
  return (
    newExpert ||
    !!(await User.exists({
      email,
      active: true,
      $or: [{ accountPurpose: 'expert' }, { roles: 'expert' }],
    }))
  );
}
export async function checkInvite(c: Config, email?: string | null, newExpert = false) {
  assert(
    await hasBetaAccess(c, email, newExpert),
    403,
    'INVITE_REQUIRED',
    'This beta is invitation-only. Ask the marketplace team for access.',
  );
}
export async function issueSession(c: Config, res: Response, userId: Types.ObjectId | string) {
  const token = randomBytes(32).toString('hex');
  await Session.create({
    tokenHash: digest(token),
    userId,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie('market_session', token, {
    httpOnly: true,
    secure: c.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 86400000,
    path: '/api',
  });
}
export function authentication(c: Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.market_session;
    if (token && typeof token === 'string') {
      const s = await Session.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
      if (s) {
        const u = await User.findOne({ _id: s.userId, active: true });
        if (u && (await hasBetaAccess(c, u.email))) res.locals.user = u;
      }
    }
    next();
  };
}
export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  assert(res.locals.user, 401, 'UNAUTHENTICATED', 'Please sign in');
  next();
};
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  assert(res.locals.user?.roles.includes('admin'), 403, 'FORBIDDEN', 'Admin access required');
  next();
};
const codeDigest = (c: Config, target: string, purpose: string, code: string) =>
  createHmac('sha256', c.AUTH_PEPPER).update(`${target}|${purpose}|${code}`).digest('hex');
export async function sendCode(c: Config, p: Providers, target: string, purpose: string) {
  const code = String(randomInt(100000, 1000000));
  await Challenge.findOneAndUpdate(
    { target, purpose },
    {
      $set: {
        digest: codeDigest(c, target, purpose, code),
        attempts: 0,
        expiresAt: new Date(Date.now() + 600000),
      },
      $unset: { usedAt: 1 },
    },
    { upsert: true },
  );
  await p.sendEmail(
    target,
    'Your Expert Market verification code',
    `Your code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
  );
}
export async function consumeCode(c: Config, target: string, purpose: string, code: string) {
  const found = await Challenge.findOneAndUpdate(
    {
      target,
      purpose,
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  );
  assert(found, 400, 'INVALID_CODE', 'Invalid or expired code');
  const valid = timingSafeEqual(
    Buffer.from(found.digest, 'hex'),
    Buffer.from(codeDigest(c, target, purpose, code), 'hex'),
  );
  assert(valid, 400, 'INVALID_CODE', 'Invalid or expired code');
  const used = await Challenge.updateOne(
    {
      _id: found._id,
      digest: found.digest,
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
  );
  assert(used.modifiedCount === 1, 400, 'INVALID_CODE', 'Invalid or expired code');
}
