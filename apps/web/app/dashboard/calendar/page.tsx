'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/dashboard';
import { addDays, pkr, todayPk } from '@/lib/hotels';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { Loading, NoHotelYet, UpgradeHint, useManagedHotel } from '@/components/hotel-dashboard/use-managed-hotel';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = 21;

function CalendarScreen() {
  const { data, loading, isAdmin, hotelId } = useManagedHotel();
  const [from, setFrom] = useState(todayPk());
  const [cal, setCal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ roomIds: [] as string[], from: todayPk(), to: addDays(todayPk(), 6), action: 'price', price: '', available: '', weekdays: [] as number[] });

  const load = useCallback(async () => {
    try {
      setCal(await hotelsApi.calendar(from, DAYS, hotelId));
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [from, hotelId]);

  useEffect(() => {
    if (data?.hotel) void load();
  }, [data?.hotel, load]);
  useEffect(() => {
    if (data?.rooms?.length && !form.roomIds.length) setForm((f) => ({ ...f, roomIds: data.rooms.map((r: any) => r._id) }));
  }, [data?.rooms, form.roomIds.length]);

  if (loading) return <Loading />;
  if (!data?.hotel) return <NoHotelYet isAdmin={isAdmin} />;
  const perks = data.perks;

  const apply = async () => {
    const body: any = { roomIds: form.roomIds, from: form.from, to: form.to, weekdays: form.weekdays };
    if (form.action === 'price') {
      if (!(Number(form.price) > 0)) return toast.error('Enter the price per night.');
      body.price = Number(form.price);
    } else if (form.action === 'available') body.available = Number(form.available) || 0;
    else if (form.action === 'close') body.closed = true;
    else if (form.action === 'open') body.closed = false;
    else body.clear = true;
    setBusy(true);
    try {
      const r = await hotelsApi.setRates(body, hotelId);
      toast.success(`Updated ${r.updated} room-nights`);
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Calendar & prices" description="Rooms left each night, with your bookings taken off. Set Eid, summer or weekend prices, or close dates when you're full offline." />
      {!perks.rateCalendar && <div className="mb-4"><UpgradeHint text="Seasonal prices need Standard or Premium. On Free you can still close dates when you are full." /></div>}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 font-bold text-slate-900">Change several nights at once</p>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Rooms</p>
            <div className="flex flex-wrap gap-1.5">
              {data.rooms.map((r: any) => {
                const on = form.roomIds.includes(r._id);
                return (
                  <button key={r._id} type="button" onClick={() => setForm({ ...form, roomIds: on ? form.roomIds.filter((x) => x !== r._id) : [...form.roomIds, r._id] })} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-ink bg-accent' : 'border-slate-200')}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700">From</span><Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
          <label><span className="mb-1 block text-sm font-semibold text-slate-700">To (night of)</span><Input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-slate-500">Only on:</span>
          {WD.map((d, i) => {
            const on = form.weekdays.includes(i);
            return (
              <button key={d} type="button" onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((x) => x !== i) : [...form.weekdays, i] })} className={cn('rounded-md border px-2 py-0.5', on ? 'border-ink bg-accent' : 'border-slate-200')}>
                {d}
              </button>
            );
          })}
          <span className="text-xs text-slate-400">(none = every night)</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="h-10 rounded-md border border-input bg-white px-3 text-sm">
            <option value="price" disabled={!perks.rateCalendar}>Set price per night</option>
            <option value="available" disabled={!perks.rateCalendar}>Set rooms on sale</option>
            <option value="close">Close (sold out)</option>
            <option value="open">Re-open</option>
            <option value="clear">Back to normal price & rooms</option>
          </select>
          {form.action === 'price' && <Input className="w-36" type="number" placeholder="Rs per night" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />}
          {form.action === 'available' && <Input className="w-28" type="number" placeholder="Rooms" value={form.available} onChange={(e) => setForm({ ...form, available: e.target.value })} />}
          <Button onClick={apply} disabled={busy || !form.roomIds.length}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply</Button>
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setFrom(addDays(from, -DAYS) < todayPk() ? todayPk() : addDays(from, -DAYS))} disabled={from <= todayPk()}><ChevronLeft className="h-4 w-4" /></Button>
        <p className="text-sm font-semibold text-slate-700">{cal ? `${new Date(from + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(addDays(from, DAYS - 1) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}</p>
        <Button variant="outline" size="sm" onClick={() => setFrom(addDays(from, DAYS))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {!cal ? <Loading /> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-40 border-b border-r border-slate-200 bg-slate-50 p-2 text-left font-semibold text-slate-600">Room</th>
                {cal.nights.map((d: string) => {
                  const wd = new Date(d + 'T00:00:00Z').getUTCDay();
                  return (
                    <th key={d} className={cn('min-w-16 border-b border-slate-200 p-1.5 text-center font-medium', wd === 5 || wd === 6 ? 'bg-amber-50' : 'bg-slate-50')}>
                      <span className="block text-slate-400">{WD[wd]}</span>
                      <span className="block text-slate-800">{Number(d.slice(8))}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {cal.rooms.map((r: any) => (
                <tr key={r._id}>
                  <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2">
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="text-slate-500">{r.quantity} rooms · {pkr(r.price)}</p>
                  </td>
                  {r.cells.map((c: any) => (
                    <td key={c.date} className={cn('border-b border-slate-100 p-1 text-center', c.closed ? 'bg-rose-50' : c.left === 0 ? 'bg-slate-100' : '')}>
                      <span className={cn('block font-bold', c.closed ? 'text-rose-600' : c.left === 0 ? 'text-slate-400' : c.left <= 2 ? 'text-amber-600' : 'text-emerald-700')}>{c.closed ? 'Closed' : `${c.left} left`}</span>
                      {c.booked > 0 && <span className="block text-[10px] text-slate-500">{c.booked} booked</span>}
                      {c.price != null && <span className="block text-[10px] font-semibold text-ink">{(c.price / 1000).toFixed(c.price % 1000 ? 1 : 0)}k</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">Amber columns are Friday and Saturday nights (weekend price). Blue “k” figures are special prices you set.</p>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CalendarScreen />
    </Suspense>
  );
}
