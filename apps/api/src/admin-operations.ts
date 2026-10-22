import mongoose from 'mongoose';
import { Expert, User, Service, Slot, Category, Job, Audit } from './models.js';
import { assert } from './providers.js';
import { expertReadiness } from './onboarding.js';

export async function adminExpertDetail(id: string) {
  const expert = await Expert.findById(id).select('-routeAccountId -routeReady');
  assert(expert, 404, 'NOT_FOUND', 'Expert not found');
  const owner = await User.findById(expert.userId).select(
    'name email emailVerified active accountPurpose',
  );
  const categories = await Category.find({ _id: { $in: expert.categories } }).select(
    'name slug active',
  );
  const services = await Service.find({ expertId: expert._id })
    .select(
      'title description categoryId durationMinutes pricePaise mode location active confirmationPolicy',
    )
    .sort({ createdAt: -1 })
    .limit(100);
  const openSlots = await Slot.countDocuments({
    expertId: expert._id,
    status: 'open',
    startsAt: { $gt: new Date(Date.now() + 3600000) },
  });
  return {
    expert,
    owner,
    categories,
    services,
    openSlots,
    readiness: await expertReadiness(expert.userId),
  };
}
export const retryableEmailJobs = ['expert-review', 'notify', 'reminder'];
export async function retryNotification(
  actorId: mongoose.Types.ObjectId,
  id: string,
  reason: string,
) {
  return mongoose.connection.transaction(async (session) => {
    const job = await Job.findOneAndUpdate(
      { _id: id, status: 'failed', type: { $in: retryableEmailJobs } },
      {
        $set: { status: 'queued', attempts: 0, nextRunAt: new Date() },
        $unset: { lockedUntil: 1, lastError: 1 },
      },
      { session, returnDocument: 'after' },
    );
    assert(
      job,
      409,
      'JOB_NOT_RETRYABLE',
      'Only failed email notification jobs can be retried here. Reload the queue.',
    );
    await Audit.create(
      [
        {
          actorId,
          action: 'notification.retry',
          resourceId: id,
          details: { reason, type: job.type },
        },
      ],
      { session },
    );
    return {
      id: String(job._id),
      status: job.status,
      message: 'Email job queued for the worker. This does not confirm delivery.',
    };
  });
}
