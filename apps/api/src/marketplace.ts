import mongoose, { type ClientSession } from 'mongoose';
import { captureDisposition, effectivePolicy, splitMoney } from '@market/contracts';
import {
  Audit,
  Booking,
  Category,
  Expert,
  Job,
  Ledger,
  PaymentEvent,
  Payout,
  Review,
  Service,
  Settings,
  Slot,
  User,
} from './models.js';
import { assert, type ProviderPayment, type Providers } from './providers.js';
import { paymentBlockers, type Config } from './config.js';

export const audit = async (
  actorId: mongoose.Types.ObjectId | string,
  action: string,
  resourceId: unknown,
  details: unknown = {},
) => {
  await Audit.create({ actorId, action, resourceId: String(resourceId), details });
};
export async function enqueue(
  key: string,
  type: string,
  payload: unknown,
  session?: ClientSession,
  nextRunAt = new Date(),
) {
  await Job.updateOne(
    { key },
    { $setOnInsert: { key, type, payload, nextRunAt, status: 'queued' } },
    { upsert: true, session },
  );
}
export const expertFor = async (userId: mongoose.Types.ObjectId | string) => {
  const e = await Expert.findOne({ userId });
  assert(e, 403, 'EXPERT_REQUIRED', 'Create your expert profile first');
  return e;
};
export async function addSlot(
  userId: mongoose.Types.ObjectId | string,
  serviceId: string,
  startsAt: Date,
) {
  assert(
    startsAt.getTime() > Date.now() + 3600000 && startsAt.getTime() < Date.now() + 180 * 86400000,
    400,
    'INVALID_TIME',
    'Slots must be 1 hour to 180 days in the future',
  );
  assert(startsAt.getTime() % (15 * 60000) === 0, 400, 'INVALID_TIME', 'Use a 15-minute boundary');
  return mongoose.connection.transaction(async (session) => {
    const expert = await Expert.findOneAndUpdate(
      { userId },
      { $inc: { scheduleVersion: 1 } },
      { session, returnDocument: 'after' },
    );
    assert(expert, 403, 'EXPERT_REQUIRED', 'Expert profile required');
    const service = await Service.findOne({
      _id: serviceId,
      expertId: expert._id,
      active: true,
    }).session(session);
    assert(service, 404, 'NOT_FOUND', 'Service not found');
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60000);
    const overlaps = await Slot.exists({
      expertId: expert._id,
      status: { $ne: 'closed' },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    }).session(session);
    assert(!overlaps, 409, 'SLOT_CONFLICT', 'This overlaps another availability slot');
    return (
      await Slot.create([{ expertId: expert._id, serviceId, startsAt, endsAt }], { session })
    )[0];
  });
}
export async function reserve(
  customerId: mongoose.Types.ObjectId | string,
  slotId: string,
  key: string,
) {
  assert(
    /^[\w-]{12,100}$/.test(key),
    400,
    'IDEMPOTENCY_REQUIRED',
    'Provide an Idempotency-Key of 12–100 characters',
  );
  return mongoose.connection.transaction(async (session) => {
    const previous = await Booking.findOne({ customerId, idempotencyKey: key }).session(session);
    if (previous) {
      assert(
        String(previous.slotId) === slotId,
        409,
        'IDEMPOTENCY_CONFLICT',
        'Key already used for another slot',
      );
      return previous;
    }
    const slot = await Slot.findOne({
      _id: slotId,
      status: 'open',
      startsAt: { $gt: new Date(Date.now() + 3600000) },
    }).session(session);
    assert(slot, 409, 'SLOT_UNAVAILABLE', 'This slot is no longer available');
    const expert = await Expert.findOne({ _id: slot.expertId, verification: 'approved' }).session(
      session,
    );
    const service = await Service.findOne({ _id: slot.serviceId, active: true }).session(session);
    assert(
      expert &&
        service &&
        (await Category.exists({ _id: service.categoryId, active: true }).session(session)),
      409,
      'SERVICE_UNAVAILABLE',
      'This service is unavailable',
    );
    assert(
      String(expert.userId) !== String(customerId),
      400,
      'SELF_BOOKING',
      'You cannot book yourself',
    );
    const settings = await Settings.findOne({ key: 'marketplace' }).session(session);
    assert(settings, 503, 'SETUP_REQUIRED', 'Marketplace setup is incomplete');
    const holdUntil = new Date(Date.now() + 600000);
    const bookingId = new mongoose.Types.ObjectId();
    const claimed = await Slot.updateOne(
      { _id: slotId, status: 'open' },
      { $set: { status: 'held', holdUntil, bookingId } },
      { session },
    );
    assert(
      claimed.modifiedCount === 1,
      409,
      'SLOT_UNAVAILABLE',
      'This slot is no longer available',
    );
    const confirmationPolicy = effectivePolicy(
      settings.confirmationPolicy as any,
      expert.confirmationPolicy as any,
      service.confirmationPolicy as any,
    );
    const booking = (
      await Booking.create(
        [
          {
            _id: bookingId,
            customerId,
            expertId: expert._id,
            serviceId: service._id,
            slotId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            title: service.title,
            mode: service.mode,
            location: service.location,
            ...splitMoney(service.pricePaise, settings.commissionBps),
            confirmationPolicy,
            status: 'held',
            holdUntil,
            idempotencyKey: key,
          },
        ],
        { session },
      )
    )[0];
    return booking;
  });
}
export async function createOrder(
  c: Config,
  p: Providers,
  customerId: mongoose.Types.ObjectId | string,
  bookingId: string,
) {
  const blockers = paymentBlockers(c);
  assert(!blockers.length, 503, 'CHECKOUT_BLOCKED', blockers.join('; '));
  const b = await Booking.findOne({
    _id: bookingId,
    customerId,
    status: 'held',
    holdUntil: { $gt: new Date() },
  });
  assert(b, 409, 'BOOKING_UNAVAILABLE', 'Booking is not payable');
  if (b.orderId)
    return { orderId: b.orderId, amount: b.grossPaise, currency: 'INR', keyId: c.RAZORPAY_KEY_ID };
  const claimed = await Booking.updateOne(
    { _id: b._id, orderState: 'none' },
    { $set: { orderState: 'creating' } },
  );
  assert(
    claimed.modifiedCount === 1,
    409,
    'ORDER_PENDING',
    'Order creation is pending or requires reconciliation',
  );
  try {
    const order = await p.createOrder(b.grossPaise, String(b._id));
    assert(
      order.amount === b.grossPaise && order.currency === 'INR',
      502,
      'ORDER_MISMATCH',
      'Provider order amount mismatch',
    );
    await Booking.updateOne(
      { _id: b._id, orderState: 'creating' },
      { $set: { orderId: order.id, orderState: 'ready' } },
    );
    return { orderId: order.id, amount: order.amount, currency: 'INR', keyId: c.RAZORPAY_KEY_ID };
  } catch (error) {
    await Booking.updateOne(
      { _id: b._id, orderState: 'creating' },
      { $set: { orderState: 'unknown' } },
    );
    throw error;
  }
}
export async function applyCapture(payment: ProviderPayment, eventId: string) {
  assert(payment.status === 'captured', 409, 'NOT_CAPTURED', 'Payment capture is still pending');
  return mongoose.connection.transaction(async (session) => {
    const b = await Booking.findOne({ orderId: payment.order_id }).session(session);
    assert(b, 409, 'UNMATCHED_PAYMENT', 'Payment has no matching booking; reconcile it');
    assert(
      payment.amount === b.grossPaise && payment.currency === 'INR',
      409,
      'PAYMENT_MISMATCH',
      'Payment does not match booking',
    );
    const existing = await PaymentEvent.findOne({ providerEventId: eventId }).session(session);
    if (existing) {
      assert(
        String(existing.bookingId) === String(b._id),
        409,
        'EVENT_CONFLICT',
        'Event is associated with another booking',
      );
      return b;
    }
    await PaymentEvent.create(
      [{ providerEventId: eventId, kind: 'capture', bookingId: b._id, paymentId: payment.id }],
      { session },
    );
    if (b.paymentId) {
      assert(
        b.paymentId === payment.id,
        409,
        'PAYMENT_CONFLICT',
        'Booking has a different payment',
      );
      return b;
    }
    const now = new Date();
    const disposition = captureDisposition(b.status, b.holdUntil, now, b.confirmationPolicy!);
    b.paymentId = payment.id;
    b.paymentStatus = disposition.paymentStatus as any;
    b.status = disposition.status as any;
    b.reconciledAt = now;
    if (payment.amount_refunded) b.paymentStatus = 'refund_required';
    if (b.paymentStatus === 'refund_required') {
      if (b.status === 'held') b.status = 'expired';
      else if (['confirmed', 'pending_confirmation'].includes(b.status)) b.status = 'cancelled';
      await Slot.updateOne(
        { _id: b.slotId, bookingId: b._id },
        { $set: { status: 'open' }, $unset: { bookingId: 1, holdUntil: 1 } },
        { session },
      );
    } else {
      await Slot.updateOne(
        { _id: b.slotId, bookingId: b._id },
        { $set: { status: 'booked' }, $unset: { holdUntil: 1 } },
        { session },
      );
      if (b.status === 'pending_confirmation')
        b.confirmationDeadline = new Date(
          Math.min(now.getTime() + 86400000, b.startsAt.getTime() - 1800000),
        );
      if (b.status === 'confirmed') await fulfill(b, session);
    }
    await Ledger.create(
      [
        {
          bookingId: b._id,
          kind: 'capture',
          grossPaise: b.grossPaise,
          commissionPaise: b.commissionPaise,
          expertPaise: b.expertPaise,
        },
      ],
      { session },
    );
    await b.save({ session });
    await enqueue(
      `payment:${b._id}`,
      'notify',
      {
        bookingId: String(b._id),
        event:
          b.paymentStatus === 'refund_required' ? 'Payment needs a refund' : 'Payment received',
      },
      session,
    );
    return b;
  });
}
async function fulfill(b: any, session: ClientSession) {
  if (b.mode === 'online') {
    b.meetingStatus = 'pending';
    await enqueue(`meet:${b._id}`, 'meet', { bookingId: String(b._id) }, session);
  }
  await enqueue(
    `confirmed:${b._id}`,
    'notify',
    { bookingId: String(b._id), event: 'Booking confirmed' },
    session,
  );
  const reminder = new Date(b.startsAt.getTime() - 3600000);
  if (reminder > new Date())
    await enqueue(`reminder:${b._id}`, 'reminder', { bookingId: String(b._id) }, session, reminder);
}
export async function actOnBooking(
  user: any,
  bookingId: string,
  action: 'accept' | 'reject' | 'cancel' | 'complete',
) {
  const result = await mongoose.connection.transaction(async (session) => {
    const b = await Booking.findById(bookingId).session(session);
    assert(b, 404, 'NOT_FOUND', 'Booking not found');
    const expert = await Expert.findById(b.expertId).session(session);
    const admin = user.roles.includes('admin');
    const owner = String(expert?.userId) === String(user._id);
    const customer = String(b.customerId) === String(user._id);
    assert(
      admin || owner || (action === 'cancel' && customer),
      403,
      'FORBIDDEN',
      'This action is not permitted',
    );
    if (action === 'accept') {
      assert(
        b.status === 'pending_confirmation' &&
          b.paymentStatus === 'captured' &&
          b.confirmationDeadline! > new Date(),
        409,
        'INVALID_STATE',
        'This booking can no longer be accepted',
      );
      b.status = 'confirmed';
      await fulfill(b, session);
    } else if (action === 'complete') {
      assert(
        b.status === 'confirmed' &&
          b.paymentStatus === 'captured' &&
          b.endsAt <= new Date() &&
          !b.dispute,
        409,
        'INVALID_STATE',
        'Only ended, confirmed paid sessions may be completed',
      );
      b.status = 'completed';
    } else {
      assert(
        ['held', 'pending_confirmation', 'confirmed'].includes(b.status) && b.startsAt > new Date(),
        409,
        'INVALID_STATE',
        'This booking cannot be cancelled automatically',
      );
      if (action === 'reject')
        assert(
          b.status === 'pending_confirmation',
          409,
          'INVALID_STATE',
          'Only pending requests can be rejected',
        );
      b.status = 'cancelled';
      if (b.paymentStatus === 'captured') b.paymentStatus = 'refund_required';
      await Slot.updateOne(
        { _id: b.slotId, bookingId: b._id },
        { $set: { status: 'open' }, $unset: { bookingId: 1, holdUntil: 1 } },
        { session },
      );
      if (b.mode === 'online' && b.meetingStatus !== 'not_requested')
        await enqueue(`cancel-meet:${b._id}`, 'cancel-meet', { bookingId: String(b._id) }, session);
    }
    await b.save({ session });
    await enqueue(
      `${action}:${b._id}`,
      'notify',
      {
        bookingId: String(b._id),
        event: `Booking ${action === 'complete' ? 'completed' : action === 'accept' ? 'accepted' : 'cancelled'}`,
      },
      session,
    );
    return b;
  });
  await audit(user._id, `booking.${action}`, bookingId);
  return result;
}
export async function expireBookings() {
  const rows = await Booking.find({
    $or: [
      { status: 'held', holdUntil: { $lte: new Date() } },
      { status: 'pending_confirmation', confirmationDeadline: { $lte: new Date() } },
    ],
  }).limit(100);
  for (const row of rows)
    await mongoose.connection.transaction(async (session) => {
      const b = await Booking.findOne({ _id: row._id, status: row.status }).session(session);
      if (!b) return;
      b.status = b.status === 'held' ? 'expired' : 'cancelled';
      if (b.paymentStatus === 'captured') b.paymentStatus = 'refund_required';
      await b.save({ session });
      await Slot.updateOne(
        { _id: b.slotId, bookingId: b._id },
        { $set: { status: 'open' }, $unset: { bookingId: 1, holdUntil: 1 } },
        { session },
      );
      await enqueue(
        `expired:${b._id}`,
        'notify',
        { bookingId: String(b._id), event: 'Booking expired' },
        session,
      );
    });
}
export async function addReview(
  customerId: mongoose.Types.ObjectId | string,
  bookingId: string,
  input: { rating: number; text: string },
) {
  return mongoose.connection.transaction(async (session) => {
    // Write the booking to serialize review eligibility against concurrent state changes.
    const b = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        customerId,
        status: 'completed',
        paymentStatus: 'captured',
        dispute: false,
        endsAt: { $lte: new Date() },
      },
      { $set: { updatedAt: new Date() } },
      { session, returnDocument: 'after' },
    );
    assert(b, 403, 'REVIEW_INELIGIBLE', 'Only your completed paid session can be reviewed');
    return (
      await Review.create([{ bookingId, customerId, expertId: b.expertId, ...input }], { session })
    )[0];
  });
}
export async function reconcileBooking(p: Providers, bookingId: string) {
  let b = await Booking.findById(bookingId);
  assert(
    b?.orderId,
    409,
    'NO_ORDER',
    'No stored order; resolve ambiguous order creation in Razorpay by booking receipt',
  );
  const payments = await p.fetchOrderPayments(b.orderId);
  const captured = payments.filter((x) => x.status === 'captured' || x.status === 'refunded');
  assert(
    captured.length <= 1,
    409,
    'MULTIPLE_PAYMENTS',
    'Multiple paid payments require manual review',
  );
  if (!captured.length) return { bookingId, status: 'no_capture' };
  const paid = captured[0];
  assert(
    paid.order_id === b.orderId && paid.amount === b.grossPaise && paid.currency === 'INR',
    409,
    'PAYMENT_MISMATCH',
    'Provider payment mismatch',
  );
  if (!b.paymentId) await applyCapture({ ...paid, status: 'captured' }, `reconcile:${paid.id}`);
  await mongoose.connection.transaction(async (session) => {
    b = await Booking.findById(bookingId).session(session);
    assert(b, 404, 'NOT_FOUND', 'Booking missing');
    assert(b.paymentId === paid.id, 409, 'PAYMENT_MISMATCH', 'Provider payment ID mismatch');
    if (paid.amount_refunded === b.grossPaise) {
      b.paymentStatus = 'refunded';
      b.status = 'cancelled';
      await Ledger.updateOne(
        { bookingId: b._id, kind: 'refund' },
        {
          $setOnInsert: {
            bookingId: b._id,
            kind: 'refund',
            grossPaise: -b.grossPaise,
            commissionPaise: -b.commissionPaise,
            expertPaise: -b.expertPaise,
          },
        },
        { upsert: true, session },
      );
      await Slot.updateOne(
        { _id: b.slotId, bookingId: b._id },
        { $set: { status: 'open' }, $unset: { bookingId: 1, holdUntil: 1 } },
        { session },
      );
      if (b.mode === 'online' && b.meetingStatus !== 'not_requested')
        await enqueue(`cancel-meet:${b._id}`, 'cancel-meet', { bookingId: String(b._id) }, session);
    } else if (paid.amount_refunded) {
      b.dispute = true;
      b.paymentStatus = 'refund_required';
    }
    b.reconciledAt = new Date();
    await b.save({ session });
  });
  return { bookingId, status: 'reconciled' };
}
export async function runPayout(
  c: Config,
  p: Providers,
  adminId: mongoose.Types.ObjectId | string,
  bookingId: string,
  reference?: string,
) {
  const settings = await Settings.findOne({ key: 'marketplace' });
  assert(settings, 503, 'SETUP_REQUIRED', 'Settings missing');
  const b = await Booking.findById(bookingId);
  assert(b?.paymentId, 409, 'INELIGIBLE', 'No captured payment');
  assert(
    b.expertPaise > 0 &&
      b.status === 'completed' &&
      b.paymentStatus === 'captured' &&
      !b.dispute &&
      b.endsAt.getTime() + settings.payoutDelayHours * 3600000 < Date.now(),
    409,
    'INELIGIBLE',
    'Payout is not eligible',
  );
  const blockers = paymentBlockers(c);
  assert(!blockers.length, 503, 'PAYOUT_BLOCKED', blockers.join('; '));
  const payment = await p.fetchPayment(b.paymentId);
  assert(
    payment.id === b.paymentId &&
      payment.order_id === b.orderId &&
      payment.amount === b.grossPaise &&
      payment.currency === 'INR' &&
      payment.status === 'captured' &&
      !payment.amount_refunded,
    409,
    'RECONCILIATION_REQUIRED',
    'Payment cannot be paid out',
  );
  const expert = await Expert.findById(b.expertId);
  if (settings.payoutMode === 'automatic')
    assert(
      c.ROUTE_ENABLED === 'true' && expert?.routeReady && expert.routeAccountId,
      503,
      'ROUTE_UNAVAILABLE',
      'Route or linked account is not ready',
    );
  else
    assert(
      reference && reference.length >= 6,
      400,
      'REFERENCE_REQUIRED',
      'Record the completed external payment reference',
    );
  const payout = await mongoose.connection.transaction(async (session) => {
    const locked = await Booking.findOneAndUpdate(
      { _id: b._id, status: 'completed', paymentStatus: 'captured', dispute: false },
      { $set: { reconciledAt: new Date() } },
      { session, returnDocument: 'after' },
    );
    assert(locked, 409, 'INELIGIBLE', 'Payout state changed');
    return (
      await Payout.create(
        [
          {
            bookingId: b._id,
            expertId: b.expertId,
            amountPaise: b.expertPaise,
            mode: settings.payoutMode,
            status: settings.payoutMode === 'manual' ? 'paid' : 'processing',
            reference,
          },
        ],
        { session },
      )
    )[0];
  });
  if (settings.payoutMode === 'automatic') {
    try {
      const result = await p.transfer(
        b.paymentId,
        expert!.routeAccountId!,
        b.expertPaise,
        String(b._id),
      );
      payout.providerId = result.id;
      payout.status = 'submitted';
      await payout.save();
    } catch (error) {
      payout.status = 'unknown';
      await payout.save();
      throw error;
    }
  }
  await audit(adminId, 'payout.record', payout._id, { mode: payout.mode, status: payout.status });
  return payout;
}
export async function notifyBooking(p: Providers, bookingId: string, event: string) {
  const b = await Booking.findById(bookingId);
  if (!b) return;
  const expert = await Expert.findById(b.expertId);
  const people = await User.find({
    _id: { $in: [b.customerId, expert?.userId] },
    emailVerified: true,
  });
  for (const person of people)
    if (person.email)
      await p.sendEmail(
        person.email,
        `${event} · Expert Market`,
        `${event}\n${b.title}\n${b.startsAt.toISOString()}\nBooking: ${b._id}\n${b.status === 'confirmed' && b.meetingUrl ? b.meetingUrl : 'Open your dashboard for the latest status.'}`,
      );
}
