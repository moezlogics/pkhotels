import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '@pakhotels/db/schemas/room.schema';
import { RoomRate, RoomRateDocument } from '@pakhotels/db/schemas/room-rate.schema';
import { Booking, BookingDocument, HOLDING_STATUSES } from '@pakhotels/db/schemas/booking.schema';
import { isWeekendNight } from './stay.util';

export interface RoomQuote {
  roomId: string;
  name: string;
  /** Rooms of this type free on every night of the stay. */
  available: number;
  /** Price of each night for one room (after any deal). */
  nightly: number[];
  /** Same, before the deal — for the struck-through price. */
  nightlyBefore: number[];
  total: number;
  totalBefore: number;
  /** Cheapest night, for "from Rs x / night". */
  perNight: number;
  closed: boolean;
  minNightsOk: boolean;
}

/**
 * Rooms left and prices for a stay.
 *
 * A night is sellable when (calendar override "available" or the room's
 * quantity) minus the rooms held by pending / confirmed / checked-in bookings
 * covering that night is above zero, and the night is not closed.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Room.name) private readonly rooms: Model<RoomDocument>,
    @InjectModel(RoomRate.name) private readonly rates: Model<RoomRateDocument>,
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
  ) {}

  /** roomId → night → rooms held, for bookings overlapping [from, to). */
  async heldRooms(hotelIds: Types.ObjectId[], from: string, to: string, excludeBooking?: Types.ObjectId) {
    const rows = await this.bookings
      .find(
        {
          hotel: { $in: hotelIds },
          status: { $in: HOLDING_STATUSES },
          checkIn: { $lt: to },
          checkOut: { $gt: from },
          ...(excludeBooking ? { _id: { $ne: excludeBooking } } : {}),
        },
        { rooms: 1, checkIn: 1, checkOut: 1 },
      )
      .lean()
      .exec();
    const held = new Map<string, Map<string, number>>();
    for (const b of rows as any[]) {
      for (const r of b.rooms ?? []) {
        const key = String(r.room);
        let m = held.get(key);
        if (!m) held.set(key, (m = new Map()));
        for (let d = b.checkIn > from ? b.checkIn : from; d < b.checkOut && d < to; d = nextDay(d)) {
          m.set(d, (m.get(d) ?? 0) + Number(r.qty || 0));
        }
      }
    }
    return held;
  }

  /** roomId → night → override row. */
  async overrides(roomIds: Types.ObjectId[], from: string, to: string) {
    const rows = await this.rates.find({ room: { $in: roomIds }, date: { $gte: from, $lt: to } }).lean().exec();
    const out = new Map<string, Map<string, any>>();
    for (const r of rows as any[]) {
      const k = String(r.room);
      let m = out.get(k);
      if (!m) out.set(k, (m = new Map()));
      m.set(r.date, r);
    }
    return out;
  }

  /**
   * Quotes for the active rooms of several hotels at once (search pages).
   * `dealPercent` per hotel (0 when the plan has no deals).
   */
  async quoteHotels(
    hotels: { _id: Types.ObjectId; dealPercent?: number }[],
    nights: string[],
    opts: { excludeBooking?: Types.ObjectId; roomsByHotel?: Map<string, any[]> } = {},
  ): Promise<Map<string, RoomQuote[]>> {
    const out = new Map<string, RoomQuote[]>();
    if (!hotels.length || !nights.length) return out;
    const from = nights[0]!;
    const to = nextDay(nights[nights.length - 1]!);
    const ids = hotels.map((h) => h._id);

    let byHotel = opts.roomsByHotel;
    if (!byHotel) {
      const rooms = await this.rooms.find({ hotel: { $in: ids }, isActive: true }).sort({ sort: 1, price: 1 }).lean().exec();
      byHotel = new Map();
      for (const r of rooms as any[]) {
        const k = String(r.hotel);
        if (!byHotel.has(k)) byHotel.set(k, []);
        byHotel.get(k)!.push(r);
      }
    }
    const allRooms = [...byHotel.values()].flat();
    const [held, over] = await Promise.all([
      this.heldRooms(ids, from, to, opts.excludeBooking),
      this.overrides(allRooms.map((r) => r._id), from, to),
    ]);

    for (const h of hotels) {
      const deal = Math.min(90, Math.max(0, Number(h.dealPercent) || 0));
      const list: RoomQuote[] = [];
      for (const r of byHotel.get(String(h._id)) ?? []) {
        const rk = String(r._id);
        let available = Infinity;
        let closed = false;
        const nightly: number[] = [];
        const before: number[] = [];
        for (const d of nights) {
          const o = over.get(rk)?.get(d);
          if (o?.closed) closed = true;
          const cap = o?.available ?? r.quantity ?? 0;
          const free = o?.closed ? 0 : Math.max(0, cap - (held.get(rk)?.get(d) ?? 0));
          available = Math.min(available, free);
          const base = o?.price ?? (isWeekendNight(d) && r.weekendPrice > 0 ? r.weekendPrice : r.price);
          before.push(Math.round(base));
          nightly.push(Math.round(deal ? base * (1 - deal / 100) : base));
        }
        const total = nightly.reduce((a, b) => a + b, 0);
        list.push({
          roomId: rk,
          name: r.name,
          available: Number.isFinite(available) ? available : 0,
          nightly,
          nightlyBefore: before,
          total,
          totalBefore: before.reduce((a, b) => a + b, 0),
          perNight: Math.min(...nightly),
          closed,
          minNightsOk: nights.length >= (r.minNights || 1),
        });
      }
      out.set(String(h._id), list);
    }
    return out;
  }
}

function nextDay(d: string): string {
  return new Date(Date.parse(d + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
}
