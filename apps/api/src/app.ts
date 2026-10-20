import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  bookingInput,
  categoryInput,
  email,
  expertInput,
  id,
  loginInput,
  pagination,
  registerInput,
  reviewInput,
  serviceInput,
  settingsInput,
  slotInput,
} from '@market/contracts';
import { paymentBlockers, type Config } from './config.js';
import { AppError, assert, createProviders, type Providers, verifyHmac } from './providers.js';
import {
  Audit,
  Booking,
  Category,
  Challenge,
  Expert,
  Invite,
  Job,
  Ledger,
  Payout,
  Review,
  Service,
  Session,
  Slot,
  User,
  ensureSettings,
} from './models.js';
import {
  authentication,
  checkInvite,
  checkPassword,
  consumeCode,
  digest,
  hashPassword,
  issueSession,
  publicUser,
  requireAdmin,
  requireUser,
  sendCode,
} from './auth.js';
import {
  actOnBooking,
  addReview,
  addSlot,
  applyCapture,
  audit,
  createOrder,
  expertFor,
  reconcileBooking,
  reserve,
  runPayout,
} from './marketplace.js';

const codeInput = z.object({ email, code: z.string().regex(/^\d{6}$/) }).strict();
const phoneInput = z.object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) }).strict();
const pageMeta = (q: any) => {
  const p = pagination.parse(q);
  return { ...p, skip: (p.page - 1) * p.limit };
};
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expertPublic = (e: any) => ({
  id: String(e._id),
  slug: e.slug,
  name: e.userId?.name ?? 'Expert',
  headline: e.headline,
  bio: e.bio,
  categories: e.categories,
  languages: e.languages,
  city: e.city,
  timezone: e.timezone,
  experienceYears: e.experienceYears,
  verified: true,
});
const servicePublic = (s: any) => ({
  id: String(s._id),
  expertId: String(s.expertId),
  categoryId: String(s.categoryId),
  title: s.title,
  description: s.description,
  durationMinutes: s.durationMinutes,
  pricePaise: s.pricePaise,
  mode: s.mode,
  location: s.mode === 'in_person' ? s.location : undefined,
});

