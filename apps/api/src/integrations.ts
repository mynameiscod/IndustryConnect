import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  mkdirSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Config } from './config.js';
import { AppError, assert } from './providers.js';

const text = z.string().trim().max(4096);
type Field = {
  key: keyof Config;
  label: string;
  secret?: boolean;
  type?: string;
  options?: string[];
  schema: z.ZodType;
};
type Definition = { title: string; help: string; fields: Field[]; required: string[] };
export const integrationDefinitions: Record<string, Definition> = {
  email: {
    title: 'Email delivery',
    help: 'Choose SMTP or Amazon SES. SES region must match your verified sender identity. Grant ses:SendEmail; sandbox accounts can send only to verified recipients. Optional configuration sets publish delivery events when configured in AWS. Saving does not send email.',
    required: ['EMAIL_FROM'],
    fields: [
      {
        key: 'EMAIL_PROVIDER',
        label: 'Email provider',
        options: ['smtp', 'ses'],
        schema: z.enum(['smtp', 'ses']),
      },
      {
        key: 'SES_REGION',
        label: 'SES region',
        schema: z.union([z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d$/), z.literal('')]),
      },
      { key: 'SES_ACCESS_KEY_ID', label: 'SES access key ID', secret: true, schema: text },
      {
        key: 'SES_SECRET_ACCESS_KEY',
        label: 'SES secret access key',
        secret: true,
        schema: z.string().max(4096),
      },
      {
        key: 'SES_CONFIGURATION_SET',
        label: 'SES configuration set (optional)',
        schema: z.union([z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), z.literal('')]),
      },
      {
        key: 'SMTP_HOST',
        label: 'SMTP host',
        schema: z.union([
          z
            .string()
            .trim()
            .max(253)
            .regex(/^[a-z0-9.-]+$/i),
          z.literal(''),
        ]),
      },
      {
        key: 'SMTP_PORT',
        label: 'SMTP port',
        type: 'number',
        schema: z.coerce.number().int().min(1).max(65535),
      },
      { key: 'SMTP_USER', label: 'SMTP username', schema: text },
      { key: 'SMTP_PASSWORD', label: 'SMTP password', secret: true, schema: z.string().max(4096) },
      {
        key: 'EMAIL_FROM',
        label: 'Sender email address',
        type: 'email',
        schema: z.union([z.email(), z.literal('')]),
      },
    ],
  },
  whatsapp: {
    title: 'WhatsApp messaging',
    help: 'Use a dedicated Meta WhatsApp Cloud API sender and system-user access token. Enter an API version supported by your Meta app and an approved template with no variables for the test message. Send only to recipients who opted in. This configures manual test delivery; automatic booking WhatsApp notifications are not enabled.',
    required: [
      'WHATSAPP_API_VERSION',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_TEMPLATE_NAME',
      'WHATSAPP_TEMPLATE_LANGUAGE',
    ],
    fields: [
      {
        key: 'WHATSAPP_API_VERSION',
        label: 'Meta Graph API version (e.g. v23.0)',
        schema: z.union([z.string().regex(/^v\d{2}\.0$/), z.literal('')]),
      },
      {
        key: 'WHATSAPP_PHONE_NUMBER_ID',
        label: 'WhatsApp phone number ID',
        schema: z.union([z.string().regex(/^\d{5,30}$/), z.literal('')]),
      },
      {
        key: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        label: 'WhatsApp business account ID (optional)',
        schema: z.union([z.string().regex(/^\d{5,30}$/), z.literal('')]),
      },
      {
        key: 'WHATSAPP_ACCESS_TOKEN',
        label: 'Meta access token',
        secret: true,
        schema: z.string().max(4096),
      },
      {
        key: 'WHATSAPP_TEMPLATE_NAME',
        label: 'Approved test template name (no variables)',
        schema: z.union([z.string().regex(/^[a-z0-9_]{1,512}$/), z.literal('')]),
      },
      {
        key: 'WHATSAPP_TEMPLATE_LANGUAGE',
        label: 'Template language code',
        schema: z.union([z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/), z.literal('')]),
      },
    ],
  },
  razorpay: {
    title: 'Razorpay payments',
    help: 'Save gateway credentials securely for operator activation. These staged keys do not replace the running payment credentials or enable checkout. Rotation requires reconciliation of outstanding orders and an operator deployment. Live payments and Route remain locked by release controls.',
    required: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'],
    fields: [
      {
        key: 'RAZORPAY_KEY_ID',
        label: 'Razorpay key ID',
        schema: z.union([z.string().regex(/^rzp_(test|live)_[a-zA-Z0-9]+$/), z.literal('')]),
      },
      {
        key: 'RAZORPAY_KEY_SECRET',
        label: 'Razorpay key secret',
        secret: true,
        schema: z.string().max(4096),
      },
      {
        key: 'RAZORPAY_WEBHOOK_SECRET',
        label: 'Razorpay webhook secret',
        secret: true,
        schema: z.string().max(4096),
      },
    ],
  },
  google: {
    title: 'Google sign-in',
    help: 'Create a Google Web OAuth client and register the application origin shown below. This client ID is public; Calendar organizer credentials are configured separately.',
    required: ['GOOGLE_CLIENT_ID'],
    fields: [
      {
        key: 'GOOGLE_CLIENT_ID',
        label: 'Google sign-in client ID',
        schema: z.union([
          z
            .string()
            .trim()
            .max(256)
            .regex(/^[a-z0-9._-]+\.apps\.googleusercontent\.com$/i),
          z.literal(''),
        ]),
      },
    ],
  },
  calendar: {
    title: 'Google Calendar / Meet',
    help: 'Use a separate organizer OAuth client with Calendar access and an offline refresh token. Complete Google consent in your provider project. Saving does not create a meeting.',
    required: [
      'GOOGLE_CALENDAR_CLIENT_ID',
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REFRESH_TOKEN',
      'GOOGLE_CALENDAR_ID',
    ],
    fields: [
      {
        key: 'GOOGLE_CALENDAR_CLIENT_ID',
        label: 'Calendar OAuth client ID',
        schema: z.union([
          z
            .string()
            .trim()
            .max(256)
            .regex(/^[a-z0-9._-]+\.apps\.googleusercontent\.com$/i),
          z.literal(''),
        ]),
      },
      {
        key: 'GOOGLE_CALENDAR_CLIENT_SECRET',
        label: 'Calendar OAuth client secret',
        secret: true,
        schema: z.string().max(4096),
      },
      {
        key: 'GOOGLE_CALENDAR_REFRESH_TOKEN',
        label: 'Organizer refresh token',
        secret: true,
        schema: z.string().max(4096),
      },
      { key: 'GOOGLE_CALENDAR_ID', label: 'Organizer calendar ID', schema: text },
    ],
  },
  phone: {
    title: 'Phone OTP',
    help: 'Use a dedicated Twilio Verify service. Configure allowed countries, fraud protection and spending limits in Twilio. Saving does not send an OTP.',
    required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'],
    fields: [
      {
        key: 'TWILIO_ACCOUNT_SID',
        label: 'Twilio account SID',
        schema: z.union([z.string().regex(/^AC[a-f0-9]{32}$/i), z.literal('')]),
      },
      {
        key: 'TWILIO_AUTH_TOKEN',
        label: 'Twilio auth token',
        secret: true,
        schema: z.string().max(4096),
      },
      {
        key: 'TWILIO_VERIFY_SERVICE_SID',
        label: 'Verify service SID',
        schema: z.union([z.string().regex(/^VA[a-f0-9]{32}$/i), z.literal('')]),
      },
    ],
  },
};
const groupSchema = z.object({
  enabled: z.boolean(),
  values: z.record(z.string(), z.union([z.string().max(4096), z.number()])),
});
const documentSchema = z.object({
  revision: z.number().int().nonnegative(),
  groups: z.record(z.string(), groupSchema),
});
type Document = z.infer<typeof documentSchema>;
function readDocument(c: Config): Document {
  if (!c.PROVIDER_CONFIG_PATH || !existsSync(c.PROVIDER_CONFIG_PATH))
    return { revision: 0, groups: {} };
  try {
    assert(
      c.PROVIDER_CONFIG_KEY,
      503,
      'INTEGRATION_STORAGE_UNAVAILABLE',
      'Provider secret storage key is not configured',
    );
    const envelope = JSON.parse(readFileSync(c.PROVIDER_CONFIG_PATH, 'utf8'));
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(c.PROVIDER_CONFIG_KEY, 'hex'),
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from('industryconnect-providers-v1'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return documentSchema.parse(
      JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.data, 'base64')),
          decipher.final(),
        ]).toString(),
      ),
    );
  } catch {
    throw new AppError(
      503,
      'INTEGRATION_STORAGE_UNAVAILABLE',
      'Provider configuration could not be read securely',
    );
  }
}
function valuesFor(c: Config, doc: Document, provider: string) {
  const values: Record<string, string | number> = {};
  for (const f of integrationDefinitions[provider].fields) values[f.key] = c[f.key];
  // Legacy environment fallback is read only; new UI settings use separate Calendar credentials.
  if (provider === 'calendar') {
    values.GOOGLE_CALENDAR_CLIENT_ID ||= c.GOOGLE_CLIENT_ID;
    values.GOOGLE_CALENDAR_CLIENT_SECRET ||= c.GOOGLE_CLIENT_SECRET;
  }
  return { ...values, ...doc.groups[provider]?.values };
}
function complete(provider: string, values: Record<string, string | number>) {
  return (
    integrationDefinitions[provider].required.every((key) => !!values[key]) &&
    (provider !== 'email' ||
      (values.EMAIL_PROVIDER === 'ses'
        ? !!values.SES_REGION && !!values.SES_ACCESS_KEY_ID === !!values.SES_SECRET_ACCESS_KEY
        : !!values.SMTP_HOST && (!values.SMTP_USER || !!values.SMTP_PASSWORD)))
  );
}
export function effectiveProviderConfig(c: Config): Config {
  const doc = readDocument(c),
    result = { ...c };
  for (const [provider, definition] of Object.entries(integrationDefinitions)) {
    if (provider === 'razorpay') continue; // Staged only: never hot-rotate in-flight payment credentials.
    const values = valuesFor(c, doc, provider);
    const enabled = doc.groups[provider]?.enabled ?? complete(provider, values);
    for (const f of definition.fields)
      (result as unknown as Record<string, string | number>)[f.key] = enabled
        ? values[f.key]
        : f.key === 'EMAIL_PROVIDER'
          ? 'smtp'
          : f.key === 'SMTP_PORT'
            ? 587
            : '';
  }
  return result;
}
export function integrationMetadata(c: Config) {
  const doc = readDocument(c);
  return {
    available: !!(c.PROVIDER_CONFIG_PATH && c.PROVIDER_CONFIG_KEY),
    revision: doc.revision,
    origin: c.APP_ORIGIN,
    providers: Object.entries(integrationDefinitions).map(([id, definition]) => {
      const values = valuesFor(c, doc, id),
        enabled = doc.groups[id]?.enabled ?? complete(id, values);
      return {
        id,
        title: definition.title,
        help: definition.help,
        enabled,
        configured: enabled && complete(id, values),
        fields: definition.fields.map((f) => ({
          key: f.key,
          label: f.label,
          secret: !!f.secret,
          type: f.type ?? 'text',
          options: f.options,
          value: f.secret ? '' : String(values[f.key] ?? ''),
          configured: !!values[f.key],
        })),
      };
    }),
  };
}
export function parseIntegrationUpdate(provider: string, body: unknown) {
  const definition = integrationDefinitions[provider];
  assert(definition, 404, 'NOT_FOUND', 'Unknown provider');
  const fields = z
    .object(Object.fromEntries(definition.fields.map((f) => [f.key, f.schema.optional()])))
    .strict();
  return z
    .object({
      revision: z.number().int().nonnegative(),
      enabled: z.boolean(),
      fields,
      clearSecrets: z.array(z.string()).default([]),
      password: z.string().min(1).max(256),
    })
    .strict()
    .parse(body);
}
export function saveIntegration(
  c: Config,
  provider: string,
  update: ReturnType<typeof parseIntegrationUpdate>,
) {
  assert(
    c.PROVIDER_CONFIG_PATH && c.PROVIDER_CONFIG_KEY,
    503,
    'INTEGRATION_STORAGE_UNAVAILABLE',
    'Encrypted provider storage is not configured on this server',
  );
  const doc = readDocument(c);
  assert(
    doc.revision === update.revision,
    409,
    'CONFIG_CHANGED',
    'Provider settings changed. Reload settings before saving.',
  );
  const definition = integrationDefinitions[provider],
    values = valuesFor(c, doc, provider);
  for (const field of definition.fields) {
    const incoming = update.fields[field.key];
    if (incoming !== undefined && (!field.secret || incoming !== ''))
      values[field.key] = incoming as string | number;
  }
  for (const key of update.clearSecrets) {
    assert(
      definition.fields.some((f) => f.key === key && f.secret),
      400,
      'INVALID_FIELD',
      'Only this provider’s secret fields can be cleared',
    );
    values[key] = '';
  }
  assert(
    !update.enabled || complete(provider, values),
    400,
    'CONFIG_INCOMPLETE',
    'Complete the required provider fields before enabling this integration',
  );
  doc.groups[provider] = { enabled: update.enabled, values };
  doc.revision++;
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', Buffer.from(c.PROVIDER_CONFIG_KEY, 'hex'), iv);
  cipher.setAAD(Buffer.from('industryconnect-providers-v1'));
  const data = Buffer.concat([cipher.update(JSON.stringify(doc)), cipher.final()]);
  mkdirSync(dirname(c.PROVIDER_CONFIG_PATH), { recursive: true, mode: 0o700 });
  const temporary = c.PROVIDER_CONFIG_PATH + '.' + randomBytes(8).toString('hex') + '.tmp';
  try {
    writeFileSync(
      temporary,
      JSON.stringify({
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
      }),
      { mode: 0o600, flag: 'wx' },
    );
    renameSync(temporary, c.PROVIDER_CONFIG_PATH);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return integrationMetadata(c);
}
