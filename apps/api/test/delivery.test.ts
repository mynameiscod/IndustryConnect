import { afterEach, expect, it, vi } from 'vitest';
const ses = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn(), options: vi.fn() }));
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    constructor(options: unknown) {
      ses.options(options);
    }
    send = ses.send;
    destroy = ses.destroy;
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));
import { createProviders } from '../src/providers.js';
import { readConfig } from '../src/config.js';
import { sendWhatsAppTest } from '../src/whatsapp.js';
process.env.AUTH_PEPPER ??= 'delivery-test-pepper-with-at-least-32-characters';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('sends SES with selected region, sender and configuration set, without retries', async () => {
  ses.send.mockResolvedValue({ MessageId: 'accepted-id' });
  const c = {
    ...readConfig(),
    EMAIL_PROVIDER: 'ses' as const,
    EMAIL_FROM: 'sender@example.invalid',
    SES_REGION: 'ap-south-1',
    SES_ACCESS_KEY_ID: 'test-key',
    SES_SECRET_ACCESS_KEY: 'test-secret',
    SES_CONFIGURATION_SET: 'events',
  };
  await createProviders(c).sendEmail('recipient@example.invalid', 'Test subject', 'Test body');
  expect(ses.options).toHaveBeenCalledWith(
    expect.objectContaining({
      region: 'ap-south-1',
      maxAttempts: 1,
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
    }),
  );
  expect(ses.send.mock.calls[0][0].input).toMatchObject({
    FromEmailAddress: c.EMAIL_FROM,
    Destination: { ToAddresses: ['recipient@example.invalid'] },
    ConfigurationSetName: 'events',
    Content: { Simple: { Body: { Text: { Data: 'Test body' } } } },
  });
  ses.send.mockRejectedValueOnce(new Error('sensitive provider detail'));
  await expect(
    createProviders(c).sendEmail('recipient@example.invalid', 'Test', 'Test'),
  ).rejects.toThrow('SES delivery request failed');
  expect(ses.destroy).toHaveBeenCalledTimes(2);
});
it('sends approved WhatsApp templates once and rejects unacknowledged responses', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) });
  vi.stubGlobal('fetch', fetcher);
  const c = {
    ...readConfig(),
    WHATSAPP_API_VERSION: 'v23.0',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_TEMPLATE_NAME: 'hello_world',
    WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
  };
  await sendWhatsAppTest(c, '+919876543210');
  expect(fetcher.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/123456789/messages');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    to: '919876543210',
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } },
  });
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await expect(sendWhatsAppTest(c, '+919876543210')).rejects.toThrow(
    'WhatsApp delivery request failed',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
