import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package, PackageDocument } from '@pakhotels/db/schemas/package.schema';
import { CreatePackageDto, UpdatePackageDto } from '@pakhotels/types/package';
import { RevalidateService } from '../revalidate/revalidate.service';
import { AgencyService } from '../agency/agency.service';


/** The PakHotels plan ladder — one hotel per account; plans add benefits, never more hotels. */
export const HOTEL_PLANS = [
  {
    name: 'Free',
    description: 'List your hotel free and pay only when a guest stays — 10% of completed bookings, billed monthly.',
    price: 0, duration: 30, propertyLimit: 1, featuredListings: 0, photosPerProperty: 10, commissionPercent: 10,
    maxRoomTypes: 3, monthlyBookings: 0, showContact: false, advancePayments: false, rateCalendar: false,
    instantConfirm: false, featuredHotel: false, deals: false, videoTour: false, insights: 'none', placement: 0,
    verifiedBadge: false, autoPublish: false, highlight: false, prioritySupport: false, isActive: true,
    features: ['No monthly fee', 'Unlimited booking requests', '1 hotel, up to 3 room types, 10 photos', 'Guest phone & WhatsApp with every booking', '10% only on completed stays, billed monthly'],
  },
  {
    name: 'Standard',
    description: 'Your own phone on the listing, instant confirmation and half the commission.',
    price: 3999, duration: 30, propertyLimit: 1, featuredListings: 0, photosPerProperty: 30, commissionPercent: 5,
    maxRoomTypes: 10, monthlyBookings: 0, showContact: true, advancePayments: true, rateCalendar: true,
    instantConfirm: true, featuredHotel: false, deals: false, videoTour: false, insights: 'basic', placement: 1,
    verifiedBadge: true, autoPublish: true, highlight: true, prioritySupport: false, isActive: true,
    features: ['Unlimited booking requests', 'Up to 10 room types, 30 photos', 'Your phone & WhatsApp on the listing', 'Advance payments to your own bank/JazzCash/Easypaisa', 'Seasonal prices & availability calendar', 'Instant confirmation', 'Verified badge, listed above Free hotels', 'Only 5% on completed stays'],
  },
  {
    name: 'Premium',
    description: 'Top of your city, on the homepage, with deals and full insights.',
    price: 9999, duration: 30, propertyLimit: 1, featuredListings: 1, photosPerProperty: 60, commissionPercent: 0,
    maxRoomTypes: 0, monthlyBookings: 0, showContact: true, advancePayments: true, rateCalendar: true,
    instantConfirm: true, featuredHotel: true, deals: true, videoTour: true, insights: 'full', placement: 2,
    verifiedBadge: true, autoPublish: true, highlight: false, prioritySupport: true, isActive: true,
    features: ['Everything in Standard', 'Featured at the top of city & search pages', 'Featured on the homepage', '"Hot deal" discount badge', 'Unlimited room types, 60 photos + video tour', 'Full booking & views insights', 'Priority support', '0% commission — every booking is yours'],
  },
];

@Injectable()
export class PackageService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
    private readonly revalidate: RevalidateService,
    private readonly agency: AgencyService,
  ) {}

  /** Plans show on the homepage and /packages, and decide who is verified. */
  private changed() {
    void this.revalidate.revalidate({ tags: ['packages'], paths: ['/', '/packages'] });
    void this.agency.refreshVerified();
  }

  async create(dto: CreatePackageDto): Promise<PackageDocument> {
    const packageDoc = await new this.packageModel(dto).save();
    this.changed();
    return packageDoc;
  }

  async findAll(): Promise<PackageDocument[]> {
    return this.packageModel.find({ isActive: true }).sort({ price: 1 }).exec();
  }

  async findAllIncludingInactive(): Promise<PackageDocument[]> {
    return this.packageModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<PackageDocument> {
    const packageDoc = await this.packageModel.findById(id).exec();
    if (!packageDoc) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    return packageDoc;
  }

  async update(id: string, dto: UpdatePackageDto): Promise<PackageDocument> {
    const packageDoc = await this.packageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!packageDoc) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    this.changed();
    return packageDoc;
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.packageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    this.changed();
    return {
      success: true,
      message: 'Package deleted successfully',
    };
  }

  async seedHotelPlans(): Promise<PackageDocument[]> {
    const out: PackageDocument[] = [];
    for (const plan of HOTEL_PLANS) {
      const doc = await this.packageModel.findOneAndUpdate({ name: plan.name }, { $set: plan }, { new: true, upsert: true }).exec();
      out.push(doc);
    }
    this.changed();
    return out;
  }
}
