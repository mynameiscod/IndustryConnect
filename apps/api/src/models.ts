import mongoose, { Schema } from 'mongoose';
const ref = (model: string) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true as const,
});
const opts = { timestamps: true as const, strict: 'throw' as const };
const user = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    googleSub: { type: String, unique: true, sparse: true },
    passwordHash: String,
    roles: { type: [String], default: ['customer'] },
    accountPurpose: { type: String, enum: ['customer', 'expert'], default: 'customer' },
    emailVerified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  opts,
);
const expert = new Schema(
  {
    userId: { ...ref('User'), unique: true },
    slug: { type: String, required: true, unique: true },
    headline: { type: String, required: true },
    bio: { type: String, required: true },
    categories: [Schema.Types.ObjectId],
    languages: [String],
    city: String,
    timezone: String,
    experienceYears: Number,
    verification: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
    },
    reviewReason: String,
    profileRevision: { type: Number, default: 0 },
    confirmationPolicy: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    scheduleVersion: { type: Number, default: 0 },
    routeAccountId: String,
    routeReady: { type: Boolean, default: false },
  },
  opts,
);
expert.index({ verification: 1, categories: 1 });
const service = new Schema(
  {
    expertId: ref('Expert'),
    categoryId: ref('Category'),
    title: { type: String, required: true },
    description: String,
    durationMinutes: { type: Number, required: true },
    pricePaise: { type: Number, required: true },
    mode: { type: String, enum: ['online', 'in_person'], required: true },
    location: String,
    confirmationPolicy: { type: String, enum: ['auto', 'manual'] },
    active: { type: Boolean, default: true },
  },
  opts,
);
service.index({ expertId: 1, active: 1 });
service.index({ categoryId: 1, active: 1, pricePaise: 1 });
const slot = new Schema(
  {
    expertId: ref('Expert'),
    serviceId: ref('Service'),
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'held', 'booked', 'closed'], default: 'open' },
    holdUntil: Date,
    bookingId: Schema.Types.ObjectId,
  },
  opts,
);
slot.index(
  { expertId: 1, startsAt: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'held', 'booked'] } } },
);
slot.index({ serviceId: 1, status: 1, startsAt: 1 });
const booking = new Schema(
  {
    customerId: ref('User'),
    expertId: ref('Expert'),
    serviceId: ref('Service'),
    slotId: ref('Slot'),
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    title: String,
    mode: String,
    location: String,
    grossPaise: { type: Number, required: true },
    commissionBps: { type: Number, required: true },
    commissionPaise: { type: Number, required: true },
    expertPaise: { type: Number, required: true },
    confirmationPolicy: String,
    status: {
      type: String,
      enum: ['held', 'pending_confirmation', 'confirmed', 'completed', 'cancelled', 'expired'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'captured', 'refund_required', 'refunded'],
      default: 'unpaid',
    },
    holdUntil: { type: Date, required: true },
    confirmationDeadline: Date,
    orderId: { type: String, unique: true, sparse: true },
    orderState: { type: String, enum: ['none', 'creating', 'ready', 'unknown'], default: 'none' },
    paymentId: { type: String, unique: true, sparse: true },
    idempotencyKey: { type: String, required: true },
    meetingUrl: String,
    meetingStatus: { type: String, default: 'not_requested' },
    calendarEventId: String,
    reconciledAt: Date,
    dispute: { type: Boolean, default: false },
  },
  opts,
);
booking.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
booking.index({ expertId: 1, startsAt: 1 });
booking.index({ status: 1, holdUntil: 1 });
const session = new Schema(
  {
    tokenHash: { type: String, unique: true, required: true },
    userId: ref('User'),
    expiresAt: { type: Date, required: true },
  },
  opts,
);
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const challenge = new Schema(
  {
    target: { type: String, required: true },
    purpose: { type: String, required: true },
    digest: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  opts,
);
challenge.index({ target: 1, purpose: 1 }, { unique: true });
challenge.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const event = new Schema(
  {
    providerEventId: { type: String, unique: true, required: true },
    kind: String,
    bookingId: ref('Booking'),
    paymentId: String,
  },
  opts,
);
const ledger = new Schema(
  {
    bookingId: ref('Booking'),
    kind: { type: String, enum: ['capture', 'refund'], required: true },
    grossPaise: Number,
    commissionPaise: Number,
    expertPaise: Number,
  },
  opts,
);
ledger.index({ bookingId: 1, kind: 1 }, { unique: true });
const review = new Schema(
  {
    bookingId: { ...ref('Booking'), unique: true },
    customerId: ref('User'),
    expertId: ref('Expert'),
    rating: { type: Number, min: 1, max: 5, required: true },
    text: String,
    visible: { type: Boolean, default: true },
  },
  opts,
);
review.index({ expertId: 1, visible: 1 });
const payout = new Schema(
  {
    bookingId: { ...ref('Booking'), unique: true },
    expertId: ref('Expert'),
    amountPaise: { type: Number, required: true },
    mode: String,
    status: {
      type: String,
      enum: ['processing', 'submitted', 'paid', 'unknown', 'failed'],
      required: true,
    },
    providerId: String,
    reference: String,
    note: String,
  },
  opts,
);
const settings = new Schema(
  {
    key: { type: String, unique: true, default: 'marketplace' },
    commissionBps: { type: Number, default: 1000 },
    confirmationPolicy: { type: String, default: 'expert_choice' },
    payoutMode: { type: String, default: 'manual' },
    payoutDelayHours: { type: Number, default: 48 },
  },
  opts,
);
const job = new Schema(
  {
    key: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
    attempts: { type: Number, default: 0 },
    nextRunAt: { type: Date, default: Date.now },
    lockedUntil: Date,
    lastError: String,
  },
  opts,
);
job.index({ status: 1, nextRunAt: 1 });
export const User = mongoose.model('User', user);
export const Expert = mongoose.model('Expert', expert);
export const Category = mongoose.model(
  'Category',
  new Schema(
    {
      name: { type: String, required: true },
      slug: { type: String, unique: true, required: true },
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);
export const Service = mongoose.model('Service', service);
export const Slot = mongoose.model('Slot', slot);
export const Booking = mongoose.model('Booking', booking);
export const Session = mongoose.model('Session', session);
export const Challenge = mongoose.model('Challenge', challenge);
export const PaymentEvent = mongoose.model('PaymentEvent', event);
export const Ledger = mongoose.model('Ledger', ledger);
export const Review = mongoose.model('Review', review);
export const Payout = mongoose.model('Payout', payout);
export const Settings = mongoose.model('Settings', settings);
export const Job = mongoose.model('Job', job);
export const Audit = mongoose.model(
  'AuditLog',
  new Schema(
    {
      actorId: Schema.Types.ObjectId,
      action: String,
      resourceId: String,
      details: Schema.Types.Mixed,
    },
    opts,
  ),
);
export const Invite = mongoose.model(
  'Invite',
  new Schema(
    {
      email: { type: String, unique: true, required: true },
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);
export const EmailDelivery = mongoose.model(
  'EmailDelivery',
  new Schema(
    {
      provider: { type: String, enum: ['ses', 'smtp'], required: true },
      messageId: String,
      recipient: { type: String, required: true },
      region: String,
      status: {
        type: String,
        enum: [
          'sending',
          'accepted',
          'delivered',
          'bounced',
          'complained',
          'rejected',
          'delayed',
          'failed',
          'unknown',
        ],
        required: true,
      },
      events: [new Schema({ type: { type: String, required: true }, at: Date }, { _id: false })],
      reportNote: String,
      lastCheckedAt: Date,
    },
    opts,
  ),
);
EmailDelivery.schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });
EmailDelivery.schema.index({ createdAt: -1, _id: -1 });
export const models = [
  EmailDelivery,
  User,
  Expert,
  Category,
  Service,
  Slot,
  Booking,
  Session,
  Challenge,
  PaymentEvent,
  Ledger,
  Review,
  Payout,
  Settings,
  Job,
  Audit,
  Invite,
];
export async function connect(uri: string, production = false) {
  await mongoose.connect(uri, { autoIndex: !production, serverSelectionTimeoutMS: 5000 });
}
export async function ensureSettings() {
  return (await Settings.findOneAndUpdate(
    { key: 'marketplace' },
    { $setOnInsert: { key: 'marketplace' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ))!;
}
