import { Booking, Expert, Job, User } from './models.js';
import { expireBookings, notifyBooking } from './marketplace.js';
import { assert, type Providers } from './providers.js';

export async function processOneJob(p: Providers) {
  const now = new Date();
  const job = await Job.findOneAndUpdate(
    {
      $or: [
        { status: 'queued', nextRunAt: { $lte: now } },
        { status: 'running', lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: 'running', lockedUntil: new Date(Date.now() + 120000) },
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after', sort: { nextRunAt: 1 } },
  );
  if (!job) return false;
  try {
    const b = await Booking.findById(job.payload.bookingId);
    if (job.type === 'meet' && b?.status === 'confirmed' && b.paymentStatus === 'captured') {
      const expert = await Expert.findById(b.expertId);
      const users = await User.find({
        _id: { $in: [b.customerId, expert?.userId] },
        emailVerified: true,
      });
      const emails = users.map((u) => u.email).filter((e): e is string => !!e);
      assert(emails.length === 2, 409, 'EMAIL_MISSING', 'Both participants need verified email');
      const result = await p.createMeeting({
        bookingId: String(b._id),
        title: b.title ?? 'Expert session',
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        emails,
      });
      assert(
        result.url?.startsWith('https://meet.google.com/'),
        503,
        'MEETING_PENDING',
        'Conference is not ready yet',
      );
      const updated = await Booking.updateOne(
        { _id: b._id, status: 'confirmed', paymentStatus: 'captured' },
        {
          $set: { meetingUrl: result.url, calendarEventId: result.eventId, meetingStatus: 'ready' },
        },
      );
      if (!updated.modifiedCount) await p.cancelMeeting(result.eventId);
      else await notifyBooking(p, String(b._id), 'Your meeting link is ready');
    } else if (job.type === 'cancel-meet' && b) {
      // Check the stable ID even if a crash prevented persisting Calendar's response.
      await p.cancelMeeting(b.calendarEventId ?? `b${b._id}`);
      await Booking.updateOne(
        { _id: b._id },
        { $set: { meetingStatus: 'cancelled' }, $unset: { meetingUrl: 1 } },
      );
    } else if (job.type === 'notify' && b)
      await notifyBooking(p, String(b._id), String(job.payload.event));
    else if (job.type === 'reminder' && b?.status === 'confirmed' && b.startsAt > new Date())
      await notifyBooking(p, String(b._id), 'Your session starts in one hour');
    await Job.updateOne(
      { _id: job._id, lockedUntil: job.lockedUntil },
      { $set: { status: 'done' }, $unset: { lockedUntil: 1, lastError: 1 } },
    );
  } catch (error) {
    const lastError = error instanceof Error ? error.name : 'ProviderError';
    await Job.updateOne(
      { _id: job._id, lockedUntil: job.lockedUntil },
      {
        $set: {
          status: job.attempts >= 8 ? 'failed' : 'queued',
          nextRunAt: new Date(Date.now() + Math.min(3600000, 5000 * 2 ** job.attempts)),
          lastError,
        },
        $unset: { lockedUntil: 1 },
      },
    );
    if (job.type === 'meet' && job.attempts >= 8)
      await Booking.updateOne(
        { _id: job.payload.bookingId, meetingStatus: 'pending' },
        { $set: { meetingStatus: 'failed' } },
      );
  }
  return true;
}
export async function workerTick(p: Providers) {
  await expireBookings();
  for (let count = 0; count < 20; count++) if (!(await processOneJob(p))) break;
}
