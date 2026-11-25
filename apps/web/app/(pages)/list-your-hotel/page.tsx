import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BellRing, CalendarRange, Check, KeyRound, MessageCircle, Percent, ShieldCheck, Smartphone, Star, Wallet } from 'lucide-react';
import CommissionCalculator from '@/components/hotel/CommissionCalculator';
import { activePlans } from '@/lib/hotels-server';
import { planBenefits, planPrice, type Plan } from '@/lib/plans';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'List Your Hotel on PakHotels — Free to List, Pay Only for Stays',
  description:
    'Get bookings for your hotel, guest house or resort in Pakistan. Free to list, a small commission only on completed stays (0% on Premium), guest phone and WhatsApp, your own prices and calendar.',
  alternates: { canonical: '/list-your-hotel' },
};

const START = '/register?next=/dashboard/hotel';

export default async function ListYourHotel() {
  const plans = ((await activePlans()) as Plan[]).sort((a, b) => a.price - b.price);

  return (
    <main>
      <section className="bg-navy text-white">
        <div className="container mx-auto grid items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-gold">
              <Percent className="h-3.5 w-3.5" /> Free to list
            </p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight md:text-[48px]">More bookings for your hotel. Pay only when guests stay.</h1>
            <p className="mt-4 max-w-xl text-[18px] text-white/80">
              Pakistan&apos;s booking site built for hotels like yours: guests book and pay you at check-in, you confirm from your phone, and you pay a small share only for stays that happen — or nothing on Premium.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={START} className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-navy hover:bg-white/90">
                List your hotel free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#plans" className="inline-flex h-12 items-center rounded-xl px-5 font-semibold ring-1 ring-white/30 hover:bg-white/10">
                Compare plans
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <KeyRound className="h-4 w-4" /> Already on PakHotels? Open your hotel&apos;s page and press “Claim this hotel”.
            </p>
          </div>
          <CommissionCalculator plans={plans} />
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-neutral-900 md:text-[32px]">Everything you need to take bookings</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: BellRing, t: 'Bookings on your phone', d: 'A notification for every request. Confirm or decline in one tap from the dashboard.' },
            { icon: MessageCircle, t: 'Guest phone & WhatsApp', d: 'Every booking comes with the guest’s name, mobile and a one-tap WhatsApp message.' },
            { icon: Wallet, t: 'Advances to your own account', d: 'Ask for an advance by bank, JazzCash or Easypaisa — the money goes straight to you.' },
            { icon: CalendarRange, t: 'Your prices, your calendar', d: 'Weekend and seasonal rates, Eid prices, close dates when you are full offline.' },
            { icon: ShieldCheck, t: 'Fewer fake bookings', d: 'Mobile numbers required, limits on open requests, no-shows flagged to you.' },
            { icon: Star, t: 'Real reviews', d: 'Signed-in guests review; stays booked here are marked “Stayed here”. Reply to every one.' },
            { icon: Smartphone, t: 'Walk-ins too', d: 'Add phone and walk-in bookings so your rooms never double-book.' },
            { icon: Percent, t: 'Pay only for stays', d: 'No monthly fee on Free. Commission only on completed stays — never on cancellations or no-shows.' },
            { icon: KeyRound, t: 'Set up in 10 minutes', d: 'Add your hotel, rooms and photos from your phone. We help if you need it.' },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <x.icon className="h-6 w-6 text-ink" />
              <p className="mt-3 font-semibold text-neutral-900">{x.t}</p>
              <p className="mt-1 text-[15px] text-neutral-600">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {plans.length > 0 && (
        <section id="plans" className="scroll-mt-20 bg-neutral-50 py-10">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-[26px] font-semibold tracking-tight text-neutral-900 md:text-[32px]">Simple plans. Less commission as you grow.</h2>
            <div className="mx-auto mt-6 grid max-w-6xl gap-4 md:grid-cols-3">
              {plans.map((p) => {
                const price = planPrice(p);
                return (
                  <div key={p._id} className={`relative flex flex-col rounded-3xl border bg-white p-6 ${p.highlight ? 'border-ink shadow-xl ring-1 ring-ink' : 'border-neutral-200'}`}>
                    {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most popular</span>}
                    <p className="text-lg font-semibold text-neutral-900">{p.name}</p>
                    <p className="mt-1 min-h-10 text-sm text-neutral-500">{p.description}</p>
                    <p className="mt-4">
                      <span className="text-[34px] font-semibold text-neutral-900">{price.amount}</span>
                      {price.per && <span className="text-neutral-500"> / {price.per}</span>}
                    </p>
                    <ul className="mt-5 flex-1 space-y-2.5 text-[15px]">
                      {planBenefits(p)
                        .filter((b) => b.on)
                        .map((b) => (
                          <li key={b.key} className="flex items-start gap-2 text-neutral-700">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.5} /> {b.label}
                          </li>
                        ))}
                    </ul>
                    <Link href={p.price ? `/register?next=${encodeURIComponent(`/dashboard/purchase-package?plan=${p._id}`)}` : START} className={`mt-6 flex h-12 items-center justify-center rounded-xl font-semibold ${p.highlight ? 'bg-primary text-primary-foreground' : 'bg-neutral-900 text-primary-foreground'}`}>
                      {p.price ? `Choose ${p.name}` : 'Start free'}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-center text-sm text-neutral-500">
              Pay for plans by bank transfer, JazzCash or Easypaisa. <Link href="/packages" className="font-semibold text-ink">Full comparison</Link>
            </p>
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 py-10">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-neutral-900 md:text-[32px]">Live in three steps</h2>
        <ol className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-3">
          {['Create your free account', 'Add your hotel, rooms, prices and photos', 'Start receiving bookings — confirm from your phone'].map((t, i) => (
            <li key={t} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">{i + 1}</span>
              <p className="mt-3 text-[17px] font-semibold text-neutral-900">{t}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link href={START} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
