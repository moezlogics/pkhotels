'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarClock, ChevronDown, Info, Loader2, MessageCircle, Receipt, Rocket, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/dashboard';
import { CheckoutDialog, type CheckoutInvoice } from '@/components/billing/checkout-dialog';
import { pkr, waLink } from '@/lib/hotels';
import { apiError, billingApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

export const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const monthName = (p: string) => (p ? new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

export function invoiceTitle(i: any) {
  return i.kind === 'commission' ? `Commission · ${monthName(i.period)}` : i.lines?.[0]?.label || 'Boost';
}

/** One label and colour per state, the same for owners and admins. */
export function invoiceState(i: any): { label: string; tone: string } {
  if (i.status === 'paid') return { label: 'Paid', tone: 'bg-emerald-50 text-emerald-700' };
  if (i.status === 'void') return { label: 'Cancelled', tone: 'bg-neutral-100 text-neutral-500' };
  if (i.status === 'submitted') return { label: 'Checking payment', tone: 'bg-sky-50 text-sky-700' };
  if (i.overdue) return { label: 'Overdue', tone: 'bg-rose-50 text-rose-700' };
  if (i.status === 'rejected') return { label: 'Not verified', tone: 'bg-amber-50 text-amber-800' };
  return { label: 'Unpaid', tone: 'bg-highlight text-ink' };
}

/** CheckoutDialog speaks "plan invoice"; this maps a hotel invoice onto it. */
export function toCheckout(i: any): CheckoutInvoice {
  return {
    _id: i._id,
    invoiceNumber: i.number,
    planName: invoiceTitle(i),
    amount: i.amount,
    paymentStatus: i.status === 'rejected' ? 'failed' : i.status,
    rejectionReason: i.rejectionReason,
  };
}

/** Dashboard → Billing for a hotel: plan and rate, this month so far, invoices to pay. */
export default function HotelBilling({ hotelId }: { hotelId?: string | null }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showMonth, setShowMonth] = useState(false);

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

  const due = data.invoices.filter((i: any) => ['unpaid', 'rejected'].includes(i.status));
  const checking = data.invoices.filter((i: any) => i.status === 'submitted');
  const next = [...due].sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  const rate = data.commissionPercent;

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" description="Your plan, commission and invoices — pay by bank, JazzCash or Easypaisa." />

      {data.hotel.billingHold && (
        <div className="flex items-start gap-3 rounded-[22px] bg-rose-600 p-4 text-white">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Online booking is paused</p>
            <p className="text-[14.5px] text-white/85">An invoice is long overdue. Your hotel page is still live; bookings start again as soon as the payment is verified.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] bg-ink p-5 text-white">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/60">Amount due</p>
          <p className="font-display mt-1 text-[34px] font-bold leading-none">{pkr(data.balance)}</p>
          <p className="mt-2 text-[14px] text-white/70">{next ? `${next.overdue ? 'Overdue since' : 'Due'} ${fmtDate(next.dueDate)}` : checking.length ? 'Payment being checked' : 'Nothing to pay right now'}</p>
          {next && (
            <button type="button" onClick={() => setPaying(next)} className="btn-yellow btn-sm mt-4 w-full">
              Pay {pkr(next.amount)} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500"><Wallet className="h-4 w-4" /> Your plan</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{data.plan}</p>
          <p className="mt-1 text-[14.5px] text-neutral-600">{rate ? `${rate}% of completed PakHotels stays` : '0% commission — every booking is yours'}</p>
          <Link href="/dashboard/purchase-package" className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-ink underline-offset-4 hover:underline">
            {rate ? 'Lower your commission' : 'Change plan'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500"><CalendarClock className="h-4 w-4" /> Not billed yet</p>
          <p className="mt-1 text-[22px] font-bold text-ink">{rate ? pkr(data.thisMonth.amount) : '—'}</p>
          <p className="mt-1 text-[14.5px] text-neutral-600">
            {rate ? `${data.thisMonth.bookings} completed stay${data.thisMonth.bookings === 1 ? '' : 's'}${data.thisMonth.upcoming ? ` · ${data.thisMonth.upcoming} upcoming` : ''}` : 'No commission on your plan'}
          </p>
          {rate > 0 && data.thisMonth.items.length > 0 && (
            <button type="button" onClick={() => setShowMonth((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-ink">
              See stays <ChevronDown className={cn('h-4 w-4 transition', showMonth && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {showMonth && (
        <div className="overflow-hidden rounded-[22px] border border-[color:var(--border)] bg-white">
          <LinesTable lines={data.thisMonth.items.map((b: any) => ({ label: b.guestName, ref: b.ref, dates: b.dates, base: b.total, percent: b.percent, amount: b.amount }))} />
        </div>
      )}

      <section className="rounded-[22px] border border-[color:var(--border)] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-ink"><Receipt className="h-5 w-5" /> Invoices</h2>
          <Link href={hotelId ? `/dashboard/boost?hotelId=${hotelId}` : '/dashboard/boost'} className="btn-ghost btn-sm inline-flex items-center gap-1.5"><Rocket className="h-4 w-4" /> Boost</Link>
        </div>
        {data.invoices.length === 0 ? (
          <p className="px-5 py-10 text-center text-[15px] text-neutral-500">No invoices yet. {rate ? 'Commission for completed stays is billed in the first days of each month.' : ''}</p>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {data.invoices.map((i: any) => {
              const st = invoiceState(i);
              const canPay = ['unpaid', 'rejected'].includes(i.status);
              return (
                <li key={i._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold text-ink">{invoiceTitle(i)}</p>
                      <p className="text-[13.5px] text-neutral-500">
                        {i.number} · {i.status === 'paid' ? `Paid ${fmtDate(i.paidAt)}` : `Due ${fmtDate(i.dueDate)}`}
                        {i.kind === 'boost' && i.boostEnd ? ` · live until ${fmtDate(i.boostEnd)}` : ''}
                      </p>
                      {i.status === 'rejected' && i.rejectionReason && <p className="mt-1 text-[13.5px] text-amber-800">{i.rejectionReason}</p>}
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', st.tone)}>{st.label}</span>
                    <p className="w-24 text-right text-[16px] font-bold text-ink tabular">{pkr(i.amount)}</p>
                    <div className="flex gap-2">
                      {i.lines?.length > 1 && (
                        <button type="button" onClick={() => setOpen(open === i._id ? null : i._id)} className="btn-ghost btn-sm">{open === i._id ? 'Hide' : 'Details'}</button>
                      )}
                      {canPay && <button type="button" onClick={() => setPaying(i)} className="btn-yellow btn-sm">{i.status === 'rejected' ? 'Send again' : 'Pay'}</button>}
                    </div>
                  </div>
                  {open === i._id && <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--border)]"><LinesTable lines={i.lines} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-[22px] bg-[#f0ebfb] p-5 text-[14.5px] text-neutral-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <div className="space-y-1">
          <p><span className="font-semibold text-ink">How commission works.</span> Only bookings made on PakHotels that end in a stay are billed — never cancellations, declines or genuine no-shows. Walk-ins and phone bookings you add yourself are free.</p>
          <p>Each month&apos;s stays are invoiced on the 3rd of the next month and are due in {data.terms.dueDays} days.{data.terms.holdDays ? ` Online booking pauses if an invoice is ${data.terms.holdDays} days overdue.` : ''}</p>
          {data.terms.note && <p>{data.terms.note}</p>}
          {data.terms.whatsapp && (
            <a href={waLink(data.terms.whatsapp, `Assalam-o-Alaikum, I have a question about billing for ${data.hotel.name}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline">
              <MessageCircle className="h-4 w-4" /> Questions? WhatsApp us
            </a>
          )}
        </div>
      </div>

      <CheckoutDialog
        invoice={paying ? toCheckout(paying) : null}
        onClose={() => setPaying(null)}
        onPay={(d) => billingApi.pay(paying._id, d)}
        doneText={paying?.kind === 'boost' ? 'Your boost starts as soon as we verify the payment — usually within a few hours.' : 'Thank you! We will confirm the payment within a few hours.'}
        onSubmitted={() => {
          toast.success('Payment sent for checking');
          void load();
        }}
      />
    </div>
  );
}

export function LinesTable({ lines }: { lines: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[14px]">
        <thead className="bg-[#f7f5fc] text-[12.5px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Guest / item</th>
            <th className="px-4 py-2.5 font-semibold">Stay</th>
            <th className="px-4 py-2.5 text-right font-semibold">Booking</th>
            <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
            <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--border)]">
          {lines.map((l, n) => (
            <tr key={l.ref || n}>
              <td className="px-4 py-2.5"><span className="font-medium text-ink">{l.label}</span>{l.ref && <span className="block text-[12.5px] text-neutral-500">{l.ref}</span>}</td>
              <td className="px-4 py-2.5 text-neutral-600">{l.dates || '—'}</td>
              <td className="px-4 py-2.5 text-right text-neutral-600 tabular">{l.base ? pkr(l.base) : '—'}</td>
              <td className="px-4 py-2.5 text-right text-neutral-600">{l.percent ? `${l.percent}%` : '—'}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-ink tabular">{pkr(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
