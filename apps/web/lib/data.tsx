/** A listing as the cards and detail pages show it. */
export interface Property {
  id: string;
  name: string;
  slug: string;
  type: 'House' | 'Upper Portion' | 'Lower Portion' | 'Flat' | 'Apartment' | 'Room' | 'Hostel' | 'Shop' | 'Office' | 'Warehouse' | 'Commercial';
  city: string;
  citySlug?: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  areaSlug?: string;
  marla?: number;
  kanal?: number;
  marlaSqft?: number;
  /** Always 'rent' — PakHotels lists rentals only. */
  purpose: 'rent';
  image: string;
  featured?: boolean;
  description?: string;
  features?: string[];
  areaId?: string; // Area ObjectId
  areaName?: string; // Area name
  longitude?: number;
  latitude?: number;
  whatsappNumber?: string;
  contactNumber?: string;
  /** Real photos on the listing — cover plus gallery. */
  photoCount?: number;
  postedAt?: string;
  /** Admin-pinned: shows a badge and sorts above the rest. */
  isFeatured?: boolean;
  /** Posted by a verified agency or one of its agents. */
  ownerVerified?: boolean;
  /** 'rented' puts a badge on the card and hides the phone number. */
  availability?: 'available' | 'rented';
  videoUrl?: string | null;
  videoPosterUrl?: string | null;
  isVideoThumbnail?: boolean;
}
