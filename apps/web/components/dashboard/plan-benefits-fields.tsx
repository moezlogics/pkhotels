"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * What a hotel plan unlocks — every field here is enforced by the API
 * (HotelPlanService, BookingService, BillingService), not just text on the
 * card. Commission is the hybrid model: Free pays per completed stay, paid
 * plans pay less or none.
 */

export interface PlanBenefits {
  verifiedBadge: boolean;
  autoPublish: boolean;
  highlight: boolean;
  showContact: boolean;
  advancePayments: boolean;
  rateCalendar: boolean;
  instantConfirm: boolean;
  featuredHotel: boolean;
  deals: boolean;
  videoTour: boolean;
  prioritySupport: boolean;
  commissionPercent: string;
  monthlyBookings: string;
  maxRoomTypes: string;
  placement: string;
  insights: string;
  /* Kept from the older agent plans so saving never wipes them. */
  spotlight: boolean;
  brandedProfile: boolean;
  socialLinks: boolean;
  profilePage: boolean;
  teamMembers: string;
}

export const EMPTY_BENEFITS: PlanBenefits = {
  verifiedBadge: false,
  autoPublish: false,
  highlight: false,
  showContact: false,
  advancePayments: false,
  rateCalendar: false,
  instantConfirm: false,
  featuredHotel: false,
  deals: false,
  videoTour: false,
  prioritySupport: false,
  commissionPercent: "10",
  monthlyBookings: "0",
  maxRoomTypes: "3",
  placement: "0",
  insights: "none",
  spotlight: false,
  brandedProfile: false,
  socialLinks: false,
  profilePage: true,
  teamMembers: "0",
};

export function benefitsFrom(pkg: Record<string, any>): PlanBenefits {
  const b = (k: string) => Boolean(pkg[k]);
  const n = (k: string, d: number) => String(Number.isFinite(Number(pkg[k])) ? Number(pkg[k]) : d);
  return {
    verifiedBadge: b("verifiedBadge"),
    autoPublish: b("autoPublish"),
    highlight: b("highlight"),
    showContact: b("showContact"),
    advancePayments: b("advancePayments"),
    rateCalendar: b("rateCalendar"),
    instantConfirm: b("instantConfirm"),
    featuredHotel: b("featuredHotel"),
    deals: b("deals"),
    videoTour: b("videoTour"),
    prioritySupport: b("prioritySupport"),
    commissionPercent: n("commissionPercent", 0),
    monthlyBookings: n("monthlyBookings", 0),
    maxRoomTypes: n("maxRoomTypes", 3),
    placement: n("placement", 0),
    insights: ["none", "basic", "full"].includes(pkg.insights) ? pkg.insights : "none",
    spotlight: b("spotlight"),
    brandedProfile: b("brandedProfile"),
    socialLinks: b("socialLinks"),
    profilePage: pkg.profilePage !== false,
    teamMembers: n("teamMembers", 0),
  };
}

const clampInt = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

export function benefitsDto(b: PlanBenefits) {
  return {
    ...b,
    commissionPercent: Math.max(0, Math.min(50, Number(b.commissionPercent) || 0)),
    monthlyBookings: clampInt(b.monthlyBookings, 0, 10000),
    maxRoomTypes: clampInt(b.maxRoomTypes, 0, 200),
    placement: clampInt(b.placement, 0, 2),
    teamMembers: clampInt(b.teamMembers, 0, 100),
  };
}

type Toggle = keyof Pick<PlanBenefits, "verifiedBadge" | "autoPublish" | "highlight" | "showContact" | "advancePayments" | "rateCalendar" | "instantConfirm" | "featuredHotel" | "deals" | "videoTour" | "prioritySupport">;

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: "showContact", label: "Hotel’s phone & WhatsApp", hint: "Shown on the hotel page. Off = guests can only book through PakHotels." },
  { key: "instantConfirm", label: "Instant confirmation", hint: "Bookings confirm themselves when the hotel switches it on." },
  { key: "advancePayments", label: "Advance payments", hint: "Guests send an advance to the hotel’s own account." },
  { key: "rateCalendar", label: "Seasonal prices & calendar", hint: "Per-date prices and closing dates." },
  { key: "verifiedBadge", label: "Verified badge", hint: "On the hotel page and cards." },
  { key: "featuredHotel", label: "Featured", hint: "Homepage rail and Featured tag (boosts do this per hotel too)." },
  { key: "deals", label: "Deals badge", hint: "“Hot deal” with the hotel’s discount." },
  { key: "videoTour", label: "Video tour", hint: "Video on the hotel page." },
  { key: "autoPublish", label: "Instant publishing", hint: "Hotel edits go live without review." },
  { key: "prioritySupport", label: "Priority support", hint: "Shown on the plan card." },
  { key: "highlight", label: "“Most popular” ribbon", hint: "Highlights this card on the pricing pages." },
];

function NumberRow({ label, hint, value, onChange, suffix, max }: { label: string; hint: string; value: string; onChange: (v: string) => void; suffix?: string; max: number }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Input type="number" min={0} max={max} className="w-20" value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

export function PlanBenefitsFields({ value, onChange }: { value: PlanBenefits; onChange: (v: PlanBenefits) => void }) {
  const set = (patch: Partial<PlanBenefits>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-semibold">What this plan gives a hotel</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberRow label="Commission on completed stays" hint="Billed monthly on PakHotels bookings that end in a stay. 0 = none." value={value.commissionPercent} onChange={(v) => set({ commissionPercent: v })} suffix="%" max={50} />
        <NumberRow label="Online bookings a month" hint="0 = unlimited. Ignored when the plan has a commission." value={value.monthlyBookings} onChange={(v) => set({ monthlyBookings: v })} max={10000} />
        <NumberRow label="Room types" hint="0 = unlimited." value={value.maxRoomTypes} onChange={(v) => set({ maxRoomTypes: v })} max={200} />
        <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Placement in search</span>
            <span className="block text-xs text-muted-foreground">Order within a city (boosts go above all).</span>
          </span>
          <select className="h-9 rounded-md border bg-white px-2 text-sm" value={value.placement} onChange={(e) => set({ placement: e.target.value })}>
            <option value="0">Standard</option>
            <option value="1">Above Free</option>
            <option value="2">Top</option>
          </select>
        </label>
        <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Insights</span>
            <span className="block text-xs text-muted-foreground">Views and bookings reports.</span>
          </span>
          <select className="h-9 rounded-md border bg-white px-2 text-sm" value={value.insights} onChange={(e) => set({ insights: e.target.value })}>
            <option value="none">None</option>
            <option value="basic">Basic</option>
            <option value="full">Full</option>
          </select>
        </label>
        {TOGGLES.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 hover:bg-slate-50">
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <Switch checked={value[key]} onCheckedChange={(v) => set({ [key]: v } as Partial<PlanBenefits>)} />
          </label>
        ))}
      </div>
    </div>
  );
}
