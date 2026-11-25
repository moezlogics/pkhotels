'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, BedDouble, CalendarRange, CalendarCheck, ExternalLink, Loader2, Pencil, Plus, Search, Star, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog, PageHeader, useConfirm } from '@/components/dashboard';
import { cityApi } from '@/lib/api';
import { photo } from '@/lib/img';
import { hotelPath, pkr } from '@/lib/hotels';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

const STATUSES = ['all', 'pending', 'approved', 'draft', 'rejected', 'suspended'];

export default function AdminHotels() {
  const [status, setStatus] = useState('all');
  const [claimed, setClaimed] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<any>(null);
  const [add, setAdd] = useState(false);
  const [owner, setOwner] = useState<any>(null);
  const [ownerId, setOwnerId] = useState('');
  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setRes(await hotelsApi.adminList({ status, claimed: claimed || undefined, q: q || undefined, page }));
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [status, claimed, q, page]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const patch = async (id: string, body: any, msg = 'Saved') => {
    try {
      await hotelsApi.adminSet(id, body);
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ConfirmDialog {...dialogProps} />
      <PageHeader title="All hotels" description="Approve new hotels, feature the best, assign owners, and manage unclaimed listings yourself." actions={<Button onClick={() => setAdd(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add unclaimed hotel</Button>} />
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => { setStatus(s); setPage(1); }} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium capitalize', status === s ? 'bg-primary text-primary-foreground' : 'bg-white ring-1 ring-slate-200')}>
            {s}{res?.counts?.[s] ? ` (${res.counts[s]})` : ''}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Hotel name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={claimed} onChange={(e) => { setClaimed(e.target.value); setPage(1); }}>
          <option value="">Claimed & unclaimed</option>
          <option value="yes">Has owner</option>
          <option value="no">Unclaimed</option>
        </select>
      </div>

      {!res ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {res.items.map((h: any) => (
            <div key={h._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {h.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo(h.coverImage, 160)} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold text-slate-900">
                    {h.name} {(h.verified || h.perks?.verified) && <BadgeCheck className="h-4 w-4 text-ink" />}
                    {(h.featured || h.perks?.featured) && <Star className="h-4 w-4 fill-gold text-gold" />}
                  </p>
                  <p className="text-xs text-slate-500">
                    {h.cityName} · {h.roomTypes} room types · from {pkr(h.minPrice)} · {h.views} views · {h.bookingsCount} bookings
                  </p>
                  <p className="text-xs">
                    <span className={cn('rounded px-1.5 py-0.5 font-semibold capitalize', h.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : h.status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600')}>{h.status}</span>{' '}
                    {h.owner ? <span className="text-slate-600">Owner: {h.owner.name || h.owner.email} · {h.perks?.plan}</span> : <span className="text-amber-700">Unclaimed — bookings come to you</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {h.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => patch(h._id, { status: 'approved' }, 'Approved — live now')}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => { const r = window.prompt('What needs changing?'); if (r !== null) void patch(h._id, { status: 'rejected', rejectionReason: r }, 'Sent back'); }}>Reject</Button>
                  </>
                )}
                <Button size="sm" variant="outline" title="Edit" asChild><Link href={`/dashboard/hotel?hotelId=${h._id}`}><Pencil className="h-4 w-4" /></Link></Button>
                <Button size="sm" variant="outline" title="Rooms" asChild><Link href={`/dashboard/rooms?hotelId=${h._id}`}><BedDouble className="h-4 w-4" /></Link></Button>
                <Button size="sm" variant="outline" title="Calendar" asChild><Link href={`/dashboard/calendar?hotelId=${h._id}`}><CalendarRange className="h-4 w-4" /></Link></Button>
                <Button size="sm" variant="outline" title="Bookings" asChild><Link href={`/dashboard/bookings?hotelId=${h._id}`}><CalendarCheck className="h-4 w-4" /></Link></Button>
                <Button size="sm" variant="outline" title={h.featured ? 'Unfeature' : 'Feature'} onClick={() => patch(h._id, { featured: !h.featured }, h.featured ? 'No longer featured' : 'Featured')}><Star className={cn('h-4 w-4', h.featured && 'fill-gold text-gold')} /></Button>
                <Button size="sm" variant="outline" title={h.verified ? 'Remove verified' : 'Mark verified'} onClick={() => patch(h._id, { verified: !h.verified })}><BadgeCheck className={cn('h-4 w-4', h.verified && 'text-ink')} /></Button>
                <Button size="sm" variant="outline" title="Owner" onClick={() => { setOwner(h); setOwnerId(h.owner?._id ?? ''); }}><UserCog className="h-4 w-4" /></Button>
                {h.status === 'approved' && <Button size="sm" variant="outline" title="View" asChild><Link href={hotelPath(h.slug, h.citySlug)} target="_blank"><ExternalLink className="h-4 w-4" /></Link></Button>}
                {h.status === 'approved' ? (
                  <Button size="sm" variant="ghost" onClick={() => patch(h._id, { status: 'suspended' }, 'Suspended')}>Suspend</Button>
                ) : (
                  h.status === 'suspended' && <Button size="sm" variant="ghost" onClick={() => patch(h._id, { status: 'approved' }, 'Live again')}>Restore</Button>
                )}
                <Button size="sm" variant="ghost" title="Delete" onClick={() => confirm({ title: `Delete ${h.name}?`, description: 'Its rooms and calendar go too. This cannot be undone — its page will stop existing (a ranked URL!). Prefer Suspend.', destructive: true, confirmLabel: 'Delete', onConfirm: async () => { try { await hotelsApi.adminDelete(h._id); toast.success('Deleted'); await load(); } catch (e) { toast.error(apiError(e)); } } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {res.pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-2 py-1.5 text-sm text-slate-500">Page {page} of {res.pages} · {res.total} hotels</span>
              <Button variant="outline" size="sm" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      <AddHotel open={add} onOpenChange={setAdd} onDone={load} />
      <Dialog open={!!owner} onOpenChange={(v) => !v && setOwner(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Owner of {owner?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Paste the owner&apos;s account id (Dashboard → Users). Leave empty to make the hotel unclaimed again.</p>
          <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="User id" />
          <Button onClick={async () => { await patch(owner._id, { owner: ownerId.trim() || null }, 'Owner updated'); setOwner(null); }}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddHotel({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [cities, setCities] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', city: '', address: '', phone: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) cityApi.getNames().then(setCities).catch(() => undefined);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add an unclaimed hotel</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600">For hotels you list yourself before the owner joins. Bookings come to you (concierge); the owner can claim it later.</p>
        <Input placeholder="Hotel name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
          <option value="">City</option>
          {cities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <Input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <Input placeholder="Hotel phone (private, for your calls)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Button disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const h = await hotelsApi.adminCreate(f);
            toast.success('Added — now add rooms and photos');
            onOpenChange(false);
            onDone();
            window.location.href = `/dashboard/hotel?hotelId=${h._id}`;
          } catch (e) {
            toast.error(apiError(e));
          } finally {
            setBusy(false);
          }
        }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add hotel</Button>
      </DialogContent>
    </Dialog>
  );
}
