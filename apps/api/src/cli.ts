import mongoose from 'mongoose';
import { readConfig, paymentBlockers } from './config.js';
import {
  Category,
  Expert,
  Invite,
  Service,
  User,
  Booking,
  connect,
  ensureSettings,
  models,
} from './models.js';
import { hashPassword } from './auth.js';
import { addSlot, reconcileBooking, recoverOrder } from './marketplace.js';
import { createProviders, assert } from './providers.js';
const c = readConfig();
const action = process.argv[2];
try {
  if (action === 'readiness') {
    console.info(
      JSON.stringify({ payments: c.PAYMENTS_MODE, blockers: paymentBlockers(c) }, null, 2),
    );
  } else {
    await connect(c.MONGODB_URI, c.NODE_ENV === 'production');
    if (action === 'indexes') {
      for (const model of models) await model.createIndexes();
      await ensureSettings();
      console.info('Indexes and default settings created.');
    } else if (action === 'admin') {
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      assert(
        email && password && password.length >= 16 && process.env.ADMIN_NAME,
        400,
        'INPUT_REQUIRED',
        'Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (16+ chars) in the local environment',
      );
      assert(
        !(await User.exists({ email })),
        409,
        'EXISTS',
        'User already exists; do not silently promote',
      );
      await User.create({
        email,
        name: process.env.ADMIN_NAME,
        passwordHash: await hashPassword(password),
        emailVerified: true,
        roles: ['customer', 'admin'],
      });
      await Invite.create({ email });
      console.info('Admin created.');
    } else if (action === 'seed') {
      assert(
        c.NODE_ENV === 'development' && c.PAYMENTS_MODE !== 'live',
        403,
        'DEV_ONLY',
        'Seed is development-only',
      );
      const password = process.env.DEMO_PASSWORD;
      assert(
        password && password.length >= 16,
        400,
        'INPUT_REQUIRED',
        'Set DEMO_PASSWORD to 16+ characters',
      );
      assert(
        (await User.countDocuments()) === 0,
        409,
        'NOT_EMPTY',
        'Seed requires an empty isolated development database',
      );
      await ensureSettings();
      const categories = await Category.create([
        { name: 'Career & leadership', slug: 'career-leadership' },
        { name: 'Technology', slug: 'technology' },
        { name: 'Business & startups', slug: 'business-startups' },
        { name: 'Design & creative', slug: 'design-creative' },
      ]);
      const hash = await hashPassword(password);
      for (const [name, email, roles] of [
        ['Demo Customer', 'customer@example.invalid', ['customer']],
        ['Demo Admin', 'admin@example.invalid', ['customer', 'admin']],
      ] as const) {
        await User.create({
          name,
          email,
          passwordHash: hash,
          emailVerified: true,
          roles: [...roles],
        });
        await Invite.create({ email });
      }
      const samples = [
        [
          'Ananya Rao',
          'Product strategy & your next career chapter',
          'Product career clarity',
          0,
          149900,
        ],
        [
          'Arjun Mehta',
          'Build better systems. Make better technical decisions.',
          'System design deep dive',
          1,
          199900,
        ],
        [
          'Maya Shah',
          'A sounding board for your next business move',
          'Founder office hours',
          2,
          249900,
        ],
        [
          'Rohan Iyer',
          'Turn a good portfolio into a compelling story',
          'Portfolio review',
          3,
          99900,
        ],
      ] as const;
      for (let i = 0; i < samples.length; i++) {
        const [name, headline, title, cat, price] = samples[i];
        const email = `expert${i + 1}@example.invalid`;
        const u = await User.create({
          name,
          email,
          passwordHash: hash,
          emailVerified: true,
          roles: ['customer', 'expert'],
        });
        await Invite.create({ email });
        const e = await Expert.create({
          userId: u._id,
          slug: name.toLowerCase().replaceAll(' ', '-'),
          headline,
          bio: 'Demonstration profile for local testing only. Explore a focused one-to-one conversation, practical feedback and a clear set of next steps. This is fictional sample data.',
          categories: [categories[cat]._id],
          languages: ['English', 'Telugu'],
          city: 'Hyderabad',
          timezone: 'Asia/Kolkata',
          experienceYears: 8 + i,
          verification: 'approved',
          confirmationPolicy: 'manual',
        });
        const s = await Service.create({
          expertId: e._id,
          categoryId: categories[cat]._id,
          title,
          description:
            'A focused 45-minute conversation to review your goals, work through your questions and agree on practical next steps.',
          durationMinutes: 45,
          pricePaise: price,
          mode: 'online',
          active: true,
        });
        for (let d = 1; d <= 4; d++) {
          const date = new Date();
          date.setUTCDate(date.getUTCDate() + d);
          date.setUTCHours(9 + i, 0, 0, 0);
          await addSlot(u._id, String(s._id), date);
        }
      }
      console.info(
        'Fictional development data created. All demo accounts use DEMO_PASSWORD. No provider calls were made.',
      );
    } else if (action === 'recover-order') {
      console.info(
        JSON.stringify(
          await recoverOrder(createProviders(c), process.argv[3] ?? '', process.argv[4] ?? ''),
        ),
      );
    } else if (action === 'reconcile') {
      const p = createProviders(c);
      const rows = await Booking.find({
        orderId: { $exists: true },
        paymentStatus: { $ne: 'refunded' },
      })
        .sort({ reconciledAt: 1 })
        .limit(100);
      for (const row of rows) {
        try {
          console.info(JSON.stringify(await reconcileBooking(p, String(row._id))));
        } catch (error) {
          console.info(
            JSON.stringify({
              bookingId: row._id,
              status: 'exception',
              type: error instanceof Error ? error.name : 'Unknown',
            }),
          );
          process.exitCode = 1;
        }
      }
    } else throw new Error('Use indexes, admin, seed, reconcile, recover-order or readiness');
  }
} finally {
  await mongoose.disconnect();
}
