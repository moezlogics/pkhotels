import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Hotel, HotelDocument } from '@pakhotels/db/schemas/hotel.schema';
import { Room, RoomDocument } from '@pakhotels/db/schemas/room.schema';
import { Booking, BookingDocument, BookingStatus, HOLDING_STATUSES } from '@pakhotels/db/schemas/booking.schema';
import { HotelReview, HotelReviewDocument } from '@pakhotels/db/schemas/hotel-review.schema';
import { AvailabilityService } from './availability.service';
import { HotelService, Actor } from './hotel.service';
import { UNCLAIMED_PERKS } from './hotel-plan.service';
import { addDays, clampInt, diffDays, escapeRegex, isPkMobile, newBookingRef, newToken, normalizePhone, parseStay, todayPk } from './stay.util';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { PushService } from '../push/push.service';

/** Which status a hotel may move a booking to, from where. */
const TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ['confirmed', 'declined', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'completed'],
  checked_in: ['completed'],
  completed: [],
  declined: [],
  cancelled: [],
  no_show: ['completed'],
  expired: ['confirmed'],
};

const STATUS_WORD: Record<string, string> = {
  confirmed: 'confirmed',
  declined: 'declined',
  cancelled: 'cancelled',
  checked_in: 'checked in',
  completed: 'completed',
  no_show: 'marked no-show',
  expired: 'expired',
};

const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

