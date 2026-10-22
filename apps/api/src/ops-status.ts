import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { connect, Job, Booking, Payout } from './models.js';
import { effectiveProviderConfig } from './integrations.js';
try {
  const config = readConfig();
  effectiveProviderConfig(config); // Corrupt/unreadable integration storage becomes an operations probe alert.
  await connect(config.MONGODB_URI, true);
  const queued = await Job.findOne({ status: 'queued' })
    .sort({ nextRunAt: 1 })
    .select('nextRunAt')
    .lean();
  const oldestDueSeconds =
    queued && queued.nextRunAt <= new Date()
      ? Math.floor((Date.now() - +queued.nextRunAt) / 1000)
      : 0;
  console.log(
    JSON.stringify({
      oldestDueSeconds,
      failedJobs: await Job.countDocuments({ status: 'failed' }),
      expiredWorkerLeases: await Job.countDocuments({
        status: 'running',
        lockedUntil: { $lt: new Date() },
      }),
      paymentExceptions: await Booking.countDocuments({
        $or: [
          { orderState: { $in: ['creating', 'unknown'] } },
          { paymentStatus: 'refund_required' },
          { dispute: true },
        ],
      }),
      unknownPayouts: await Payout.countDocuments({ status: 'unknown' }),
    }),
  );
} finally {
  await mongoose.disconnect();
}
