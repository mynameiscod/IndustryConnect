import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import {
  bookingInput,
  categoryInput,
  email,
  expertInput,
  id,
  loginInput,
  registerInput,
  reviewInput,
  serviceInput,
  settingsInput,
  slotInput,
} from '../packages/contracts/src/index.js';
const json = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const schemas: Record<string, any> = {
  Register: json(registerInput),
  Login: json(loginInput),
  Email: json(z.object({ email }).strict()),
  VerifyEmail: json(z.object({ email, code: z.string().regex(/^\d{6}$/) }).strict()),
  Reset: json(
    z
      .object({ email, code: z.string().regex(/^\d{6}$/), password: z.string().min(12).max(128) })
      .strict(),
  ),
  Google: json(z.object({ credential: z.string().max(6000) }).strict()),
  Phone: json(z.object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) }).strict()),
  PhoneVerify: json(
    z
      .object({
        phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
        code: z.string().regex(/^\d{4,10}$/),
      })
      .strict(),
  ),
  ExpertInput: json(expertInput),
  CategoryInput: json(categoryInput),
  ServiceInput: json(serviceInput),
  SlotInput: json(slotInput),
  BookingInput: json(bookingInput),
  ReviewInput: json(reviewInput),
  SettingsInput: json(settingsInput),
  BookingAction: json(
    z.object({ action: z.enum(['accept', 'reject', 'cancel', 'complete']) }).strict(),
  ),
  Verification: json(
    z
      .object({
        status: z.enum(['approved', 'rejected', 'suspended']),
        reason: z.string().min(5).max(500),
        expectedRevision: z.number().int().nonnegative(),
      })
      .strict(),
  ),
  RouteAccount: json(
    z
      .object({ routeAccountId: z.string().regex(/^acc_[a-zA-Z0-9]+$/), routeReady: z.boolean() })
      .strict(),
  ),
  PaymentVerify: json(
    z
      .object({
        razorpay_order_id: z.string().max(100),
        razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
        razorpay_signature: z.string().length(64),
      })
      .strict(),
  ),
  Invite: json(z.object({ email, active: z.boolean().default(true) }).strict()),
  PayoutRequest: json(z.object({ reference: z.string().min(6).max(100).optional() }).strict()),
  Moderation: json(z.object({ visible: z.boolean(), reason: z.string().min(5).max(500) }).strict()),
  Empty: { type: 'object', additionalProperties: false },
  Object: { type: 'object' },
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: { code: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  User: {
    type: 'object',
    required: ['id', 'name', 'emailVerified', 'roles', 'accountPurpose'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      emailVerified: { type: 'boolean' },
      roles: { type: 'array', items: { enum: ['customer', 'expert', 'admin'] } },
      accountPurpose: {
        enum: ['customer', 'expert'],
        description:
          'Signup/onboarding intent only; does not grant expert verification or admin privileges. Existing expert roles map to expert intent.',
      },
    },
  },
  Collection: {
    type: 'object',
    required: ['items'],
    properties: {
      items: { type: 'array', items: { type: 'object' } },
      total: { type: 'integer' },
      page: { type: 'integer' },
    },
  },
  Order: {
    type: 'object',
    required: ['orderId', 'amount', 'currency', 'keyId'],
    properties: {
      orderId: { type: 'string' },
      amount: { type: 'integer', minimum: 100 },
      currency: { const: 'INR' },
      keyId: { type: 'string' },
    },
  },
  Booking: {
    type: 'object',
    required: [
      '_id',
      'customerId',
      'expertId',
      'serviceId',
      'slotId',
      'startsAt',
      'endsAt',
      'status',
      'paymentStatus',
      'grossPaise',
      'commissionBps',
      'commissionPaise',
      'expertPaise',
      'holdUntil',
      'idempotencyKey',
    ],
    properties: Object.fromEntries([
      ...[
        '_id',
        'customerId',
        'expertId',
        'serviceId',
        'slotId',
        'title',
        'mode',
        'location',
        'confirmationPolicy',
        'orderId',
        'paymentId',
        'idempotencyKey',
        'meetingStatus',
        'calendarEventId',
      ].map((k) => [k, { type: 'string' }]),
      ...['grossPaise', 'commissionBps', 'commissionPaise', 'expertPaise'].map((k) => [
        k,
        { type: 'integer' },
      ]),
      ...[
        'startsAt',
        'endsAt',
        'holdUntil',
        'confirmationDeadline',
        'reconciledAt',
        'createdAt',
        'updatedAt',
      ].map((k) => [k, { type: 'string', format: 'date-time' }]),
      [
        'status',
        {
          enum: ['held', 'pending_confirmation', 'confirmed', 'completed', 'cancelled', 'expired'],
        },
      ],
      ['paymentStatus', { enum: ['unpaid', 'captured', 'refund_required', 'refunded'] }],
      ['dispute', { type: 'boolean' }],
      ['meetingUrl', { type: 'string', format: 'uri' }],
    ]),
  },
};
const earningsMoney = { type: 'integer', minimum: 0 };
schemas.ExpertEarnings = {
  type: 'object',
  required: [
    'totals',
    'summary',
    'monthly',
    'payouts',
    'payoutTotal',
    'payoutPage',
    'payoutLimit',
    'timezone',
    'currentMonth',
    'asOf',
    'payoutInfo',
  ],
  properties: {
    totals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['_id', 'grossPaise', 'netPaise', 'count'],
        properties: {
          _id: { type: 'string' },
          grossPaise: earningsMoney,
          netPaise: earningsMoney,
          count: earningsMoney,
        },
      },
    },
    summary: {
      type: 'object',
      required: ['totalEarningsPaise', 'completedSessions', 'pendingPayoutPaise', 'thisMonthPaise'],
      properties: {
        totalEarningsPaise: earningsMoney,
        completedSessions: earningsMoney,
        pendingPayoutPaise: earningsMoney,
        thisMonthPaise: earningsMoney,
      },
    },
    monthly: {
      type: 'array',
      items: {
        type: 'object',
        required: ['month', 'netPaise', 'sessions'],
        properties: {
          month: { type: 'string', description: 'YYYY-MM in the report timezone' },
          netPaise: earningsMoney,
          sessions: earningsMoney,
        },
      },
    },
    payouts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['_id', 'bookingId', 'amountPaise', 'mode', 'status', 'createdAt'],
        properties: {
          _id: { type: 'string' },
          bookingId: { type: 'string' },
          amountPaise: earningsMoney,
          mode: { type: 'string' },
          status: { enum: ['paid', 'processing', 'submitted', 'unknown', 'failed'] },
          providerId: { type: 'string' },
          reference: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    payoutTotal: earningsMoney,
    payoutPage: { type: 'integer', minimum: 1 },
    payoutLimit: { type: 'integer', minimum: 1, maximum: 100 },
    timezone: { type: 'string' },
    currentMonth: { type: 'string' },
    asOf: { type: 'string', format: 'date-time' },
    payoutInfo: {
      type: 'object',
      required: ['mode', 'delayHours', 'paymentMode', 'checkoutEnabled'],
      properties: {
        mode: { type: 'string' },
        delayHours: earningsMoney,
        paymentMode: { enum: ['disabled', 'test', 'live'] },
        checkoutEnabled: { type: 'boolean' },
      },
    },
  },
};

