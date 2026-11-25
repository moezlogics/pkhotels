'use client'

import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { packageApi, subscriptionApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import PlanCards from '@/components/plans/PlanCards';
import { planBenefits, planDuration, planPrice, type Plan } from '@/lib/plans';

/*
 * Plans for hotels — the same plan cards as the dashboard, then every benefit
 * side by side, then the questions hotel owners ask.
 */

const FAQS = [
  { q: 'Do you take a commission on bookings?', a: 'Only on stays that actually happen through PakHotels, and only at your plan’s rate: Free has no monthly fee and a small commission, Standard halves it, and Premium has none. Nothing is charged on cancellations or genuine no-shows. Guests still pay you directly at the hotel; we send one invoice at the start of each month for last month’s completed stays.' },
  { q: 'How do I pay the monthly invoice?', a: 'Open Dashboard → Billing, send the amount to one of the accounts shown (bank, JazzCash or Easypaisa) and upload the screenshot. You have 10 days. If an invoice stays unpaid long after its due date, online booking pauses until it is paid — your hotel page stays up.' },
  { q: 'Can I push my hotel to the top without a plan?', a: 'Yes — buy a Boost from Dashboard → Boost: Top of your city or Featured on the homepage for 7 or 30 days. It starts as soon as we verify the payment, and adds days if you renew early.' },
  { q: 'Can I list more than one hotel on a plan?', a: 'Each account manages one hotel, so every hotel has its own plan and its own dashboard. If you run several hotels, add each from its own account — we can help you set them up.' },
  { q: 'How do guests pay?', a: 'At the hotel, in cash or however you accept. On Standard and Premium you can also ask for an advance (for example 25%) to your own bank, JazzCash or Easypaisa account; the guest uploads the screenshot and you mark it received. PakHotels never touches the money.' },
  { q: 'What about fake bookings and no-shows?', a: 'Every booking needs a Pakistani mobile number, guests can only hold a few open requests at once, and you can mark no-shows — repeat no-shows are flagged to you. Asking for an advance (Standard and Premium) stops most no-shows.' },
  { q: 'How do I pay for a plan?', a: 'Choose a plan, send the amount to one of the accounts shown at checkout (bank, JazzCash or Easypaisa) and upload the screenshot. Your plan starts as soon as we verify it, usually within a few hours.' },
  { q: 'My hotel is already on PakHotels. How do I manage it?', a: 'Open your hotel’s page and press “Claim this hotel”. After a quick call to confirm, it moves to your account on the Free plan.' },
];

export default function PackagesPublicPage() {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    packageApi
      .getAll()
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    subscriptionApi
      .getMyPlan()
      .then((p) => setCurrent(p?.name ?? null))
      .catch(() => undefined);
  }, [isAuthenticated]);

  const sorted = [...plans].sort((a, b) => a.price - b.price);

  return (
    <div className="container mx-auto max-w-7xl overflow-x-hidden px-4 py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[34px]">Plans for hotels — free to list</h1>
        <p className="mt-2 text-[16px] text-neutral-600">
          List your hotel free and pay only on completed stays. A monthly plan lowers the commission (to 0% on Premium) and adds advances, seasonal prices and the
          <span className="mx-1 inline-flex items-center gap-1 font-semibold text-ink">
            <BadgeCheck className="h-4 w-4" /> Verified
          </span>
          badge.
        </p>
      </div>

      <div className="mt-7">
        {loading ? (
          <div className="flex gap-3 overflow-hidden pt-4 lg:grid lg:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[28rem] w-[84%] max-w-[340px] shrink-0 animate-pulse rounded-2xl bg-neutral-100 sm:w-[46%] lg:w-auto lg:max-w-none" />
            ))}
          </div>
        ) : (
          <PlanCards plans={plans} current={current} />
        )}
      </div>

      {sorted.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[22px] font-semibold text-neutral-900 sm:text-[24px]">Compare plans</h2>
          <p className="mt-1 text-[15px] text-neutral-500 sm:hidden">Swipe the table sideways to see every plan.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-[14.5px] sm:text-[15px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[38%] border-b border-neutral-200 bg-neutral-50 px-3 py-3 font-semibold text-neutral-600 sm:px-4">What you get</th>
                  {sorted.map((p) => {
                    const price = planPrice(p);
                    return (
                      <th key={p._id} className={cn('border-b border-neutral-200 px-2 py-3 text-center align-bottom', p.highlight ? 'bg-primary/5' : 'bg-neutral-50')}>
                        <span className="block font-semibold text-neutral-900">{p.name}</span>
                        <span className="block text-[13px] font-medium text-neutral-500">{price.amount}{price.per ? ` / ${price.per}` : ''}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {planBenefits(sorted[0]!).map((row) => (
                  <tr key={row.key}>
                    <td className="sticky left-0 z-10 border-b border-neutral-100 bg-white px-3 py-2.5 sm:px-4">
                      <p className="font-medium text-neutral-800">{row.row}</p>
                      <p className="hidden text-[13px] text-neutral-400 sm:block">{row.hint}</p>
                    </td>
                    {sorted.map((p) => {
                      const b = planBenefits(p).find((x) => x.key === row.key)!;
                      return (
                        <td key={p._id} className={cn('border-b border-neutral-100 px-2 py-2.5 text-center', p.highlight && 'bg-primary/5')}>
                          {b.value ? (
                            <span className="font-semibold text-neutral-900">{b.value}</span>
                          ) : b.on ? (
                            <Check className="mx-auto h-5 w-5 text-ink" strokeWidth={2.5} />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-neutral-300" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium text-neutral-800 sm:px-4">Valid for</td>
                  {sorted.map((p) => (
                    <td key={p._id} className={cn('px-2 py-2.5 text-center text-neutral-700', p.highlight && 'bg-primary/5')}>{planDuration(p)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="text-[22px] font-semibold text-neutral-900 sm:text-[24px]">Questions</h2>
        <div className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="cursor-pointer list-none text-[16px] font-semibold text-neutral-900">{f.q}</summary>
              <p className="mt-2 text-[15.5px] leading-relaxed text-neutral-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
