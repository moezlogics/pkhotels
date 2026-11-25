'use client';

import { createContext, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, Globe2, Loader2, Plane, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CityPicker } from '@/components/ui/city-picker';
import { ImageField } from '@/components/media/image-field';
import { GalleryField } from '@/components/media/gallery-field';
import { PageHeader } from '@/components/dashboard';
import { cityApi, areaApi } from '@/lib/api';
import { AMENITIES, AMENITY_GROUPS } from '@/lib/hotel-amenities';
import { COUPLE_POLICIES, LANGUAGE_LABELS, PROPERTY_TYPES, hotelPath } from '@/lib/hotels';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { Loading, NoHotelYet, UpgradeHint, useManagedHotel } from '@/components/hotel-dashboard/use-managed-hotel';

const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> });
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-slate-100" /> });

const EMPTY = {
  name: '', propertyType: 'hotel', stars: 0, shortDescription: '', description: '', city: '', area: '', areaName: '', address: '',
  lat: undefined as number | undefined, lng: undefined as number | undefined, nearby: [] as { title: string; distance: string }[],
  coverImage: '', gallery: [] as string[], videoUrl: '', amenities: [] as string[], checkInTime: '14:00', checkOutTime: '12:00',
  idRequired: true, couplePolicy: 'couples_with_nikah', childrenAllowed: true, petsAllowed: false, smokingAllowed: false,
  cancellationPolicy: 'free', freeCancelHours: 24, policies: '', taxIncluded: true, taxPercent: 0, extraBedPrice: 0,
  faqs: [] as { q: string; a: string }[], phone: '', whatsapp: '', email: '', website: '', acceptsBookings: true, instantConfirm: false,
  responseHours: 12, advanceMode: 'none', advancePercent: 25,
  paymentAccounts: [] as { kind: string; title: string; accountName: string; accountNumber: string; iban?: string }[],
  dealText: '', dealPercent: 0, metaTitle: '', metaDescription: '',
  acceptsForeigners: '', foreignerRegistration: false, languages: ['ur'] as string[],
  airportName: '', airportKm: 0, airportPickup: false, airportPickupPrice: 0,
};
type Form = typeof EMPTY;

/* One section on screen at a time: a single long form scared owners off.
   New hotels walk through the first six as steps; the rest are extras. */
const SECTIONS = [
  ['basics', 'Basics'], ['location', 'Location'], ['photos', 'Photos'], ['amenities', 'Facilities'], ['rules', 'House rules'],
  ['contact', 'Contact'], ['booking', 'Booking & payment'], ['faqs', 'FAQs'], ['seo', 'Google listing'],
] as const;
type SectionId = (typeof SECTIONS)[number][0];
const NEW_STEPS: SectionId[] = ['basics', 'location', 'photos', 'amenities', 'rules', 'contact'];
const OPTIONAL: SectionId[] = ['booking', 'seo'];

const TabCtx = createContext<string>('basics');

