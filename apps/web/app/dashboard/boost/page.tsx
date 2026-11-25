'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpToLine, Check, Clock, Home, Loader2, Rocket, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/dashboard';
import { CheckoutDialog } from '@/components/billing/checkout-dialog';
import { fmtDate, toCheckout } from '@/components/billing/hotel-billing';
import { pkr } from '@/lib/hotels';
import { apiError, billingApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

const KINDS = {
  top: {
    icon: ArrowUpToLine,
    title: 'Top of your city',
    what: (city: string) => `Shown above every other hotel on the ${city || 'city'} page and in search, with a Featured tag.`,
  },
  featured: {
    icon: Home,
    title: 'Homepage featured',
    what: () => 'In the Featured hotels rail on the homepage — the first thing every visitor sees.',
  },
} as const;

const daysLeft = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));

/**
 * Boosts, OLX style: one hotel, one placement, a number of days. Buying makes
 * an invoice straight away; the boost starts when the payment is verified, and
 * buying again while one runs adds the days on the end.
 */
function BoostInner() {
  const sp = useSearchParams();
  const hotelId = sp.get('hotelId');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [paying, setPaying] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setData(await billingApi.mine(hotelId));
      setError('');
    } catch (e) {
      setError(apiError(e));
    }
  }, [hotelId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="rounded-2xl bg-white p-6 text-center text-neutral-600">{error}</p>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;

  const live = data.hotel.status === 'approved' && data.hotel.owned;
  const pending = data.invoices.filter((i: any) => i.kind === 'boost' && ['unpaid', 'rejected', 'submitted'].includes(i.status));
  const city = data.hotel.citySlug ? data.hotel.citySlug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';

  const buy = async (plan: any) => {
    setBusy(plan._id);
    try {
      const inv = await billingApi.buyBoost(plan._id, hotelId);
      if (inv.status === 'paid') {
        toast.success('Your boost is live.');
        void load();
      } else if (inv.status === 'submitted') {
        toast('This boost is already waiting for payment checking.');
      } else {
        setPaying(inv);
      }
      void load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Boost your hotel" description="More guests see you first. Pay once — no subscription, no commission change." />

      {!live && (
        <p className="rounded-[22px] border border-[color:var(--border)] bg-white p-5 text-[15px] text-neutral-600">
          {data.hotel.owned ? 'Your hotel must be live before you can boost it. Finish and submit your hotel first.' : 'Claim this hotel to boost it.'}{' '}
          <Link href="/dashboard/hotel" className="font-semibold text-ink underline">Open My hotel</Link>
        </p>
      )}

      {(data.boosts.top || data.boosts.featured) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['top', 'featured'] as const).filter((k) => data.boosts[k]).map((k) => {
            const K = KINDS[k];
            return (
              <div key={k} className="flex items-center gap-3 rounded-[22px] bg-ink p-5 text-white">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><K.icon className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold">{K.title} is live</p>
                  <p className="text-[14px] text-white/70">Until {fmtDate(data.boosts[k])} · {daysLeft(data.boosts[k])} days left</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
          <p className="flex items-center gap-2 font-semibold text-ink"><Clock className="h-4 w-4" /> Waiting</p>
          <ul className="mt-2 divide-y divide-[color:var(--border)]">
            {pending.map((i: any) => (
              <li key={i._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[15px]">
                <span>{i.lines?.[0]?.label} · {pkr(i.amount)}</span>
                {i.status === 'submitted' ? (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[12.5px] font-semibold text-sky-700">Checking payment</span>
                ) : (
                  <button type="button" onClick={() => setPaying(i)} className="btn-yellow btn-sm">{i.status === 'rejected' ? 'Send proof again' : 'Pay now'}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(['top', 'featured'] as const).map((k) => {
        const K = KINDS[k];
        const plans = data.boosts.plans.filter((p: any) => p.placement === k);
        if (!plans.length) return null;
        return (
          <section key={k} className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-ink"><K.icon className="h-5 w-5" /></span>
              <div>
                <h2 className="text-[19px] font-bold text-ink">{K.title}</h2>
                <p className="text-[14.5px] text-neutral-600">{K.what(city)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p: any) => (
                <div key={p._id} className={cn('relative flex flex-col rounded-2xl border p-4', p.highlight ? 'border-ink ring-1 ring-ink' : 'border-[color:var(--border)]')}>
                  {p.highlight && <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-primary-foreground">Best value</span>}
                  <p className="text-[15px] font-semibold text-ink">{p.days} days</p>
                  <p className="font-display mt-1 text-[28px] font-bold leading-none text-ink">{pkr(p.price)}</p>
                  <p className="mt-1 text-[13px] text-neutral-500">{pkr(Math.round(p.price / p.days))} a day</p>
                  <button type="button" disabled={!live || !!busy} onClick={() => void buy(p)} className={cn('mt-4 h-11 w-full', p.highlight ? 'btn-yellow' : 'btn-ink', 'disabled:opacity-50')}>
                    {busy === p._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Rocket className="h-4 w-4" /> Boost {p.days} days</>}
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-[22px] bg-[#f0ebfb] p-5 text-[14.5px] text-neutral-700">
        <p className="flex items-center gap-2 font-semibold text-ink"><Sparkles className="h-4 w-4" /> How boosts work</p>
        <ul className="mt-2 space-y-1.5">
          {[
            'Choose a boost and send the amount by bank, JazzCash or Easypaisa — the account details show on the next screen.',
            'Upload the screenshot. The boost starts as soon as we verify it, usually within a few hours.',
            'Renew early and the new days are added after the current boost ends — you never lose a day.',
            'Boosts are for one hotel. They do not change your plan or your commission.',
          ].map((t) => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" />{t}</li>
          ))}
        </ul>
      </div>

      <CheckoutDialog
        invoice={paying ? toCheckout(paying) : null}
        onClose={() => setPaying(null)}
        onPay={(d) => billingApi.pay(paying._id, d)}
        doneText="Your boost starts as soon as we verify the payment — usually within a few hours."
        onSubmitted={() => void load()}
      />
    </div>
  );
}

export default function BoostPage() {
  return (
    <Suspense fallback={null}>
      <BoostInner />
    </Suspense>
  );
}
