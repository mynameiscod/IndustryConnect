import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import mongoose from 'mongoose';
import {
  Booking,
  Category,
  Expert,
  Service,
  Slot,
  User,
  connect,
  ensureSettings,
  models,
} from '../apps/api/dist/models.js';

if (process.platform === 'linux') process.env.MONGOMS_DISTRO ??= 'ubuntu-22.04';
const replica = await MongoMemoryReplSet.create({
  binary: { version: process.env.MONGOMS_VERSION ?? '7.0.24' },
  replSet: { count: 1, args: process.platform === 'win32' ? [] : ['--nounixsocket'] },
});
const children = [];
let success = false;
try {
  await connect(replica.getUri());
  for (const model of models) await model.createIndexes();
  await ensureSettings();
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    APP_ORIGIN: `http://localhost:${port}`,
    MONGODB_URI: replica.getUri(),
    AUTH_PEPPER: randomBytes(32).toString('hex'),
    BETA_ACCESS_MODE: 'invite',
    PAYMENTS_MODE: 'disabled',
    SMTP_HOST: '',
    EMAIL_FROM: '',
    GOOGLE_CALENDAR_REFRESH_TOKEN: '',
    TWILIO_AUTH_TOKEN: '',
    RAZORPAY_KEY_ID: '',
    RAZORPAY_KEY_SECRET: '',
    RAZORPAY_WEBHOOK_SECRET: '',
  };
  const start = (entry) => {
    const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    return child;
  };
  start('apps/api/dist/server.js');
  const base = `http://127.0.0.1:${port}`;
  async function eventually(check) {
    for (let i = 0; i < 80; i++) {
      try {
        if (await check()) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Smoke check timed out');
  }
  await eventually(async () => (await fetch(`${base}/api/ready`)).ok);
  const page = await fetch(base);
  if (!page.ok || !(await page.text()).includes('IndustryConnect'))
    throw new Error('SPA serving failed');
  const deep = await fetch(`${base}/dashboard`);
  if (!deep.ok || !deep.headers.get('content-security-policy'))
    throw new Error('SPA deep link or headers failed');
  const unauth = await fetch(`${base}/api/me`);
  if (unauth.status !== 401) throw new Error('Authentication check failed');
  const origin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
    body: '{}',
  });
  if (origin.status !== 403) throw new Error('Origin gate failed');
  const configuration = await (await fetch(`${base}/api/config`)).json();
  if (configuration.checkoutEnabled !== false) throw new Error('Checkout was not disabled');
  const customer = await User.create({ name: 'Smoke fixture' }),
    expertUser = await User.create({ name: 'Smoke expert' }),
    category = await Category.create({ name: 'Smoke test', slug: 'smoke-test' });
  const expert = await Expert.create({
    userId: expertUser._id,
    slug: 'smoke-expert',
    headline: 'Smoke fixture only',
    bio: 'A deployment smoke test fixture, not a public expert',
    categories: [category._id],
  });
  const service = await Service.create({
    expertId: expert._id,
    categoryId: category._id,
    title: 'Smoke fixture',
    durationMinutes: 30,
    pricePaise: 10000,
    mode: 'online',
  });
  const bookingId = new mongoose.Types.ObjectId();
  const slot = await Slot.create({
    expertId: expert._id,
    serviceId: service._id,
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 88200000),
    status: 'held',
    bookingId,
    holdUntil: new Date(0),
  });
  await Booking.create({
    _id: bookingId,
    customerId: customer._id,
    expertId: expert._id,
    serviceId: service._id,
    slotId: slot._id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    grossPaise: 10000,
    commissionBps: 1000,
    commissionPaise: 1000,
    expertPaise: 9000,
    status: 'held',
    holdUntil: new Date(0),
    idempotencyKey: 'smoke-expired-reservation',
  });
  start('apps/api/dist/worker-main.js');
  await eventually(async () => (await Booking.findById(bookingId))?.status === 'expired');
  if ((await Slot.findById(slot._id))?.status !== 'open')
    throw new Error('Worker failed to release reservation');
  success = true;
  mkdirSync('.runtime', { recursive: true });
  const report = {
    executedAt: new Date().toISOString(),
    result: 'pass',
    environment: 'local compiled Node services + temporary MongoDB 7.0 replica set',
    checks: [
      'compiled API startup',
      'database readiness',
      'SPA assets and deep links',
      'security headers',
      'unauthenticated request denied',
      'foreign Origin denied',
      'checkout disabled',
      'separate compiled worker expired and released a booking',
    ],
    limits: [
      'not a Docker execution',
      'not HTTPS staging',
      'no provider calls',
      'not a browser or accessibility audit',
      'not backup/restore or rollback certification',
    ],
  };
  writeFileSync('.runtime/deployment-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.info(JSON.stringify(report, null, 2));
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.all(
    children.map((child) =>
      child.exitCode === null
        ? Promise.race([
            once(child, 'exit'),
            new Promise((r) =>
              setTimeout(() => {
                child.kill('SIGKILL');
                r();
              }, 7000),
            ),
          ])
        : Promise.resolve(),
    ),
  );
  await mongoose.disconnect();
  await replica.stop();
  if (!success) process.exitCode = 1;
}
