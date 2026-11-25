'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Coffee, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { GalleryField } from '@/components/media/gallery-field';
import { ConfirmDialog, PageHeader, useConfirm } from "@/components/dashboard";
import { photo } from '@/lib/img';
import { AMENITIES } from '@/lib/hotel-amenities';
import { pkr } from '@/lib/hotels';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { Loading, NoHotelYet, UpgradeHint, useManagedHotel } from '@/components/hotel-dashboard/use-managed-hotel';

const ROOM_AMENITIES = AMENITIES.filter((a) => ['room', 'popular', 'pakistan', 'views'].includes(a.group)).filter((a) =>
  ['wifi', 'ac', 'tv', 'minibar', 'kettle', 'private_bathroom', 'bathtub', 'toiletries', 'wardrobe', 'non_smoking', 'hot_water', 'heating', 'mountain_view', 'lake_view', 'city_view'].includes(a.key),
);

const BLANK = {
  name: '', description: '', bedType: '', beds: 1, maxAdults: 2, maxChildren: 1, size: 0, price: 0, weekendPrice: 0, originalPrice: 0,
  quantity: 5, breakfastIncluded: false, refundable: true, amenities: [] as string[], images: [] as string[], minNights: 1, isActive: true,
};
type RoomForm = typeof BLANK & { _id?: string };

const PRESETS = ['Standard Double Room', 'Deluxe Double Room', 'Deluxe Twin Room', 'Executive Room', 'Family Room', 'Junior Suite', 'Executive Suite'];

