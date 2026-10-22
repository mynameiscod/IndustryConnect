import mongoose from 'mongoose';
import { expertInput } from '@market/contracts';
import { Expert, User, Category, Service, Slot, Audit } from './models.js';
import { assert } from './providers.js';
import { enqueue } from './marketplace.js';

export async function submitExpert(userId: mongoose.Types.ObjectId, body: unknown) {
  const data = expertInput.parse(body);
  data.categories = [...new Set(data.categories)];
  return mongoose.connection.transaction(async (session) => {
    const user = await User.findById(userId).session(session);
    assert(
      user?.active && user.emailVerified,
      403,
      'VERIFY_EMAIL',
      'Verify your email before onboarding',
    );
    assert(
      (await Category.countDocuments({ _id: { $in: data.categories }, active: true }).session(
        session,
      )) === data.categories.length,
      400,
      'INVALID_CATEGORY',
      'Select active categories',
    );
    let expert = await Expert.findOne({ userId }).session(session);
    assert(
      expert?.verification !== 'suspended',
      403,
      'EXPERT_SUSPENDED',
      'Your profile is suspended. Contact the marketplace team before resubmitting.',
    );
    const changed =
      !expert ||
      Object.entries(data).some(
        ([key, value]) =>
          key !== 'confirmationPolicy' &&
          JSON.stringify(expert!.get(key)) !== JSON.stringify(value),
      );
    const needsReview = !expert || expert.verification === 'rejected' || changed;
    if (!expert) expert = new Expert({ userId, ...data });
    else Object.assign(expert, data);
    if (needsReview) {
      expert.verification = 'pending';
      expert.profileRevision = (expert.profileRevision ?? 0) + 1;
    }
    await expert.save({ session });
    await User.updateOne({ _id: userId }, { $addToSet: { roles: 'expert' } }, { session });
    await Audit.create(
      [
        {
          actorId: userId,
          action: needsReview ? 'expert.submit' : 'expert.update',
          resourceId: String(expert._id),
          details: { profileRevision: expert.profileRevision },
        },
      ],
      { session },
    );
    if (needsReview)
      await enqueue(
        `expert-submit:${expert._id}:${expert.profileRevision}`,
        'expert-review',
        { expertId: String(expert._id), revision: expert.profileRevision, status: 'pending' },
        session,
      );
    return expert;
  });
}

export async function reviewExpert(
  actorId: mongoose.Types.ObjectId,
  expertId: string,
  data: { status: 'approved' | 'rejected' | 'suspended'; reason: string; expectedRevision: number },
) {
  return mongoose.connection.transaction(async (session) => {
    const expert = await Expert.findById(expertId).session(session);
    assert(expert, 404, 'NOT_FOUND', 'Expert not found');
    assert(
      (expert.profileRevision ?? 0) === data.expectedRevision,
      409,
      'PROFILE_CHANGED',
      'The expert profile changed. Reload and review the current application.',
    );
    const owner = await User.findById(expert.userId).session(session);
    assert(
      data.status !== 'approved' || (owner?.active && owner.emailVerified),
      409,
      'VERIFY_EMAIL',
      'An active account with verified email is required for approval',
    );
    assert(
      data.status !== 'approved' ||
        ((await Category.countDocuments({ _id: { $in: expert.categories }, active: true }).session(
          session,
        )) === new Set(expert.categories.map(String)).size &&
          expert.categories.length > 0),
      409,
      'INVALID_CATEGORY',
      'The expert needs an active category before approval',
    );
    expert.verification = data.status;
    expert.reviewReason = data.reason;
    // Increment on decisions too, so concurrent reviewers cannot overwrite each other.
    expert.profileRevision = (expert.profileRevision ?? 0) + 1;
    await expert.save({ session });
    await Audit.create(
      [{ actorId, action: 'expert.verify', resourceId: expertId, details: data }],
      { session },
    );
    await enqueue(
      `expert-review:${expertId}:${expert.profileRevision}`,
      'expert-review',
      { expertId, revision: expert.profileRevision, status: data.status },
      session,
    );
    return expert;
  });
}

export async function expertReadiness(userId: mongoose.Types.ObjectId) {
  const user = await User.findById(userId);
  const expert = await Expert.findOne({ userId });
  const activeCategories = await Category.find({ active: true }).select('_id');
  const services = expert
    ? await Service.find({
        expertId: expert._id,
        active: true,
        categoryId: { $in: activeCategories.map((c) => c._id) },
      }).select('_id')
    : [];
  const futureSlots = expert
    ? await Slot.countDocuments({
        expertId: expert._id,
        serviceId: { $in: services.map((s) => s._id) },
        status: 'open',
        startsAt: { $gt: new Date(Date.now() + 3600000) },
      })
    : 0;
  const approved = expert?.verification === 'approved';
  return {
    emailVerified: !!user?.emailVerified,
    profileSubmitted: !!expert,
    verification: expert?.verification ?? 'not_started',
    reviewReason: expert?.reviewReason ?? '',
    activeServices: services.length,
    openSlots: futureSlots,
    listed: !!user?.active && approved && services.length > 0,
    acceptingReservations: !!user?.active && approved && services.length > 0 && futureSlots > 0,
    publicPath: approved && services.length ? `/experts/${expert!.slug}` : null,
  };
}
