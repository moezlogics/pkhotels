import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Hotel, HotelDocument, HotelPerks } from '@pakhotels/db/schemas/hotel.schema';
import { SubscriptionService } from '../subscription/subscription.service';

/**
 * Unclaimed hotels (imported, no owner yet) are run by the PakHotels team:
 * bookings come to the admin, who phones the hotel. No booking cap, no
 * contact shown (the team is the contact), no extras.
 */
export const UNCLAIMED_PERKS: HotelPerks = {
  plan: 'Unclaimed',
  placement: 0,
  featured: false,
  verified: false,
  showContact: false,
  advancePayments: false,
  rateCalendar: true,
  instantConfirm: false,
  deals: false,
  videoTour: false,
  insights: 'none',
  maxRoomTypes: 0,
  photos: 60,
  monthlyBookings: 0,
  autoPublish: true,
  commissionPercent: 0,
};

/** A paid boost on top of the plan: "top" lifts the hotel above all others in its city, "featured" puts it on the homepage. */
export function withBoosts(perks: HotelPerks, h: { boostTopUntil?: Date | string | null; boostFeaturedUntil?: Date | string | null }): HotelPerks {
  const now = Date.now();
  const top = !!h?.boostTopUntil && new Date(h.boostTopUntil).getTime() > now;
  const featured = !!h?.boostFeaturedUntil && new Date(h.boostFeaturedUntil).getTime() > now;
  return { ...perks, featured: perks.featured || featured, boostTop: top, boostFeatured: featured };
}

/** Listing order: boosted hotels first, then by plan. */
export const rankOf = (p: HotelPerks) => (p.placement || 0) + (p.boostTop ? 10 : 0);

/** Keeps each hotel's `perks`, `rank` and `verified` in step with its owner's plan. */
@Injectable()
export class HotelPlanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('HotelPlan');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(Hotel.name) private readonly hotels: Model<HotelDocument>,
    private readonly subscriptions: SubscriptionService,
  ) {}

  onModuleInit() {
    const tick = () => this.syncAll().catch((e) => this.logger.warn(`sync failed: ${e?.message}`));
    setTimeout(tick, 20_000).unref?.();
    this.timer = setInterval(tick, 10 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async perksForOwner(ownerId: unknown): Promise<HotelPerks> {
    if (!ownerId || !Types.ObjectId.isValid(String(ownerId))) return UNCLAIMED_PERKS;
    const plan = await this.subscriptions.getEffectivePlan(String(ownerId));
    const p = plan.perks;
    return {
      plan: plan.name,
      placement: p.placement,
      featured: p.featuredHotel,
      verified: p.verifiedBadge,
      showContact: p.showContact,
      advancePayments: p.advancePayments,
      rateCalendar: p.rateCalendar,
      instantConfirm: p.instantConfirm,
      deals: p.deals,
      videoTour: p.videoTour,
      insights: p.insights,
      maxRoomTypes: p.maxRoomTypes,
      photos: p.photosPerProperty,
      monthlyBookings: p.monthlyBookings,
      autoPublish: p.autoPublish,
      commissionPercent: p.commissionPercent,
    };
  }

  /** Refreshes one hotel and returns its perks. */
  async sync(hotel: { _id: unknown; owner?: unknown }): Promise<HotelPerks> {
    const h: any = await this.hotels.findById(hotel._id, { owner: 1, boostTopUntil: 1, boostFeaturedUntil: 1 }).lean().exec();
    const perks = withBoosts(await this.perksForOwner(h ? h.owner : hotel.owner), h ?? {});
    await this.hotels.updateOne({ _id: hotel._id }, { $set: { perks, rank: rankOf(perks) } }).exec();
    return perks;
  }

  async syncAll(): Promise<void> {
    const rows = await this.hotels.find({}, { owner: 1, perks: 1, rank: 1, boostTopUntil: 1, boostFeaturedUntil: 1 }).lean().exec();
    const byOwner = new Map<string, HotelPerks>();
    for (const h of rows as any[]) {
      const key = h.owner ? String(h.owner) : '';
      let plan = byOwner.get(key);
      if (!plan) {
        plan = await this.perksForOwner(h.owner).catch(() => UNCLAIMED_PERKS);
        byOwner.set(key, plan);
      }
      const perks = withBoosts(plan, h);
      if (JSON.stringify(perks) !== JSON.stringify(h.perks ?? null) || h.rank !== rankOf(perks)) {
        await this.hotels.updateOne({ _id: h._id }, { $set: { perks, rank: rankOf(perks) } }).exec();
      }
    }
  }
}