export function createApp(c: Config, p: Providers = createProviders(c)) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", 'https://checkout.razorpay.com', 'https://accounts.google.com'],
          'frame-src': [
            'https://api.razorpay.com',
            'https://checkout.razorpay.com',
            'https://accounts.google.com',
          ],
          'connect-src': ["'self'", 'https://api.razorpay.com', 'https://accounts.google.com'],
          'img-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.setHeader('X-Request-ID', randomBytes(12).toString('hex'));
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'independent-expert-marketplace' }),
  );
  app.get('/api/ready', (_req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ ready: mongoose.connection.readyState === 1 }),
  );
  app.post(
    '/api/webhooks/razorpay',
    express.raw({ type: 'application/json', limit: '128kb' }),
    async (req, res) => {
      assert(
        Buffer.isBuffer(req.body) &&
          verifyHmac(
            req.body,
            String(req.headers['x-razorpay-signature'] ?? ''),
            c.RAZORPAY_WEBHOOK_SECRET,
          ),
        400,
        'BAD_SIGNATURE',
        'Invalid webhook signature',
      );
      const body = JSON.parse(req.body.toString('utf8'));
      const eventId = String(
        req.headers['x-razorpay-event-id'] ?? createHash('sha256').update(req.body).digest('hex'),
      );
      assert(eventId.length <= 200, 400, 'INVALID_EVENT', 'Invalid event identifier');
      if (body.event === 'payment.captured')
        await applyCapture(
          z
            .object({
              id: z.string(),
              order_id: z.string(),
              amount: z.number().int(),
              currency: z.string(),
              status: z.string(),
              amount_refunded: z.number().optional(),
            })
            .parse(body.payload?.payment?.entity),
          eventId,
        );
      else if (body.event?.startsWith('refund.')) {
        const paymentId = body.payload?.refund?.entity?.payment_id;
        const booking = await Booking.findOne({ paymentId });
        if (booking) await reconcileBooking(p, String(booking._id));
      } else if (body.event?.startsWith('payment.dispute.')) {
        const paymentId = body.payload?.dispute?.entity?.payment_id;
        if (paymentId) await Booking.updateOne({ paymentId }, { $set: { dispute: true } });
      }
      res.json({ received: true });
    },
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(
    '/api',
    rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      assert(
        req.get('Origin') === c.APP_ORIGIN && req.get('X-Market-Request') === '1',
        403,
        'ORIGIN_REJECTED',
        'Request origin rejected',
      );
    next();
  });
  app.use('/api', authentication(c));
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const codeLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.use('/api/auth', authLimit);
  app.get('/api/config', (_req, res) =>
    res.json({
      googleClientId: c.GOOGLE_CLIENT_ID,
      phoneEnabled: !!c.TWILIO_VERIFY_SERVICE_SID,
      emailEnabled: !!c.SMTP_HOST,
      betaAccess: c.BETA_ACCESS_MODE,
      paymentMode: c.PAYMENTS_MODE,
      checkoutEnabled: paymentBlockers(c).length === 0,
    }),
  );
  app.get('/api/me', requireUser, (_req, res) => res.json(publicUser(res.locals.user)));
  app.post('/api/auth/register', codeLimit, async (req, res) => {
    const data = registerInput.parse(req.body);
    await checkInvite(c, data.email);
    const existing = await User.findOne({ email: data.email });
    if (!existing) {
      await User.create({
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
      });
    }
    // Deliberately return the same response for existing accounts.
    if (!existing) await sendCode(c, p, data.email, 'verify');
    res
      .status(202)
      .json({
        message:
          'If eligible, a verification code has been sent. Existing members can sign in or request a new code.',
      });
  });
  app.post('/api/auth/email/request', codeLimit, async (req, res) => {
    const { email: target } = z.object({ email }).strict().parse(req.body);
    const u = await User.findOne({ email: target });
    if (u && !u.emailVerified) await sendCode(c, p, target, 'verify');
    res.status(202).json({ message: 'If eligible, a code has been sent' });
  });
  app.post('/api/auth/email/verify', async (req, res) => {
    const data = codeInput.parse(req.body);
    await checkInvite(c, data.email);
    await consumeCode(c, data.email, 'verify', data.code);
    const u = await User.findOneAndUpdate(
      { email: data.email, active: true },
      { $set: { emailVerified: true } },
      { returnDocument: 'after' },
    );
    assert(u, 400, 'INVALID_CODE', 'Invalid verification');
    await issueSession(c, res, u._id);
    res.json(publicUser(u));
  });
  app.post('/api/auth/login', async (req, res) => {
    const data = loginInput.parse(req.body);
    const u = await User.findOne({ email: data.email });
    const valid = await checkPassword(data.password, u?.passwordHash);
    assert(u && valid && u.active, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    assert(u.emailVerified, 403, 'VERIFY_EMAIL', 'Verify your email first');
    await checkInvite(c, u.email);
    await issueSession(c, res, u._id);
    res.json(publicUser(u));
  });
  app.post('/api/auth/password/request', codeLimit, async (req, res) => {
    const data = z.object({ email }).strict().parse(req.body);
    const u = await User.findOne({ email: data.email, active: true });
    if (u) await sendCode(c, p, data.email, 'reset');
    res.status(202).json({ message: 'If eligible, a reset code has been sent' });
  });
  app.post('/api/auth/password/reset', async (req, res) => {
    const data = codeInput.extend({ password: z.string().min(12).max(128) }).parse(req.body);
    await consumeCode(c, data.email, 'reset', data.code);
    const u = await User.findOneAndUpdate(
      { email: data.email, active: true },
      { $set: { passwordHash: await hashPassword(data.password) } },
    );
    if (u) await Session.deleteMany({ userId: u._id });
    res.json({ message: 'Password updated; sign in again' });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies.market_session)
      await Session.deleteOne({ tokenHash: digest(req.cookies.market_session) });
    res.clearCookie('market_session', { path: '/api' });
    res.status(204).end();
  });
  app.get('/api/auth/google/nonce', async (_req, res) => {
    const nonce = randomBytes(32).toString('hex');
    await Challenge.create({
      target: digest(nonce),
      purpose: 'google',
      digest: digest(nonce),
      expiresAt: new Date(Date.now() + 300000),
    });
    res.cookie('market_google_nonce', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: c.NODE_ENV === 'production',
      path: '/api/auth/google',
      maxAge: 300000,
    });
    res.json({ nonce });
  });
  app.post('/api/auth/google', async (req, res) => {
    const data = z
      .object({ credential: z.string().max(6000) })
      .strict()
      .parse(req.body);
    const identity = await p.verifyGoogle(data.credential);
    assert(
      identity.nonce && identity.nonce === req.cookies.market_google_nonce,
      401,
      'INVALID_NONCE',
      'Google sign-in expired; try again',
    );
    assert(
      await Challenge.findOneAndDelete({
        target: digest(identity.nonce),
        purpose: 'google',
        expiresAt: { $gt: new Date() },
      }),
      401,
      'INVALID_NONCE',
      'Google sign-in expired',
    );
    res.clearCookie('market_google_nonce', { path: '/api/auth/google' });
    await checkInvite(c, identity.email);
    let u = await User.findOne({ googleSub: identity.sub });
    if (!u) {
      const existing = await User.findOne({ email: identity.email });
      if (existing) {
        assert(
          String(res.locals.user?._id) === String(existing._id) && existing.emailVerified,
          409,
          'LINK_REQUIRED',
          'Sign in with your existing account first to link Google',
        );
        existing.googleSub = identity.sub;
        u = await existing.save();
      } else
        u = await User.create({
          name: identity.name,
          email: identity.email,
          googleSub: identity.sub,
          emailVerified: true,
        });
    }
    assert(u.active, 403, 'DISABLED', 'Account is disabled');
    await issueSession(c, res, u._id);
    res.json(publicUser(u));
  });
  app.post('/api/auth/phone/request', codeLimit, async (req, res) => {
    const data = phoneInput.parse(req.body);
    await p.startPhone(data.phone);
    res.status(202).json({ message: 'Verification code requested' });
  });
  app.post('/api/auth/phone/verify', async (req, res) => {
    const data = phoneInput.extend({ code: z.string().regex(/^\d{4,10}$/) }).parse(req.body);
    assert(
      await p.verifyPhone(data.phone, data.code),
      401,
      'INVALID_CODE',
      'Invalid or expired code',
    );
    let u = await User.findOne({ phone: data.phone });
    if (res.locals.user) {
      assert(
        !u || String(u._id) === String(res.locals.user._id),
        409,
        'PHONE_LINKED',
        'Phone is linked to another account',
      );
      u = await User.findByIdAndUpdate(
        res.locals.user._id,
        { $set: { phone: data.phone } },
        { returnDocument: 'after' },
      );
    } else if (!u) {
      assert(
        c.BETA_ACCESS_MODE === 'open',
        403,
        'INVITE_REQUIRED',
        'For this beta, sign in by invited email first and link your phone',
      );
      u = await User.create({ name: 'Member', phone: data.phone });
    }
    assert(u?.active, 403, 'DISABLED', 'Account is disabled');
    await checkInvite(c, u.email);
    await issueSession(c, res, u._id);
    res.json(publicUser(u));
  });
  app.post('/api/me/email/request', requireUser, codeLimit, async (req, res) => {
    const data = z.object({ email }).strict().parse(req.body);
    await checkInvite(c, data.email);
    assert(
      !(await User.exists({ email: data.email, _id: { $ne: res.locals.user._id } })),
      409,
      'EMAIL_LINKED',
      'Email is already linked',
    );
    await sendCode(c, p, data.email, `link:${res.locals.user._id}`);
    res.status(202).json({ message: 'Verification code sent' });
  });
  app.post('/api/me/email/verify', requireUser, async (req, res) => {
    const data = codeInput.parse(req.body);
    await consumeCode(c, data.email, `link:${res.locals.user._id}`, data.code);
    const u = await User.findByIdAndUpdate(
      res.locals.user._id,
      { $set: { email: data.email, emailVerified: true } },
      { returnDocument: 'after' },
    );
    res.json(publicUser(u));
  });

  app.get('/api/categories', async (req, res) => {
    const pg = pageMeta(req.query);
    res.json({
      items: await Category.find({ active: true })
        .sort({ name: 1, _id: 1 })
        .skip(pg.skip)
        .limit(pg.limit),
      total: await Category.countDocuments({ active: true }),
      page: pg.page,
    });
  });
  app.get('/api/experts', async (req, res) => {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        category: id.optional(),
        language: z.string().max(30).optional(),
        mode: z.enum(['online', 'in_person']).optional(),
        maxPrice: z.coerce.number().int().min(1).max(10000000).optional(),
      })
      .parse(req.query);
    const pg = pageMeta(req.query);
    const active = await Category.find({ active: true }).select('_id');
    const activeIds = active.map((x) => x._id);
    const serviceFilter: any = { active: true, categoryId: q.category ?? { $in: activeIds } };
    if (q.category && !activeIds.some((x) => String(x) === q.category))
      return res.json({ items: [], total: 0, page: pg.page });
    if (q.mode) serviceFilter.mode = q.mode;
    if (q.maxPrice) serviceFilter.pricePaise = { $lte: q.maxPrice };
    const serviceRows = await Service.find(serviceFilter).select('expertId title');
    const filter: any = {
      verification: 'approved',
      _id: { $in: serviceRows.map((s) => s.expertId) },
    };
    if (q.language) filter.languages = q.language;
    if (q.q) {
      const regex = new RegExp(escapeRegex(q.q), 'i');
      const nameMatches = await User.find({ name: regex, active: true }).select('_id').limit(1000);
      filter.$or = [
        { userId: { $in: nameMatches.map((u) => u._id) } },
        { headline: regex },
        { bio: regex },
        { _id: { $in: serviceRows.filter((s) => regex.test(s.title)).map((s) => s.expertId) } },
      ];
    }
    const rows = await Expert.find(filter)
      .populate('userId', 'name')
      .sort({ _id: 1 })
      .skip(pg.skip)
      .limit(pg.limit);
    const items = [];
    for (const e of rows) {
      const services = await Service.find({ ...serviceFilter, expertId: e._id });
      const reviews = await Review.find({ expertId: e._id, visible: true }).select('rating');
      items.push({
        ...expertPublic(e),
        services: services.map(servicePublic),
        reviewCount: reviews.length,
        rating: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null,
      });
    }
    res.json({ items, total: await Expert.countDocuments(filter), page: pg.page });
  });
  app.get('/api/experts/:slug', async (req, res) => {
    const e = await Expert.findOne({ slug: req.params.slug, verification: 'approved' }).populate(
      'userId',
      'name',
    );
    assert(e, 404, 'NOT_FOUND', 'Expert not found');
    const active = await Category.find({ active: true }).select('_id');
    const services = await Service.find({
      expertId: e._id,
      active: true,
      categoryId: { $in: active.map((x) => x._id) },
    });
    assert(services.length, 404, 'NOT_FOUND', 'No published services');
    const reviews = await Review.find({ expertId: e._id, visible: true })
      .select('rating text createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ ...expertPublic(e), services: services.map(servicePublic), reviews });
  });
  app.get('/api/services/:id/slots', async (req, res) => {
    const service = await Service.findOne({ _id: id.parse(req.params.id), active: true });
    assert(
      service &&
        (await Expert.exists({ _id: service.expertId, verification: 'approved' })) &&
        (await Category.exists({ _id: service.categoryId, active: true })),
      404,
      'NOT_FOUND',
      'Service unavailable',
    );
    res.json({
      items: await Slot.find({
        serviceId: service._id,
        status: 'open',
        startsAt: { $gt: new Date(Date.now() + 3600000) },
      })
        .select('startsAt endsAt')
        .sort({ startsAt: 1 })
        .limit(100),
    });
  });

  app.get('/api/expert/profile', requireUser, async (_req, res) => {
    res.json(await Expert.findOne({ userId: res.locals.user._id }));
  });
  app.put('/api/expert/profile', requireUser, async (req, res) => {
    assert(
      res.locals.user.emailVerified,
      403,
      'VERIFY_EMAIL',
      'Verify your email before onboarding',
    );
    const data = expertInput.parse(req.body);
    assert(
      (await Category.countDocuments({
        _id: { $in: [...new Set(data.categories)] },
        active: true,
      })) === new Set(data.categories).size,
      400,
      'INVALID_CATEGORY',
      'Select active categories',
    );
    const e = await Expert.findOneAndUpdate(
      { userId: res.locals.user._id },
      { $set: { ...data, verification: 'pending' }, $setOnInsert: { userId: res.locals.user._id } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    await User.updateOne({ _id: res.locals.user._id }, { $addToSet: { roles: 'expert' } });
    await audit(res.locals.user._id, 'expert.submit', e._id);
    res.json(e);
  });
  app.get('/api/expert/services', requireUser, async (_req, res) => {
    const e = await expertFor(res.locals.user._id);
    res.json({ items: await Service.find({ expertId: e._id }).sort({ createdAt: -1 }).limit(100) });
  });
  app.post('/api/expert/services', requireUser, async (req, res) => {
    const e = await expertFor(res.locals.user._id);
    const data = serviceInput.parse(req.body);
    assert(
      await Category.exists({ _id: data.categoryId, active: true }),
      400,
      'INVALID_CATEGORY',
      'Select an active category',
    );
    res.status(201).json(await Service.create({ ...data, expertId: e._id }));
  });
  app.put('/api/expert/services/:id', requireUser, async (req, res) => {
    const e = await expertFor(res.locals.user._id);
    const data = serviceInput.parse(req.body);
    assert(
      await Category.exists({ _id: data.categoryId, active: true }),
      400,
      'INVALID_CATEGORY',
      'Select an active category',
    );
    const current = await Service.findOne({ _id: id.parse(req.params.id), expertId: e._id });
    assert(current, 404, 'NOT_FOUND', 'Service not found');
    assert(
      data.durationMinutes === current.durationMinutes ||
        !(await Slot.exists({
          serviceId: current._id,
          status: { $ne: 'closed' },
          endsAt: { $gt: new Date() },
        })),
      409,
      'SLOTS_EXIST',
      'Close future slots before changing duration',
    );
    Object.assign(current, data);
    await current.save();
    res.json(current);
  });
  app.post('/api/expert/slots', requireUser, async (req, res) => {
    const data = slotInput.parse(req.body);
    res
      .status(201)
      .json(await addSlot(res.locals.user._id, data.serviceId, new Date(data.startsAt)));
  });
  app.delete('/api/expert/slots/:id', requireUser, async (req, res) => {
    const e = await expertFor(res.locals.user._id);
    const slot = await Slot.findOneAndUpdate(
      { _id: id.parse(req.params.id), expertId: e._id, status: 'open' },
      { $set: { status: 'closed' } },
      { returnDocument: 'after' },
    );
    assert(slot, 409, 'SLOT_UNAVAILABLE', 'Only open slots can be closed');
    res.json(slot);
  });
  app.get('/api/expert/slots', requireUser, async (req, res) => {
    const e = await expertFor(res.locals.user._id);
    const pg = pageMeta(req.query);
    res.json({
      items: await Slot.find({ expertId: e._id, endsAt: { $gt: new Date() } })
        .sort({ startsAt: 1 })
        .skip(pg.skip)
        .limit(pg.limit),
    });
  });

  app.post('/api/bookings', requireUser, async (req, res) => {
    assert(
      res.locals.user.emailVerified,
      403,
      'VERIFY_EMAIL',
      'Verify an email address before booking',
    );
    const data = bookingInput.parse(req.body);
    res
      .status(201)
      .json(await reserve(res.locals.user._id, data.slotId, req.get('Idempotency-Key') ?? ''));
  });
  app.get('/api/bookings', requireUser, async (req, res) => {
    const pg = pageMeta(req.query);
    const scope = z
      .enum(['customer', 'expert', 'admin'])
      .default('customer')
      .parse(req.query.scope);
    let filter: any = { customerId: res.locals.user._id };
    if (scope === 'expert') filter = { expertId: (await expertFor(res.locals.user._id))._id };
    if (scope === 'admin') {
      assert(res.locals.user.roles.includes('admin'), 403, 'FORBIDDEN', 'Admin access required');
      filter = {};
    }
    res.json({
      items: await Booking.find(filter).sort({ startsAt: -1 }).skip(pg.skip).limit(pg.limit),
      total: await Booking.countDocuments(filter),
      page: pg.page,
    });
  });
  app.post('/api/bookings/:id/order', requireUser, async (req, res) =>
    res.json(await createOrder(c, p, res.locals.user._id, id.parse(req.params.id))),
  );
  app.post('/api/bookings/:id/payment/verify', requireUser, async (req, res) => {
    const data = z
      .object({
        razorpay_order_id: z.string().max(100),
        razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
        razorpay_signature: z.string().length(64),
      })
      .strict()
      .parse(req.body);
    const b = await Booking.findOne({
      _id: id.parse(req.params.id),
      customerId: res.locals.user._id,
    });
    assert(b?.orderId === data.razorpay_order_id, 400, 'ORDER_MISMATCH', 'Order does not match');
    assert(
      verifyHmac(
        `${b.orderId}|${data.razorpay_payment_id}`,
        data.razorpay_signature,
        c.RAZORPAY_KEY_SECRET,
      ),
      400,
      'BAD_SIGNATURE',
      'Invalid payment signature',
    );
    res.json(
      await applyCapture(
        await p.fetchPayment(data.razorpay_payment_id),
        `callback:${data.razorpay_payment_id}`,
      ),
    );
  });
  app.post('/api/bookings/:id/action', requireUser, async (req, res) => {
    const { action } = z
      .object({ action: z.enum(['accept', 'reject', 'cancel', 'complete']) })
      .strict()
      .parse(req.body);
    res.json(await actOnBooking(res.locals.user, id.parse(req.params.id), action));
  });
  app.post('/api/bookings/:id/review', requireUser, async (req, res) =>
    res
      .status(201)
      .json(
        await addReview(res.locals.user._id, id.parse(req.params.id), reviewInput.parse(req.body)),
      ),
  );
  app.get('/api/expert/earnings', requireUser, async (_req, res) => {
    const e = await expertFor(res.locals.user._id);
    const totals = await Booking.aggregate([
      { $match: { expertId: e._id, paymentStatus: 'captured' } },
      {
        $group: {
          _id: '$status',
          grossPaise: { $sum: '$grossPaise' },
          netPaise: { $sum: '$expertPaise' },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json({
      totals,
      payouts: await Payout.find({ expertId: e._id }).sort({ createdAt: -1 }).limit(100),
    });
  });

  app.use('/api/admin', requireUser, requireAdmin);
  app.get('/api/admin/overview', async (_req, res) =>
    res.json({
      pendingExperts: await Expert.countDocuments({ verification: 'pending' }),
      bookings: await Booking.countDocuments(),
      refundsRequired: await Booking.countDocuments({ paymentStatus: 'refund_required' }),
      failedJobs: await Job.countDocuments({ status: 'failed' }),
      paymentBlockers: paymentBlockers(c),
      providerStatus: {
        email: !!c.SMTP_HOST,
        google: !!c.GOOGLE_CLIENT_ID,
        calendar: !!c.GOOGLE_CALENDAR_REFRESH_TOKEN,
        phone: !!c.TWILIO_VERIFY_SERVICE_SID,
        route: c.ROUTE_ENABLED === 'true',
      },
    }),
  );
  app.get('/api/admin/experts', async (req, res) => {
    const pg = pageMeta(req.query);
    res.json({
      items: await Expert.find()
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(pg.skip)
        .limit(pg.limit),
      total: await Expert.countDocuments(),
    });
  });
  app.patch('/api/admin/experts/:id/verification', async (req, res) => {
    const data = z
      .object({
        status: z.enum(['approved', 'rejected', 'suspended']),
        reason: z.string().trim().min(5).max(500),
      })
      .strict()
      .parse(req.body);
    const e = await Expert.findByIdAndUpdate(
      id.parse(req.params.id),
      { $set: { verification: data.status, reviewReason: data.reason } },
      { returnDocument: 'after' },
    );
    assert(e, 404, 'NOT_FOUND', 'Expert not found');
    await audit(res.locals.user._id, 'expert.verify', e._id, data);
    res.json(e);
  });
  app.patch('/api/admin/experts/:id/route', async (req, res) => {
    const data = z
      .object({ routeAccountId: z.string().regex(/^acc_[a-zA-Z0-9]+$/), routeReady: z.boolean() })
      .strict()
      .parse(req.body);
    const e = await Expert.findByIdAndUpdate(
      id.parse(req.params.id),
      { $set: data },
      { returnDocument: 'after' },
    );
    assert(e, 404, 'NOT_FOUND', 'Expert not found');
    await audit(res.locals.user._id, 'expert.route', e._id, { ready: data.routeReady });
    res.json({ id: e._id, routeReady: e.routeReady });
  });
  app.get('/api/admin/categories', async (req, res) => {
    const pg = pageMeta(req.query);
    res.json({
      items: await Category.find().sort({ name: 1, _id: 1 }).skip(pg.skip).limit(pg.limit),
      total: await Category.countDocuments(),
    });
  });
  app.post('/api/admin/categories', async (req, res) => {
    const result = await Category.create(categoryInput.parse(req.body));
    await audit(res.locals.user._id, 'category.create', result._id);
    res.status(201).json(result);
  });
  app.put('/api/admin/categories/:id', async (req, res) => {
    const result = await Category.findByIdAndUpdate(
      id.parse(req.params.id),
      { $set: categoryInput.parse(req.body) },
      { returnDocument: 'after', runValidators: true },
    );
    assert(result, 404, 'NOT_FOUND', 'Category not found');
    await audit(res.locals.user._id, 'category.update', result._id);
    res.json(result);
  });
  app.get('/api/admin/settings', async (_req, res) => res.json(await ensureSettings()));
  app.put('/api/admin/settings', async (req, res) => {
    const settings = await ensureSettings();
    Object.assign(settings, settingsInput.parse(req.body));
    await settings.save();
    await audit(res.locals.user._id, 'settings.update', settings._id, req.body);
    res.json(settings);
  });
  app.post('/api/admin/invites', async (req, res) => {
    const data = z
      .object({ email, active: z.boolean().default(true) })
      .strict()
      .parse(req.body);
    res
      .status(201)
      .json(
        await Invite.findOneAndUpdate(
          { email: data.email },
          { $set: data },
          { upsert: true, returnDocument: 'after' },
        ),
      );
    await audit(res.locals.user._id, 'invite.update', data.email, { active: data.active });
  });
  app.get('/api/admin/exceptions', async (_req, res) =>
    res.json({
      bookings: await Booking.find({
        $or: [
          { paymentStatus: 'refund_required' },
          { orderState: { $in: ['creating', 'unknown'] } },
          { dispute: true },
        ],
      }).limit(100),
      payouts: await Payout.find({ status: { $in: ['unknown', 'processing', 'submitted'] } }).limit(
        100,
      ),
      jobs: await Job.find({ status: 'failed' }).select('-payload').limit(100),
    }),
  );
  app.post('/api/admin/bookings/:id/reconcile', async (req, res) => {
    const result = await reconcileBooking(p, id.parse(req.params.id));
    await audit(res.locals.user._id, 'payment.reconcile', req.params.id);
    res.json(result);
  });
  app.post('/api/admin/bookings/:id/payout', async (req, res) => {
    const data = z
      .object({ reference: z.string().min(6).max(100).optional() })
      .strict()
      .parse(req.body);
    res.json(await runPayout(c, p, res.locals.user._id, id.parse(req.params.id), data.reference));
  });
  app.get('/api/admin/ledger', async (req, res) => {
    const pg = pageMeta(req.query);
    res.json({ items: await Ledger.find().sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit) });
  });
  app.patch('/api/admin/reviews/:id', async (req, res) => {
    const data = z
      .object({ visible: z.boolean(), reason: z.string().min(5).max(500) })
      .strict()
      .parse(req.body);
    const review = await Review.findByIdAndUpdate(
      id.parse(req.params.id),
      { $set: { visible: data.visible } },
      { returnDocument: 'after' },
    );
    assert(review, 404, 'NOT_FOUND', 'Review not found');
    await audit(res.locals.user._id, 'review.moderate', review._id, data);
    res.json(review);
  });
  app.get('/api/admin/audit', async (req, res) => {
    const pg = pageMeta(req.query);
    res.json({ items: await Audit.find().sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit) });
  });
  if (c.NODE_ENV === 'production') {
    const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
    app.use(express.static(webDist));
    app.get('/{*splat}', (req, res, next) =>
      req.path.startsWith('/api/') ? next() : res.sendFile(`${webDist}/index.html`),
    );
  }
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use(
    (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
            },
          });
      if (error?.code === 11000)
        return res
          .status(409)
          .json({
            error: {
              code: 'CONFLICT',
              message: 'This record already exists or was changed by another request',
            },
          });
      if (error instanceof AppError)
        return res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
      if (error?.type === 'entity.too.large')
        return res
          .status(413)
          .json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large' } });
      if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError)
        return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } });
      console.error(
        JSON.stringify({
          level: 'error',
          code: 'INTERNAL_ERROR',
          requestId: res.getHeader('X-Request-ID'),
          type: error?.name,
        }),
      );
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed' } });
    },
  );
  return app;
}
