import {
  Wifi, Car, Snowflake, Coffee, UtensilsCrossed, BellRing, Clock, Zap, Droplets, Flame, ArrowUpDown, Users, CigaretteOff,
  ShieldCheck, Plane, Shirt, Waves, Dumbbell, Sparkles, Presentation, Moon, Beef, Baby, Trees, Tv, Wine, CupSoda, Bath,
  ShowerHead, Archive, KeyRound, MapPinned, Accessibility, Stethoscope, Mountain, Building2, Tent, Briefcase, Trophy,
  FireExtinguisher, Bus, Sun, type LucideIcon,
} from 'lucide-react';

export interface Amenity {
  key: string;
  label: string;
  icon: LucideIcon;
  group: 'popular' | 'pakistan' | 'room' | 'services' | 'leisure' | 'views';
  /** Shown as a search filter. */
  filter?: boolean;
}

/**
 * Every amenity a hotel can tick. Keys are stored on Hotel.amenities and must
 * not change (scripts/import-wordpress.js maps WordPress features onto them).
 * The "pakistan" group is what guests here actually ask about on WhatsApp.
 */
export const AMENITIES: Amenity[] = [
  { key: 'wifi', label: 'Free WiFi', icon: Wifi, group: 'popular', filter: true },
  { key: 'parking', label: 'Free parking', icon: Car, group: 'popular', filter: true },
  { key: 'ac', label: 'Air conditioning', icon: Snowflake, group: 'popular', filter: true },
  { key: 'breakfast', label: 'Breakfast available', icon: Coffee, group: 'popular', filter: true },
  { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, group: 'popular', filter: true },
  { key: 'room_service', label: 'Room service', icon: BellRing, group: 'popular' },
  { key: 'front_desk_24', label: '24-hour front desk', icon: Clock, group: 'popular' },
  { key: 'family_rooms', label: 'Family rooms', icon: Users, group: 'popular', filter: true },

  { key: 'generator', label: 'Generator / UPS backup', icon: Zap, group: 'pakistan', filter: true },
  { key: 'hot_water', label: 'Hot water (geyser)', icon: Droplets, group: 'pakistan', filter: true },
  { key: 'heating', label: 'Room heater', icon: Flame, group: 'pakistan', filter: true },
  { key: 'halal', label: 'Halal food', icon: Beef, group: 'pakistan' },
  { key: 'prayer_area', label: 'Prayer area', icon: Moon, group: 'pakistan', filter: true },
  { key: 'security_24', label: '24-hour security / CCTV', icon: ShieldCheck, group: 'pakistan', filter: true },
  { key: 'family_hall', label: 'Family hall / dining', icon: Users, group: 'pakistan' },
  { key: 'jeep', label: 'Jeep / transport service', icon: Bus, group: 'pakistan' },
  { key: 'bonfire', label: 'Bonfire / fireplace', icon: Tent, group: 'pakistan' },

  { key: 'tv', label: 'Flat-screen TV', icon: Tv, group: 'room' },
  { key: 'minibar', label: 'Minibar', icon: Wine, group: 'room' },
  { key: 'kettle', label: 'Tea / coffee maker', icon: CupSoda, group: 'room' },
  { key: 'private_bathroom', label: 'Private bathroom', icon: ShowerHead, group: 'room' },
  { key: 'bathtub', label: 'Bathtub', icon: Bath, group: 'room' },
  { key: 'toiletries', label: 'Free toiletries & towels', icon: Sparkles, group: 'room' },
  { key: 'wardrobe', label: 'Wardrobe', icon: Archive, group: 'room' },
  { key: 'non_smoking', label: 'Non-smoking rooms', icon: CigaretteOff, group: 'room' },

  { key: 'elevator', label: 'Lift / elevator', icon: ArrowUpDown, group: 'services', filter: true },
  { key: 'airport_shuttle', label: 'Airport pick & drop', icon: Plane, group: 'services', filter: true },
  { key: 'laundry', label: 'Laundry', icon: Shirt, group: 'services' },
  { key: 'meeting_rooms', label: 'Meeting / banquet hall', icon: Presentation, group: 'services' },
  { key: 'business_centre', label: 'Business centre', icon: Briefcase, group: 'services' },
  { key: 'car_rental', label: 'Car rental', icon: KeyRound, group: 'services' },
  { key: 'tour_desk', label: 'Tour desk / guide', icon: MapPinned, group: 'services' },
  { key: 'wheelchair', label: 'Wheelchair accessible', icon: Accessibility, group: 'services' },
  { key: 'doctor_on_call', label: 'Doctor on call', icon: Stethoscope, group: 'services' },
  { key: 'fire_safety', label: 'Fire safety', icon: FireExtinguisher, group: 'services' },

  { key: 'pool', label: 'Swimming pool', icon: Waves, group: 'leisure', filter: true },
  { key: 'gym', label: 'Gym', icon: Dumbbell, group: 'leisure', filter: true },
  { key: 'spa', label: 'Spa', icon: Sparkles, group: 'leisure' },
  { key: 'garden', label: 'Garden / terrace', icon: Trees, group: 'leisure' },
  { key: 'bbq', label: 'BBQ', icon: Flame, group: 'leisure' },
  { key: 'kids_friendly', label: 'Kids play area', icon: Baby, group: 'leisure' },
  { key: 'sports', label: 'Sports facilities', icon: Trophy, group: 'leisure' },

  { key: 'mountain_view', label: 'Mountain view', icon: Mountain, group: 'views' },
  { key: 'lake_view', label: 'River / lake view', icon: Waves, group: 'views' },
  { key: 'city_view', label: 'City view', icon: Building2, group: 'views' },
  { key: 'sun_terrace', label: 'Sun terrace', icon: Sun, group: 'views' },
];

export const AMENITY_GROUPS: Record<Amenity['group'], string> = {
  popular: 'Most popular',
  pakistan: 'Good to know in Pakistan',
  room: 'In the room',
  services: 'Services',
  leisure: 'Leisure',
  views: 'Views',
};

const BY_KEY = new Map(AMENITIES.map((a) => [a.key, a]));
export const amenity = (key: string) => BY_KEY.get(key);
export const FILTER_AMENITIES = AMENITIES.filter((a) => a.filter);
