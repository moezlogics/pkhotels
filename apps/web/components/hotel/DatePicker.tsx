'use client';

import { useState } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { addDays, fromDate, nightsBetween, todayPk, toDate } from '@/lib/hotels';
import { cn } from '@/lib/utils';

const fmt = (d?: string) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

/**
 * Check-in / check-out on a phone, the way travel apps do it:
 *
 *   - two tiles on top say which date you are picking now (the active one is
 *     outlined), so "what do I tap?" always has an answer;
 *   - a line under them tells you the next step in words;
 *   - the first tap always starts a new stay, the second ends it. (The
 *     calendar's own behaviour moved whichever end was nearest, which is why
 *     people got lost);
 *   - one-tap shortcuts for the stays most people want.
 */
export default function DatePicker({
  checkIn,
  checkOut,
  onChange,
  maxNights = 30,
  shortcuts = true,
}: {
  checkIn?: string;
  checkOut?: string;
  onChange: (checkIn: string | undefined, checkOut: string | undefined) => void;
  maxNights?: number;
  shortcuts?: boolean;
}) {
  // Which end the next tap sets.
  const [phase, setPhase] = useState<'in' | 'out'>(checkIn && !checkOut ? 'out' : 'in');
  const today = todayPk();
  const nights = nightsBetween(checkIn, checkOut);

  const pick = (d: Date | undefined) => {
    if (!d) return;
    const day = fromDate(d);
    if (day < today) return;
    if (phase === 'in' || !checkIn || day <= checkIn) {
      onChange(day, undefined);
      setPhase('out');
      return;
    }
    const out = nightsBetween(checkIn, day)! > maxNights ? addDays(checkIn, maxNights) : day;
    onChange(checkIn, out);
    setPhase('in');
  };

  const quick = (offset: number, n: number) => {
    const a = addDays(today, offset);
    onChange(a, addDays(a, n));
    setPhase('in');
  };
  const weekend = (5 - new Date(today + 'T00:00:00Z').getUTCDay() + 7) % 7;

  const hint = !checkIn
    ? 'Tap your check-in date'
    : !checkOut
      ? 'Now tap your check-out date'
      : `${nights} night${nights === 1 ? '' : 's'} · tap a date to start again`;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {([
          ['in', 'Check-in', checkIn, CalendarCheck],
          ['out', 'Check-out', checkOut, CalendarX],
        ] as const).map(([k, label, value, Icon]) => {
          const on = phase === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => (k === 'out' && !checkIn ? null : setPhase(k))}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-2.5 rounded-[18px] border-2 px-3 py-2.5 text-left transition',
                on ? 'border-ink bg-white' : 'border-transparent bg-[#f7f5fc]',
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', on ? 'text-ink' : 'text-neutral-500')} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
                <span className={cn('block truncate text-[16px] font-bold', value ? 'text-ink' : 'text-neutral-400')}>{value ? fmt(value) : 'Add date'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-ink" aria-live="polite">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-ink" />
        {hint}
      </p>

      {shortcuts && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {[
            { l: 'Tonight', o: 0, n: 1 },
            { l: 'Tomorrow', o: 1, n: 1 },
            { l: 'This weekend', o: weekend, n: 2 },
            { l: '2 nights', o: 0, n: 2 },
          ].map((c) => {
            const on = checkIn === addDays(today, c.o) && checkOut === addDays(today, c.o + c.n);
            return (
              <button key={c.l} type="button" onClick={() => quick(c.o, c.n)} className={cn('shrink-0 rounded-full border px-4 py-2 text-[15px] font-semibold transition', on ? 'border-ink bg-ink text-white' : 'border-neutral-300 bg-white text-ink')}>
                {c.l}
              </button>
            );
          })}
        </div>
      )}

      <Calendar
        mode="range"
        numberOfMonths={1}
        selected={checkIn ? { from: toDate(checkIn), to: checkOut ? toDate(checkOut) : undefined } : undefined}
        onSelect={(_, d) => pick(d)}
        disabled={{ before: toDate(today) }}
        defaultMonth={checkIn ? toDate(checkIn) : toDate(today)}
        className="dp-compact mx-auto mt-3 w-full p-0 [--cell-size:2.6rem]"
      />
    </div>
  );
}