const paths: Record<string, any> = {};
function add(
  method: string,
  path: string,
  summary: string,
  auth: 'public' | 'user' | 'expert' | 'admin',
  input?: string,
  output = 'Object',
  status = 200,
  description = '',
  query: Record<string, any> = {},
) {
  const parameters: any[] = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    in: 'path',
    name: m[1],
    required: true,
    schema: { type: 'string', ...(m[1] === 'id' ? { pattern: '^[a-f0-9]{24}$' } : {}) },
  }));
  for (const [name, schema] of Object.entries(query))
    parameters.push({ in: 'query', name, schema });
  if (method !== 'get' && path !== '/webhooks/razorpay')
    parameters.push(
      { $ref: '#/components/parameters/Origin' },
      { $ref: '#/components/parameters/RequestHeader' },
    );
  if (path === '/bookings' && method === 'post')
    parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
  if (path === '/webhooks/razorpay')
    parameters.push(
      {
        in: 'header',
        name: 'X-Razorpay-Signature',
        required: true,
        schema: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      },
      { in: 'header', name: 'X-Razorpay-Event-Id', schema: { type: 'string' } },
    );
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    operationId: `${method}_${path.replace(/[^a-z0-9]+/gi, '_')}`,
    tags: [auth],
    description: `${auth === 'public' ? 'Public endpoint.' : `Requires ${auth} permission and resource ownership where applicable.`} ${description}`,
    security: auth === 'public' ? [] : [{ Session: [] }],
    parameters,
    ...(input
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(input) } } } }
      : {}),
    responses: {
      [status]: {
        description: status === 204 ? 'No content' : 'Success',
        ...(status === 204 ? {} : { content: { 'application/json': { schema: ref(output) } } }),
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 429, 500, 503].map((code) => [
          code,
          {
            description: (
              {
                400: 'Validation or invalid signature',
                401: 'Authentication required',
                403: 'Forbidden / invite required',
                404: 'Not found',
                409: 'State, uniqueness or idempotency conflict',
                429: 'Rate limit',
                500: 'Unexpected error',
                503: 'Provider or release gate unavailable',
              } as any
            )[code],
            content: { 'application/json': { schema: ref('Error') } },
          },
        ]),
      ),
    },
  };
}
const pages = {
  page: { type: 'integer', minimum: 1, default: 1 },
  limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 },
};
add('get', '/health', 'Liveness', 'public');
add('get', '/ready', 'Database readiness', 'public');
add(
  'get',
  '/config',
  'Public provider capabilities',
  'public',
  undefined,
  'Object',
  200,
  'Includes expertSignupEnabled alongside betaAccess. Expert self-registration may be open while customer signup remains invite-only. No secrets are exposed.',
);
add('get', '/me', 'Current user', 'user', undefined, 'User');
add(
  'post',
  '/auth/register',
  'Register an account',
  'public',
  'Register',
  'Object',
  202,
  'Customer signup follows BETA_ACCESS_MODE. When EXPERT_SIGNUP_ENABLED=true, expert-purpose accounts may register without invitation and retain access during verification/login/sessions. An explicitly revoked invitation still blocks access. Registration does not grant expert approval or admin privileges.',
);
add('post', '/auth/login', 'Email/password sign in', 'public', 'Login', 'User');
add('post', '/auth/logout', 'Revoke current session', 'public', 'Empty', 'Object', 204);
add('post', '/auth/email/request', 'Request verification code', 'public', 'Email', 'Object', 202);
add(
  'post',
  '/auth/email/verify',
  'Verify email and create session',
  'public',
  'VerifyEmail',
  'User',
);
add('post', '/auth/password/request', 'Request password reset', 'public', 'Email', 'Object', 202);
add('post', '/auth/password/reset', 'Reset password and revoke sessions', 'public', 'Reset');
add('get', '/auth/google/nonce', 'Issue one-use Google nonce', 'public');
add(
  'post',
  '/auth/google',
  'Verify Google identity',
  'public',
  'Google',
  'User',
  200,
  'Requires nonce cookie and matching signed nonce. Existing account linking requires current authenticated ownership.',
);
add('post', '/auth/phone/request', 'Request managed SMS OTP', 'public', 'Phone', 'Object', 202);
add(
  'post',
  '/auth/phone/verify',
  'Verify phone / link signed-in account',
  'public',
  'PhoneVerify',
  'User',
);
add('post', '/me/email/request', 'Request new email verification', 'user', 'Email', 'Object', 202);
add('post', '/me/email/verify', 'Link verified email', 'user', 'VerifyEmail', 'User');
add(
  'get',
  '/categories',
  'List active categories',
  'public',
  undefined,
  'Collection',
  200,
  'No business count cap.',
  pages,
);
add(
  'get',
  '/experts',
  'Search verified experts with active services',
  'public',
  undefined,
  'Collection',
  200,
  'Public serializers omit email, Route account and private review notes.',
  {
    ...pages,
    q: { type: 'string', maxLength: 100 },
    category: json(id),
    language: { type: 'string', maxLength: 30 },
    mode: { enum: ['online', 'in_person'] },
    maxPrice: { type: 'integer', description: 'Maximum service price in paise' },
  },
);
add('get', '/experts/{slug}', 'Expert storefront and verified reviews', 'public');
add('get', '/services/{id}/slots', 'Next 100 available slots', 'public', undefined, 'Collection');
add('get', '/expert/profile', 'Own onboarding profile or null', 'user');
add(
  'get',
  '/expert/dashboard',
  'Own expert dashboard and application result',
  'user',
  undefined,
  'Object',
  200,
  'Returns own profile (or null), onboarding readiness and stats {upcomingAppointments,pendingRequests,completedSessions,heldReservations}. Counts belong only to the signed-in expert. Upcoming appointments are confirmed and not ended; temporary holds are separate and not paid appointments. No profile produces zero counts. No credentials, Route account or other experts data is returned.',
);
add(
  'get',
  '/expert/onboarding',
  'Read own onboarding progress and listing readiness',
  'user',
  undefined,
  'Object',
  200,
  'Returns emailVerified, profileSubmitted, verification, reviewReason, activeServices, openSlots, listed, acceptingReservations and publicPath. Counts only active services in active categories and open slots more than one hour ahead. Reservation readiness is separate from payment availability.',
);
add(
  'put',
  '/expert/profile',
  'Submit profile for verification',
  'user',
  'ExpertInput',
  'Object',
  200,
  'Verified email required. Transactionally saves profile, expert role, audit and notification outbox. New, changed professional claims and rejected resubmissions enter pending; unchanged approved profiles and confirmation-policy-only updates keep approval. Suspended profiles cannot self-resubmit. Profile revisions protect admin review.',
);
add('get', '/expert/services', 'Own services (first 100)', 'expert', undefined, 'Collection');
add('post', '/expert/services', 'Create a service', 'expert', 'ServiceInput', 'Object', 201);
add(
  'put',
  '/expert/services/{id}',
  'Replace or archive a service; omit confirmationPolicy to inherit the profile preference',
  'expert',
  'ServiceInput',
);
add(
  'get',
  '/expert/slots',
  'Own upcoming availability',
  'expert',
  undefined,
  'Collection',
  200,
  '',
  pages,
);
add(
  'post',
  '/expert/slots',
  'Publish non-overlapping dated slot',
  'expert',
  'SlotInput',
  'Object',
  201,
);
add('delete', '/expert/slots/{id}', 'Close an unreserved slot', 'expert');
add(
  'put',
  '/expert/slots/{id}',
  'Edit an owned open dated slot atomically; reserved slots cannot be changed',
  'expert',
  'SlotInput',
);
add(
  'post',
  '/bookings',
  'Reserve slot for ten minutes',
  'user',
  'BookingInput',
  'Booking',
  201,
  'Price and policies are server snapshots. Idempotency key is scoped to customer and bound to slot.',
);
add(
  'get',
  '/bookings',
  'List private bookings',
  'user',
  undefined,
  'Collection',
  200,
  'Scope expert/admin requires its corresponding permission.',
  { ...pages, scope: { enum: ['customer', 'expert', 'admin'], default: 'customer' } },
);
add(
  'post',
  '/bookings/{id}/order',
  'Create a server-priced Razorpay order',
  'user',
  'Empty',
  'Order',
  200,
  'Only one order attempt; ambiguous provider outcome requires reconciliation.',
);
add(
  'post',
  '/bookings/{id}/payment/verify',
  'Verify checkout signature and fetched captured payment',
  'user',
  'PaymentVerify',
  'Booking',
);
add(
  'post',
  '/bookings/{id}/action',
  'Accept, reject, cancel or complete booking',
  'user',
  'BookingAction',
  'Booking',
  200,
  'accept/reject/complete require expert ownership or admin. Customer may cancel their eligible own booking.',
);
add(
  'post',
  '/bookings/{id}/review',
  'Review own paid completed session',
  'user',
  'ReviewInput',
  'Object',
  201,
);
add(
  'get',
  '/expert/earnings',
  'Own session earnings and paginated payout records',
  'expert',
  undefined,
  'ExpertEarnings',
  200,
  'Completed/captured/undisputed session net; grouped by session end in the requested timezone. Pending means no paid payout record, not immediate eligibility or bank settlement.',
  {
    ...pages,
    months: { type: 'integer', enum: [3, 6, 12], default: 6 },
    timezone: { type: 'string', default: 'Asia/Kolkata' },
    status: {
      enum: ['all', 'paid', 'processing', 'submitted', 'unknown', 'failed'],
      default: 'all',
    },
  },
);
add(
  'post',
  '/webhooks/razorpay',
  'Ingest signed Razorpay event',
  'public',
  'Object',
  'Object',
  200,
  'Exact raw JSON body is HMAC authenticated before parsing. Handles payment.captured, refund.* and payment.dispute.*; other events acknowledged without state changes.',
);
add('get', '/admin/overview', 'Operations and payment blockers', 'admin');
add('get', '/admin/exceptions', 'Refund, order, payout and failed-job queues', 'admin');
add(
  'get',
  '/admin/experts/{id}',
  'Read full expert application for review',
  'admin',
  undefined,
  'Object',
  200,
  'Returns expert profile excluding Route account fields, minimal owner account/email verification, selected categories, latest 100 services, future open slot count and listing readiness. Owner password/session data and provider credentials are excluded. Read a fresh profileRevision before recording a review.',
);
add(
  'get',
  '/admin/jobs',
  'Read notification and fulfillment job history',
  'admin',
  undefined,
  'Collection',
  200,
  'Returns newest-first paginated jobs, total and page. Payload and deduplication key are excluded. Job done means processing completed or was superseded, not proof of email delivery.',
  {
    ...pages,
    status: {
      type: 'string',
      enum: ['all', 'failed', 'queued', 'running', 'done'],
      default: 'failed',
    },
  },
);
schemas.NotificationRetry = json(z.object({ reason: z.string().trim().min(5).max(500) }).strict());
add(
  'post',
  '/admin/jobs/{id}/retry',
  'Queue one reviewed failed email notification',
  'admin',
  'NotificationRetry',
  'Object',
  200,
  'Ten attempts/client/fifteen minutes; admin session and same-origin checks required. Only failed expert-review, notify or reminder jobs may be reset. Transactionally records the reason and queues the job. Duplicate, running, completed, meeting or unsupported operations return 409. Check delivery before retrying: an earlier attempt may already have arrived. Never retries payment orders/transfers.',
);
add(
  'get',
  '/admin/experts',
  'List expert review records',
  'admin',
  undefined,
  'Collection',
  200,
  'Returns filtered items, filtered total and global summary {pending,approved,total,updatedThisMonth}. updatedThisMonth counts profile updates since the UTC month start, not active users. User fields contain name/email only; categories include _id/name. Search is escaped literal matching against user name/email and expert headline/bio. Sort uses createdAt or slug with _id as a stable tie breaker.',
  {
    ...pages,
    q: { type: 'string', maxLength: 120 },
    status: {
      type: 'string',
      enum: ['all', 'pending', 'approved', 'rejected', 'suspended'],
      default: 'all',
    },
    category: { type: 'string', description: 'Category ObjectId or empty for all' },
    sort: { type: 'string', enum: ['newest', 'oldest', 'slug'], default: 'newest' },
  },
);
add(
  'patch',
  '/admin/experts/{id}/verification',
  'Approve, reject or suspend expert',
  'admin',
  'Verification',
  'Object',
  200,
  'Requires expectedRevision from the reviewed expert profile (legacy profiles use zero); stale or concurrent review returns 409. Decisions increment profileRevision and queue status email transactionally. Approval requires an active account, verified email and an active category. No automatic KYC or payment activation.',
);
add(
  'patch',
  '/admin/experts/{id}/route',
  'Record verified Route account readiness',
  'admin',
  'RouteAccount',
  'Object',
  200,
  'Operator attestation; does not onboard or verify provider KYC automatically.',
);
add(
  'get',
  '/admin/categories',
  'List active and archived categories',
  'admin',
  undefined,
  'Collection',
  200,
  'Filtered items include expertCount for each category; counts reflect stored expert-category associations.',
  {
    ...pages,
    q: { type: 'string', maxLength: 120 },
    status: { type: 'string', enum: ['all', 'active', 'inactive'], default: 'all' },
  },
);
add('post', '/admin/categories', 'Create category', 'admin', 'CategoryInput', 'Object', 201);
add('put', '/admin/categories/{id}', 'Edit or archive category', 'admin', 'CategoryInput');
schemas.IntegrationUpdate = json(
  z
    .object({
      revision: z.number().int().nonnegative(),
      enabled: z.boolean(),
      fields: z.record(z.string(), z.union([z.string().max(4096), z.number()])),
      clearSecrets: z.array(z.string()).default([]),
      password: z.string().min(1).max(256),
    })
    .strict(),
);
schemas.IntegrationUpdate.properties.password.writeOnly = true;
schemas.IntegrationStatus = json(
  z.object({
    available: z.boolean(),
    revision: z.number().int().nonnegative(),
    origin: z.string(),
    providers: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        help: z.string(),
        enabled: z.boolean(),
        configured: z.boolean(),
        fields: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            secret: z.boolean(),
            type: z.string(),
            options: z.array(z.string()).optional(),
            value: z.string(),
            configured: z.boolean(),
          }),
        ),
      }),
    ),
  }),
);
add(
  'get',
  '/admin/integrations',
  'Read redacted provider configuration',
  'admin',
  undefined,
  'IntegrationStatus',
  200,
  'Provider IDs: email, whatsapp, razorpay, google, calendar, phone. Email supports SMTP or SES. Razorpay keys are staged only. Secret values are always empty strings; configured flags indicate presence only, not external validation.',
);
add(
  'put',
  '/admin/integrations/{provider}',
  'Save encrypted provider configuration',
  'admin',
  'IntegrationUpdate',
  'IntegrationStatus',
  200,
  'Requires current admin password and matching revision. Ten update attempts per client per fifteen minutes. Strict provider fields. Blank secrets preserve existing values; clearSecrets removes named secrets. Enabled integrations require complete credentials. Messaging settings apply without restart. Razorpay keys are staged for operator activation, never hot-rotated; payment mode, Route and release gates cannot be changed here. Saving does not contact a provider.',
);
schemas.IntegrationTest = json(
  z
    .object({
      password: z.string().min(1).max(256),
      recipient: z.string().max(254),
      consent: z.literal(true),
    })
    .strict(),
);
schemas.IntegrationTest.properties.password.writeOnly = true;
add(
  'post',
  '/admin/integrations/{provider}/test',
  'Send a real delivery test using saved configuration',
  'admin',
  'IntegrationTest',
  'Object',
  200,
  'Email or WhatsApp only. Current admin password and recipient consent required; five attempts per client per fifteen minutes. Email recipient must be an email address; WhatsApp recipient must be E.164. Sends once with no automatic retry. Production email sends create masked delivery reports and return deliveryId with accepted:true and message. WhatsApp uses the approved no-variable template. Success means provider acceptance, not confirmed delivery. No payment test or payment activation.',
);
add('get', '/admin/settings', 'Read policy defaults', 'admin');
add(
  'get',
  '/admin/email-deliveries',
  'Read recent email delivery reports',
  'admin',
  undefined,
  'Collection',
  200,
  'Paginated newest-first reports: masked recipient, provider, message ID, status, event timestamps and report note. No email bodies, subjects, OTPs or raw provider errors. Application reports begin after deployment; TTL retention is thirty days.',
  pages,
);
add(
  'post',
  '/admin/email-deliveries/{id}/check',
  'Fetch SES delivery events without resending',
  'admin',
  undefined,
  'Object',
  200,
  'Admin session and same-origin protection required. Twenty checks/client/minute, one SES insights request per 1.1 seconds per API process. Fetches the stored SES message ID in its original region. Delivery comes only from an AWS DELIVERY event. Bounce/complaint/rejection override earlier delivery. Unavailable insights preserve prior status and return an actionable reportNote. Requires SES VDM and ses:GetMessageInsights permission. SMTP cannot report downstream delivery here.',
);
add(
  'put',
  '/admin/settings',
  'Set commission, confirmation and payout policies',
  'admin',
  'SettingsInput',
);
add(
  'get',
  '/admin/invites',
  'List beta invitations',
  'admin',
  undefined,
  'Collection',
  200,
  'Admin-only email, active, createdAt and updatedAt; no email is sent.',
  {
    ...pages,
    q: { type: 'string', maxLength: 120 },
    status: { type: 'string', enum: ['all', 'active', 'revoked'], default: 'all' },
  },
);
add(
  'get',
  '/admin/payments',
  'List booking and recorded payout operations',
  'admin',
  undefined,
  'Collection',
  200,
  'Read-only Mongo snapshot: filtered items and total, expert/customer names, optional payout {bookingId,status,amountPaise}; global summary {totalBookings,recordedPaidPaise,recordedPaidCount,payoutsToReconcile}. Recorded paid totals are not bank-settlement evidence. Date filters apply to startsAt in UTC with inclusive calendar-day bounds; q searches exact booking ObjectId or literal title/customer/expert name. Existing mutation gates are unchanged.',
  {
    ...pages,
    q: { type: 'string', maxLength: 120 },
    status: {
      type: 'string',
      enum: [
        'all',
        'held',
        'pending_confirmation',
        'confirmed',
        'completed',
        'cancelled',
        'expired',
      ],
      default: 'all',
    },
    payout: {
      type: 'string',
      enum: ['all', 'none', 'processing', 'submitted', 'paid', 'unknown', 'failed'],
      default: 'all',
    },
    from: { type: 'string', format: 'date' },
    to: { type: 'string', format: 'date' },
  },
);
add(
  'post',
  '/admin/invites',
  'Allow or revoke beta email access',
  'admin',
  'Invite',
  'Object',
  201,
  'Does not send an email.',
);
add(
  'post',
  '/admin/bookings/{id}/reconcile',
  'Fetch order payments and reconcile capture/refund',
  'admin',
  'Empty',
);
add(
  'post',
  '/admin/bookings/{id}/payout',
  'Record manual payout or submit conditional Route transfer',
  'admin',
  'PayoutRequest',
  'Object',
  200,
  'Manual mode records a completed external payment; automatic mode initiates a transfer. Both are release gated.',
);
add(
  'get',
  '/admin/ledger',
  'List immutable ledger postings',
  'admin',
  undefined,
  'Collection',
  200,
  '',
  pages,
);
add('patch', '/admin/reviews/{id}', 'Moderate review with audit reason', 'admin', 'Moderation');
add(
  'get',
  '/admin/audit',
  'List audit history',
  'admin',
  undefined,
  'Collection',
  200,
  'Returns items,total,page with actor name, action, resource, timestamp and whitelisted reason/status/type/profileRevision details. No raw integration credential payloads. Optional action is an exact match.',
  { ...pages, action: { type: 'string', maxLength: 120 } },
);
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Independent Expert Marketplace API',
    version: '0.1.0',
    description:
      'Controlled beta. Live money movement is source-locked pending release certification. All amounts are INR paise; times are UTC ISO 8601. Customer and expert session data are private. Production client-IP rate limits trust only the configured immediate proxy; Nginx must overwrite forwarding headers. Limits are per API process.',
  },
  servers: [{ url: '/api' }],
  paths,
  components: {
    schemas,
    securitySchemes: { Session: { type: 'apiKey', in: 'cookie', name: 'market_session' } },
    parameters: {
      Origin: {
        in: 'header',
        name: 'Origin',
        required: true,
        schema: { type: 'string' },
        description: 'Must equal configured APP_ORIGIN',
      },
      RequestHeader: {
        in: 'header',
        name: 'X-Market-Request',
        required: true,
        schema: { const: '1' },
      },
      IdempotencyKey: {
        in: 'header',
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', pattern: '^[\\w-]{12,100}$' },
      },
    },
  },
};
writeFileSync(
  new URL('../docs/openapi.json', import.meta.url),
  JSON.stringify(spec, null, 2) + '\n',
);
console.info(
  `Documented ${Object.keys(paths).length} paths / ${Object.values(paths).reduce((sum, p) => sum + Object.keys(p).length, 0)} operations.`,
);