function Rooms() {
  const { data, loading, reload, isAdmin, hotelId, withScope } = useManagedHotel();
  const [edit, setEdit] = useState<RoomForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  if (loading) return <Loading />;
  if (!data?.hotel) return <NoHotelYet isAdmin={isAdmin} />;
  const rooms = data.rooms;
  const perks = data.perks;
  const atLimit = perks.maxRoomTypes > 0 && rooms.length >= perks.maxRoomTypes;

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error('Please enter the room name.');
    if (!(edit.price > 0)) return toast.error('Please enter the price per night.');
    setSaving(true);
    try {
      const { _id, ...body } = edit;
      if (_id) await hotelsApi.updateRoom(_id, body, hotelId);
      else await hotelsApi.addRoom(body, hotelId);
      toast.success('Room saved');
      setEdit(null);
      await reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof RoomForm>(k: K, v: RoomForm[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));

  return (
    <div className="mx-auto max-w-5xl">
      <ConfirmDialog {...dialogProps} />
      <PageHeader
        title="Rooms"
        description={`Your room types, their prices and how many of each you have. ${perks.maxRoomTypes ? `${rooms.length} of ${perks.maxRoomTypes} on your ${perks.plan} plan.` : ''}`}
        actions={
          <Button onClick={() => setEdit({ ...BLANK })} disabled={atLimit} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add room type
          </Button>
        }
      />
      {atLimit && <div className="mb-4"><UpgradeHint text={`Your ${perks.plan} plan allows ${perks.maxRoomTypes} room types.`} /></div>}
      {data.hotel.status === 'draft' && rooms.length > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Rooms added. <Link href={withScope('/dashboard/hotel')} className="font-bold underline">Publish your hotel</Link> when your photos are in.
        </p>
      )}

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <BedDouble className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Add your first room type</p>
          <p className="mt-1 text-sm text-slate-500">For example “Deluxe Double Room — 8 rooms — Rs 9,500 a night”.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PRESETS.slice(0, 4).map((p) => (
              <button key={p} type="button" onClick={() => setEdit({ ...BLANK, name: p })} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm hover:border-ink">{p}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {rooms.map((r: any) => (
            <div key={r._id} className={cn('flex flex-col gap-4 rounded-[22px] border bg-white p-3 sm:flex-row sm:items-center sm:p-4', r.isActive ? 'border-[color:var(--border)]' : 'border-dashed border-slate-300 opacity-70')}>
              <div className="h-40 w-full shrink-0 overflow-hidden rounded-[16px] bg-slate-100 sm:h-24 sm:w-36">
                {(r.images?.[0] || data.hotel.coverImage) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo(r.images?.[0] || data.hotel.coverImage, 384)} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[19px] font-bold text-ink">{r.name} {!r.isActive && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Off</span>}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4 text-slate-400" /> {r.maxAdults} adults{r.maxChildren ? ` + ${r.maxChildren}` : ''}</span>
                  <span className="inline-flex items-center gap-1"><BedDouble className="h-4 w-4 text-slate-400" /> {r.quantity} room{r.quantity === 1 ? '' : 's'}</span>
                  {r.breakfastIncluded && <span className="inline-flex items-center gap-1 text-emerald-700"><Coffee className="h-4 w-4" /> Breakfast</span>}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:text-right">
                <div>
                  <p className="font-display text-[22px] font-bold text-ink">{pkr(r.price)}</p>
                  <p className="text-xs text-slate-500">per night{r.weekendPrice ? ` · weekends ${pkr(r.weekendPrice)}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" aria-label="Edit" onClick={() => setEdit({ ...BLANK, ...r, _id: r._id })}><Pencil className="h-4 w-4" /></Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Delete"
                    onClick={() =>
                      confirm({
                        title: `Delete ${r.name}?`,
                        description: 'Its calendar prices are deleted too. Rooms with upcoming bookings cannot be deleted — switch them off instead.',
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: async () => {
                          try {
                            await hotelsApi.deleteRoom(r._id, hotelId);
                            toast.success('Deleted');
                            await reload();
                          } catch (e) {
                            toast.error(apiError(e));
                          }
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetTitle className="font-display text-[24px] font-bold">{edit?._id ? 'Edit room type' : 'Add room type'}</SheetTitle>
          {edit && (
            <div className="mt-4 space-y-4 pb-24">
              <label className="block">
                <span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Room name</span>
                <Input list="room-presets" value={edit.name} onChange={(e) => set('name', e.target.value)} placeholder="Deluxe Double Room" />
                <datalist id="room-presets">{PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Price per night (Rs)</span><Input type="number" min={0} value={edit.price || ''} onChange={(e) => set('price', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Weekend price</span><Input type="number" min={0} value={edit.weekendPrice || ''} placeholder="Same" onChange={(e) => set('weekendPrice', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">How many rooms?</span><Input type="number" min={1} value={edit.quantity} onChange={(e) => set('quantity', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">“Was” price (optional)</span><Input type="number" min={0} value={edit.originalPrice || ''} onChange={(e) => set('originalPrice', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Max adults</span><Input type="number" min={1} max={20} value={edit.maxAdults} onChange={(e) => set('maxAdults', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Max children</span><Input type="number" min={0} max={10} value={edit.maxChildren} onChange={(e) => set('maxChildren', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Beds</span><Input value={edit.bedType} placeholder="1 King bed" onChange={(e) => set('bedType', e.target.value)} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Size (sq ft)</span><Input type="number" min={0} value={edit.size || ''} onChange={(e) => set('size', Number(e.target.value))} /></label>
                <label><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Minimum nights</span><Input type="number" min={1} max={30} value={edit.minNights} onChange={(e) => set('minNights', Number(e.target.value))} /></label>
              </div>
              <p className="text-xs text-slate-500">Weekend price applies to Friday and Saturday nights. Set Eid or season prices in Calendar & Prices.</p>
              <div className="grid gap-2">
                {([['breakfastIncluded', 'Breakfast included'], ['refundable', 'Guests can cancel this room'], ['isActive', 'Available for booking']] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{l}<Switch checked={!!edit[k]} onCheckedChange={(v) => set(k, v)} /></label>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">In the room</p>
                <div className="flex flex-wrap gap-2">
                  {ROOM_AMENITIES.map((a) => {
                    const on = edit.amenities.includes(a.key);
                    return (
                      <button key={a.key} type="button" onClick={() => set('amenities', on ? edit.amenities.filter((x) => x !== a.key) : [...edit.amenities, a.key])} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm', on ? 'border-ink bg-accent' : 'border-slate-200')}>
                        <a.icon className="h-3.5 w-3.5" /> {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block"><span className="mb-1.5 block text-[14.5px] font-semibold text-ink">Description (optional)</span><Textarea rows={3} value={edit.description} onChange={(e) => set('description', e.target.value)} /></label>
              <GalleryField label="Room photos" value={edit.images} onChange={(u) => set('images', u)} folder="rooms" context={`${edit.name} ${data.hotel.name}`} max={12} />
              <div className="fixed bottom-0 right-0 w-full border-t border-slate-200 bg-white p-3 sm:max-w-xl">
                <Button className="h-12 w-full gap-2 text-[16px]" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save room</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Rooms />
    </Suspense>
  );
}
