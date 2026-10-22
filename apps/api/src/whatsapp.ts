import type { Config } from './config.js';
import { AppError, assert } from './providers.js';

export async function sendWhatsAppTest(c: Config, to: string) {
  assert(
    c.WHATSAPP_API_VERSION &&
      c.WHATSAPP_PHONE_NUMBER_ID &&
      c.WHATSAPP_ACCESS_TOKEN &&
      c.WHATSAPP_TEMPLATE_NAME &&
      c.WHATSAPP_TEMPLATE_LANGUAGE,
    503,
    'WHATSAPP_UNAVAILABLE',
    'WhatsApp messaging is not configured',
  );
  try {
    const response = await fetch(
      `https://graph.facebook.com/${c.WHATSAPP_API_VERSION}/${c.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${c.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.slice(1),
          type: 'template',
          template: {
            name: c.WHATSAPP_TEMPLATE_NAME,
            language: { code: c.WHATSAPP_TEMPLATE_LANGUAGE },
          },
        }),
      },
    );
    assert(response.ok, 502, 'WHATSAPP_ERROR', 'WhatsApp request failed');
    const result = (await response.json()) as { messages?: { id?: string }[] };
    assert(
      result.messages?.[0]?.id,
      502,
      'WHATSAPP_ERROR',
      'WhatsApp did not acknowledge the message',
    );
  } catch {
    throw new AppError(
      502,
      'WHATSAPP_ERROR',
      'WhatsApp delivery request failed; check the sender, token, approved template and recipient eligibility',
    );
  }
}
