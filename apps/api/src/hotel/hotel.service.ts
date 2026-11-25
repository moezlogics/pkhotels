import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Hotel, HotelDocument } from '@pakhotels/db/schemas/hotel.schema';
import { Room, RoomDocument } from '@pakhotels/db/schemas/room.schema';
import { RoomRate, RoomRateDocument } from '@pakhotels/db/schemas/room-rate.schema';
import { HotelClaim, HotelClaimDocument } from '@pakhotels/db/schemas/hotel-claim.schema';
import { HotelReview, HotelReviewDocument } from '@pakhotels/db/schemas/hotel-review.schema';
import { Booking, BookingDocument, HOLDING_STATUSES } from '@pakhotels/db/schemas/booking.schema';
import { City } from '@pakhotels/db/schemas/city.schema';
import { AvailabilityService } from './availability.service';
import { HotelPlanService, UNCLAIMED_PERKS } from './hotel-plan.service';
import { addDays, clampInt, escapeRegex, maybeStay, nightsOf, parseStay, slugify, todayPk } from './stay.util';
import { RevalidateService } from '../revalidate/revalidate.service';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { PushService } from '../push/push.service';

export interface Actor {
  userId: string;
  role: string;
}

/** Fields an owner may edit on their hotel. Everything else is set by the system or the admin. */
const OWNER_FIELDS = [
  'name', 'propertyType', 'stars', 'shortDescription', 'description', 'city', 'area', 'areaName', 'address', 'lat', 'lng',
  'nearby', 'coverImage', 'gallery', 'videoUrl', 'amenities', 'checkInTime', 'checkOutTime', 'idRequired', 'couplePolicy',
  'childrenAllowed', 'petsAllowed', 'smokingAllowed', 'cancellationPolicy', 'freeCancelHours', 'policies', 'taxIncluded',
  'taxPercent', 'extraBedPrice', 'faqs', 'phone', 'whatsapp', 'email', 'website', 'acceptsBookings', 'instantConfirm',
  'responseHours', 'advanceMode', 'advancePercent', 'paymentAccounts', 'dealText', 'dealPercent', 'metaTitle', 'metaDescription',
  'acceptsForeigners', 'foreignerRegistration', 'languages', 'airportName', 'airportKm', 'airportPickup', 'airportPickupPrice',
] as const;

const LANGUAGES = ['en', 'ur', 'pa', 'ps', 'sd', 'bal', 'ar', 'zh', 'fa', 'tr'];

const ADMIN_FIELDS = ['slug', 'status', 'featured', 'verified', 'rejectionReason', 'owner'] as const;

const ROOM_FIELDS = [
  'name', 'description', 'bedType', 'beds', 'maxAdults', 'maxChildren', 'size', 'price', 'weekendPrice', 'originalPrice',
  'quantity', 'breakfastIncluded', 'refundable', 'amenities', 'images', 'minNights', 'isActive', 'sort',
] as const;

/** What a public card needs. */
const CARD_PROJECTION = {
  name: 1, slug: 1, propertyType: 1, stars: 1, shortDescription: 1, citySlug: 1, cityName: 1, areaName: 1, address: 1,
  coverImage: 1, gallery: { $slice: 4 }, amenities: 1, minPrice: 1, ratingAvg: 1, ratingCount: 1, featured: 1, verified: 1,
  dealText: 1, dealPercent: 1, rank: 1, perks: 1, couplePolicy: 1, cancellationPolicy: 1, owner: 1, lat: 1, lng: 1, acceptsForeigners: 1, airportPickup: 1,
} as const;

@Injectable()
export class HotelService {
  private readonly logger = new Logger('Hotels');

  constructor(
    @InjectModel(Hotel.name) private readonly hotels: Model<HotelDocument>,
    @InjectModel(Room.name) private readonly rooms: Model<RoomDocument>,
    @InjectModel(RoomRate.name) private readonly rates: Model<RoomRateDocument>,
    @InjectModel(HotelClaim.name) private readonly claims: Model<HotelClaimDocument>,
    @InjectModel(HotelReview.name) private readonly reviews: Model<HotelReviewDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectModel(City.name) private readonly cities: Model<any>,
    private readonly availability: AvailabilityService,
    private readonly plans: HotelPlanService,
    private readonly revalidate: RevalidateService,
    @Optional() private readonly discord?: DiscordService,
    @Optional() private readonly push?: PushService,
  ) {}

  /* ───────────────────────── public ───────────────────────── */

  /** The card shape for lists — perks reduced to what the public may know. */
  toCard(h: any, quote?: { perNight: number; total: number; totalBefore: number; roomsLeft: number; nights: number }) {
    const perks = h.perks ?? UNCLAIMED_PERKS;
    return {
      _id: String(h._id),
      name: h.name,
      slug: h.slug,
      propertyType: h.propertyType,
      stars: h.stars,
      shortDescription: h.shortDescription,
      citySlug: h.citySlug,
      cityName: h.cityName,
      areaName: h.areaName,
      address: h.address,
      coverImage: h.coverImage || h.gallery?.[0] || '',
      gallery: (h.gallery ?? []).slice(0, 4),
      amenities: (h.amenities ?? []).slice(0, 12),
      minPrice: h.minPrice,
      ratingAvg: h.ratingAvg,
      ratingCount: h.ratingCount,
      featured: !!(h.featured || perks.featured || perks.boostTop),
      verified: !!(h.verified || perks.verified),
      deal: perks.deals && h.dealPercent > 0 ? { text: h.dealText || 'Hot deal', percent: h.dealPercent } : null,
      couplePolicy: h.couplePolicy,
      acceptsForeigners: h.acceptsForeigners || '',
      airportPickup: !!h.airportPickup,
      freeCancellation: h.cancellationPolicy === 'free',
      lat: h.lat,
      lng: h.lng,
      ...(quote ? { quote } : {}),
    };
  }

  private dealOf(h: any): number {
    const perks = h.perks ?? UNCLAIMED_PERKS;
    return perks.deals ? Math.max(0, Number(h.dealPercent) || 0) : 0;
  }