function Card({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  const active = useContext(TabCtx);
  if (active !== id) return null;
  return (
    <section id={id} className="rounded-[24px] border border-[color:var(--border)] bg-white p-5 md:p-7">
      <h2 className="text-[24px] font-bold text-ink md:text-[28px]">{title}</h2>
      {hint && <p className="mt-1 text-[15px] text-neutral-500">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[14.5px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-neutral-500">{hint}</span>}
    </label>
  );
}

const select = 'h-11 w-full rounded-xl border border-input bg-white px-3 text-[15px]';

function Editor() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data, loading, reload, isAdmin, hotelId, withScope } = useManagedHotel();
  const [tab, setTab] = useState<SectionId>(() => {
    const t = sp?.get('tab');
    return (SECTIONS.find(([id]) => id === t)?.[0] ?? 'basics') as SectionId;
  });
  const [f, setF] = useState<Form>(EMPTY);
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ _id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const hotel = data?.hotel;
  const perks = data?.perks ?? {};
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    cityApi.getNames().then(setCities).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!hotel) return;
    const next: any = { ...EMPTY };
    for (const k of Object.keys(EMPTY)) if (hotel[k] !== undefined && hotel[k] !== null) next[k] = hotel[k];
    next.city = hotel.city ? String(hotel.city) : '';
    next.area = hotel.area ? String(hotel.area) : '';
    setF(next);
  }, [hotel]);
  useEffect(() => {
    if (!f.city) return setAreas([]);
    areaApi.getNames(f.city).then((rows: any[]) => setAreas(rows)).catch(() => setAreas([]));
  }, [f.city]);

  const cityName = useMemo(() => cities.find((c) => c._id === f.city)?.name ?? '', [cities, f.city]);

  if (loading) return <Loading />;
  if (!hotel && isAdmin && !hotelId) return <NoHotelYet isAdmin />;

  const save = async (submit = false) => {
    if (f.name.trim().length < 3) {
      setTab('basics');
      return toast.error('Please enter the hotel name.');
    }
    if (!f.city) {
      setTab('location');
      return toast.error('Please choose the city.');
    }
    setSaving(true);
    try {
      const body = { ...f, areaName: areas.find((a) => a._id === f.area)?.name ?? f.areaName };
      if (!hotel) {
        await hotelsApi.create(body);
        toast.success('Hotel saved. Now add your rooms.');
        router.push('/dashboard/rooms');
        return;
      }
      await hotelsApi.update(body, hotelId);
      if (submit) {
        const h = await hotelsApi.submit(hotelId);
        toast.success(h.status === 'approved' ? 'Your hotel is live!' : 'Sent for review — we usually approve within a few hours.');
      } else toast.success('Saved');
      await reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const status = hotel?.status as string | undefined;
  const photos = (f.coverImage ? 1 : 0) + f.gallery.length;
  const done: Record<SectionId, boolean> = {
    basics: f.name.trim().length >= 3 && !!f.shortDescription.trim(),
    location: !!f.city && !!f.address.trim() && typeof f.lat === 'number',
    photos: photos >= 5,
    amenities: f.amenities.length >= 5,
    rules: !!f.checkInTime && !!f.checkOutTime,
    contact: !!(f.phone || f.whatsapp),
    booking: true,
    faqs: f.faqs.length > 0,
    seo: true,
  };
  const order: SectionId[] = hotel ? SECTIONS.map(([id]) => id) : NEW_STEPS;
  const at = Math.max(0, order.indexOf(tab));
  const go = (id: SectionId) => {
    setTab(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-6xl pb-40 md:pb-28">
      <PageHeader
        title={hotel ? hotel.name : 'Add your hotel'}
        description={hotel ? 'Everything guests see on your hotel page.' : 'Start with the basics — you can add the rest later.'}
        actions={
          hotel?.slug && status === 'approved' ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={hotelPath(hotel.slug, hotel.citySlug)} target="_blank"><Eye className="h-4 w-4" /> View page</Link>
            </Button>
          ) : undefined
        }
      />

      {hotel && (
        <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm',
          status === 'approved' ? 'bg-emerald-50 text-emerald-800' : status === 'rejected' || status === 'suspended' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900')}>
          <span className="flex items-center gap-2">
            {status === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {status === 'approved' && 'Live on PakHotels.'}
            {status === 'pending' && 'Waiting for review — we will publish it shortly.'}
            {status === 'draft' && 'Draft — not visible to guests yet. Add rooms and photos, then publish.'}
            {status === 'rejected' && `Needs changes: ${hotel.rejectionReason || 'please check your details'}`}
            {status === 'suspended' && 'Suspended — contact support.'}
          </span>
          {(status === 'draft' || status === 'rejected') && (
            <Button size="sm" onClick={() => save(true)} disabled={saving} className="gap-1.5"><Send className="h-4 w-4" /> Publish</Button>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
      <nav aria-label="Hotel sections" className="no-scrollbar sticky top-14 z-20 -mx-3 mb-4 flex gap-2 overflow-x-auto bg-[#f7f5fc] px-3 py-2 lg:static lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:bg-transparent lg:p-0">
        {order.map((id, i) => {
          const label = SECTIONS.find(([k]) => k === id)![1];
          const on = tab === id;
          const tick = done[id] && !OPTIONAL.includes(id);
          return (
            <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'step' : undefined}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-[14.5px] font-semibold transition lg:w-full lg:rounded-[16px] lg:py-2',
                on ? 'border-ink bg-ink text-white' : 'border-[color:var(--border)] bg-white text-ink hover:border-ink')}>
              <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold', tick ? 'bg-highlight text-ink' : on ? 'bg-white/15 text-white' : 'bg-[#f7f5fc] text-ink')}>
                {tick ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      <TabCtx.Provider value={tab}>
      <div className="min-w-0 space-y-5">
        <Card id="basics" title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hotel name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Hotel One Gulberg" /></Field>
            <Field label="Property type">
              <select className={select} value={f.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                {PROPERTY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Star rating">
              <select className={select} value={f.stars} onChange={(e) => set('stars', Number(e.target.value))}>
                <option value={0}>Not rated</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} star</option>)}
              </select>
            </Field>
          </div>
          <Field label="Short description" hint="One or two lines shown in search results.">
            <Textarea rows={2} maxLength={300} value={f.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
          </Field>
          <Field label="About the hotel">
            <RichEditor value={f.description} onChange={(v) => set('description', v)} imageContext={f.name} minHeight="200px" />
          </Field>
        </Card>

        <Card id="location" title="Location">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <CityPicker options={cities.map((c) => ({ value: c._id, label: c.name }))} value={f.city} onChange={(v) => setF((x) => ({ ...x, city: v, area: '' }))} placeholder="Choose city" />
            </Field>
            <Field label="Area">
              <select className={select} value={f.area} onChange={(e) => set('area', e.target.value)} disabled={!areas.length}>
                <option value="">{areas.length ? 'Choose area' : 'No areas yet'}</option>
                {areas.map((a) => <option key={a._id} value={a._id} className="capitalize">{a.name}</option>)}
              </select>
            </Field>
            <Field label="Full address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, area, city" /></Field>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <MapPicker initialLat={f.lat} initialLng={f.lng} onLocationSelect={(lat, lng) => setF((x) => ({ ...x, lat, lng }))} addressQuery={f.address} city={cityName} />
          </div>
          <p className="text-xs text-slate-500">Drag the pin to your hotel&apos;s gate — guests use it for directions.</p>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">What&apos;s nearby</p>
            {f.nearby.map((n, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <Input value={n.title} placeholder="e.g. Liberty Market" onChange={(e) => set('nearby', f.nearby.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input className="w-28" value={n.distance} placeholder="1.2 km" onChange={(e) => set('nearby', f.nearby.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => set('nearby', f.nearby.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set('nearby', [...f.nearby, { title: '', distance: '' }])} className="gap-1"><Plus className="h-4 w-4" /> Add place</Button>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Plane className="h-4 w-4" /> Getting here from the airport</p>
            <p className="mt-0.5 text-xs text-slate-500">The first thing guests flying in look for.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Nearest airport"><Input value={f.airportName} onChange={(e) => set('airportName', e.target.value)} placeholder="e.g. Allama Iqbal International Airport" /></Field>
              <Field label="Distance (km)"><Input type="number" min={0} value={f.airportKm || ''} onChange={(e) => set('airportKm', Number(e.target.value))} /></Field>
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <span><b>Airport pickup</b><span className="block text-xs text-slate-500">You can collect guests from the airport.</span></span>
              <Switch checked={f.airportPickup} onCheckedChange={(v) => set('airportPickup', v)} />
            </label>
            {f.airportPickup && (
              <Field label="Pickup price per trip (Rs)" hint="0 = free" className="mt-3"><Input type="number" min={0} value={f.airportPickupPrice} onChange={(e) => set('airportPickupPrice', Number(e.target.value))} /></Field>
            )}
          </div>
        </Card>

        <Card id="photos" title="Photos" hint={`${photos} of ${perks.photos || 10} photos on your ${perks.plan || 'Free'} plan. The first impression is everything — bright, wide photos of rooms, bathroom, lobby and outside.`}>
          {perks.photos && photos > perks.photos && <UpgradeHint text={`Your plan allows ${perks.photos} photos.`} />}
          <ImageField label="Cover photo" value={f.coverImage} onChange={(u) => set('coverImage', u)} folder="hotels" context={f.name} aspect="wide" />
          <GalleryField label="More photos" value={f.gallery} onChange={(u) => set('gallery', u)} folder="hotels" context={f.name} max={Math.max(0, (perks.photos || 10) - 1)} />
          {perks.videoTour ? (
            <Field label="Video tour link (YouTube or MP4)"><Input value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://…" /></Field>
          ) : (
            <p className="text-xs text-slate-500">Video tours are part of the Premium plan.</p>
          )}
        </Card>

        <Card id="amenities" title="Facilities" hint="Tick everything guests can use. These power the search filters.">
          {(Object.keys(AMENITY_GROUPS) as (keyof typeof AMENITY_GROUPS)[]).map((g) => (
            <div key={g}>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">{AMENITY_GROUPS[g]}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AMENITIES.filter((a) => a.group === g).map((a) => {
                  const on = f.amenities.includes(a.key);
                  return (
                    <button key={a.key} type="button" onClick={() => set('amenities', on ? f.amenities.filter((x) => x !== a.key) : [...f.amenities, a.key])}
                      className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm', on ? 'border-ink bg-accent text-accent-foreground' : 'border-slate-200 text-slate-700')}>
                      <a.icon className="h-4 w-4 shrink-0" /> {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        <Card id="rules" title="House rules" hint="Shown before guests book — clear rules mean fewer arguments at the front desk.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check-in from"><Input type="time" value={f.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} /></Field>
            <Field label="Check-out until"><Input type="time" value={f.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} /></Field>
            <Field label="Couples policy" className="sm:col-span-2">
              <select className={select} value={f.couplePolicy} onChange={(e) => set('couplePolicy', e.target.value)}>
                {Object.entries(COUPLE_POLICIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <p className="rounded-xl bg-accent px-3 py-2.5 text-sm text-ink sm:col-span-2">
              <b>Cancellation:</b> guests can cancel online only until you confirm. Once you confirm, the room is theirs — any change goes through you by phone or WhatsApp.
            </p>
            <Field label="Extra mattress price per night (Rs)" hint="0 = not offered"><Input type="number" min={0} value={f.extraBedPrice} onChange={(e) => set('extraBedPrice', Number(e.target.value))} /></Field>
            <Field label="Tax">
              <div className="flex items-center gap-3">
                <select className={select} value={f.taxIncluded ? 'yes' : 'no'} onChange={(e) => set('taxIncluded', e.target.value === 'yes')}>
                  <option value="yes">Prices include tax</option>
                  <option value="no">Add tax on top</option>
                </select>
                {!f.taxIncluded && <Input className="w-24" type="number" min={0} max={30} value={f.taxPercent} onChange={(e) => set('taxPercent', Number(e.target.value))} placeholder="%" />}
              </div>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['idRequired', 'CNIC / passport required at check-in'], ['childrenAllowed', 'Children welcome'], ['petsAllowed', 'Pets allowed'], ['smokingAllowed', 'Smoking allowed in designated areas']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {label}
                <Switch checked={!!f[k]} onCheckedChange={(v) => set(k, v as never)} />
              </label>
            ))}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Globe2 className="h-4 w-4" /> Guests from abroad</p>
            <p className="mt-0.5 text-xs text-slate-500">Foreign passport holders need a hotel that may register them with the police. Guests see this before they book.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([['yes', 'Yes, we host foreigners'], ['no', 'No'], ['', 'Not sure']] as const).map(([v, label]) => (
                <button key={v || 'unset'} type="button" onClick={() => set('acceptsForeigners', v)} className={cn('rounded-xl border px-3 py-2 text-sm font-medium', f.acceptsForeigners === v ? 'border-primary bg-accent text-ink ring-1 ring-primary' : 'border-slate-200 bg-white text-slate-700')}>
                  {label}
                </button>
              ))}
            </div>
            {f.acceptsForeigners === 'yes' && (
              <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <span><b>We file the police registration (Form C)</b><span className="block text-xs text-slate-500">Guests don&apos;t have to do it themselves.</span></span>
                <Switch checked={f.foreignerRegistration} onCheckedChange={(v) => set('foreignerRegistration', v)} />
              </label>
            )}
            <p className="mb-2 mt-4 text-sm font-semibold text-slate-700">Languages your front desk speaks</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(LANGUAGE_LABELS).map(([k, label]) => {
                const on = f.languages.includes(k);
                return (
                  <button key={k} type="button" onClick={() => set('languages', on ? f.languages.filter((x) => x !== k) : [...f.languages, k])} className={cn('rounded-full border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700')}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Other rules / terms (optional)"><RichEditor value={f.policies} onChange={(v) => set('policies', v)} minHeight="120px" /></Field>
        </Card>

        <Card id="booking" title="Booking & payment">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <span><b>Accept online bookings</b><span className="block text-xs text-slate-500">Switch off for a while if you are full or closed.</span></span>
            <Switch checked={f.acceptsBookings} onCheckedChange={(v) => set('acceptsBookings', v)} />
          </label>
          <label className={cn('flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm', !perks.instantConfirm && 'opacity-60')}>
            <span><b>Instant confirmation</b><span className="block text-xs text-slate-500">Bookings confirm themselves — guests book more. Standard & Premium.</span></span>
            <Switch disabled={!perks.instantConfirm} checked={f.instantConfirm} onCheckedChange={(v) => set('instantConfirm', v)} />
          </label>
          <Field label="Reply to booking requests within (hours)" hint="Requests you don't answer in time expire, and the guest can book elsewhere.">
            <Input type="number" min={1} max={72} value={f.responseHours} onChange={(e) => set('responseHours', Number(e.target.value))} />
          </Field>
          {perks.advancePayments ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Advance payment">
                  <select className={select} value={f.advanceMode} onChange={(e) => set('advanceMode', e.target.value)}>
                    <option value="none">No advance — pay at hotel</option>
                    <option value="optional">Optional — guest chooses</option>
                    <option value="required">Required to confirm</option>
                  </select>
                </Field>
                {f.advanceMode !== 'none' && <Field label="Advance (% of total)"><Input type="number" min={5} max={100} value={f.advancePercent} onChange={(e) => set('advancePercent', Number(e.target.value))} /></Field>}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Your accounts for advances</p>
                {f.paymentAccounts.map((a, i) => (
                  <div key={i} className="mb-2 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[130px_1fr_1fr_auto]">
                    <select className={select} value={a.kind} onChange={(e) => set('paymentAccounts', f.paymentAccounts.map((x, j) => (j === i ? { ...x, kind: e.target.value, title: x.title || e.target.value } : x)))}>
                      <option value="bank">Bank</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option>
                    </select>
                    <Input placeholder="Account title" value={a.accountName} onChange={(e) => set('paymentAccounts', f.paymentAccounts.map((x, j) => (j === i ? { ...x, accountName: e.target.value } : x)))} />
                    <Input placeholder="Account / mobile number" value={a.accountNumber} onChange={(e) => set('paymentAccounts', f.paymentAccounts.map((x, j) => (j === i ? { ...x, accountNumber: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => set('paymentAccounts', f.paymentAccounts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    {a.kind === 'bank' && <Input className="sm:col-span-3" placeholder="Bank name and IBAN (optional)" value={a.iban || ''} onChange={(e) => set('paymentAccounts', f.paymentAccounts.map((x, j) => (j === i ? { ...x, iban: e.target.value, title: x.title } : x)))} />}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => set('paymentAccounts', [...f.paymentAccounts, { kind: 'jazzcash', title: 'JazzCash', accountName: '', accountNumber: '' }])}><Plus className="h-4 w-4" /> Add account</Button>
              </div>
            </>
          ) : (
            <UpgradeHint text="Take advances to your own bank / JazzCash / Easypaisa to stop no-shows — Standard & Premium." />
          )}
          {perks.deals ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Deal label"><Input value={f.dealText} onChange={(e) => set('dealText', e.target.value)} placeholder="e.g. Winter offer" /></Field>
              <Field label="Discount %"><Input type="number" min={0} max={70} value={f.dealPercent} onChange={(e) => set('dealPercent', Number(e.target.value))} /></Field>
            </div>
          ) : (
            <p className="text-xs text-slate-500">“Hot deal” discount badges are part of the Premium plan.</p>
          )}
        </Card>

        <Card id="contact" title="Contact" hint={perks.showContact ? 'Shown on your hotel page.' : 'Shared with guests after they book. Shown on your page on Standard & Premium.'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone (front desk)"><Input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0300 1234567" /></Field>
            <Field label="WhatsApp" hint="Guests message this number about their booking."><Input inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="0300 1234567" /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Website"><Input value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></Field>
          </div>
        </Card>

        <Card id="faqs" title="Frequently asked questions" hint="Answer what guests ask on WhatsApp — parking, breakfast, generator, couples…">
          {f.faqs.map((q, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <Input value={q.q} placeholder="Question" onChange={(e) => set('faqs', f.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => set('faqs', f.faqs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea rows={2} value={q.a} placeholder="Answer" onChange={(e) => set('faqs', f.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => set('faqs', [...f.faqs, { q: '', a: '' }])}><Plus className="h-4 w-4" /> Add question</Button>
        </Card>

        <Card id="seo" title="How you look on Google" hint="Optional. Leave empty and we write them for you.">
          <Field label="Page title"><Input maxLength={70} value={f.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} /></Field>
          <Field label="Meta description"><Textarea rows={2} maxLength={170} value={f.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></Field>
        </Card>
      </div>
      </TabCtx.Provider>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-[22px] border border-[color:var(--border)] bg-white p-2 shadow-[0_18px_40px_-20px_rgba(14,14,16,0.45)] md:inset-x-auto md:bottom-4 md:left-[calc(var(--sidebar-width,16rem)+1.5rem)] md:right-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => at > 0 && go(order[at - 1]!)} disabled={at === 0} aria-label="Previous section" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neutral-300 text-ink disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="hidden min-w-0 flex-1 truncate px-1 text-[14px] text-neutral-500 sm:block">
            {hotel ? SECTIONS.find(([k]) => k === tab)![1] : `Step ${at + 1} of ${order.length}`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {at < order.length - 1 && (
              <button type="button" onClick={() => go(order[at + 1]!)} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-[15px] font-semibold text-ink">
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {hotel && at === order.length - 1 && (
              <Link href={withScope('/dashboard/rooms')} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-[15px] font-semibold text-ink">Rooms <ArrowRight className="h-4 w-4" /></Link>
            )}
            {(hotel || at === order.length - 1) && (
              <button type="button" onClick={() => save(false)} disabled={saving} className="inline-flex h-11 min-w-24 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-white disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {hotel ? 'Save' : 'Save & add rooms'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotelEditorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Editor />
    </Suspense>
  );
}

