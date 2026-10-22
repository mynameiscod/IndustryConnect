import { GetMessageInsightsCommand } from '@aws-sdk/client-sesv2';
import type { Config } from './config.js';
import { EmailDelivery } from './models.js';
import { AppError, assert, sesClient, type Providers } from './providers.js';

const maskRecipient = (to: string) => {
  const [name, domain] = to.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};
export async function sendTrackedEmail(
  c: Config,
  p: Providers,
  to: string,
  subject: string,
  text: string,
) {
  const row = await EmailDelivery.create({
    provider: c.EMAIL_PROVIDER,
    region: c.SES_REGION,
    recipient: maskRecipient(to),
    status: 'sending',
    reportNote: 'Sending request to the email provider.',
  });
  try {
    const receipt = await p.sendEmail(to, subject, text);
    await EmailDelivery.updateOne(
      { _id: row._id },
      {
        $set: {
          messageId: receipt?.messageId,
          status: 'accepted',
          reportNote: 'Accepted by the sending provider. Delivery confirmation is pending.',
        },
      },
    );
    return receipt ? { ...receipt, deliveryId: String(row._id) } : undefined;
  } catch (error) {
    const knownFailure =
      error instanceof AppError && ['EMAIL_REJECTED', 'EMAIL_UNAVAILABLE'].includes(error.code);
    await EmailDelivery.updateOne(
      { _id: row._id },
      {
        $set: {
          status: knownFailure ? 'failed' : 'unknown',
          reportNote: knownFailure
            ? 'The provider rejected this send request or email is not configured.'
            : 'The send outcome could not be confirmed. Check the provider before sending again.',
        },
      },
    );
    throw error;
  }
}

// One API process is deployed. Provider throttling is still handled if another sender shares the AWS account.
let nextInsightCheck = 0;
export function insightStatus(events: { type: string; at: Date }[]) {
  const types = new Set(events.map((e) => e.type));
  if (types.has('COMPLAINT')) return 'complained';
  if (types.has('BOUNCE')) return 'bounced';
  if (types.has('REJECT') || types.has('RENDERING_FAILURE')) return 'rejected';
  if (types.has('DELIVERY')) return 'delivered';
  if (types.has('DELIVERY_DELAY')) return 'delayed';
  return 'accepted';
}
export async function checkEmailDelivery(c: Config, id: string) {
  const row = await EmailDelivery.findById(id);
  assert(row, 404, 'NOT_FOUND', 'Email report not found');
  if (row.provider !== 'ses' || !row.messageId) {
    row.reportNote =
      row.provider === 'smtp'
        ? 'SMTP does not provide delivery confirmation here. Check your SMTP provider logs.'
        : 'No SES message ID was recorded. Check your SES console before resending.';
    await row.save();
    return row;
  }
  assert(
    Date.now() >= nextInsightCheck,
    429,
    'REPORT_RATE_LIMIT',
    'Wait a moment before checking another report',
  );
  nextInsightCheck = Date.now() + 1100;
  const client = sesClient({ ...c, SES_REGION: row.region || c.SES_REGION });
  try {
    const result = await client.send(new GetMessageInsightsCommand({ MessageId: row.messageId }));
    assert(
      result.MessageId === row.messageId,
      502,
      'REPORT_MISMATCH',
      'SES returned a different message',
    );
    const events = (result.Insights ?? [])
      .flatMap((insight) =>
        (insight.Events ?? [])
          .filter((e) => e.Type && e.Timestamp)
          .map((e) => ({ type: e.Type!, at: e.Timestamp! })),
      )
      .sort((a, b) => +a.at - +b.at);
    const previous = row.events.flatMap((event) =>
      event.type && event.at ? [{ type: event.type, at: event.at }] : [],
    );
    const combined = [
      ...new Map(
        [...previous, ...events].map((event) => [event.type + ':' + event.at.toISOString(), event]),
      ).values(),
    ].sort((a, b) => +a.at - +b.at);
    row.set('events', combined);
    row.status = insightStatus(combined);
    row.reportNote =
      row.status === 'delivered'
        ? 'The recipient mail server accepted this email. This does not confirm inbox placement or that it was read.'
        : row.status === 'accepted'
          ? 'SES has not reported a delivery result yet. Check again later.'
          : 'AWS SES reported the status shown below.';
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    row.reportNote =
      name === 'NotFoundException'
        ? 'SES has no report for this message yet. Message Insights requires Virtual Deliverability Manager; check its setup and try later.'
        : name === 'AccessDeniedException'
          ? 'Delivery reporting needs the ses:GetMessageInsights IAM permission. Sending permission alone is insufficient.'
          : 'SES delivery reporting is unavailable. Check IAM permission, Virtual Deliverability Manager and the AWS region, then try again.';
  } finally {
    client.destroy();
  }
  row.lastCheckedAt = new Date();
  await row.save();
  return row;
}
