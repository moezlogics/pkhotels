import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Hotel, HotelDocument } from '@pakhotels/db/schemas/hotel.schema';
import { Booking, BookingDocument } from '@pakhotels/db/schemas/booking.schema';
import { BoostPlan, BoostPlanDocument, BOOST_PLACEMENTS } from '@pakhotels/db/schemas/boost-plan.schema';
import { BillingInvoice, BillingInvoiceDocument, InvoiceLine } from '@pakhotels/db/schemas/billing-invoice.schema';
import { Subscription, SubscriptionDocument } from '@pakhotels/db/schemas/subscription.schema';
import { PaymentMethod, PaymentMethodDocument } from '@pakhotels/db/schemas/payment-method.schema';
import { HotelService, type Actor } from '../hotel/hotel.service';
import { HotelPlanService } from '../hotel/hotel-plan.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { PushService } from '../push/push.service';

const DAY = 86_400_000;

/** Today in Pakistan, "YYYY-MM-DD". */
function todayPk(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}

/** "2026-10" → "2026-11". */
function nextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function prevMonth(period: string): string {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function monthName(period: string): string {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const fmtDay = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const rs = (n: number) => `Rs ${Math.round(n || 0).toLocaleString('en-PK')}`;

/** Starting prices the admin can change (Billing → Boost prices). */
const DEFAULT_BOOSTS = [
  { name: 'Top of city · 7 days', placement: 'top', days: 7, price: 1500, highlight: false, order: 1 },
  { name: 'Top of city · 30 days', placement: 'top', days: 30, price: 4500, highlight: true, order: 2 },
  { name: 'Homepage featured · 7 days', placement: 'featured', days: 7, price: 2500, highlight: false, order: 3 },
  { name: 'Homepage featured · 30 days', placement: 'featured', days: 30, price: 7500, highlight: false, order: 4 },
] as const;

/**
 * Money the hotels owe PakHotels besides their plan:
 *
 *  - Boosts, bought one at a time per hotel (OLX "Feature this ad").
 *  - Commission on completed PakHotels bookings, at the rate of the hotel's
 *    plan when the booking was made, invoiced once a month.
 *
 * No gateway: invoices show the admin's payment accounts, the hotel uploads
 * the transfer screenshot, an admin verifies it. Long-overdue commission
 * pauses the hotel's online booking (the listing stays up) until it is paid.
 */
@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Billing');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(Hotel.name) private readonly hotels: Model<HotelDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectModel(BoostPlan.name) private readonly boostPlans: Model<BoostPlanDocument>,
    @InjectModel(BillingInvoice.name) private readonly invoices: Model<BillingInvoiceDocument>,
    @InjectModel(Subscription.name) private readonly subscriptions: Model<SubscriptionDocument>,
    @InjectModel(PaymentMethod.name) private readonly methods: Model<PaymentMethodDocument>,
    private readonly hotelService: HotelService,
    private readonly plans: HotelPlanService,
    private readonly settings: SiteSettingsService,
    @Optional() private readonly discord?: DiscordService,
    @Optional() private readonly push?: PushService,
  ) {}

  onModuleInit() {
    const tick = () => this.housekeeping().catch((e) => this.logger.warn(`housekeeping: ${e?.message}`));
    setTimeout(tick, 45_000).unref?.();
    this.timer = setInterval(tick, 60 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Hourly: seed boost prices once, bill last month from the 3rd, pause long-overdue hotels. */
  async housekeeping() {
    if (!(await this.boostPlans.estimatedDocumentCount())) await this.boostPlans.insertMany(DEFAULT_BOOSTS as any);
    // Confirmed stays complete two days after check-out, so last month is final on the 3rd.
    const today = todayPk();
    if (Number(today.slice(8, 10)) >= 3) await this.generate(prevMonth(today.slice(0, 7)), 'system');
    await this.refreshHolds();
  }

  /* ───────────────────────── settings ───────────────────────── */

  private async terms() {
    const s: any = await this.settings.get();
    return {
      dueDays: Number(s.billingDueDays) || 10,
      holdDays: Number(s.billingHoldDays ?? 15),
      whatsapp: String(s.billingWhatsapp || s.contactWhatsapp || ''),
      note: String(s.billingNote || ''),
    };
  }

  private async paymentMethods() {
    return this.methods.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean().exec();
  }

  private async nextNumber(): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const n = `PH-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(10 + Math.random() * 89)}`;
      if (!(await this.invoices.exists({ number: n }))) return n;
    }
    return `PH-${Date.now()}`;
  }

  /** What the hotel sees on an invoice: no admin notes. */
  private forOwner(inv: any) {
    if (!inv) return inv;
    const { adminNote: _a, reviewedBy: _r, ...rest } = inv.toObject ? inv.toObject() : inv;
    return { ...rest, overdue: ['unpaid', 'rejected'].includes(rest.status) && new Date(rest.dueDate).getTime() < Date.now() };
  }

  /* ───────────────────────── owner ───────────────────────── */

  /** Dashboard → Billing: rate, this month so far, boosts, invoices, where to pay. */
  async overview(actor: Actor, hotelId?: string) {
    const h: any = await this.hotelService.requireManaged(actor, hotelId);
    const perks = h.perks ?? {};
    const month = todayPk().slice(0, 7);
    const [running, upcoming, invoices, boostPlans, methods, terms] = await Promise.all([
      this.bookings
        .find({ hotel: h._id, source: 'web', status: 'completed', commissionPercent: { $gt: 0 }, invoice: { $exists: false } }, { ref: 1, total: 1, commissionPercent: 1, checkIn: 1, checkOut: 1, guestName: 1 })
        .sort({ checkOut: 1 })
        .lean()
        .exec(),
      this.bookings.countDocuments({ hotel: h._id, source: 'web', status: { $in: ['confirmed', 'checked_in'] }, commissionPercent: { $gt: 0 } }),
      this.invoices.find({ hotel: h._id }).sort({ createdAt: -1 }).limit(36).lean().exec(),
      this.boostPlans.find({ isActive: true }).sort({ order: 1, price: 1 }).lean().exec(),
      this.paymentMethods(),
      this.terms(),
    ]);
    const due = (invoices as any[]).filter((i) => ['unpaid', 'rejected', 'submitted'].includes(i.status));
    const now = Date.now();
    return {
      hotel: { _id: h._id, name: h.name, slug: h.slug, citySlug: h.citySlug, status: h.status, billingHold: !!h.billingHold, owned: !!h.owner },
      plan: perks.plan || 'Free',
      commissionPercent: Number(perks.commissionPercent) || 0,
      thisMonth: {
        period: month,
        bookings: running.length,
        amount: running.reduce((a: number, b: any) => a + Math.round((b.total * b.commissionPercent) / 100), 0),
        upcoming,
        items: running.slice(-50).map((b: any) => ({ ref: b.ref, guestName: b.guestName, dates: `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`, total: b.total, percent: b.commissionPercent, amount: Math.round((b.total * b.commissionPercent) / 100) })),
      },
      boosts: {
        top: h.boostTopUntil && new Date(h.boostTopUntil).getTime() > now ? h.boostTopUntil : null,
        featured: h.boostFeaturedUntil && new Date(h.boostFeaturedUntil).getTime() > now ? h.boostFeaturedUntil : null,
        plans: boostPlans,
      },
      balance: due.filter((i) => i.status !== 'submitted').reduce((a, i) => a + i.amount, 0),
      invoices: (invoices as any[]).map((i) => this.forOwner(i)),
      methods,
      terms,
    };
  }

  /** Buy a boost: an invoice now, the boost starts when the payment is verified. */
  async buyBoost(actor: Actor, planId: string, hotelId?: string) {
    const h: any = await this.hotelService.requireManaged(actor, hotelId);
    if (!h.owner) throw new BadRequestException('Claim this hotel first to boost it.');
    if (h.status !== 'approved') throw new BadRequestException('Your hotel must be live before you can boost it.');
    if (!Types.ObjectId.isValid(planId)) throw new NotFoundException('Boost not found.');
    const plan: any = await this.boostPlans.findOne({ _id: planId, isActive: true }).lean().exec();
    if (!plan) throw new NotFoundException('This boost is no longer offered.');

    // Clicking "Buy" twice should not make two invoices.
    const open = await this.invoices.findOne({ hotel: h._id, kind: 'boost', boostPlan: plan._id, status: { $in: ['unpaid', 'rejected', 'submitted'] } }).exec();
    if (open) return this.forOwner(open);

    const inv = await this.invoices.create({
      number: await this.nextNumber(),
      kind: 'boost',
      hotel: h._id,
      owner: h.owner,
      hotelName: h.name,
      cityName: h.cityName,
      lines: [{ label: plan.name, amount: plan.price }],
      amount: plan.price,
      dueDate: new Date(Date.now() + 3 * DAY),
      boostPlan: plan._id,
      boostPlacement: plan.placement,
      boostDays: plan.days,
    });
    if (plan.price <= 0) return this.forOwner(await this.markPaid(inv, undefined));
    return this.forOwner(inv);
  }

  async invoiceFor(actor: Actor, id: string) {
    const inv = await this.load(id);
    await this.assertOwner(actor, inv);
    const [methods, terms] = await Promise.all([this.paymentMethods(), this.terms()]);
    return { invoice: actor.role === 'ADMIN' ? inv.toObject() : this.forOwner(inv), methods, terms };
  }

  /** "I have paid" — the screenshot goes to the admins. Re-sending is allowed. */
  async submitProof(actor: Actor, id: string, dto: { proofUrl?: string; method?: string; note?: string }) {
    const inv = await this.load(id);
    await this.assertOwner(actor, inv);
    if (inv.status === 'paid') throw new BadRequestException('This invoice is already paid.');
    if (inv.status === 'void') throw new BadRequestException('This invoice was cancelled.');
    const proof = String(dto.proofUrl ?? '').trim();
    if (!proof) throw new BadRequestException('Please upload the payment screenshot.');
    inv.proofUrl = proof.slice(0, 500);
    inv.paymentMethod = String(dto.method ?? '').slice(0, 80);
    inv.paymentNote = String(dto.note ?? '').trim().slice(0, 300);
    inv.status = 'submitted';
    inv.submittedAt = new Date();
    inv.rejectionReason = '';
    await inv.save();

    this.discord?.send({
      title: '🧾 Hotel payment to verify',
      description: `${inv.number} · ${inv.hotelName} · ${inv.kind === 'boost' ? 'Boost' : `Commission ${monthName(inv.period)}`} · ${rs(inv.amount)}`,
      url: '/dashboard/billing',
      color: DISCORD_COLORS.money,
      category: 'Payments',
      image: proof,
      fields: [
        { name: 'Paid via', value: inv.paymentMethod || '—' },
        { name: 'Reference', value: inv.paymentNote || '—' },
      ],
      links: [{ label: 'Verify', url: '/dashboard/billing' }],
    });
    return this.forOwner(inv);
  }

  /* ───────────────────────── admin ───────────────────────── */

  /** Counts for the admin's Billing page header. */
  async summary() {
    // The admin is looking: make "paused" true to the minute, not to the hour.
    await this.refreshHolds().catch(() => undefined);
    const now = new Date();
    const soon = new Date(Date.now() + 3 * DAY);
    const monthStart = new Date(todayPk().slice(0, 7) + '-01T00:00:00+05:00');
    const sum = async (match: any) => (await this.invoices.aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } }]))[0] ?? { n: 0, amount: 0 };
    const [verify, overdue, dueSoon, outstanding, collected, disputes, holds] = await Promise.all([
      sum({ status: 'submitted' }),
      sum({ status: { $in: ['unpaid', 'rejected'] }, dueDate: { $lt: now } }),
      sum({ status: { $in: ['unpaid', 'rejected'] }, dueDate: { $gte: now, $lte: soon } }),
      sum({ status: { $in: ['unpaid', 'rejected', 'submitted'] } }),
      sum({ status: 'paid', paidAt: { $gte: monthStart } }),
      this.bookings.countDocuments({ stayDispute: 'open' }),
      this.hotels.countDocuments({ billingHold: true }),
    ]);
    return { verify, overdue, dueSoon, outstanding, collected, disputes, holds };
  }

  /** Invoices, with the owner's contact so the admin can call or WhatsApp. */
  async list(q: { status?: string; kind?: string; q?: string; page?: number }) {
    const filter: any = {};
    const now = new Date();
    if (q.status === 'overdue') Object.assign(filter, { status: { $in: ['unpaid', 'rejected'] }, dueDate: { $lt: now } });
    else if (q.status === 'open') filter.status = { $in: ['unpaid', 'rejected'] };
    else if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.kind === 'boost' || q.kind === 'commission') filter.kind = q.kind;
    if (q.q) {
      const rx = new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60), 'i');
      filter.$or = [{ number: rx }, { hotelName: rx }, { cityName: rx }];
    }
    const page = Math.max(1, Number(q.page) || 1);
    const [items, total] = await Promise.all([
      this.invoices
        .find(filter)
        .sort(q.status === 'submitted' ? { submittedAt: 1 } : q.status === 'overdue' || q.status === 'open' ? { dueDate: 1 } : { createdAt: -1 })
        .skip((page - 1) * 30)
        .limit(30)
        .populate('owner', 'name email phone whatsappNumber')
        .populate('hotel', 'phone whatsapp slug citySlug billingHold')
        .lean()
        .exec(),
      this.invoices.countDocuments(filter),
    ]);
    return { items: (items as any[]).map((i) => ({ ...i, overdue: ['unpaid', 'rejected'].includes(i.status) && new Date(i.dueDate) < now })), total, page, pages: Math.ceil(total / 30) };
  }

  /**
   * "Who do I chase today?" — one list: overdue and nearly-due invoices,
   * plans that have ended or end this week, boosts ending in two days, and
   * guests who say they stayed after the hotel marked a no-show.
   */
  async followUps() {
    const now = Date.now();
    const out: any[] = [];
    const contact = (u: any, h: any) => ({
      ownerName: u?.name || '',
      phone: u?.phone || h?.phone || '',
      whatsapp: u?.whatsappNumber || h?.whatsapp || u?.phone || h?.phone || '',
      email: u?.email || '',
    });

    const unpaid = await this.invoices
      .find({ status: { $in: ['unpaid', 'rejected'] }, dueDate: { $lte: new Date(now + 3 * DAY) } })
      .sort({ dueDate: 1 })
      .limit(200)
      .populate('owner', 'name email phone whatsappNumber')
      .populate('hotel', 'phone whatsapp')
      .lean()
      .exec();
    for (const i of unpaid as any[]) {
      const late = Math.floor((now - new Date(i.dueDate).getTime()) / DAY);
      out.push({
        kind: late >= 0 ? 'overdue' : 'due_soon',
        id: String(i._id),
        hotelName: i.hotelName,
        cityName: i.cityName,
        ...contact(i.owner, i.hotel),
        amount: i.amount,
        date: i.dueDate,
        days: late,
        title: `${i.kind === 'boost' ? 'Boost' : `Commission · ${monthName(i.period)}`} · ${i.number}`,
        reminders: i.reminders || 0,
        lastReminderAt: i.lastReminderAt,
        adminNote: i.adminNote || '',
        message: `Assalam-o-Alaikum${i.owner?.name ? ` ${String(i.owner.name).split(' ')[0]}` : ''}, PakHotels invoice ${i.number} for ${i.hotelName} (${rs(i.amount)}) ${late > 0 ? `was due ${late} day${late === 1 ? '' : 's'} ago` : late === 0 ? 'is due today' : `is due on ${new Date(i.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}. Please pay from Dashboard → Billing and upload the screenshot. Shukriya!`,
      });
    }

    // Plans: ended in the last 30 days and not renewed, or ending within 7 days.
    const subs = await this.subscriptions
      .find({ status: { $in: ['active', 'expired'] }, amount: { $gt: 0 }, endDate: { $gte: new Date(now - 30 * DAY), $lte: new Date(now + 7 * DAY) } })
      .sort({ endDate: 1 })
      .limit(200)
      .populate('userId', 'name email phone whatsappNumber')
      .lean()
      .exec();
    const renewed = new Set(
      (await this.subscriptions.find({ status: 'active', endDate: { $gt: new Date(now + 7 * DAY) } }, { userId: 1 }).lean().exec()).map((s: any) => String(s.userId)),
    );
    const hotelOf = new Map(
      (await this.hotels.find({ owner: { $in: (subs as any[]).map((s) => s.userId?._id).filter(Boolean) } }, { owner: 1, name: 1, cityName: 1, phone: 1, whatsapp: 1 }).lean().exec()).map((h: any) => [String(h.owner), h]),
    );
    for (const s of subs as any[]) {
      const uid = String(s.userId?._id ?? s.userId);
      if (renewed.has(uid)) continue;
      const h: any = hotelOf.get(uid);
      const left = Math.ceil((new Date(s.endDate).getTime() - now) / DAY);
      out.push({
        kind: left < 0 ? 'plan_ended' : 'plan_ending',
        id: String(s._id),
        hotelName: h?.name || s.userId?.name || 'Account',
        cityName: h?.cityName || '',
        ...contact(s.userId, h),
        amount: s.amount,
        date: s.endDate,
        days: -left,
        title: `${s.planName || 'Plan'} plan ${left < 0 ? 'ended' : `ends in ${left} day${left === 1 ? '' : 's'}`}`,
        message: `Assalam-o-Alaikum${s.userId?.name ? ` ${String(s.userId.name).split(' ')[0]}` : ''}, your PakHotels ${s.planName || ''} plan ${left < 0 ? 'has ended' : `ends on ${new Date(s.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}. Renew from Dashboard → My plan to keep your benefits. Shukriya!`,
      });
    }

    // Boosts ending within two days — the easiest renewal there is.
    const ending = await this.hotels
      .find({ $or: [{ boostTopUntil: { $gt: new Date(now), $lte: new Date(now + 2 * DAY) } }, { boostFeaturedUntil: { $gt: new Date(now), $lte: new Date(now + 2 * DAY) } }] }, { name: 1, cityName: 1, owner: 1, phone: 1, whatsapp: 1, boostTopUntil: 1, boostFeaturedUntil: 1 })
      .populate('owner', 'name email phone whatsappNumber')
      .lean()
      .exec();
    for (const h of ending as any[]) {
      const until: Date = [h.boostTopUntil, h.boostFeaturedUntil].filter((d) => d && new Date(d).getTime() > now).sort()[0]!;
      out.push({
        kind: 'boost_ending',
        id: String(h._id),
        hotelName: h.name,
        cityName: h.cityName,
        ...contact(h.owner, h),
        amount: 0,
        date: until,
        days: -Math.ceil((new Date(until).getTime() - now) / DAY),
        title: 'Boost ends soon',
        message: `Assalam-o-Alaikum, the boost on ${h.name} ends on ${new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Renew it from Dashboard → Boost to stay at the top. Shukriya!`,
      });
    }

    const disputes = await this.bookings
      .find({ stayDispute: 'open' }, { ref: 1, hotelName: 1, cityName: 1, guestName: 1, guestPhone: 1, checkIn: 1, checkOut: 1, total: 1, status: 1, stayDisputeNote: 1, commissionPercent: 1, cancelReason: 1, history: { $slice: -3 } })
      .sort({ updatedAt: 1 })
      .limit(100)
      .lean()
      .exec();
    for (const b of disputes as any[]) {
      out.push({
        kind: 'dispute',
        id: String(b._id),
        hotelName: b.hotelName,
        cityName: b.cityName,
        ownerName: b.guestName,
        phone: b.guestPhone,
        whatsapp: b.guestPhone,
        email: '',
        amount: Math.round((b.total * (b.commissionPercent || 0)) / 100),
        date: b.checkIn,
        days: 0,
        title: `${b.ref}: hotel marked ${String(b.status).replace('_', '-')}, guest says they stayed`,
        note: b.stayDisputeNote,
        hotelReason: b.cancelReason || b.history?.[b.history.length - 1]?.note || '',
        dates: `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`,
        total: b.total,
        message: `Assalam-o-Alaikum ${String(b.guestName).split(' ')[0]}, this is PakHotels about your booking ${b.ref} at ${b.hotelName}. Could you confirm you stayed on ${fmtDay(b.checkIn)}? Shukriya!`,
      });
    }

    const order: Record<string, number> = { dispute: 0, overdue: 1, plan_ended: 2, due_soon: 3, plan_ending: 4, boost_ending: 5 };
    return out.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || b.days - a.days);
  }

  async approve(id: string, adminId: string) {
    const inv = await this.load(id);
    if (inv.status === 'paid') return inv;
    if (inv.status === 'void') throw new BadRequestException('This invoice was cancelled.');
    return this.markPaid(inv, adminId);
  }

  private async markPaid(inv: BillingInvoiceDocument, adminId?: string) {
    inv.status = 'paid';
    inv.paidAt = new Date();
    inv.rejectionReason = '';
    if (adminId && Types.ObjectId.isValid(adminId)) inv.reviewedBy = new Types.ObjectId(adminId);

    const h: any = await this.hotels.findById(inv.hotel).exec();
    if (inv.kind === 'boost' && h && BOOST_PLACEMENTS.includes(inv.boostPlacement as any)) {
      // A boost bought while one is running adds its days on the end.
      const field = inv.boostPlacement === 'top' ? 'boostTopUntil' : 'boostFeaturedUntil';
      const current = h[field] ? new Date(h[field]).getTime() : 0;
      const start = new Date(Math.max(Date.now(), current));
      const end = new Date(start.getTime() + inv.boostDays * DAY);
      inv.boostStart = start;
      inv.boostEnd = end;
      h[field] = end;
      await h.save();
    }
    await inv.save();
    if (h) {
      await this.plans.sync(h).catch(() => undefined);
      await this.refreshHolds(h._id);
      this.hotelService.changed(h);
    }
    if (inv.owner && adminId) {
      void this.push
        ?.toUsers([inv.owner], {
          type: 'billing_paid',
          vars: { number: inv.number, what: inv.boostEnd ? `Your boost is live until ${inv.boostEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.` : `Invoice ${inv.number} is paid.` },
          url: '/dashboard/billing',
        })
        .catch(() => undefined);
    }
    return inv;
  }

  async reject(id: string, reason: string, adminId: string) {
    const inv = await this.load(id);
    if (inv.status === 'paid' || inv.status === 'void') throw new BadRequestException(`This invoice is ${inv.status}.`);
    inv.status = 'rejected';
    inv.rejectionReason = String(reason || '').trim().slice(0, 300) || 'We could not find this payment. Please check the amount and upload the screenshot again.';
    if (Types.ObjectId.isValid(adminId)) inv.reviewedBy = new Types.ObjectId(adminId);
    await inv.save();
    if (inv.owner) {
      void this.push?.toUsers([inv.owner], { type: 'billing_rejected', vars: { number: inv.number, reason: inv.rejectionReason }, url: '/dashboard/billing' }).catch(() => undefined);
    }
    return inv;
  }

  /** Cancel an invoice (written off, or a boost the hotel no longer wants). Its bookings can be billed again. */
  async void(id: string, note: string) {
    const inv = await this.load(id);
    if (inv.status === 'paid') throw new BadRequestException('A paid invoice cannot be cancelled.');
    inv.status = 'void';
    if (note) inv.adminNote = [inv.adminNote, `Cancelled: ${String(note).slice(0, 200)}`].filter(Boolean).join('\n');
    await inv.save();
    if (inv.kind === 'commission') await this.bookings.updateMany({ invoice: inv._id }, { $unset: { invoice: 1 }, $set: { commissionAmount: 0 } });
    await this.refreshHolds(inv.hotel);
    return inv;
  }

  /** The admin pressed WhatsApp / Call, or wrote a note. */
  async followUp(id: string, dto: { reminded?: boolean; adminNote?: string }) {
    const inv = await this.load(id);
    if (dto.reminded) {
      inv.lastReminderAt = new Date();
      inv.reminders = (inv.reminders || 0) + 1;
    }
    if (typeof dto.adminNote === 'string') inv.adminNote = dto.adminNote.slice(0, 1000);
    await inv.save();
    return inv;
  }

  /**
   * Bill commission for a month: every completed PakHotels booking with a
   * rate that checked out by the end of that month and has not been billed.
   * One invoice per hotel per month, never changed once issued — a booking
   * that completes late (a dispute, a late check-out) goes on the next one.
   */
  async generate(period: string, by: 'system' | 'admin' = 'admin') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Which month?');
    if (period >= todayPk().slice(0, 7)) throw new BadRequestException('A month can be billed once it is over.');
    const end = `${nextMonth(period)}-01`;
    const rows = await this.bookings
      .find({ source: 'web', status: 'completed', commissionPercent: { $gt: 0 }, invoice: { $exists: false }, checkOut: { $lte: end } })
      .lean()
      .exec();
    if (!rows.length) return { created: 0, amount: 0 };

    const byHotel = new Map<string, any[]>();
    for (const b of rows as any[]) {
      const k = String(b.hotel);
      if (!byHotel.has(k)) byHotel.set(k, []);
      byHotel.get(k)!.push(b);
    }
    const { dueDays } = await this.terms();
    let created = 0;
    let amount = 0;
    for (const [hotelId, list] of byHotel) {
      if (await this.invoices.exists({ hotel: hotelId, kind: 'commission', period })) continue;
      const h: any = await this.hotels.findById(hotelId, { name: 1, cityName: 1, owner: 1 }).lean().exec();
      if (!h) continue;
      const lines: InvoiceLine[] = list
        .sort((a, b) => a.checkOut.localeCompare(b.checkOut))
        .map((b) => ({
          label: b.guestName,
          ref: b.ref,
          dates: `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`,
          base: b.total,
          percent: b.commissionPercent,
          amount: Math.round((b.total * b.commissionPercent) / 100),
        }));
      const total = lines.reduce((a, l) => a + l.amount, 0);
      if (total <= 0) continue;
      let inv: BillingInvoiceDocument;
      try {
        inv = await this.invoices.create({
          number: await this.nextNumber(),
          kind: 'commission',
          hotel: h._id,
          owner: h.owner,
          hotelName: h.name,
          cityName: h.cityName,
          period,
          lines,
          amount: total,
          dueDate: new Date(Date.now() + dueDays * DAY),
        });
      } catch (e: any) {
        if (e?.code === 11000) continue; // another run got there first
        throw e;
      }
      for (const b of list) {
        await this.bookings.updateOne({ _id: b._id }, { $set: { invoice: inv._id, commissionAmount: Math.round((b.total * b.commissionPercent) / 100) } });
      }
      created++;
      amount += total;
      if (h.owner) {
        void this.push
          ?.toUsers([h.owner], { type: 'billing_invoice', vars: { number: inv.number, amount: total.toLocaleString('en-PK'), due: inv.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }, url: '/dashboard/billing' })
          .catch(() => undefined);
      }
    }
    if (created) {
      this.discord?.send({
        title: `🧾 ${created} commission invoice${created === 1 ? '' : 's'} issued`,
        description: `${monthName(period)} · ${rs(amount)} in total${by === 'system' ? ' (automatic)' : ''}`,
        url: '/dashboard/billing',
        color: DISCORD_COLORS.money,
        category: 'Payments',
        links: [{ label: 'Billing', url: '/dashboard/billing' }],
      });
    }
    return { created, amount };
  }

  /**
   * Pause online booking for hotels with commission unpaid this long past its
   * due date, and lift the pause when nothing is that late any more.
   */
  async refreshHolds(onlyHotel?: unknown) {
    const { holdDays } = await this.terms();
    const scope = onlyHotel ? { hotel: onlyHotel } : {};
    const late = holdDays > 0
      ? await this.invoices.distinct('hotel', { ...scope, kind: 'commission', status: { $in: ['unpaid', 'rejected'] }, dueDate: { $lt: new Date(Date.now() - holdDays * DAY) } })
      : [];
    const lateIds = late.map((x: any) => String(x));
    const held = await this.hotels.find({ ...(onlyHotel ? { _id: onlyHotel } : {}), billingHold: true }, { _id: 1, slug: 1, citySlug: 1 }).lean().exec();
    for (const h of held as any[]) {
      if (!lateIds.includes(String(h._id))) {
        await this.hotels.updateOne({ _id: h._id }, { $set: { billingHold: false } });
        this.hotelService.changed(h);
      }
    }
    if (lateIds.length) {
      const newly = await this.hotels.find({ _id: { $in: lateIds }, billingHold: { $ne: true } }, { _id: 1, slug: 1, citySlug: 1, owner: 1, name: 1 }).lean().exec();
      for (const h of newly as any[]) {
        await this.hotels.updateOne({ _id: h._id }, { $set: { billingHold: true } });
        this.hotelService.changed(h);
        this.discord?.send({ title: '⏸️ Online booking paused for unpaid commission', description: h.name, url: '/dashboard/billing', color: DISCORD_COLORS.report, category: 'Payments' });
      }
    }
  }

  /* ── boost prices (admin) ── */

  async listBoostPlans() {
    return this.boostPlans.find().sort({ order: 1, price: 1 }).lean().exec();
  }

  async saveBoostPlan(id: string | null, dto: any) {
    const d: any = {
      name: String(dto.name ?? '').trim().slice(0, 80),
      placement: BOOST_PLACEMENTS.includes(dto.placement) ? dto.placement : 'top',
      days: Math.max(1, Math.min(365, Math.round(Number(dto.days) || 7))),
      price: Math.max(0, Math.round(Number(dto.price) || 0)),
      highlight: !!dto.highlight,
      isActive: dto.isActive !== false,
      order: Math.round(Number(dto.order) || 0),
    };
    if (!d.name) throw new BadRequestException('Please name the boost.');
    if (!id) return this.boostPlans.create(d);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const doc = await this.boostPlans.findByIdAndUpdate(id, d, { new: true }).exec();
    if (!doc) throw new NotFoundException();
    return doc;
  }

  async deleteBoostPlan(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    // Switched off rather than deleted when an invoice points at it.
    if (await this.invoices.exists({ boostPlan: id })) return this.boostPlans.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
    await this.boostPlans.deleteOne({ _id: id });
    return { ok: true };
  }

  /* ── stay disputes ── */

  /** Admin decides a guest's "I did stay": upheld → completed, and billable. */
  async decideDispute(bookingId: string, decision: string, adminId: string) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException();
    const b = await this.bookings.findById(bookingId).exec();
    if (!b || b.stayDispute !== 'open') throw new NotFoundException('No open dispute on this booking.');
    if (decision === 'upheld') {
      b.stayDispute = 'upheld';
      b.status = 'completed';
      b.history.push({ status: 'completed', at: new Date(), by: 'admin', note: 'Guest confirmed the stay' });
    } else {
      b.stayDispute = 'rejected';
      b.history.push({ status: b.status, at: new Date(), by: 'admin', note: 'Stay claim not upheld' });
    }
    await b.save();
    return { ok: true, status: b.status, adminId };
  }

  /* ── helpers ── */

  private async load(id: string): Promise<BillingInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invoice not found.');
    const inv = await this.invoices.findById(id).exec();
    if (!inv) throw new NotFoundException('Invoice not found.');
    return inv;
  }

  private async assertOwner(actor: Actor, inv: BillingInvoiceDocument) {
    if (actor.role === 'ADMIN') return;
    if (inv.owner && String(inv.owner) === String(actor.userId)) return;
    const h = await this.hotelService.requireManaged(actor).catch(() => null);
    if (h && String(h._id) === String(inv.hotel)) return;
    throw new ForbiddenException('This invoice belongs to another hotel.');
  }
}
