'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { apiError, hotelsApi } from '@/lib/hotels-api';

const HotelMap = dynamic(() => import('./HotelMap'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-neutral-100" />,
});

export function HotelMapLazy(props: { latitude: number; longitude: number; title: string }) {
  return <HotelMap {...props} />;
}

/** Counts one view per visit (the owner's Insights). */
export function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    const key = `ph-v-${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    void hotelsApi.view(id);
  }, [id]);
  return null;
}

export function ShareButton({ title }: { title: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
        } else {
          await navigator.clipboard.writeText(url).catch(() => undefined);
          toast.success('Link copied');
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-neutral-50"
    >
      <Share2 className="h-4 w-4" /> Share
    </button>
  );
}

/** "Is this your hotel?" — for listings imported without an owner. */
export function ClaimButton({ hotelId, hotelName, slug }: { hotelId: string; hotelName: string; slug: string }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: 'Owner', message: '' });

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name || '', phone: f.phone || (user as any).phone || '' }));
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('claim') === '1' && isAuthenticated) setOpen(true);
  }, [isAuthenticated]);

  const start = () => {
    if (!isAuthenticated) {
      router.push(`/register?next=${encodeURIComponent(`${window.location.pathname}?claim=1`)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="rounded-2xl border border-dashed border-primary/40 bg-accent/60 p-4">
        <p className="flex items-center gap-2 text-[16px] font-semibold text-neutral-900">
          <KeyRound className="h-4 w-4 text-ink" /> Do you own or manage this hotel?
        </p>
        <p className="mt-1 text-sm text-neutral-600">Claim it for free: take bookings directly and set your own prices, photos and rooms.</p>
        <Button size="sm" className="mt-3" onClick={start}>
          Claim this hotel
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim {hotelName}</DialogTitle>
            <DialogDescription>Our team will call you to confirm, usually within one working day.</DialogDescription>
          </DialogHeader>
          {done ? (
            <p className="rounded-xl bg-accent p-4 text-sm text-ink">Thank you! We have your request and will call you on {form.phone}.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await hotelsApi.claim(hotelId, form);
                  setDone(true);
                } catch (err) {
                  toast.error(apiError(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input required inputMode="tel" placeholder="Mobile number (03xx xxxxxxx)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {['Owner', 'General manager', 'Front office / reservations', 'Marketing'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Textarea placeholder="Anything we should know? (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
