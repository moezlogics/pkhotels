'use client';

import { useState } from 'react';
import { pkr } from '@/lib/hotels';
import type { Plan } from '@/lib/plans';

/**
 * "What will bookings cost me?" — other sites' commission against every
 * PakHotels plan (monthly price + its commission on completed stays), so a
 * hotel sees which plan is cheapest for its own numbers.
 */
export default function CommissionCalculator({ plans = [] }: { plans?: Pick<Plan, '_id' | 'name' | 'price' | 'commissionPercent'>[] }) {
  const [bookings, setBookings] = useState(30);
  const [value, setValue] = useState(12000);
  const [rate, setRate] = useState(17);
  const sales = bookings * value;
  const elsewhere = Math.round((sales * rate) / 100);
  const ours = (plans.length ? plans : [{ _id: 'free', name: 'Free', price: 0, commissionPercent: 10 }])
    .map((p) => ({ ...p, cost: Math.round((p.price || 0) + (sales * (p.commissionPercent || 0)) / 100) }))
    .sort((a, b) => a.cost - b.cost);
  const best = ours[0]!;
  const saved = Math.max(0, elsewhere - best.cost);

  const row = (label: string, v: number, set: (n: number) => void, min: number, max: number, step: number, fmt: (n: number) => string) => (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span className="font-medium text-neutral-700">{label}</span>
        <span className="font-semibold text-neutral-900">{fmt(v)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
    </label>
  );

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-ink shadow-sm md:p-8">
      <h3 className="text-lg font-semibold text-neutral-900">What bookings cost you each month</h3>
      <div className="mt-5 space-y-5">
        {row('Online bookings a month', bookings, setBookings, 5, 300, 5, (n) => String(n))}
        {row('Average booking value', value, setValue, 3000, 60000, 1000, pkr)}
        {row('Commission on other sites', rate, setRate, 10, 25, 1, (n) => `${n}%`)}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-[14px] font-semibold">Other sites</p>
          <p className="mt-1 text-2xl font-semibold">{pkr(elsewhere)}</p>
          <p className="text-xs text-neutral-500">{rate}% of every booking</p>
        </div>
        <div className="rounded-2xl bg-primary p-4 text-white">
          <p className="text-[14px] font-semibold">PakHotels {best.name}</p>
          <p className="mt-1 text-2xl font-semibold">{pkr(best.cost)}</p>
          <p className="text-xs text-white/75">{best.price ? `${pkr(best.price)} plan` : 'No monthly fee'}{best.commissionPercent ? ` + ${best.commissionPercent}% of completed stays` : ' · 0% commission'}</p>
        </div>
      </div>
      {ours.length > 1 && (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4 text-[14px]">
          {ours.map((p) => (
            <li key={p._id} className="flex justify-between py-2">
              <span className="text-neutral-600">{p.name}{p.commissionPercent ? ` · ${p.commissionPercent}%` : ' · 0%'}</span>
              <span className={p._id === best._id ? 'font-semibold' : 'text-neutral-600'}>{pkr(p.cost)}</span>
            </li>
          ))}
        </ul>
      )}
      {saved > 0 && <p className="mt-4 text-center text-[16px] font-semibold text-neutral-800">You keep {pkr(saved)} more a month — {pkr(saved * 12)} a year.</p>}
      <p className="mt-2 text-center text-[12.5px] text-neutral-500">Commission is only on stays that happen — never on cancellations or no-shows.</p>
    </div>
  );
}