@Injectable()
export class BookingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Bookings');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectModel(Hotel.name) private readonly hotels: Model<HotelDocument>,
    @InjectModel(Room.name) private readonly rooms: Model<RoomDocument>,
    @InjectModel(HotelReview.name) private readonly reviews: Model<HotelReviewDocument>,
    private readonly availability: AvailabilityService,
    private readonly hotelService: HotelService,
    @Optional() private readonly discord?: DiscordService,
    @Optional() private readonly push?: PushService,
  ) {}

  onModuleInit() {
    // Reviews used to need a booking (unique "booking_1"); any account may review now.
    void this.reviews.collection.dropIndex('booking_1').catch(() => undefined).then(() => this.reviews.syncIndexes().catch(() => undefined));
    const tick = () => this.housekeeping().catch((e) => this.logger.warn(`housekeeping: ${e?.message}`));
    setTimeout(tick, 30_000).unref?.();
    this.timer = setInterval(tick, 5 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Pending requests the hotel never answered expire; stays whose check-out
   * has passed are completed (which opens the review form for the guest).
   */
  async housekeeping() {
    const now = new Date();
    const expired = await this.bookings.find({ status: 'pending', expiresAt: { $lt: now } }, { _id: 1 }).lean().exec();
    if (expired.length) {
      await this.bookings.updateMany(
        { _id: { $in: expired.map((b: any) => b._id) } },
        { $set: { status: 'expired' }, $push: { history: { status: 'expired', at: now, by: 'system', note: 'The hotel did not answer in time.' } } },
      );
    }
    const today = todayPk();
    await this.bookings.updateMany(
      { status: 'checked_in', checkOut: { $lt: today } },
      { $set: { status: 'completed' }, $push: { history: { status: 'completed', at: now, by: 'system' } } },
    );
    // Confirmed stays nobody updated: two days after check-out we assume they happened.
    await this.bookings.updateMany(
      { status: 'confirmed', checkOut: { $lt: addDays(today, -2) } },
      { $set: { status: 'completed' }, $push: { history: { status: 'completed', at: now, by: 'system' } } },
    );
  }

  /* ───────────────────────── guest ───────────────────────── */

  /** A guest's reservation. Works without an account. */
  async create(dto: any, user?: { userId: string } | null) {
    if (!Types.ObjectId.isValid(String(dto.hotelId))) throw new BadRequestException('Hotel not found.');
    const hotel: any = await this.hotels.findById(dto.hotelId).lean().exec();
    if (!hotel || hotel.status !== 'approved') throw new NotFoundException('This hotel is not available.');
    const gate = await this.hotelService.bookingGate(hotel);
    if (!gate.open) throw new BadRequestException(gate.reason);

    const stay = parseStay(dto.checkIn, dto.checkOut);
    const guestName = String(dto.guestName ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (guestName.length < 3) throw new BadRequestException('Please enter your full name.');
    const guestPhone = normalizePhone(dto.guestPhone);
    if (!guestPhone) throw new BadRequestException('Please enter a valid mobile number — 0300 1234567 in Pakistan, or with your country code, e.g. +44 7911 123456.');
    let guestEmail = String(dto.guestEmail ?? '').trim().toLowerCase().slice(0, 120);
    if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) throw new BadRequestException('Please check your email address.');
    // A number from abroad: the account's email is how we reach them.
    if (!guestEmail && user?.userId && Types.ObjectId.isValid(user.userId)) {
      const acct: any = await this.bookings.db.collection('users').findOne({ _id: new Types.ObjectId(user.userId) }, { projection: { email: 1 } });
      guestEmail = String(acct?.email ?? '').toLowerCase();
    }
    if (!isPkMobile(guestPhone) && !guestEmail) throw new BadRequestException('Please add an email address — with a number from outside Pakistan, the hotel and PakHotels reach you by email and WhatsApp.');
    const guestForeign = dto.guestForeign === true || dto.guestForeign === 'true';
    const guestCountry = /^[A-Z]{2}$/.test(String(dto.guestCountry ?? '').toUpperCase()) ? String(dto.guestCountry).toUpperCase() : guestForeign ? '' : 'PK';
    if (guestForeign && (!guestCountry || guestCountry === 'PK')) throw new BadRequestException('Please choose the country of your passport.');
    if (guestForeign && hotel.acceptsForeigners === 'no') {
      throw new BadRequestException('This hotel is not registered to host foreign passport holders. Please choose a hotel marked “Welcomes foreign guests”.');
    }
    const bookerName = String(dto.bookerName ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const bookerPhone = bookerName ? normalizePhone(dto.bookerPhone) : '';
    const adults = clampInt(dto.adults, 1, 40, 1);
    const children = clampInt(dto.children, 0, 20, 0);
    if (children > 0 && hotel.childrenAllowed === false) throw new BadRequestException('This hotel does not accept children.');

    // Too many open requests from one number is how fake bookings look.
    const openFromPhone = await this.bookings.countDocuments({ guestPhone, status: 'pending' });
    if (openFromPhone >= 3) throw new BadRequestException('You already have 3 booking requests waiting. Please wait for the hotels to reply, or cancel one.');
    const noShows = await this.bookings.countDocuments({ guestPhone, status: 'no_show', createdAt: { $gte: new Date(Date.now() - 180 * 86_400_000) } });

    const wanted: { roomId: string; qty: number }[] = (Array.isArray(dto.rooms) ? dto.rooms : [])
      .map((r: any) => ({ roomId: String(r.roomId ?? r.room ?? ''), qty: clampInt(r.qty, 0, 20, 0) }))
      .filter((r: any) => Types.ObjectId.isValid(r.roomId) && r.qty > 0);
    if (!wanted.length) throw new BadRequestException('Please choose a room.');

    const roomDocs = await this.rooms.find({ _id: { $in: wanted.map((w) => w.roomId) }, hotel: hotel._id, isActive: true }).lean().exec();
    const byId = new Map(roomDocs.map((r: any) => [String(r._id), r]));
    const perks = hotel.perks ?? UNCLAIMED_PERKS;
    const deal = perks.deals ? Math.max(0, Number(hotel.dealPercent) || 0) : 0;
    const quotes = (await this.availability.quoteHotels([{ _id: hotel._id, dealPercent: deal }], stay.nights)).get(String(hotel._id)) ?? [];
    const qById = new Map(quotes.map((q) => [q.roomId, q]));

    const lines: any[] = [];
    let capacity = 0;
    for (const w of wanted) {
      const room: any = byId.get(w.roomId);
      const q = qById.get(w.roomId);
      if (!room || !q) throw new BadRequestException('One of the rooms is no longer offered. Please choose again.');
      if (!q.minNightsOk) throw new BadRequestException(`${room.name} needs a stay of at least ${room.minNights} nights.`);
      if (q.available < w.qty) {
        throw new BadRequestException(q.available > 0 ? `Only ${q.available} ${room.name} left for these dates.` : `${room.name} is sold out for these dates.`);
      }
      capacity += w.qty * ((room.maxAdults || 2) + (room.maxChildren || 0));
      lines.push({ room: room._id, name: room.name, qty: w.qty, nightly: q.nightly, subtotal: q.total * w.qty });
    }
    const extraBeds = clampInt(dto.extraBeds, 0, 10, 0);
    if (adults + children > capacity + extraBeds) {
      throw new BadRequestException(`These rooms sleep ${capacity} guests. Add a room${hotel.extraBedPrice > 0 ? ' or an extra bed' : ''}.`);
    }
    const roomsTotal = lines.reduce((a, l) => a + l.subtotal, 0);
    const extrasTotal = extraBeds * (hotel.extraBedPrice || 0) * stay.nights.length;
    const tax = !hotel.taxIncluded && hotel.taxPercent > 0 ? Math.round(((roomsTotal + extrasTotal) * hotel.taxPercent) / 100) : 0;
    const total = roomsTotal + extrasTotal + tax;

    const advanceMode = perks.advancePayments ? hotel.advanceMode : 'none';
    const payAdvance = advanceMode === 'required' || (advanceMode === 'optional' && dto.paymentMode === 'advance');
    const advanceAmount = payAdvance ? Math.round((total * (hotel.advancePercent || 25)) / 100) : 0;

    const instant = !!(perks.instantConfirm && hotel.instantConfirm && !payAdvance && noShows === 0);
    const status: BookingStatus = instant ? 'confirmed' : 'pending';
    const responseMs = Math.max(1, Number(hotel.responseHours) || 12) * 3_600_000;
    // Never let a request wait past the evening before check-in.
    const latest = Date.parse(addDays(stay.checkIn, 0) + 'T12:00:00+05:00');
    const expiresAt = new Date(Math.max(Date.now() + 2 * 3_600_000, Math.min(Date.now() + responseMs, latest)));

    const token = newToken();
    let doc: BookingDocument | null = null;
    for (let i = 0; i < 5 && !doc; i++) {
      try {
        doc = await this.bookings.create({
          ref: newBookingRef(),
          token,
          hotel: hotel._id,
          hotelName: hotel.name,
          hotelSlug: hotel.slug,
          cityName: hotel.cityName,
          owner: hotel.owner,
          user: user?.userId && Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined,
          guestName,
          guestPhone,
          guestEmail,
          guestCity: String(dto.guestCity ?? '').slice(0, 60),
          guestCountry,
          guestForeign,
          bookerName,
          bookerPhone,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          nights: stay.nights.length,
          adults,
          children,
          rooms: lines,
          roomCount: lines.reduce((a, l) => a + l.qty, 0),
          extraBeds,
          extrasTotal,
          tax,
          total,
          purpose: String(dto.purpose ?? '').slice(0, 20),
          arrivalTime: String(dto.arrivalTime ?? '').slice(0, 20),
          specialRequests: String(dto.specialRequests ?? '').slice(0, 1000),
          status,
          paymentMode: payAdvance ? 'advance' : 'pay_at_hotel',
          advanceAmount,
          advanceStatus: 'none',
          source: 'web',
          // The rate is fixed when the guest books; a later plan change does not move it.
          commissionPercent: hotel.owner ? Math.max(0, Number(perks.commissionPercent) || 0) : 0,
          expiresAt: status === 'pending' ? expiresAt : undefined,
          history: [{ status, at: new Date(), by: 'guest', note: instant ? 'Instant confirmation' : '' }],
        });
      } catch (e: any) {
        if (e?.code !== 11000) throw e; // reference clash: try another
      }
    }
    if (!doc) throw new BadRequestException('Please try again.');

    // Two guests can reach the last room at the same moment: re-count, and undo ours if it overbooked.
    const after = (await this.availability.quoteHotels([{ _id: hotel._id, dealPercent: deal }], stay.nights)).get(String(hotel._id)) ?? [];
    const over = lines.find((l) => (after.find((q) => q.roomId === String(l.room))?.available ?? 0) < 0);
    if (over) {
      await this.bookings.deleteOne({ _id: doc._id });
      throw new BadRequestException(`${over.name} just sold out for these dates. Please choose another room.`);
    }

    await this.hotels.updateOne({ _id: hotel._id }, { $inc: { bookingsCount: 1 } }).exec();
    // Keep the guest's number on their account so the next booking is pre-filled.
    if (user?.userId && Types.ObjectId.isValid(user.userId)) {
      await this.bookings.db.collection('users').updateOne(
        { _id: new Types.ObjectId(user.userId), $or: [{ phone: { $exists: false } }, { phone: '' }, { phone: null }] },
        { $set: { phone: guestPhone } },
      );
    }
    this.announceNew(doc, hotel, noShows);
    return { ref: doc.ref, token, status: doc.status, total, advanceAmount, paymentMode: doc.paymentMode };
  }

  private announceNew(b: BookingDocument, hotel: any, noShows: number) {
    const dates = `${fmtDate(b.checkIn)} – ${fmtDate(b.checkOut)}`;
    const rooms = b.rooms.map((r) => `${r.qty}× ${r.name}`).join(', ');
    if (hotel.owner) {
      void this.push?.toUsers([hotel.owner], {
        type: 'booking_new',
        vars: { guest: b.guestForeign ? `${b.guestName} (foreign guest, ${b.guestCountry})` : b.guestName, dates, rooms, total: b.total.toLocaleString('en-PK') },
        url: `/dashboard/bookings?ref=${b.ref}`,
        tag: `booking:${b.ref}`,
      }).catch(() => undefined);
    } else {
      void this.push?.admins().then((ids) =>
        this.push?.toUsers(ids, { type: 'admin_booking', vars: { hotel: hotel.name, guest: b.guestForeign ? `${b.guestName} (foreign, ${b.guestCountry})` : b.guestName, dates }, url: `/dashboard/bookings?ref=${b.ref}` }),
      ).catch(() => undefined);
    }
    this.discord?.send({
      title: hotel.owner ? `🛎️ New booking · ${hotel.name}` : `🛎️ Concierge booking (unclaimed) · ${hotel.name}`,
      description: `${b.ref} · ${b.guestName} · ${b.guestPhone}\n${rooms} · ${dates} (${b.nights} nights) · Rs ${b.total.toLocaleString('en-PK')}`,
      url: `/dashboard/bookings?ref=${b.ref}`,
      color: DISCORD_COLORS.booking,
      category: 'Bookings',
      fields: [
        ...(noShows ? [{ name: '⚠️ Guest history', value: `${noShows} no-show(s) in the last 6 months` }] : []),
        ...(b.guestForeign ? [{ name: '🌍 Foreign guest', value: `Passport: ${b.guestCountry}${b.guestEmail ? ` · ${b.guestEmail}` : ''}` }] : []),
        ...(b.bookerName ? [{ name: '👤 Booked by', value: `${b.bookerName} ${b.bookerPhone}` }] : []),
      ],
    });
  }

  /** The guest's view of a booking (reference + secret from the manage link). */
  async byRef(ref: string, token: string) {
    const b: any = await this.bookings.findOne({ ref: String(ref).toUpperCase() }).select('+token').lean().exec();
    if (!b || !token || b.token !== token) throw new NotFoundException('Booking not found. Check the link in your confirmation.');
    const hotel: any = await this.hotels.findById(b.hotel).lean().exec();
    const perks = hotel?.perks ?? UNCLAIMED_PERKS;
    const { token: _t, internalNote: _n, owner: _o, ...rest } = b;
    const canCancel = this.guestCanCancel(b, hotel);
    // The guest must always have a number to call: the hotel's, else its owner's.
    let ownerPhone = '';
    if (hotel && !hotel.phone && !hotel.whatsapp && hotel.owner) {
      const o: any = await this.bookings.db.collection('users').findOne({ _id: hotel.owner }, { projection: { phone: 1, whatsappNumber: 1 } });
      ownerPhone = o?.whatsappNumber || o?.phone || '';
    }
    return {
      ...rest,
      canCancel: canCancel.ok,
      cancelNote: canCancel.note,
      canReview: this.canReview(b),
      canDispute: this.canDispute(b),
      hotel: hotel
        ? {
            _id: String(hotel._id),
            name: hotel.name,
            slug: hotel.slug,
            address: hotel.address,
            cityName: hotel.cityName,
            citySlug: hotel.citySlug,
            coverImage: hotel.coverImage || hotel.gallery?.[0] || '',
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            idRequired: hotel.idRequired,
            couplePolicy: hotel.couplePolicy,
            lat: hotel.lat,
            lng: hotel.lng,
            // Someone who booked may always reach the hotel, whatever its plan.
            phone: b.status !== 'declined' ? hotel.phone || ownerPhone : '',
            whatsapp: b.status !== 'declined' ? hotel.whatsapp || hotel.phone || ownerPhone : '',
            claimed: !!hotel.owner,
            responseHours: hotel.responseHours || 12,
            acceptsForeigners: hotel.acceptsForeigners || '',
            paymentAccounts: b.paymentMode === 'advance' && perks.advancePayments ? hotel.paymentAccounts ?? [] : [],
            cancellationPolicy: hotel.cancellationPolicy,
            freeCancelHours: hotel.freeCancelHours,
          }
        : null,
    };
  }

  /** Reference + phone number (like an airline's PNR + surname) → the manage link. */
  async lookup(ref: string, phone: string) {
    const p = normalizePhone(phone);
    const b: any = await this.bookings.findOne({ ref: String(ref ?? '').trim().toUpperCase(), guestPhone: p }).select('+token ref').lean().exec();
    if (!b || !p) throw new NotFoundException('No booking matches that reference and mobile number.');
    return { ref: b.ref, token: b.token };
  }

  private guestCanCancel(b: any, hotel: any): { ok: boolean; note: string } {
    if (!['pending', 'confirmed'].includes(b.status)) return { ok: false, note: '' };
    if (b.checkIn < todayPk()) return { ok: false, note: 'The stay has started.' };
    if (b.status === 'pending') return { ok: true, note: 'You can cancel until the hotel confirms. Once confirmed, the booking can only be changed by calling the hotel.' };
    // Confirmed: the hotel has held the room for this guest. Changes go through the hotel.
    return { ok: false, note: 'Confirmed by the hotel — it can no longer be cancelled online. To change your plans, call or WhatsApp the hotel.' };
  }

  async cancelByGuest(ref: string, token: string, reason: string) {
    const b = await this.bookings.findOne({ ref: String(ref).toUpperCase() }).select('+token').exec();
    if (!b || b.token !== token) throw new NotFoundException('Booking not found.');
    const hotel: any = await this.hotels.findById(b.hotel).lean().exec();
    if (!this.guestCanCancel(b, hotel).ok) throw new BadRequestException('The hotel has confirmed this booking, so it can no longer be cancelled online. Please call or WhatsApp the hotel.');
    b.status = 'cancelled';
    b.cancelReason = String(reason ?? '').slice(0, 300);
    b.history.push({ status: 'cancelled', at: new Date(), by: 'guest', note: b.cancelReason });
    await b.save();
    if (b.owner) {
      void this.push?.toUsers([b.owner], {
        type: 'booking_cancelled',
        vars: { guest: b.guestName, dates: `${fmtDate(b.checkIn)} – ${fmtDate(b.checkOut)}` },
        url: `/dashboard/bookings?ref=${b.ref}`,
        tag: `booking:${b.ref}`,
      }).catch(() => undefined);
    }
    this.discord?.send({ title: `❌ Booking cancelled by guest · ${b.hotelName}`, description: `${b.ref} · ${b.guestName}`, url: `/dashboard/bookings?ref=${b.ref}`, category: 'Bookings' });
    return { ok: true };
  }

  /**
   * The hotel marked the stay cancelled or a no-show after the guest arrived.
   * The guest can say "I did stay" — an admin then checks (both sides are
   * phoned) and an upheld stay is completed and billed. This is what keeps
   * fake no-shows from eating the commission.
   */
  private canDispute(b: any) {
    if (b.source !== 'web' || b.stayDispute) return false;
    if (!['no_show', 'cancelled'].includes(b.status)) return false;
    const last = [...(b.history ?? [])].reverse().find((x: any) => x.status === b.status);
    if (!last || last.by === 'guest') return false;
    // Only around and after the stay, for up to 60 days.
    return b.checkIn <= todayPk() && b.checkIn >= addDays(todayPk(), -60);
  }

  async disputeStay(ref: string, token: string, note: string) {
    const b = await this.bookings.findOne({ ref: String(ref).toUpperCase() }).select('+token').exec();
    if (!b || b.token !== token) throw new NotFoundException('Booking not found.');
    if (!this.canDispute(b)) throw new BadRequestException('This booking cannot be reported.');
    b.stayDispute = 'open';
    b.stayDisputeNote = String(note ?? '').trim().slice(0, 500);
    b.history.push({ status: b.status, at: new Date(), by: 'guest', note: 'Guest says they stayed' });
    await b.save();
    this.discord?.send({
      title: `⚠️ Guest says they stayed · ${b.hotelName}`,
      description: `${b.ref} · ${b.guestName} · ${b.guestPhone}
Hotel marked it ${b.status.replace('_', '-')}. ${b.stayDisputeNote}`,
      url: '/dashboard/billing',
      color: DISCORD_COLORS.report,
      category: 'Bookings',
    });
    return { ok: true };
  }

  /** The guest says they sent the advance, with a screenshot. */
  async submitAdvance(ref: string, token: string, dto: any) {
    const b = await this.bookings.findOne({ ref: String(ref).toUpperCase() }).select('+token').exec();
    if (!b || b.token !== token) throw new NotFoundException('Booking not found.');
    if (b.paymentMode !== 'advance') throw new BadRequestException('This booking is paid at the hotel.');
    if (!['pending', 'confirmed'].includes(b.status)) throw new BadRequestException('This booking is closed.');
    const proof = String(dto.proofUrl ?? '');
    if (!proof) throw new BadRequestException('Please attach the payment screenshot.');
    b.advanceStatus = 'submitted';
    b.advanceMethod = String(dto.method ?? '').slice(0, 60);
    b.advanceProofUrl = proof.slice(0, 500);
    b.advanceNote = String(dto.note ?? '').slice(0, 300);
    b.history.push({ status: b.status, at: new Date(), by: 'guest', note: 'Advance proof uploaded' });
    await b.save();
    const to = b.owner ? [b.owner] : await this.push?.admins().catch(() => []) ?? [];
    void this.push?.toUsers(to, { type: 'booking_advance', vars: { guest: b.guestName, amount: b.advanceAmount.toLocaleString('en-PK') }, url: `/dashboard/bookings?ref=${b.ref}` }).catch(() => undefined);
    return { ok: true };
  }

  private canReview(b: any) {
    return !b.reviewed && (b.status === 'completed' || (['confirmed', 'checked_in'].includes(b.status) && b.checkOut <= todayPk()));
  }

  /** A verified review — only a guest with the booking's secret, after the stay. */
  async review(ref: string, token: string, dto: any) {
    const b = await this.bookings.findOne({ ref: String(ref).toUpperCase() }).select('+token').exec();
    if (!b || b.token !== token) throw new NotFoundException('Booking not found.');
    if (!this.canReview(b)) throw new BadRequestException(b.reviewed ? 'You have already reviewed this stay.' : 'You can review after your stay.');
    const rating = clampInt(dto.rating, 1, 5, 0);
    if (!rating) throw new BadRequestException('Please choose a rating.');
    const part = (v: any) => (v ? clampInt(v, 1, 5, 0) || undefined : undefined);
    const text = String(dto.text ?? '').trim().slice(0, 2000);
    // Already reviewed this hotel from the account? Attach the stay to that review instead.
    if (b.user) {
      const existing = await this.reviews.findOne({ hotel: b.hotel, user: b.user }).exec();
      if (existing) {
        Object.assign(existing, {
          booking: b._id, rating, cleanliness: part(dto.cleanliness), staff: part(dto.staff), location: part(dto.location), value: part(dto.value),
          title: String(dto.title ?? '').trim().slice(0, 120), text, tripType: b.purpose, stayMonth: b.checkIn.slice(0, 7),
        });
        await existing.save();
        b.reviewed = true;
        await b.save();
        await this.refreshRating(b.hotel);
        this.hotelService.changed({ slug: b.hotelSlug, citySlug: (await this.hotels.findById(b.hotel, { citySlug: 1 }).lean().exec() as any)?.citySlug });
        return { ok: true };
      }
    }
    await this.reviews.create({
      hotel: b.hotel,
      booking: b._id,
      user: b.user,
      guestName: b.guestName.split(' ')[0] + (b.guestName.includes(' ') ? ' ' + b.guestName.split(' ').pop()![0] + '.' : ''),
      rating,
      cleanliness: part(dto.cleanliness),
      staff: part(dto.staff),
      location: part(dto.location),
      value: part(dto.value),
      title: String(dto.title ?? '').trim().slice(0, 120),
      text,
      tripType: b.purpose,
      stayMonth: b.checkIn.slice(0, 7),
      status: 'approved',
    });
    b.reviewed = true;
    await b.save();
    await this.refreshRating(b.hotel);
    this.hotelService.changed({ slug: b.hotelSlug, citySlug: (await this.hotels.findById(b.hotel, { citySlug: 1 }).lean().exec() as any)?.citySlug });
    return { ok: true };
  }

  async refreshRating(hotelId: unknown) {
    const [agg] = await this.reviews.aggregate([
      { $match: { hotel: new Types.ObjectId(String(hotelId)), status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    await this.hotels.updateOne({ _id: hotelId }, { $set: { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.n ?? 0 } }).exec();
  }

  /** A signed-in guest's bookings: made while signed in, or with the account's phone number. */
  async mine(userId: string) {
    const u: any = await this.bookings.db.collection('users').findOne({ _id: new Types.ObjectId(userId) }, { projection: { phone: 1, whatsappNumber: 1 } });
    const phones = [normalizePhone(u?.phone), normalizePhone(u?.whatsappNumber)].filter(Boolean);
    const rows = await this.bookings
      .find({ $or: [{ user: new Types.ObjectId(userId) }, ...(phones.length ? [{ guestPhone: { $in: phones } }] : [])] })
      .select('+token')
      .sort({ checkIn: -1 })
      .limit(100)
      .lean()
      .exec();
    const covers = new Map(
      (await this.hotels.find({ _id: { $in: [...new Set(rows.map((b: any) => String(b.hotel)))] } }, { coverImage: 1, gallery: { $slice: 1 } }).lean().exec())
        .map((h: any) => [String(h._id), h.coverImage || h.gallery?.[0] || '']),
    );
    return rows.map(({ internalNote: _n, ...b }: any) => ({ ...b, hotelCover: covers.get(String(b.hotel)) ?? '' }));
  }

  /* ───────────────────────── hotel side ───────────────────────── */

  /** The bookings this person may manage: their hotel's, or (admin) any. */
  private async scope(actor: Actor, hotelId?: string): Promise<any> {
    if (actor.role === 'ADMIN') {
      if (hotelId && Types.ObjectId.isValid(hotelId)) return { hotel: new Types.ObjectId(hotelId) };
      return {};
    }
    const h = await this.hotelService.requireManaged(actor);
    return { hotel: h._id };
  }

  async list(actor: Actor, q: Record<string, any>) {
    const filter: any = await this.scope(actor, q.hotelId);
    const page = clampInt(q.page, 1, 1000, 1);
    const limit = clampInt(q.limit, 5, 100, 25);
    const today = todayPk();
    switch (q.view) {
      case 'arrivals':
        filter.checkIn = today;
        filter.status = { $in: ['confirmed', 'pending'] };
        break;
      case 'inhouse':
        filter.status = 'checked_in';
        break;
      case 'upcoming':
        filter.checkIn = { $gte: today };
        filter.status = { $in: ['confirmed'] };
        break;
      case 'departures':
        filter.checkOut = today;
        filter.status = { $in: ['checked_in', 'confirmed'] };
        break;
    }
    if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.unclaimed === '1' && actor.role === 'ADMIN') filter.owner = { $in: [null, undefined] };
    if (q.from) filter.checkIn = { ...(typeof filter.checkIn === 'object' ? filter.checkIn : {}), $gte: q.from };
    if (q.to) filter.checkIn = { ...(typeof filter.checkIn === 'object' ? filter.checkIn : {}), $lte: q.to };
    const text = String(q.q ?? q.ref ?? '').trim();
    if (text) {
      const rx = new RegExp(escapeRegex(text), 'i');
      filter.$or = [{ ref: rx }, { guestName: rx }, { guestPhone: rx }, { hotelName: rx }];
    }
    const sort: any = q.view === 'upcoming' || q.view === 'arrivals' ? { checkIn: 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      this.bookings.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.bookings.countDocuments(filter),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async stats(actor: Actor, hotelId?: string) {
    const base: any = await this.scope(actor, hotelId);
    const today = todayPk();
    const monthStart = today.slice(0, 7) + '-01';
    const [pending, arrivals, inhouse, departures, upcoming, month, monthRevenue, advances] = await Promise.all([
      this.bookings.countDocuments({ ...base, status: 'pending' }),
      this.bookings.countDocuments({ ...base, checkIn: today, status: { $in: ['confirmed', 'pending'] } }),
      this.bookings.countDocuments({ ...base, status: 'checked_in' }),
      this.bookings.countDocuments({ ...base, checkOut: today, status: { $in: ['checked_in', 'confirmed'] } }),
      this.bookings.countDocuments({ ...base, checkIn: { $gte: today }, status: 'confirmed' }),
      this.bookings.countDocuments({ ...base, createdAt: { $gte: new Date(monthStart + 'T00:00:00+05:00') } }),
      this.bookings.aggregate([
        { $match: { ...base, checkIn: { $gte: monthStart }, status: { $in: ['confirmed', 'checked_in', 'completed'] } } },
        { $group: { _id: null, sum: { $sum: '$total' }, nights: { $sum: { $multiply: ['$nights', '$roomCount'] } } } },
      ]),
      this.bookings.countDocuments({ ...base, advanceStatus: 'submitted' }),
    ]);
    // Last 30 days, per day, for the chart.
    const since = addDays(today, -29);
    const daily = await this.bookings.aggregate([
      { $match: { ...base, createdAt: { $gte: new Date(since + 'T00:00:00+05:00') } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:00' } }, n: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { _id: 1 } },
    ]);
    return {
      pending,
      arrivals,
      inhouse,
      departures,
      upcoming,
      month,
      monthRevenue: monthRevenue[0]?.sum ?? 0,
      monthRoomNights: monthRevenue[0]?.nights ?? 0,
      advancesToCheck: advances,
      daily,
    };
  }

  private async loadManaged(actor: Actor, id: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Booking not found');
    const b = await this.bookings.findById(id).exec();
    if (!b) throw new NotFoundException('Booking not found');
    if (actor.role !== 'ADMIN') {
      const h = await this.hotelService.requireManaged(actor);
      if (String(b.hotel) !== String(h._id)) throw new ForbiddenException('Not your booking');
    }
    return b;
  }

  async setStatus(actor: Actor, id: string, dto: any) {
    const b = await this.loadManaged(actor, id);
    const to = String(dto.status) as BookingStatus;
    if (!(TRANSITIONS[b.status] ?? []).includes(to)) throw new BadRequestException(`A ${b.status.replace('_', ' ')} booking cannot be marked ${to.replace('_', ' ')}.`);
    if (to === 'confirmed' && b.status === 'expired') {
      // Re-confirming an expired request takes the rooms again: check they are still free.
      const quotes = (await this.availability.quoteHotels([{ _id: b.hotel as any }], this.nights(b), { excludeBooking: b._id as any })).get(String(b.hotel)) ?? [];
      const short = b.rooms.find((r) => (quotes.find((q) => q.roomId === String(r.room))?.available ?? 0) < r.qty);
      if (short) throw new BadRequestException(`${short.name} is no longer free for these dates.`);
    }
    if (to === 'checked_in' && b.checkIn > todayPk()) throw new BadRequestException('Check-in is on ' + fmtDate(b.checkIn) + '.');
    if (to === 'no_show' && b.checkIn > todayPk()) throw new BadRequestException('A guest can only be a no-show from the check-in date (' + fmtDate(b.checkIn) + ').');
    if (to === 'cancelled' && actor.role !== 'ADMIN' && b.source === 'web' && b.checkIn < todayPk()) {
      throw new BadRequestException('The check-in date has passed. If the guest did not come, mark the booking as No-show.');
    }
    if (to === 'no_show' && actor.role !== 'ADMIN' && b.source === 'web' && String(dto.note ?? '').trim().length < 3) {
      throw new BadRequestException('Please add a short note on what happened (the guest can see that the booking was marked no-show).');
    }
    b.status = to;
    if (dto.hotelNote !== undefined) b.hotelNote = String(dto.hotelNote).slice(0, 500);
    if (to === 'cancelled' || to === 'declined') b.cancelReason = String(dto.note ?? '').slice(0, 300);
    b.expiresAt = undefined;
    b.history.push({ status: to, at: new Date(), by: actor.role === 'ADMIN' ? 'admin' : 'hotel', note: String(dto.note ?? '').slice(0, 300) });
    await b.save();
    if (b.user && ['confirmed', 'declined', 'cancelled'].includes(to)) {
      void this.push?.toUsers([b.user], {
        type: 'booking_status',
        vars: { hotel: b.hotelName, status: STATUS_WORD[to] ?? to },
        url: `/trips`,
        tag: `booking:${b.ref}`,
      }).catch(() => undefined);
    }
    return b;
  }

  private nights(b: any): string[] {
    const n = diffDays(b.checkIn, b.checkOut);
    return Array.from({ length: n }, (_, i) => addDays(b.checkIn, i));
  }

  async setAdvance(actor: Actor, id: string, dto: any) {
    const b = await this.loadManaged(actor, id);
    const s = dto.advanceStatus === 'received' ? 'received' : 'rejected';
    b.advanceStatus = s;
    b.history.push({ status: b.status, at: new Date(), by: 'hotel', note: s === 'received' ? 'Advance received' : 'Advance not received' });
    // An advance the hotel has in hand confirms a waiting request.
    if (s === 'received' && b.status === 'pending') {
      b.status = 'confirmed';
      b.expiresAt = undefined;
      b.history.push({ status: 'confirmed', at: new Date(), by: 'hotel', note: 'Confirmed on advance' });
    }
    await b.save();
    return b;
  }

  async setNote(actor: Actor, id: string, dto: any) {
    const b = await this.loadManaged(actor, id);
    if (dto.internalNote !== undefined) b.internalNote = String(dto.internalNote).slice(0, 1000);
    if (dto.hotelNote !== undefined) b.hotelNote = String(dto.hotelNote).slice(0, 500);
    await b.save();
    return b;
  }

  /** The hotel adds a phone or walk-in booking so the calendar stays right. */
  async createManual(actor: Actor, dto: any, hotelId?: string) {
    const h = await this.hotelService.requireManaged(actor, hotelId);
    const stay = (() => {
      const s = String(dto.checkIn), e = String(dto.checkOut);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e) || e <= s) throw new BadRequestException('Choose the dates.');
      return { checkIn: s, checkOut: e, nights: this.nights({ checkIn: s, checkOut: e }) };
    })();
    const guestName = String(dto.guestName ?? '').trim().slice(0, 80) || 'Walk-in guest';
    const guestPhone = normalizePhone(dto.guestPhone) || String(dto.guestPhone ?? '').replace(/\D/g, '').slice(0, 15) || '0';
    const quotes = (await this.availability.quoteHotels([{ _id: h._id as any }], stay.nights)).get(String(h._id)) ?? [];
    const lines: any[] = [];
    for (const w of Array.isArray(dto.rooms) ? dto.rooms : []) {
      const q = quotes.find((x) => x.roomId === String(w.roomId));
      const qty = clampInt(w.qty, 0, 50, 0);
      if (!q || !qty) continue;
      if (q.available < qty && !dto.force) throw new BadRequestException(`Only ${q.available} ${q.name} free for these dates.`);
      const price = Number(w.price) > 0 ? Number(w.price) : null;
      const nightly = price ? stay.nights.map(() => price) : q.nightly;
      lines.push({ room: new Types.ObjectId(q.roomId), name: q.name, qty, nightly, subtotal: nightly.reduce((a, b) => a + b, 0) * qty });
    }
    if (!lines.length) throw new BadRequestException('Choose a room.');
    const total = Number(dto.total) > 0 ? Number(dto.total) : lines.reduce((a, l) => a + l.subtotal, 0);
    const status: BookingStatus = dto.status === 'checked_in' ? 'checked_in' : 'confirmed';
    const doc = await this.bookings.create({
      ref: newBookingRef(),
      token: newToken(),
      hotel: h._id,
      hotelName: h.name,
      hotelSlug: h.slug,
      cityName: h.cityName,
      owner: h.owner,
      guestName,
      guestPhone,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      nights: stay.nights.length,
      adults: clampInt(dto.adults, 1, 40, 1),
      children: clampInt(dto.children, 0, 20, 0),
      rooms: lines,
      roomCount: lines.reduce((a, l) => a + l.qty, 0),
      total,
      status,
      source: 'dashboard',
      internalNote: String(dto.internalNote ?? '').slice(0, 1000),
      history: [{ status, at: new Date(), by: actor.role === 'ADMIN' ? 'admin' : 'hotel', note: 'Added by the hotel' }],
    });
    return doc;
  }

  /* ── reviews (hotel side) ── */

  async hotelReviews(actor: Actor, hotelId?: string) {
    const base: any = await this.scope(actor, hotelId);
    return this.reviews.find(base).sort({ createdAt: -1 }).limit(200).lean().exec();
  }

  async replyReview(actor: Actor, id: string, reply: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const r = await this.reviews.findById(id).exec();
    if (!r) throw new NotFoundException();
    if (actor.role !== 'ADMIN') {
      const h = await this.hotelService.requireManaged(actor);
      if (String(r.hotel) !== String(h._id)) throw new ForbiddenException();
    }
    r.reply = String(reply ?? '').slice(0, 1000);
    r.repliedAt = new Date();
    await r.save();
    const h: any = await this.hotels.findById(r.hotel, { slug: 1 }).lean().exec();
    this.hotelService.changed(h);
    return r;
  }

  async moderateReview(id: string, status: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const r = await this.reviews.findByIdAndUpdate(id, { status: ['approved', 'hidden', 'pending'].includes(status) ? status : 'hidden' }, { new: true }).exec();
    if (!r) throw new NotFoundException();
    await this.refreshRating(r.hotel);
    const h: any = await this.hotels.findById(r.hotel, { slug: 1 }).lean().exec();
    this.hotelService.changed(h);
    return r;
  }
}

export { HOLDING_STATUSES };
