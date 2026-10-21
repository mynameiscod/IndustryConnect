import mongoose from 'mongoose';
import type { Config } from './config.js';
import { paymentBlockers } from './config.js';
import { Booking, Payout, Settings } from './models.js';
import { assert } from './providers.js';

export async function expertEarnings(
  c: Config,
  expertId: mongoose.Types.ObjectId,
  input: {
    months: number;
    timezone: string;
    page: number;
    limit: number;
    status: 'all' | 'paid' | 'processing' | 'submitted' | 'unknown' | 'failed';
  },
) {
  const asOf = new Date();
  assert(!/^[+-]/.test(input.timezone), 400, 'INVALID_TIMEZONE', 'Choose a valid IANA timezone');
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en', {
      timeZone: input.timezone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(asOf);
  } catch {
    assert(false, 400, 'INVALID_TIMEZONE', 'Choose a valid IANA timezone');
  }
  const year = Number(parts.find((part) => part.type === 'year')!.value),
    month = Number(parts.find((part) => part.type === 'month')!.value);
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
  const keys = Array.from({ length: input.months }, (_, index) => {
    const date = new Date(Date.UTC(year, month - input.months + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  return mongoose.connection.transaction(async (session) => {
    const [report] = await Booking.aggregate([
      { $match: { expertId, paymentStatus: 'captured' } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: '$status',
                grossPaise: { $sum: '$grossPaise' },
                netPaise: { $sum: '$expertPaise' },
                count: { $sum: 1 },
              },
            },
          ],
          summary: [
            { $match: { status: 'completed', dispute: false } },
            {
              $lookup: {
                from: Payout.collection.name,
                localField: '_id',
                foreignField: 'bookingId',
                as: 'payoutRecords',
              },
            },
            {
              $group: {
                _id: null,
                totalEarningsPaise: { $sum: '$expertPaise' },
                completedSessions: { $sum: 1 },
                pendingPayoutPaise: {
                  $sum: { $cond: [{ $in: ['paid', '$payoutRecords.status'] }, 0, '$expertPaise'] },
                },
                thisMonthPaise: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          {
                            $dateToString: {
                              format: '%Y-%m',
                              date: '$endsAt',
                              timezone: input.timezone,
                            },
                          },
                          currentMonth,
                        ],
                      },
                      '$expertPaise',
                      0,
                    ],
                  },
                },
              },
            },
          ],
          monthly: [
            { $match: { status: 'completed', dispute: false } },
            {
              $project: {
                month: {
                  $dateToString: { format: '%Y-%m', date: '$endsAt', timezone: input.timezone },
                },
                expertPaise: 1,
              },
            },
            { $match: { month: { $in: keys } } },
            {
              $group: { _id: '$month', netPaise: { $sum: '$expertPaise' }, sessions: { $sum: 1 } },
            },
          ],
        },
      },
    ]).session(session);
    const payoutFilter = { expertId, ...(input.status === 'all' ? {} : { status: input.status }) };
    const payouts = await Payout.find(payoutFilter)
      .select('_id bookingId amountPaise mode status providerId reference createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .session(session)
      .lean();
    const payoutTotal = await Payout.countDocuments(payoutFilter).session(session);
    const settings = await Settings.findOne({ key: 'marketplace' }).session(session);
    assert(settings, 503, 'SETUP_REQUIRED', 'Marketplace settings are missing');
    const summary = report.summary[0] ?? {
      totalEarningsPaise: 0,
      completedSessions: 0,
      pendingPayoutPaise: 0,
      thisMonthPaise: 0,
    };
    return {
      totals: report.totals,
      payouts,
      payoutTotal,
      payoutPage: input.page,
      payoutLimit: input.limit,
      summary: {
        totalEarningsPaise: summary.totalEarningsPaise,
        completedSessions: summary.completedSessions,
        pendingPayoutPaise: summary.pendingPayoutPaise,
        thisMonthPaise: summary.thisMonthPaise,
      },
      monthly: keys.map((key) => {
        const row = report.monthly.find((item: { _id: string }) => item._id === key);
        return { month: key, netPaise: row?.netPaise ?? 0, sessions: row?.sessions ?? 0 };
      }),
      timezone: input.timezone,
      currentMonth,
      asOf: asOf.toISOString(),
      payoutInfo: {
        mode: settings.payoutMode,
        delayHours: settings.payoutDelayHours,
        paymentMode: c.PAYMENTS_MODE,
        checkoutEnabled: paymentBlockers(c).length === 0,
      },
    };
  });
}