  /**
   * Hotel search. With dates, only hotels with enough rooms free on every
   * night are returned, each with its price for the stay.
   */
  async search(q: Record<string, any>) {
    const page = clampInt(q.page, 1, 500, 1);
    const limit = clampInt(q.limit, 1, 48, 18);
    const filter: any = { status: 'approved' };
    if (q.city) filter.citySlug = slugify(String(q.city));
    if (q.type) filter.propertyType = String(q.type);
    if (q.stars) {
      const s = String(q.stars).split(',').map(Number).filter((n) => n >= 0 && n <= 5);
      if (s.length) filter.stars = { $in: s };
    }
    if (q.amenities) {
      const a = String(q.amenities).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);
      if (a.length) filter.amenities = { $all: a };
    }
    if (q.couples === '1') filter.couplePolicy = { $in: ['couples_allowed', 'couples_with_nikah'] };
    if (q.foreigners === '1') filter.acceptsForeigners = 'yes';
    if (q.freeCancel === '1') filter.cancellationPolicy = 'free';
    if (q.minRating) filter.ratingAvg = { $gte: Number(q.minRating) || 0 };
    const minP = Number(q.minPrice) || 0;
    const maxP = Number(q.maxPrice) || 0;
    if (minP || maxP) filter.minPrice = { ...(minP ? { $gte: minP } : {}), ...(maxP ? { $lte: maxP } : {}) };
    const text = String(q.q ?? '').trim().slice(0, 80);
    if (text) {
      const rx = new RegExp(escapeRegex(text), 'i');
      filter.$or = [{ name: rx }, { areaName: rx }, { cityName: rx }, { address: rx }];
    }

    const sortKey = String(q.sort || 'recommended');
    const sort: any =
      sortKey === 'price_asc' ? { minPrice: 1 } :
      sortKey === 'price_desc' ? { minPrice: -1 } :
      sortKey === 'rating' ? { ratingAvg: -1, ratingCount: -1 } :
      sortKey === 'newest' ? { createdAt: -1 } :
      // Paid placement first, then what guests liked and booked, then the most complete listings.
      { rank: -1, featured: -1, ratingAvg: -1, bookingsCount: -1, roomTypes: -1, views: -1 };

    const stay = maybeStay(q.checkIn, q.checkOut);
    const adults = clampInt(q.adults, 1, 30, 2);
    const children = clampInt(q.children, 0, 20, 0);
    const roomsWanted = clampInt(q.rooms, 1, 10, 1);

    if (!stay) {
      const [items, total] = await Promise.all([
        this.hotels.find(filter, CARD_PROJECTION).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
        this.hotels.countDocuments(filter),
      ]);
      return { items: items.map((h) => this.toCard(h)), total, page, pages: Math.ceil(total / limit), stay: null };
    }

    // Dated search: price every candidate, keep those that fit, then page.
    const candidates = await this.hotels.find(filter, CARD_PROJECTION).sort(sort).limit(600).lean().exec();
    const quotes = await this.availability.quoteHotels(
      candidates.map((h: any) => ({ _id: h._id, dealPercent: this.dealOf(h) })),
      stay.nights,
    );
    const roomsMeta = await this.rooms
      .find({ hotel: { $in: candidates.map((h: any) => h._id) }, isActive: true }, { hotel: 1, maxAdults: 1, maxChildren: 1 })
      .lean()
      .exec();
    const cap = new Map<string, any>();
    for (const r of roomsMeta as any[]) cap.set(String(r._id), r);

