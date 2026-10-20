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
    required: ['id', 'name', 'emailVerified', 'roles'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      emailVerified: { type: 'boolean' },
      roles: { type: 'array', items: { enum: ['customer', 'expert', 'admin'] } },
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
add('get', '/config', 'Public provider capabilities', 'public');
add('get', '/me', 'Current user', 'user', undefined, 'User');
add('post', '/auth/register', 'Register an invited email', 'public', 'Register', 'Object', 202);
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
add('put', '/expert/profile', 'Submit profile for verification', 'user', 'ExpertInput');
add('get', '/expert/services', 'Own services (first 100)', 'expert', undefined, 'Collection');
add('post', '/expert/services', 'Create a service', 'expert', 'ServiceInput', 'Object', 201);
add('put', '/expert/services/{id}', 'Edit or archive a service', 'expert', 'ServiceInput');
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
add('get', '/expert/earnings', 'Own captured earnings and payouts', 'expert');
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
  '/admin/experts',
  'List expert review records',
  'admin',
  undefined,
  'Collection',
  200,
  '',
  pages,
);
add(
  'patch',
  '/admin/experts/{id}/verification',
  'Approve, reject or suspend expert',
  'admin',
  'Verification',
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
  '',
  pages,
);
add('post', '/admin/categories', 'Create category', 'admin', 'CategoryInput', 'Object', 201);
add('put', '/admin/categories/{id}', 'Edit or archive category', 'admin', 'CategoryInput');
add('get', '/admin/settings', 'Read policy defaults', 'admin');
add(
  'put',
  '/admin/settings',
  'Set commission, confirmation and payout policies',
  'admin',
  'SettingsInput',
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
add('get', '/admin/audit', 'List audit history', 'admin', undefined, 'Collection', 200, '', pages);
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Independent Expert Marketplace API',
    version: '0.1.0',
    description:
      'Controlled beta. Live money movement is source-locked pending release certification. All amounts are INR paise; times are UTC ISO 8601. Customer and expert session data are private.',
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
