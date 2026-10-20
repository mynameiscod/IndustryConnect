import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { digest, hashPassword } from '../src/auth.js';
import {
  Audit,
  Booking,
  Category,
  Expert,
  Invite,
  Job,
  Ledger,
  Review,
  Service,
  Session,
  Settings,
  Slot,
  User,
  connect,
  ensureSettings,
  models,
} from '../src/models.js';
import {
  addSlot,
  applyCapture,
  reserve,
  actOnBooking,
  expireBookings,
  addReview,
  reconcileBooking,
  recoverOrder,
  runPayout,
} from '../src/marketplace.js';
import type { Providers, ProviderPayment } from '../src/providers.js';
import { processOneJob } from '../src/worker.js';
let repl: MongoMemoryReplSet, app: ReturnType<typeof createApp>, f: any, p: Providers;
process.env.AUTH_PEPPER = 'integration-pepper-at-least-32-characters-long';
if (process.platform === 'linux') process.env.MONGOMS_DISTRO ??= 'ubuntu-22.04';
const c = {
  ...readConfig(),
  NODE_ENV: 'test' as const,
  APP_ORIGIN: 'http://localhost:5173',
  BETA_ACCESS_MODE: 'open' as const,
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  RAZORPAY_KEY_SECRET: 'key-secret',
};
const headers = { Origin: c.APP_ORIGIN, 'X-Market-Request': '1' };
const paid = (b: any, overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  id: 'pay_test',
  order_id: b.orderId,
  amount: b.grossPaise,
  currency: 'INR',
  status: 'captured',
  ...overrides,
});
async function createBooking() {
  const b = await reserve(f.customer._id, String(f.slot._id), 'test-booking-key-001');
  b.orderId = 'order_test';
  await b.save();
  return b;
}
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({
    binary: { version: process.env.MONGOMS_VERSION ?? '7.0.24' },
    replSet: { count: 1, args: process.platform === 'win32' ? [] : ['--nounixsocket'] },
  });
  await connect(repl.getUri());
  for (const m of models) await m.createIndexes();
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
beforeEach(async () => {
  for (const m of models) await m.deleteMany({});
  await ensureSettings();
  p = {
    fetchOrder: vi.fn(),
    createOrder: vi.fn(async (amount) => ({ id: 'order_test', amount, currency: 'INR' })),
    fetchPayment: vi.fn(),
    fetchOrderPayments: vi.fn(),
    transfer: vi.fn(),
    verifyGoogle: vi.fn(),
    createMeeting: vi.fn(async (input) => ({
      eventId: `b${input.bookingId}`,
      url: 'https://meet.google.com/abc-defg-hij',
    })),
    cancelMeeting: vi.fn(),
    sendEmail: vi.fn(),
    startPhone: vi.fn(),
    verifyPhone: vi.fn(),
  };
  app = createApp(c, p);
  const expertUser = await User.create({
    name: 'Expert',
    email: 'expert@example.invalid',
    emailVerified: true,
    roles: ['customer', 'expert'],
  });
  const customer = await User.create({
    name: 'Customer',
    email: 'customer@example.invalid',
    emailVerified: true,
  });
  const other = await User.create({
    name: 'Other',
    email: 'other@example.invalid',
    emailVerified: true,
  });
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@example.invalid',
    emailVerified: true,
    roles: ['admin'],
  });
  const category = await Category.create({ name: 'Technology', slug: 'technology' });
  const expert = await Expert.create({
    userId: expertUser._id,
    slug: 'test-expert',
    headline: 'A thoughtful expert',
    bio: 'Test biography for a verified expert profile',
    verification: 'approved',
    confirmationPolicy: 'auto',
    categories: [category._id],
    languages: ['English'],
  });
  const service = await Service.create({
    expertId: expert._id,
    categoryId: category._id,
    title: 'System design',
    description: 'A detailed system design session',
    durationMinutes: 60,
    pricePaise: 10001,
    mode: 'online',
  });
  const date = new Date(Math.ceil((Date.now() + 86400000) / 900000) * 900000);
  const slot = await addSlot(expertUser._id, String(service._id), date);
  for (const [token, u] of [
    ['customer', customer],
    ['expert', expertUser],
    ['other', other],
    ['admin', admin],
  ] as const)
    await Session.create({
      tokenHash: digest(token),
      userId: u._id,
      expiresAt: new Date(Date.now() + 3600000),
    });
  f = { customer, other, admin, expertUser, expert, category, service, slot };
});
describe('database integrity and authorization', () => {
  it('allows exactly one of 50 concurrent reservations', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        reserve(
          i % 2 ? f.customer._id : f.other._id,
          String(f.slot._id),
          `concurrent-key-${i.toString().padStart(4, '0')}`,
        ),
      ),
    );
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await Booking.countDocuments()).toBe(1);
    expect((await Slot.findById(f.slot._id))?.status).toBe('held');
  });
  it('rejects overlapping availability across services', async () => {
    const second = await Service.create({
      expertId: f.expert._id,
      categoryId: f.category._id,
      title: 'Other service',
      durationMinutes: 30,
      pricePaise: 5000,
      mode: 'online',
    });
    await expect(
      addSlot(f.expertUser._id, String(second._id), new Date(+f.slot.startsAt + 1800000)),
    ).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
  });
  it('returns original booking on replay and rejects payload reuse', async () => {
    const a = await createBooking();
    const b = await reserve(f.customer._id, String(f.slot._id), 'test-booking-key-001');
    expect(String(a._id)).toBe(String(b._id));
    await expect(
      reserve(f.customer._id, new mongoose.Types.ObjectId().toString(), 'test-booking-key-001'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('rejects admin access and foreign-origin writes', async () => {
    expect(
      (
        await request(app)
          .put('/api/admin/settings')
          .set(headers)
          .set('Cookie', 'market_session=customer')
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await request(app).post('/api/auth/login').set('Origin', 'https://evil.invalid').send({}))
        .status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/bookings?scope=admin').set('Cookie', 'market_session=customer'))
        .status,
    ).toBe(403);
  });
  it('keeps private expert and user fields out of public data', async () => {
    await Expert.updateOne(
      { _id: f.expert._id },
      { $set: { routeAccountId: 'acc_private', reviewReason: 'private notes' } },
    );
    const r = await request(app).get('/api/experts/test-expert');
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/acc_private|private notes|expert@example/);
  });
  it('does not publish pending experts', async () => {
    await Expert.updateOne({ _id: f.expert._id }, { $set: { verification: 'pending' } });
    expect((await request(app).get('/api/experts')).body.items).toHaveLength(0);
    expect((await request(app).get('/api/experts/test-expert')).status).toBe(404);
  });
  it('does not allow another customer to cancel a booking', async () => {
    const b = await createBooking();
    await expect(actOnBooking(f.other, String(b._id), 'cancel')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('fails closed when checkout is not configured', async () => {
    const b = await createBooking();
    const r = await request(app)
      .post(`/api/bookings/${b._id}/order`)
      .set(headers)
      .set('Cookie', 'market_session=customer')
      .send({});
    expect(r.status).toBe(503);
    expect(p.createOrder).not.toHaveBeenCalled();
  });
  it('registers, verifies, logs in and revokes sessions without role escalation', async () => {
    const email = 'new@example.invalid';
    const password = 'long-enough-password!';
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .set(headers)
          .send({ name: 'New member', email, password, roles: ['admin'] })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .set(headers)
          .send({ name: 'New member', email, password })
      ).status,
    ).toBe(202);
    const message = vi.mocked(p.sendEmail).mock.calls[0][2];
    const code = message.match(/\b\d{6}\b/)![0];
    const verified = await request(app)
      .post('/api/auth/email/verify')
      .set(headers)
      .send({ email, code });
    expect(verified.status).toBe(200);
    expect(verified.body.roles).toEqual(['customer']);
    expect(
      (await request(app).post('/api/auth/email/verify').set(headers).send({ email, code })).status,
    ).toBe(400);
    const login = await request(app).post('/api/auth/login').set(headers).send({ email, password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect(
      (await request(app).post('/api/auth/logout').set(headers).set('Cookie', cookie).send({}))
        .status,
    ).toBe(204);
    expect((await request(app).get('/api/me').set('Cookie', cookie)).status).toBe(401);
  });
  it('rejects uninvited registration without creating a user', async () => {
    const inviteApp = createApp({ ...c, BETA_ACCESS_MODE: 'invite' }, p);
    const r = await request(inviteApp).post('/api/auth/register').set(headers).send({
      name: 'New member',
      email: 'unknown@example.invalid',
      password: 'long-enough-password!',
    });
    expect(r.status).toBe(403);
    expect(await User.exists({ email: 'unknown@example.invalid' })).toBeNull();
  });
});
describe('payment state and fulfillment', () => {
  it('recovers one ambiguous order without reviving an expired hold or creating an order', async () => {
    const b = await reserve(f.customer._id, String(f.slot._id), 'recover-order-key');
    await Booking.updateOne(
      { _id: b._id },
      { $set: { orderState: 'unknown', holdUntil: new Date(0) } },
    );
    await expireBookings();
    vi.mocked(p.fetchOrder).mockResolvedValue({
      id: 'order_recovered',
      receipt: String(b._id),
      amount: b.grossPaise,
      currency: 'INR',
      partial_payment: false,
    });
    const results = await Promise.allSettled([
      recoverOrder(p, String(b._id), 'order_recovered'),
      recoverOrder(p, String(b._id), 'order_recovered'),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await Audit.countDocuments({ action: 'payment.order-recovered' })).toBe(1);
    expect(p.createOrder).not.toHaveBeenCalled();
    const recovered = await Booking.findById(b._id);
    expect(recovered?.orderId).toBe('order_recovered');
    expect((await Slot.findById(b.slotId))?.status).toBe('open');
    await applyCapture(paid(recovered), 'recovered-late-capture');
    expect((await Booking.findById(b._id))?.paymentStatus).toBe('refund_required');
  });
  it('rejects mismatched recovery evidence and leaves the order ambiguous', async () => {
    const b = await reserve(f.customer._id, String(f.slot._id), 'recover-mismatch-key');
    await Booking.updateOne({ _id: b._id }, { $set: { orderState: 'unknown' } });
    const order = {
      id: 'order_recovered',
      receipt: String(b._id),
      amount: b.grossPaise,
      currency: 'INR',
      partial_payment: false,
    };
    for (const change of [
      { receipt: String(f.other._id) },
      { amount: b.grossPaise + 1 },
      { currency: 'USD' },
      { partial_payment: true },
      { id: 'order_other' },
    ]) {
      vi.mocked(p.fetchOrder).mockResolvedValue({ ...order, ...change });
      await expect(recoverOrder(p, String(b._id), order.id)).rejects.toMatchObject({
        code: 'ORDER_MISMATCH',
      });
    }
    expect((await Booking.findById(b._id))?.orderState).toBe('unknown');
    expect((await Booking.findById(b._id))?.orderId).toBeUndefined();
    expect(p.createOrder).not.toHaveBeenCalled();
  });
  it('captures once across webhook IDs and callback, preserving balanced ledger', async () => {
    const b = await createBooking();
    await applyCapture(paid(b), 'event-one');
    await applyCapture(paid(b), 'event-one');
    await applyCapture(paid(b), 'event-two');
    expect(await Ledger.countDocuments({ kind: 'capture' })).toBe(1);
    expect((await Booking.findById(b._id))?.status).toBe('confirmed');
    expect(await Job.countDocuments({ type: 'meet' })).toBe(1);
    const l = await Ledger.findOne();
    expect(l!.commissionPaise! + l!.expertPaise!).toBe(l!.grossPaise);
  });
  it('rejects amount, currency and authorized-only payments', async () => {
    const b = await createBooking();
    for (const change of [{ amount: 1 }, { currency: 'USD' }, { status: 'authorized' }])
      await expect(applyCapture(paid(b, change), 'bad-event')).rejects.toThrow();
    expect(await Ledger.countDocuments()).toBe(0);
  });
  it('rejects a tampered webhook and accepts an authentic duplicate safely', async () => {
    const b = await createBooking();
    const body = { event: 'payment.captured', payload: { payment: { entity: paid(b) } } };
    const raw = JSON.stringify(body);
    const signature = createHmac('sha256', c.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    expect(
      (
        await request(app)
          .post('/api/webhooks/razorpay')
          .set('Content-Type', 'application/json')
          .set('x-razorpay-signature', 'bad')
          .send(raw)
      ).status,
    ).toBe(400);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(app)
            .post('/api/webhooks/razorpay')
            .set('Content-Type', 'application/json')
            .set('x-razorpay-signature', signature)
            .set('x-razorpay-event-id', 'event-valid')
            .send(raw)
        ).status,
      ).toBe(200);
    expect(await Ledger.countDocuments()).toBe(1);
  });
  it('late capture after hold expiry never reclaims a rebooked slot', async () => {
    const b = await createBooking();
    await Booking.updateOne({ _id: b._id }, { $set: { holdUntil: new Date(0) } });
    await expireBookings();
    const replacement = await reserve(f.other._id, String(f.slot._id), 'replacement-booking-key');
    await applyCapture(paid(b), 'late-event');
    expect((await Booking.findById(b._id))?.paymentStatus).toBe('refund_required');
    expect(String((await Slot.findById(f.slot._id))?.bookingId)).toBe(String(replacement._id));
    expect(await Job.countDocuments({ type: 'meet' })).toBe(0);
  });
  it('manual reject queues refund and releases slot', async () => {
    await Expert.updateOne({ _id: f.expert._id }, { $set: { confirmationPolicy: 'manual' } });
    const b = await createBooking();
    await applyCapture(paid(b), 'manual-event');
    expect((await Booking.findById(b._id))?.status).toBe('pending_confirmation');
    await actOnBooking(f.expertUser, String(b._id), 'reject');
    expect((await Booking.findById(b._id))?.paymentStatus).toBe('refund_required');
    expect((await Slot.findById(f.slot._id))?.status).toBe('open');
  });
  it('creates a real-adapter-bound meeting job, not a fabricated URL', async () => {
    const b = await createBooking();
    await applyCapture(paid(b), 'meet-event');
    await processOneJob(p);
    expect(p.createMeeting).toHaveBeenCalledTimes(1);
    expect((await Booking.findById(b._id))?.meetingStatus).toBe('ready');
  });
  it('allows one review only from the paid booking owner after completion', async () => {
    const b = await createBooking();
    await expect(
      addReview(f.customer._id, String(b._id), { rating: 5, text: 'A useful conversation' }),
    ).rejects.toThrow();
    await applyCapture(paid(b), 'review-event');
    await Booking.updateOne(
      { _id: b._id },
      { $set: { status: 'completed', endsAt: new Date(Date.now() - 1000) } },
    );
    await expect(
      addReview(f.other._id, String(b._id), { rating: 5, text: 'A useful conversation' }),
    ).rejects.toThrow();
    await addReview(f.customer._id, String(b._id), { rating: 5, text: 'A useful conversation' });
    await expect(
      addReview(f.customer._id, String(b._id), { rating: 5, text: 'A useful conversation' }),
    ).rejects.toThrow();
    expect(await Review.countDocuments()).toBe(1);
  });
  it('reconciles a refund once and releases the slot', async () => {
    const b = await createBooking();
    await applyCapture(paid(b), 'refund-event');
    vi.mocked(p.fetchOrderPayments).mockResolvedValue([
      paid(b, { status: 'refunded', amount_refunded: b.grossPaise }),
    ]);
    await reconcileBooking(p, String(b._id));
    await reconcileBooking(p, String(b._id));
    expect((await Booking.findById(b._id))?.paymentStatus).toBe('refunded');
    expect(await Ledger.countDocuments({ kind: 'refund' })).toBe(1);
  });
});

describe('release-sensitive follow-up cases', () => {
  it('revokes authenticated beta access when an invite is disabled', async () => {
    const inviteApp = createApp({ ...c, BETA_ACCESS_MODE: 'invite' }, p);
    await Invite.create({ email: f.customer.email });
    expect(
      (await request(inviteApp).get('/api/me').set('Cookie', 'market_session=customer')).status,
    ).toBe(200);
    await Invite.updateOne({ email: f.customer.email }, { $set: { active: false } });
    expect(
      (await request(inviteApp).get('/api/me').set('Cookie', 'market_session=customer')).status,
    ).toBe(401);
  });
  it('permits republishing a previously closed interval', async () => {
    await Slot.updateOne({ _id: f.slot._id }, { $set: { status: 'closed' } });
    const slot = await addSlot(f.expertUser._id, String(f.service._id), f.slot.startsAt);
    expect(slot?.status).toBe('open');
  });
  it('consumes the Google nonce once and rejects replay', async () => {
    const nonce = await request(app).get('/api/auth/google/nonce');
    vi.mocked(p.verifyGoogle).mockResolvedValue({
      sub: 'google-test-123',
      email: 'google@example.invalid',
      name: 'Google member',
      nonce: nonce.body.nonce,
    });
    const cookie = nonce.headers['set-cookie'][0].split(';')[0];
    const first = await request(app)
      .post('/api/auth/google')
      .set(headers)
      .set('Cookie', cookie)
      .send({ credential: 'test-credential' });
    expect(first.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/google')
          .set(headers)
          .set('Cookie', cookie)
          .send({ credential: 'test-credential' })
      ).status,
    ).toBe(401);
  });
  it('records one eligible manual payout after provider reconciliation', async () => {
    const b = await createBooking();
    await applyCapture(paid(b), 'payout-event');
    await Booking.updateOne(
      { _id: b._id },
      { $set: { status: 'completed', endsAt: new Date(Date.now() - 72 * 3600000) } },
    );
    vi.mocked(p.fetchPayment).mockResolvedValue(paid(b));
    const config = { ...c, PAYMENTS_MODE: 'test' as const, RAZORPAY_KEY_ID: 'rzp_test_mock' };
    const payout = await runPayout(
      config,
      p,
      f.admin._id,
      String(b._id),
      'test-bank-reference-001',
    );
    expect(payout.status).toBe('paid');
    expect(payout.amountPaise).toBe(b.expertPaise);
    expect(p.transfer).not.toHaveBeenCalled();
    await expect(
      runPayout(config, p, f.admin._id, String(b._id), 'test-bank-reference-001'),
    ).rejects.toThrow();
  });
  it('blocks automatic payouts when Route is not ready', async () => {
    const b = await createBooking();
    await applyCapture(paid(b), 'route-event');
    await Booking.updateOne(
      { _id: b._id },
      { $set: { status: 'completed', endsAt: new Date(Date.now() - 72 * 3600000) } },
    );
    await Settings.updateOne({ key: 'marketplace' }, { $set: { payoutMode: 'automatic' } });
    vi.mocked(p.fetchPayment).mockResolvedValue(paid(b));
    await expect(
      runPayout(
        { ...c, PAYMENTS_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_mock' },
        p,
        f.admin._id,
        String(b._id),
      ),
    ).rejects.toMatchObject({ code: 'ROUTE_UNAVAILABLE' });
    expect(p.transfer).not.toHaveBeenCalled();
  });
});
