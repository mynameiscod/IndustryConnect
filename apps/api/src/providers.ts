import { createHmac, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import type { Config } from './config.js';

export interface ProviderPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  amount_refunded?: number;
}
export interface Providers {
  fetchOrder(id: string): Promise<{
    id: string;
    receipt: string;
    amount: number;
    currency: string;
    partial_payment: boolean;
  }>;
  createOrder(
    amount: number,
    receipt: string,
  ): Promise<{ id: string; amount: number; currency: string }>;
  fetchPayment(id: string): Promise<ProviderPayment>;
  fetchOrderPayments(id: string): Promise<ProviderPayment[]>;
  transfer(
    paymentId: string,
    account: string,
    amount: number,
    reference: string,
  ): Promise<{ id: string }>;
  verifyGoogle(
    token: string,
  ): Promise<{ sub: string; email: string; name: string; nonce?: string }>;
  createMeeting(input: {
    bookingId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    emails: string[];
  }): Promise<{ url?: string; eventId: string }>;
  cancelMeeting(eventId: string): Promise<void>;
  sendEmail(to: string, subject: string, text: string): Promise<void>;
  startPhone(phone: string): Promise<void>;
  verifyPhone(phone: string, code: string): Promise<boolean>;
}
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export function verifyHmac(value: string | Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(value).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export function createProviders(c: Config): Providers {
  const google = new OAuth2Client(
    c.GOOGLE_CALENDAR_CLIENT_ID || c.GOOGLE_CLIENT_ID,
    c.GOOGLE_CALENDAR_CLIENT_SECRET || c.GOOGLE_CLIENT_SECRET,
  );
  google.setCredentials({ refresh_token: c.GOOGLE_CALENDAR_REFRESH_TOKEN });
  async function request(url: string, init: RequestInit = {}) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    if (!response.ok)
      throw new AppError(502, 'PROVIDER_ERROR', `Provider request failed (${response.status})`);
    if (response.status === 204) return {};
    return response.json() as Promise<any>;
  }
  const razor = (path: string, body?: unknown) => {
    assert(
      c.RAZORPAY_KEY_ID && c.RAZORPAY_KEY_SECRET,
      503,
      'PAYMENTS_UNAVAILABLE',
      'Razorpay is not configured',
    );
    return request(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.RAZORPAY_KEY_ID}:${c.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };
  async function calendar(path: string, init: RequestInit = {}) {
    assert(
      c.GOOGLE_CALENDAR_REFRESH_TOKEN &&
        (c.GOOGLE_CALENDAR_CLIENT_ID || c.GOOGLE_CLIENT_ID) &&
        (c.GOOGLE_CALENDAR_CLIENT_SECRET || c.GOOGLE_CLIENT_SECRET),
      503,
      'CALENDAR_UNAVAILABLE',
      'Calendar organizer is not configured',
    );
    const token = await google.getAccessToken();
    return fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.GOOGLE_CALENDAR_ID)}/events${path}`,
      {
        ...init,
        headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      },
    );
  }
  const phone = (path: string, values: Record<string, string>) => {
    assert(
      c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_VERIFY_SERVICE_SID,
      503,
      'SMS_UNAVAILABLE',
      'SMS verification is not configured',
    );
    return request(`https://verify.twilio.com/v2/Services/${c.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.TWILIO_ACCOUNT_SID}:${c.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(values),
    });
  };
  return {
    fetchOrder: (id) => razor(`orders/${encodeURIComponent(id)}`),
    createOrder: (amount, receipt) =>
      razor('orders', { amount, currency: 'INR', receipt, partial_payment: false }),
    fetchPayment: (paymentId) => razor(`payments/${encodeURIComponent(paymentId)}`),
    fetchOrderPayments: async (orderId) =>
      (await razor(`orders/${encodeURIComponent(orderId)}/payments`)).items,
    transfer: async (paymentId, account, amount, reference) => {
      assert(c.ROUTE_ENABLED === 'true', 503, 'ROUTE_UNAVAILABLE', 'Route is disabled');
      const result = await razor(`payments/${encodeURIComponent(paymentId)}/transfers`, {
        transfers: [{ account, amount, currency: 'INR', notes: { bookingId: reference } }],
      });
      assert(
        result.items?.length === 1,
        502,
        'TRANSFER_UNKNOWN',
        'Transfer outcome requires reconciliation',
      );
      return result.items[0];
    },
    verifyGoogle: async (token) => {
      assert(c.GOOGLE_CLIENT_ID, 503, 'GOOGLE_UNAVAILABLE', 'Google sign-in is not configured');
      const ticket = await new OAuth2Client(c.GOOGLE_CLIENT_ID).verifyIdToken({
        idToken: token,
        audience: c.GOOGLE_CLIENT_ID,
      });
      const p = ticket.getPayload();
      assert(
        p?.sub && p.email && p.email_verified,
        401,
        'INVALID_GOOGLE',
        'Verified Google email required',
      );
      return {
        sub: p.sub,
        email: p.email.toLowerCase(),
        name: p.name ?? 'Member',
        nonce: (p as any).nonce,
      };
    },
    createMeeting: async (input) => {
      const eventId = `b${input.bookingId}`; // Mongo hex is a valid Calendar base32hex event ID.
      let response = await calendar(`/${eventId}`);
      if (response.status === 404)
        response = await calendar('?conferenceDataVersion=1&sendUpdates=all', {
          method: 'POST',
          body: JSON.stringify({
            id: eventId,
            summary: input.title,
            start: { dateTime: input.startsAt.toISOString() },
            end: { dateTime: input.endsAt.toISOString() },
            attendees: input.emails.map((email) => ({ email })),
            conferenceData: {
              createRequest: {
                requestId: eventId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }),
        });
      if (response.status === 409) response = await calendar(`/${eventId}`);
      assert(response.ok, 502, 'MEETING_ERROR', 'Calendar creation failed');
      const event = (await response.json()) as any;
      return {
        eventId,
        url:
          event.hangoutLink ??
          event.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri,
      };
    },
    cancelMeeting: async (eventId) => {
      const r = await calendar(`/${encodeURIComponent(eventId)}?sendUpdates=all`, {
        method: 'DELETE',
      });
      assert(
        r.ok || r.status === 404 || r.status === 410,
        502,
        'MEETING_ERROR',
        'Calendar cancellation failed',
      );
    },
    sendEmail: async (to, subject, text) => {
      assert(
        c.SMTP_HOST && c.EMAIL_FROM,
        503,
        'EMAIL_UNAVAILABLE',
        'Email delivery is not configured',
      );
      const transport = nodemailer.createTransport({
        host: c.SMTP_HOST,
        port: c.SMTP_PORT,
        secure: c.SMTP_PORT === 465,
        requireTLS: c.SMTP_PORT !== 465,
        auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASSWORD } : undefined,
        connectionTimeout: 15000,
      });
      await transport.sendMail({ from: c.EMAIL_FROM, to, subject, text });
    },
    startPhone: async (phoneNumber) => {
      await phone('Verifications', { To: phoneNumber, Channel: 'sms' });
    },
    verifyPhone: async (phoneNumber, code) =>
      (await phone('VerificationCheck', { To: phoneNumber, Code: code })).status === 'approved',
  };
}
