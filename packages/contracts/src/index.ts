import { z } from 'zod';

export const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid ID');
export const email = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export const policy = z.enum(['auto', 'manual']);
export const adminPolicy = z.enum(['force_auto', 'force_manual', 'expert_choice']);
export const role = z.enum(['customer', 'expert', 'admin']);
export type Role = z.infer<typeof role>;
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export const registerInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    email,
    password: z.string().min(12).max(128),
    accountPurpose: z.enum(['customer', 'expert']).default('customer'),
  })
  .strict();
export const loginInput = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const expertInput = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(60),
    headline: z.string().trim().min(10).max(120),
    bio: z.string().trim().min(30).max(3000),
    categories: z.array(id).min(1).max(20),
    languages: z.array(z.string().trim().min(2).max(30)).min(1).max(10),
    city: z.string().trim().min(2).max(80),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, 'Use an IANA timezone'),
    experienceYears: z.number().int().min(0).max(70),
    confirmationPolicy: policy,
  })
  .strict();
export const categoryInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    active: z.boolean().default(true),
  })
  .strict();
export const serviceInput = z
  .object({
    categoryId: id,
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().min(20).max(2000),
    durationMinutes: z.number().int().min(15).max(240).multipleOf(15),
    pricePaise: z.number().int().min(100).max(10000000),
    mode: z.enum(['online', 'in_person']),
    location: z.string().trim().max(300).default(''),
    confirmationPolicy: policy.optional(),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => v.mode !== 'in_person' || v.location.length >= 5,
    'In-person services need a location',
  );
export const slotInput = z
  .object({ serviceId: id, startsAt: z.iso.datetime({ offset: true }) })
  .strict();
export const bookingInput = z.object({ slotId: id, termsAccepted: z.literal(true) }).strict();
export const reviewInput = z
  .object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(10).max(2000) })
  .strict();
export const settingsInput = z
  .object({
    commissionBps: z.number().int().min(0).max(10000),
    confirmationPolicy: adminPolicy,
    payoutMode: z.enum(['manual', 'automatic']),
    payoutDelayHours: z.number().int().min(24).max(720),
  })
  .strict();

export function splitMoney(grossPaise: number, commissionBps: number) {
  if (
    !Number.isSafeInteger(grossPaise) ||
    grossPaise < 1 ||
    grossPaise > 10000000 ||
    !Number.isInteger(commissionBps) ||
    commissionBps < 0 ||
    commissionBps > 10000
  )
    throw new Error('Invalid money');
  const commissionPaise = Math.round((grossPaise * commissionBps) / 10000);
  return { grossPaise, commissionBps, commissionPaise, expertPaise: grossPaise - commissionPaise };
}
export function effectivePolicy(
  admin: z.infer<typeof adminPolicy>,
  expert: 'auto' | 'manual',
  service?: 'auto' | 'manual',
) {
  return admin === 'force_auto'
    ? 'auto'
    : admin === 'force_manual'
      ? 'manual'
      : (service ?? expert);
}
export function captureDisposition(
  status: string,
  holdUntil: Date,
  now: Date,
  confirmationPolicy: string,
) {
  if (status !== 'held' || holdUntil <= now) return { status, paymentStatus: 'refund_required' };
  return {
    status: confirmationPolicy === 'auto' ? 'confirmed' : 'pending_confirmation',
    paymentStatus: 'captured',
  };
}
export const formatMoney = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