    const fitting: any[] = [];
    for (const h of candidates as any[]) {
      const list = (quotes.get(String(h._id)) ?? []).filter((x) => x.available > 0 && !x.closed && x.minNightsOk);
      if (!list.length) continue;
      const roomsLeft = list.reduce((a, x) => a + x.available, 0);
      const guestCap = list.reduce((a, x) => {
        const m = cap.get(x.roomId);
        return a + x.available * ((m?.maxAdults ?? 2) + (m?.maxChildren ?? 0));
      }, 0);
      if (roomsLeft < roomsWanted || guestCap < adults + children) continue;
      const cheapest = list.reduce((a, b) => (b.total < a.total ? b : a));
      fitting.push(this.toCard(h, {
        perNight: Math.round(cheapest.total / stay.nights.length),
        total: cheapest.total,
        totalBefore: cheapest.totalBefore,
        roomsLeft,
        nights: stay.nights.length,
      }));
    }
    if (sortKey === 'price_asc') fitting.sort((a, b) => a.quote.total - b.quote.total);
    if (sortKey === 'price_desc') fitting.sort((a, b) => b.quote.total - a.quote.total);
    const total = fitting.length;
    return {
      items: fitting.slice((page - 1) * limit, page * limit),
      total,
      page,
      pages: Math.ceil(total / limit),
      stay: { checkIn: stay.checkIn, checkOut: stay.checkOut, nights: stay.nights.length, adults, children, rooms: roomsWanted },
    };
  }

  async featured(limit = 8, city?: string) {
    const filter: any = { status: 'approved' };
    if (city) filter.citySlug = slugify(city);
    const rows = await this.hotels
      .find({ ...filter, $or: [{ featured: true }, { 'perks.featured': true }] }, CARD_PROJECTION)
      .sort({ rank: -1, ratingAvg: -1 })
      .limit(limit)
      .lean()
      .exec();
    if (rows.length >= limit) return rows.map((h) => this.toCard(h));
    // Top up with the best of the rest so the homepage row is never empty.
    const more = await this.hotels
      .find({ ...filter, _id: { $nin: rows.map((r: any) => r._id) }, coverImage: { $ne: '' } }, CARD_PROJECTION)
      .sort({ rank: -1, ratingAvg: -1, bookingsCount: -1, minPrice: -1 })
      .limit(limit - rows.length)
      .lean()
      .exec();
    return [...rows, ...more].map((h) => this.toCard(h));
  }

  /** Cities that have live hotels: slug, name, count, cheapest price, picture. */
  async cityStats() {
    const rows = await this.hotels.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$citySlug',
          name: { $first: '$cityName' },
          city: { $first: '$city' },
          count: { $sum: 1 },
          minPrice: { $min: { $cond: [{ $gt: ['$minPrice', 0] }, '$minPrice', null] } },
          cover: { $first: '$coverImage' },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const ids = rows.map((r) => r.city).filter(Boolean);
    const cities = await this.cities.find({ _id: { $in: ids } }, { thumbnail: 1, name: 1 }).lean().exec();
    const thumb = new Map(cities.map((c: any) => [String(c._id), c.thumbnail]));
    return rows
      .filter((r) => r._id)
      .map((r) => ({ slug: r._id, name: r.name, count: r.count, minPrice: r.minPrice ?? 0, thumbnail: thumb.get(String(r.city)) || r.cover || '' }));
  }

  /** SEO content for /hotels/<city> from the City record. */
  async cityInfo(slug: string) {
    const s = slugify(slug);
    const hotel: any = await this.hotels.findOne({ citySlug: s }, { city: 1, cityName: 1 }).lean().exec();
    let city: any = hotel?.city ? await this.cities.findById(hotel.city).lean().exec() : null;
    if (!city) {
      const all = await this.cities.find({}, { name: 1, metaTitle: 1, metaDescription: 1, description: 1, thumbnail: 1 }).lean().exec();
      city = all.find((c: any) => slugify(c.name) === s) ?? null;
    }
    const count = await this.hotels.countDocuments({ citySlug: s, status: 'approved' });
    if (!city && !count) throw new NotFoundException();
    const [cheapest] = await this.hotels.find({ citySlug: s, status: 'approved', minPrice: { $gt: 0 } }, { minPrice: 1 }).sort({ minPrice: 1 }).limit(1).lean().exec();
    return {
      slug: s,
      name: city?.name ?? hotel?.cityName ?? s,
      metaTitle: city?.metaTitle ?? '',
      metaDescription: city?.metaDescription ?? '',
      description: city?.description ?? '',
      thumbnail: city?.thumbnail ?? '',
      count,
      minPrice: (cheapest as any)?.minPrice ?? 0,
    };
  }

  /** Every live slug for the sitemap. */
  async slugs() {
    return this.hotels.find({ status: 'approved' }, { slug: 1, updatedAt: 1, citySlug: 1, coverImage: 1, name: 1, propertyType: 1, stars: 1 }).lean().exec();
  }

  /** Public hotel page. `contact` only when the plan shows it. */
  async bySlug(slug: string) {
    const h: any = await this.hotels.findOne({ slug: String(slug).toLowerCase() }).lean().exec();
    if (!h || h.status !== 'approved') throw new NotFoundException('Hotel not found');
    const perks = h.perks ?? UNCLAIMED_PERKS;
    const rooms = await this.rooms.find({ hotel: h._id, isActive: true }).sort({ sort: 1, price: 1 }).lean().exec();
    const reviewStats = await this.reviewSummary(h._id);
    const booking = await this.bookingGate(h);
    return {
      ...this.toCard(h),
      description: h.description,
      gallery: h.gallery ?? [],
      amenities: h.amenities ?? [],
      nearby: h.nearby ?? [],
      videoUrl: perks.videoTour ? h.videoUrl : '',
      checkInTime: h.checkInTime,
      checkOutTime: h.checkOutTime,
      idRequired: h.idRequired,
      foreignerRegistration: !!h.foreignerRegistration,
      languages: h.languages ?? [],
      airportName: h.airportName || '',
      airportKm: h.airportKm || 0,
      airportPickupPrice: h.airportPickupPrice || 0,
      childrenAllowed: h.childrenAllowed,
      petsAllowed: h.petsAllowed,
      smokingAllowed: h.smokingAllowed,
      cancellationPolicy: h.cancellationPolicy,
      freeCancelHours: h.freeCancelHours,
      policies: h.policies,
      taxIncluded: h.taxIncluded,
      taxPercent: h.taxPercent,
      extraBedPrice: h.extraBedPrice,
      faqs: h.faqs ?? [],
      metaTitle: h.metaTitle,
      metaDescription: h.metaDescription,
      updatedAt: h.updatedAt,
      claimed: !!h.owner,
      contact: perks.showContact ? { phone: h.phone, whatsapp: h.whatsapp || h.phone, email: h.email, website: h.website } : null,
      advanceMode: perks.advancePayments ? h.advanceMode : 'none',
      advancePercent: h.advancePercent,
      instantConfirm: !!(perks.instantConfirm && h.instantConfirm),
      responseHours: h.responseHours,
      booking,
      reviewStats,
      rooms: rooms.map((r: any) => ({
        _id: String(r._id),
        name: r.name,
        description: r.description,
        bedType: r.bedType,
        beds: r.beds,
        maxAdults: r.maxAdults,
        maxChildren: r.maxChildren,
        size: r.size,
        price: r.price,
        weekendPrice: r.weekendPrice,
        originalPrice: r.originalPrice,
        breakfastIncluded: r.breakfastIncluded,
        refundable: r.refundable,
        amenities: r.amenities,
        images: r.images,
        minNights: r.minNights,
        quantity: r.quantity,
      })),
    };
  }

  /** Can this hotel take an online booking right now, and if not, why. */
  async bookingGate(h: any): Promise<{ open: boolean; reason?: string }> {
    if (!h.acceptsBookings || h.billingHold) return { open: false, reason: 'This hotel is not taking online bookings at the moment. Try one of the similar hotels below.' };
    const perks = h.perks ?? UNCLAIMED_PERKS;
    // A plan that earns per booking never caps bookings.
    if (h.owner && perks.monthlyBookings > 0 && !(Number(perks.commissionPercent) > 0)) {
      const monthStart = todayPk().slice(0, 7) + '-01';
      const used = await this.bookings.countDocuments({
        hotel: h._id,
        source: 'web',
        createdAt: { $gte: new Date(monthStart + 'T00:00:00+05:00') },
      });
      if (used >= perks.monthlyBookings) {
        return { open: false, reason: 'This hotel has reached its online booking limit for this month. Try one of the similar hotels below.' };
      }
    }
    return { open: true };
  }

  /** Rooms free and prices for a stay, for the hotel page's room picker. */
  async quoteBySlug(slug: string, checkIn: string, checkOut: string) {
    const h: any = await this.hotels.findOne({ slug: String(slug).toLowerCase(), status: 'approved' }).lean().exec();
    if (!h) throw new NotFoundException('Hotel not found');
    const stay = parseStay(checkIn, checkOut);
    const quotes = await this.availability.quoteHotels([{ _id: h._id, dealPercent: this.dealOf(h) }], stay.nights);
    return { checkIn: stay.checkIn, checkOut: stay.checkOut, nights: stay.nights.length, rooms: quotes.get(String(h._id)) ?? [] };
  }

  async similar(slug: string, limit = 6) {
    const h: any = await this.hotels.findOne({ slug }, { citySlug: 1, minPrice: 1 }).lean().exec();
    if (!h) return [];
    const rows = await this.hotels
      .find({ status: 'approved', citySlug: h.citySlug, _id: { $ne: h._id } }, CARD_PROJECTION)
      .sort({ rank: -1, ratingAvg: -1 })
      .limit(40)
      .lean()
      .exec();
    // Closest in price first, paid hotels win ties.
    rows.sort((a: any, b: any) => Math.abs(a.minPrice - h.minPrice) - Math.abs(b.minPrice - h.minPrice) || b.rank - a.rank);
    return rows.slice(0, limit).map((r) => this.toCard(r));
  }

  async trackView(id: string) {
    if (!Types.ObjectId.isValid(id)) return { ok: false };
    await this.hotels.updateOne({ _id: id }, { $inc: { views: 1 } }).exec();
    return { ok: true };
  }

  /** WordPress room pages (/tf_room/<slug>/) → the hotel they belong to. */
  async roomRedirect(wpSlug: string) {
    const r: any = await this.rooms.findOne({ wpSlug: String(wpSlug).toLowerCase() }, { hotel: 1 }).lean().exec();
    if (!r) throw new NotFoundException();
    const h: any = await this.hotels.findById(r.hotel, { slug: 1, citySlug: 1 }).lean().exec();
    if (!h) throw new NotFoundException();
    return { hotelSlug: h.slug, citySlug: h.citySlug };
  }

  async reviewSummary(hotelId: Types.ObjectId) {
    const [agg] = await this.reviews.aggregate([
      { $match: { hotel: hotelId, status: 'approved' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avg: { $avg: '$rating' },
          cleanliness: { $avg: '$cleanliness' },
          staff: { $avg: '$staff' },
          location: { $avg: '$location' },
          value: { $avg: '$value' },
        },
      },
    ]);
    const r1 = (n: any) => (n ? Math.round(n * 10) / 10 : 0);
    return agg
      ? { count: agg.count, avg: r1(agg.avg), cleanliness: r1(agg.cleanliness), staff: r1(agg.staff), location: r1(agg.location), value: r1(agg.value) }
      : { count: 0, avg: 0, cleanliness: 0, staff: 0, location: 0, value: 0 };
  }

  async listReviews(hotelId: string, page = 1) {
    if (!Types.ObjectId.isValid(hotelId)) return { items: [], total: 0 };
    const filter = { hotel: new Types.ObjectId(hotelId), status: 'approved' };
    const [items, total] = await Promise.all([
      this.reviews.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10).lean().exec(),
      this.reviews.countDocuments(filter),
    ]);
    return { items: items.map((r: any) => this.publicReview(r)), total };
  }

  private publicReview(r: any) {
    const { user: _u, booking, __v: _v, ...rest } = r;
    return { ...rest, verified: !!booking };
  }

  /* ── reviews from any signed-in account ── */

  /** A finished stay booked from this account at this hotel, not reviewed yet. */
  private async stayFor(userId: string, hotelId: unknown) {
    return this.bookings
      .findOne({
        hotel: hotelId,
        user: new Types.ObjectId(userId),
        reviewed: { $ne: true },
        $or: [{ status: 'completed' }, { status: { $in: ['confirmed', 'checked_in'] }, checkOut: { $lte: todayPk() } }],
      })
      .sort({ checkOut: -1 })
      .exec();
  }

  private async reviewTarget(hotelId: string) {
    if (!Types.ObjectId.isValid(hotelId)) throw new NotFoundException('Hotel not found.');
    const h: any = await this.hotels.findById(hotelId, { owner: 1, status: 1, slug: 1, citySlug: 1, name: 1 }).lean().exec();
    if (!h || h.status !== 'approved') throw new NotFoundException('Hotel not found.');
    return h;
  }

  async myReview(hotelId: string, userId: string) {
    const h = await this.reviewTarget(hotelId);
    const [review, stay] = await Promise.all([
      this.reviews.findOne({ hotel: h._id, user: new Types.ObjectId(userId) }).lean().exec(),
      this.stayFor(userId, h._id),
    ]);
    return {
      review: review ? { ...this.publicReview(review), status: (review as any).status } : null,
      own: !!h.owner && String(h.owner) === String(userId),
      stayed: !!((review as any)?.booking || stay),
    };
  }

  /**
   * Write or edit the account's review. Anyone signed in may review; a review
   * from an account with a finished stay here is tied to that booking and
   * shown as "Stayed here". Links and phone numbers wait for an admin.
   */
  async saveMyReview(hotelId: string, userId: string, dto: any) {
    const h = await this.reviewTarget(hotelId);
    if (h.owner && String(h.owner) === String(userId)) throw new ForbiddenException('You cannot review your own hotel.');
    const rating = clampInt(dto.rating, 1, 5, 0);
    if (!rating) throw new BadRequestException('Please choose a star rating.');
    const part = (v: any) => (v ? clampInt(v, 1, 5, 0) || undefined : undefined);
    const text = String(dto.text ?? '').trim().replace(/\n{3,}/g, '\n\n').slice(0, 2000);
    const title = String(dto.title ?? '').trim().slice(0, 120);
    const TRIPS = ['family', 'couple', 'business', 'solo', 'friends'];
    const tripType = TRIPS.includes(String(dto.tripType)) ? String(dto.tripType) : '';
    const all = `${title} ${text}`;
    const suspicious = /(https?:\/\/|www\.|\.com\b|\.pk\b)/i.test(all) || /(\+?92|0)3\d{9}/.test(all.replace(/[\s-]/g, ''));

    const uid = new Types.ObjectId(userId);
    const u: any = await this.bookings.db.collection('users').findOne({ _id: uid }, { projection: { name: 1 } });
    const parts = String(u?.name || '').trim().split(/\s+/).filter(Boolean);
    const guestName = !parts.length ? 'PakHotels guest' : parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;

    let review = await this.reviews.findOne({ hotel: h._id, user: uid }).exec();
    const stay = review?.booking ? null : await this.stayFor(userId, h._id);
    const country = /^[A-Z]{2}$/.test(String(dto.country ?? '').toUpperCase()) ? String(dto.country).toUpperCase() : '';
    const fields: any = {
      rating, cleanliness: part(dto.cleanliness), staff: part(dto.staff), location: part(dto.location), value: part(dto.value),
      title, text, guestName, country,
    };
    if (stay) Object.assign(fields, { booking: stay._id, tripType: stay.purpose || tripType, stayMonth: stay.checkIn.slice(0, 7) });
    else if (!review?.booking) Object.assign(fields, { tripType });
    const status = review?.status === 'hidden' ? 'hidden' : suspicious ? 'pending' : 'approved';

    const isNew = !review;
    if (review) {
      Object.assign(review, fields, { status });
      await review.save();
    } else {
      review = await this.reviews.create({ hotel: h._id, user: uid, stayMonth: '', ...fields, status });
    }
    if (stay) await this.bookings.updateOne({ _id: stay._id }, { $set: { reviewed: true } });
    await this.refreshRatingOf(h._id);
    this.changed(h);

    if (isNew && status === 'approved' && h.owner) {
      void this.push
        ?.toUsers([h.owner], { type: 'review_received', vars: { rating: String(rating), reviewer: guestName, review: (title || text || '').slice(0, 90) || `${rating} stars` }, url: '/dashboard/hotel-reviews' })
        .catch(() => undefined);
    }
    if (status === 'pending') {
      this.discord?.send({ title: `📝 Hotel review to check · ${h.name}`, description: `${rating}★ ${guestName}: ${all.slice(0, 300)}`, url: '/dashboard/hotel-reviews', color: DISCORD_COLORS.review, category: 'Reports' });
    }
    return { review: { ...this.publicReview(review.toObject()), status }, status };
  }

  async deleteMyReview(hotelId: string, userId: string) {
    const h = await this.reviewTarget(hotelId);
    const r = await this.reviews.findOneAndDelete({ hotel: h._id, user: new Types.ObjectId(userId) }).exec();
    if (!r) throw new NotFoundException('You have not reviewed this hotel.');
    if (r.booking) await this.bookings.updateOne({ _id: r.booking }, { $set: { reviewed: false } });
    await this.refreshRatingOf(h._id);
    this.changed(h);
    return { ok: true };
  }

  private async refreshRatingOf(hotelId: unknown) {
    const [agg] = await this.reviews.aggregate([
      { $match: { hotel: new Types.ObjectId(String(hotelId)), status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    await this.hotels.updateOne({ _id: hotelId }, { $set: { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.n ?? 0 } }).exec();
  }

  /* ───────────────────────── owner ───────────────────────── */

  private isAdmin(a: Actor) {
    return a?.role === 'ADMIN';
  }

  /** The hotel this person manages: their own, or (admin) the one asked for. */
  async resolveManaged(actor: Actor, hotelId?: string): Promise<HotelDocument | null> {
    if (hotelId && this.isAdmin(actor)) {
      if (!Types.ObjectId.isValid(hotelId)) throw new NotFoundException('Hotel not found');
      return this.hotels.findById(hotelId).exec();
    }
    return this.hotels.findOne({ owner: new Types.ObjectId(actor.userId) }).exec();
  }

  async requireManaged(actor: Actor, hotelId?: string): Promise<HotelDocument> {
    const h = await this.resolveManaged(actor, hotelId);
    if (!h) throw new NotFoundException('You have not added your hotel yet.');
    return h;
  }

  /** Owner dashboard: hotel, rooms, plan, and this month's usage. */
  async mine(actor: Actor, hotelId?: string) {
    const h = await this.resolveManaged(actor, hotelId);
    if (!h) {
      const perks = await this.plans.perksForOwner(actor.userId);
      return { hotel: null, rooms: [], perks, usage: null };
    }
    const perks = await this.plans.sync(h);
    const rooms = await this.rooms.find({ hotel: h._id }).sort({ sort: 1, price: 1 }).lean().exec();
    const monthStart = todayPk().slice(0, 7) + '-01';
    const bookingsThisMonth = await this.bookings.countDocuments({
      hotel: h._id,
      source: 'web',
      createdAt: { $gte: new Date(monthStart + 'T00:00:00+05:00') },
    });
    const hotel = h.toObject();
    return {
      hotel: { ...hotel, perks },
      rooms,
      perks,
      usage: {
        bookingsThisMonth,
        // Plans that earn per booking never cap bookings.
        monthlyBookings: Number(perks.commissionPercent) > 0 ? 0 : perks.monthlyBookings,
        roomTypes: rooms.length,
        maxRoomTypes: perks.maxRoomTypes,
        photos: (hotel.gallery?.length ?? 0) + (hotel.coverImage ? 1 : 0),
        maxPhotos: perks.photos,
      },
    };
  }

  private pick(src: any, keys: readonly string[]) {
    const out: any = {};
    for (const k of keys) if (src && src[k] !== undefined) out[k] = src[k];
    return out;
  }

  /** Cleans and checks what an owner sent, against their plan. */
  private async clean(dto: any, perks: any, current?: any) {
    const d = this.pick(dto, OWNER_FIELDS);
    if (d.name !== undefined) {
      d.name = String(d.name).trim().slice(0, 120);
      if (d.name.length < 3) throw new BadRequestException('Please enter the hotel name.');
    }
    if (d.stars !== undefined) d.stars = clampInt(d.stars, 0, 5, 0);
    if (d.city !== undefined) {
      if (!Types.ObjectId.isValid(String(d.city))) throw new BadRequestException('Please choose the city.');
      const c: any = await this.cities.findById(d.city, { name: 1 }).lean().exec();
      if (!c) throw new BadRequestException('Please choose the city.');
      d.cityName = c.name;
      d.citySlug = slugify(c.name);
    }
    if (d.area !== undefined && d.area && !Types.ObjectId.isValid(String(d.area))) delete d.area;
    if (d.area === '') d.area = undefined;
    for (const k of ['taxPercent', 'extraBedPrice', 'freeCancelHours', 'responseHours', 'advancePercent', 'dealPercent'] as const) {
      if (d[k] !== undefined) d[k] = Math.max(0, Number(d[k]) || 0);
    }
    if (d.advancePercent !== undefined) d.advancePercent = Math.min(100, d.advancePercent);
    if (d.responseHours !== undefined) d.responseHours = Math.min(72, Math.max(1, d.responseHours || 12));
    if (d.dealPercent !== undefined) d.dealPercent = Math.min(70, d.dealPercent);
    if (Array.isArray(d.gallery)) d.gallery = d.gallery.filter((x: any) => typeof x === 'string' && x).slice(0, 100);
    const photos = (d.gallery ?? current?.gallery ?? []).length + ((d.coverImage ?? current?.coverImage) ? 1 : 0);
    if (perks.photos && photos > perks.photos && (d.gallery !== undefined || d.coverImage !== undefined)) {
      throw new BadRequestException(`Your ${perks.plan} plan allows ${perks.photos} photos. Remove some, or upgrade for more.`);
    }
    if (!perks.advancePayments && d.advanceMode && d.advanceMode !== 'none') d.advanceMode = 'none';
    if (!perks.instantConfirm && d.instantConfirm) d.instantConfirm = false;
    if (!perks.deals && d.dealPercent) {
      d.dealPercent = 0;
      d.dealText = '';
    }
    if (!perks.videoTour && d.videoUrl) d.videoUrl = '';
    if (Array.isArray(d.paymentAccounts)) {
      d.paymentAccounts = d.paymentAccounts
        .filter((a: any) => a && (a.accountNumber || a.iban))
        .slice(0, 6)
        .map((a: any) => ({
          kind: String(a.kind || 'bank').slice(0, 20),
          title: String(a.title || '').slice(0, 60),
          accountName: String(a.accountName || '').slice(0, 80),
          accountNumber: String(a.accountNumber || '').slice(0, 40),
          iban: String(a.iban || '').slice(0, 40),
        }));
    }
    if (Array.isArray(d.faqs)) d.faqs = d.faqs.filter((f: any) => f?.q && f?.a).slice(0, 20).map((f: any) => ({ q: String(f.q).slice(0, 200), a: String(f.a).slice(0, 2000) }));
    if (d.acceptsForeigners !== undefined) d.acceptsForeigners = ['yes', 'no'].includes(d.acceptsForeigners) ? d.acceptsForeigners : '';
    if (d.foreignerRegistration !== undefined) d.foreignerRegistration = !!d.foreignerRegistration;
    if (d.airportPickup !== undefined) d.airportPickup = !!d.airportPickup;
    if (d.languages !== undefined) d.languages = (Array.isArray(d.languages) ? d.languages : []).map(String).filter((l: string) => LANGUAGES.includes(l)).slice(0, 10);
    if (d.airportName !== undefined) d.airportName = String(d.airportName).trim().slice(0, 80);
    if (d.airportKm !== undefined) d.airportKm = Math.min(500, Math.max(0, Math.round(Number(d.airportKm) || 0)));
    if (d.airportPickupPrice !== undefined) d.airportPickupPrice = Math.min(100000, Math.max(0, Math.round(Number(d.airportPickupPrice) || 0)));
    if (Array.isArray(d.nearby)) d.nearby = d.nearby.filter((n: any) => n?.title).slice(0, 15).map((n: any) => ({ title: String(n.title).slice(0, 80), distance: String(n.distance || '').slice(0, 20) }));
    if (Array.isArray(d.amenities)) d.amenities = [...new Set(d.amenities.map(String))].slice(0, 80);
    for (const k of ['lat', 'lng'] as const) if (d[k] !== undefined) d[k] = Number.isFinite(Number(d[k])) && d[k] !== '' && d[k] !== null ? Number(d[k]) : undefined;
    return d;
  }

  private async uniqueSlug(base: string, excludeId?: unknown): Promise<string> {
    const root = slugify(base) || 'hotel';
    let slug = root;
    for (let i = 2; i < 200; i++) {
      const hit = await this.hotels.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
      if (!hit) return slug;
      slug = `${root}-${i}`;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  /** An owner adds their hotel (one per account), or the admin adds an unclaimed one. */
  async create(actor: Actor, dto: any, opts: { asAdmin?: boolean } = {}) {
    const asAdmin = opts.asAdmin && this.isAdmin(actor);
    if (!asAdmin) {
      const existing = await this.hotels.exists({ owner: new Types.ObjectId(actor.userId) });
      if (existing) throw new BadRequestException('Your account already has a hotel. Each account manages one hotel.');
    }
    const perks = asAdmin ? UNCLAIMED_PERKS : await this.plans.perksForOwner(actor.userId);
    const d = await this.clean(dto, perks);
    if (!d.name) throw new BadRequestException('Please enter the hotel name.');
    if (!d.citySlug) throw new BadRequestException('Please choose the city.');
    const slug = await this.uniqueSlug(`${d.name}${d.name.toLowerCase().includes(d.cityName.toLowerCase()) ? '' : ' ' + d.cityName}`);
    const status = asAdmin || perks.autoPublish ? 'approved' : dto.submit ? 'pending' : 'draft';
    const doc = await this.hotels.create({
      ...d,
      slug,
      status,
      owner: asAdmin ? undefined : new Types.ObjectId(actor.userId),
      perks,
      rank: perks.placement,
    });
    if (!asAdmin) {
      // A guest account that adds a hotel becomes a hotel (agent) account.
      await this.hotels.db.collection('users').updateOne(
        { _id: new Types.ObjectId(actor.userId), role: 'USER' },
        { $set: { role: 'AGENT' } },
      );
      this.discord?.send({
        title: status === 'pending' ? '🏨 New hotel waiting for approval' : '🏨 New hotel added',
        description: `${doc.name} · ${doc.cityName}`,
        url: '/dashboard/hotels?status=' + status,
        color: DISCORD_COLORS.review,
        category: 'Listings',
        who: [{ label: 'Owner', id: actor.userId }],
      });
    }
    this.changed(doc);
    return doc;
  }

  async update(actor: Actor, dto: any, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    const perks = h.owner ? await this.plans.perksForOwner(h.owner) : UNCLAIMED_PERKS;
    const d = await this.clean(dto, perks, h);
    if (this.isAdmin(actor)) Object.assign(d, await this.cleanAdmin(dto, h));
    // Owners on a plan without auto-publish: big edits to a rejected hotel go back for review.
    if (!this.isAdmin(actor) && h.status === 'rejected') d.status = 'pending';
    Object.assign(h, d);
    await h.save();
    this.changed(h);
    return h;
  }

  /** Draft → pending (or live straight away on plans with auto-publish). */
  async submit(actor: Actor, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    const perks = h.owner ? await this.plans.perksForOwner(h.owner) : UNCLAIMED_PERKS;
    const roomCount = await this.rooms.countDocuments({ hotel: h._id, isActive: true });
    if (!roomCount) throw new BadRequestException('Add at least one room type before publishing.');
    if (!h.coverImage && !(h.gallery ?? []).length) throw new BadRequestException('Add at least one photo before publishing.');
    if (['draft', 'rejected'].includes(h.status)) {
      h.status = perks.autoPublish || this.isAdmin(actor) ? 'approved' : 'pending';
      await h.save();
      if (h.status === 'pending') {
        this.discord?.send({
          title: '🏨 Hotel waiting for approval',
          description: `${h.name} · ${h.cityName}`,
          url: '/dashboard/hotels?status=pending',
          color: DISCORD_COLORS.review,
          category: 'Listings',
        });
      }
      this.changed(h);
    }
    return h;
  }

  private async cleanAdmin(dto: any, h: any) {
    const d = this.pick(dto, ADMIN_FIELDS);
    if (d.slug !== undefined) {
      const s = slugify(d.slug);
      // Slugs of live hotels are ranked addresses: never change them silently.
      if (s && s !== h.slug) {
        if (await this.hotels.exists({ slug: s, _id: { $ne: h._id } })) throw new BadRequestException('That address is taken.');
        d.slug = s;
      } else delete d.slug;
    }
    if (d.status !== undefined && !['draft', 'pending', 'approved', 'rejected', 'suspended'].includes(d.status)) delete d.status;
    if (d.owner !== undefined) {
      if (d.owner === '' || d.owner === null) d.owner = undefined;
      else if (!Types.ObjectId.isValid(String(d.owner))) delete d.owner;
      else {
        const other = await this.hotels.exists({ owner: d.owner, _id: { $ne: h._id } });
        if (other) throw new BadRequestException('That account already manages another hotel.');
        d.owner = new Types.ObjectId(String(d.owner));
      }
    }
    return d;
  }

  /* ── rooms ── */

  private cleanRoom(dto: any) {
    const d = this.pick(dto, ROOM_FIELDS);
    if (d.name !== undefined) {
      d.name = String(d.name).trim().slice(0, 100);
      if (!d.name) throw new BadRequestException('Please enter the room name.');
    }
    for (const k of ['beds', 'maxAdults', 'maxChildren', 'size', 'price', 'weekendPrice', 'originalPrice', 'quantity', 'minNights', 'sort'] as const) {
      if (d[k] !== undefined) d[k] = Math.max(0, Number(d[k]) || 0);
    }
    if (d.maxAdults !== undefined) d.maxAdults = Math.max(1, Math.min(20, d.maxAdults));
    if (d.quantity !== undefined) d.quantity = Math.min(500, d.quantity);
    if (d.minNights !== undefined) d.minNights = Math.max(1, Math.min(30, d.minNights));
    if (Array.isArray(d.images)) d.images = d.images.filter((x: any) => typeof x === 'string' && x).slice(0, 20);
    return d;
  }

  async addRoom(actor: Actor, dto: any, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    const perks = h.owner ? await this.plans.perksForOwner(h.owner) : UNCLAIMED_PERKS;
    const count = await this.rooms.countDocuments({ hotel: h._id });
    if (perks.maxRoomTypes > 0 && count >= perks.maxRoomTypes) {
      throw new BadRequestException(`Your ${perks.plan} plan allows ${perks.maxRoomTypes} room types. Upgrade to add more.`);
    }
    const d = this.cleanRoom(dto);
    if (!d.name) throw new BadRequestException('Please enter the room name.');
    if (!(d.price > 0)) throw new BadRequestException('Please enter the price per night.');
    const room = await this.rooms.create({ ...d, hotel: h._id, sort: d.sort ?? count });
    await this.refreshHotelPrice(h._id);
    this.changed(h);
    return room;
  }

  async updateRoom(actor: Actor, roomId: string, dto: any, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    if (!Types.ObjectId.isValid(roomId)) throw new NotFoundException('Room not found');
    const room = await this.rooms.findOne({ _id: roomId, hotel: h._id }).exec();
    if (!room) throw new NotFoundException('Room not found');
    Object.assign(room, this.cleanRoom(dto));
    await room.save();
    await this.refreshHotelPrice(h._id);
    this.changed(h);
    return room;
  }

  async deleteRoom(actor: Actor, roomId: string, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    if (!Types.ObjectId.isValid(roomId)) throw new NotFoundException('Room not found');
    const upcoming = await this.bookings.exists({
      hotel: h._id,
      'rooms.room': new Types.ObjectId(roomId),
      status: { $in: HOLDING_STATUSES },
      checkOut: { $gt: todayPk() },
    });
    if (upcoming) throw new BadRequestException('This room has upcoming bookings. Switch it off instead of deleting it.');
    await this.rooms.deleteOne({ _id: roomId, hotel: h._id }).exec();
    await this.rates.deleteMany({ room: new Types.ObjectId(roomId) }).exec();
    await this.refreshHotelPrice(h._id);
    this.changed(h);
    return { ok: true };
  }

  async refreshHotelPrice(hotelId: unknown) {
    const rooms = await this.rooms.find({ hotel: hotelId, isActive: true }, { price: 1 }).lean().exec();
    const prices = rooms.map((r: any) => r.price).filter((p: number) => p > 0);
    await this.hotels.updateOne({ _id: hotelId }, { $set: { minPrice: prices.length ? Math.min(...prices) : 0, roomTypes: rooms.length } }).exec();
  }

  /* ── calendar ── */

  async calendar(actor: Actor, from: string, days: number, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : todayPk();
    const n = clampInt(days, 7, 62, 31);
    const nights = nightsOf(start, addDays(start, n));
    const rooms = await this.rooms.find({ hotel: h._id }).sort({ sort: 1, price: 1 }).lean().exec();
    const end = addDays(start, n);
    const [held, over] = await Promise.all([
      this.availability.heldRooms([h._id as Types.ObjectId], start, end),
      this.availability.overrides(rooms.map((r: any) => r._id), start, end),
    ]);
    return {
      from: start,
      days: n,
      nights,
      rooms: rooms.map((r: any) => ({
        _id: String(r._id),
        name: r.name,
        price: r.price,
        weekendPrice: r.weekendPrice,
        quantity: r.quantity,
        isActive: r.isActive,
        cells: nights.map((d) => {
          const o = over.get(String(r._id))?.get(d);
          const booked = held.get(String(r._id))?.get(d) ?? 0;
          const cap = o?.available ?? r.quantity;
          return {
            date: d,
            price: o?.price ?? null,
            available: o?.available ?? null,
            closed: !!o?.closed,
            booked,
            left: o?.closed ? 0 : Math.max(0, cap - booked),
          };
        }),
      })),
    };
  }

  /** Sets price / rooms on sale / closed for a date range of one or more room types. */
  async setRates(actor: Actor, dto: any, hotelId?: string) {
    const h = await this.requireManaged(actor, hotelId);
    const perks = h.owner ? await this.plans.perksForOwner(h.owner) : UNCLAIMED_PERKS;
    const closingOnly = dto.closed !== undefined && dto.price === undefined && dto.available === undefined;
    // Free plans may still close dates (sold out offline); prices per date need a paid plan.
    if (!perks.rateCalendar && !closingOnly && !dto.clear) {
      throw new ForbiddenException('Seasonal prices need the Standard or Premium plan. You can still close dates when you are full.');
    }
    const ids: string[] = (Array.isArray(dto.roomIds) ? dto.roomIds : []).filter((x: string) => Types.ObjectId.isValid(x));
    const rooms = await this.rooms.find({ _id: { $in: ids }, hotel: h._id }, { _id: 1 }).lean().exec();
    if (!rooms.length) throw new BadRequestException('Choose at least one room type.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.from) || !/^\d{4}-\d{2}-\d{2}$/.test(dto.to) || dto.to < dto.from) {
      throw new BadRequestException('Choose the dates.');
    }
    const dates = nightsOf(dto.from, addDays(dto.to, 1)).slice(0, 366);
    const weekdays: number[] | null = Array.isArray(dto.weekdays) && dto.weekdays.length ? dto.weekdays.map(Number) : null;
    const chosen = weekdays ? dates.filter((d) => weekdays.includes(new Date(d + 'T00:00:00Z').getUTCDay())) : dates;
    const ops: any[] = [];
    for (const r of rooms as any[]) {
      for (const date of chosen) {
        if (dto.clear) {
          ops.push({ deleteOne: { filter: { room: r._id, date } } });
          continue;
        }
        const set: any = {};
        if (dto.price !== undefined) set.price = dto.price === null || dto.price === '' ? undefined : Math.max(0, Number(dto.price) || 0);
        if (dto.available !== undefined) set.available = dto.available === null || dto.available === '' ? undefined : Math.max(0, Number(dto.available) || 0);
        if (dto.closed !== undefined) set.closed = !!dto.closed;
        ops.push({ updateOne: { filter: { room: r._id, date }, update: { $set: { ...set, hotel: h._id } }, upsert: true } });
      }
    }
    if (ops.length) await this.rates.bulkWrite(ops, { ordered: false });
    return { ok: true, updated: ops.length };
  }

  /* ───────────────────────── admin ───────────────────────── */

  async adminList(q: Record<string, any>) {
    const page = clampInt(q.page, 1, 1000, 1);
    const limit = clampInt(q.limit, 5, 100, 25);
    const filter: any = {};
    if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.city) filter.citySlug = slugify(q.city);
    if (q.claimed === 'yes') filter.owner = { $exists: true, $ne: null };
    if (q.claimed === 'no') filter.$or = [{ owner: { $exists: false } }, { owner: null }];
    const text = String(q.q ?? '').trim();
    if (text) filter.name = new RegExp(escapeRegex(text), 'i');
    const [items, total, counts] = await Promise.all([
      this.hotels
        .find(filter, { ...CARD_PROJECTION, status: 1, createdAt: 1, updatedAt: 1, views: 1, bookingsCount: 1, roomTypes: 1, phone: 1 })
        .populate('owner', 'name email phone')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.hotels.countDocuments(filter),
      this.hotels.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
  }

  async adminSet(id: string, dto: any) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Hotel not found');
    const h = await this.hotels.findById(id).exec();
    if (!h) throw new NotFoundException('Hotel not found');
    Object.assign(h, await this.cleanAdmin(dto, h));
    await h.save();
    await this.plans.sync(h);
    this.changed(h);
    return h;
  }

  async adminDelete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Hotel not found');
    const h: any = await this.hotels.findById(id).lean().exec();
    if (!h) throw new NotFoundException('Hotel not found');
    const live = await this.bookings.exists({ hotel: h._id, status: { $in: HOLDING_STATUSES }, checkOut: { $gt: todayPk() } });
    if (live) throw new BadRequestException('This hotel has upcoming bookings. Suspend it instead.');
    await Promise.all([
      this.hotels.deleteOne({ _id: h._id }),
      this.rooms.deleteMany({ hotel: h._id }),
      this.rates.deleteMany({ hotel: h._id }),
    ]);
    this.changed(h);
    return { ok: true };
  }

  /* ── claims ── */

  async claim(actor: Actor, hotelId: string, dto: any) {
    if (!Types.ObjectId.isValid(hotelId)) throw new NotFoundException('Hotel not found');
    const h: any = await this.hotels.findById(hotelId, { owner: 1, name: 1 }).lean().exec();
    if (!h) throw new NotFoundException('Hotel not found');
    if (h.owner) throw new BadRequestException('This hotel is already managed by its owner.');
    if (await this.hotels.exists({ owner: new Types.ObjectId(actor.userId) })) {
      throw new BadRequestException('Your account already manages a hotel. Use another account for this one.');
    }
    const open = await this.claims.exists({ hotel: h._id, user: new Types.ObjectId(actor.userId), status: 'pending' });
    if (open) throw new BadRequestException('Your request is already with our team. We will call you soon.');
    const phone = String(dto.phone ?? '').trim();
    if (phone.replace(/\D/g, '').length < 10) throw new BadRequestException('Please enter a phone number we can call.');
    const doc = await this.claims.create({
      hotel: h._id,
      user: new Types.ObjectId(actor.userId),
      name: String(dto.name ?? '').slice(0, 80),
      phone: phone.slice(0, 20),
      role: String(dto.role ?? '').slice(0, 40),
      message: String(dto.message ?? '').slice(0, 1000),
      proofUrl: String(dto.proofUrl ?? '').slice(0, 500),
    });
    this.discord?.send({
      title: '🔑 Hotel claim request',
      description: `${h.name} — ${doc.name} (${doc.role || 'owner'}) ${doc.phone}`,
      url: '/dashboard/hotel-claims',
      color: DISCORD_COLORS.review,
      category: 'Requests',
      who: [{ label: 'Account', id: actor.userId }],
    });
    return { ok: true };
  }

  async listClaims(status = 'pending') {
    return this.claims
      .find(status === 'all' ? {} : { status })
      .populate('hotel', 'name slug cityName citySlug owner')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
  }

  async decideClaim(id: string, dto: any) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Request not found');
    const c = await this.claims.findById(id).exec();
    if (!c) throw new NotFoundException('Request not found');
    const status = dto.status === 'approved' ? 'approved' : 'rejected';
    if (status === 'approved') {
      const h = await this.hotels.findById(c.hotel).exec();
      if (!h) throw new NotFoundException('Hotel not found');
      if (h.owner && String(h.owner) !== String(c.user)) throw new BadRequestException('This hotel already has an owner.');
      if (await this.hotels.exists({ owner: c.user, _id: { $ne: h._id } })) throw new BadRequestException('That account already manages a hotel.');
      h.owner = c.user;
      await h.save();
      await this.hotels.db.collection('users').updateOne({ _id: c.user, role: 'USER' }, { $set: { role: 'AGENT' } });
      await this.plans.sync(h);
      await this.claims.updateMany({ hotel: h._id, _id: { $ne: c._id }, status: 'pending' }, { $set: { status: 'rejected', adminNote: 'Another claim was approved.' } });
      this.changed(h);
    }
    c.status = status;
    c.adminNote = String(dto.adminNote ?? '').slice(0, 500);
    await c.save();
    return c;
  }

  /* ── helpers ── */

  changed(h: any) {
    const paths = ['/', '/hotels'];
    if (h?.citySlug) paths.push(`/hotels/${h.citySlug}`);
    if (h?.slug && h?.citySlug) paths.push(`/hotels/${h.citySlug}/${h.slug}`);
    void this.revalidate.revalidate({ tags: ['hotels'], paths }).catch(() => undefined);
  }
}
