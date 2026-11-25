'use client';

import { useState, type ReactNode } from 'react';
import { CalendarDays, Minus, Plus, Users } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { addDays, fmtDay, fromDate, nightsBetween, toDate, todayPk } from '@/lib/hotels';
import { cn } from '@/lib/utils';

/** Popover on desktop, bottom sheet on phones — the same content in both. */
function Panel({ open, onOpenChange, trigger, title, children, align = 'start' }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <>
        <div onClick={() => onOpenChange(true)}>{trigger}</div>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerTitle className="px-4 pt-2 text-base font-semibold">{title}</DrawerTitle>
            <div className="overflow-y-auto px-4 pb-6 pt-2">{children}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function DateRangeField({ checkIn, checkOut, onChange, className, compact }: {
  checkIn?: string;
  checkOut?: string;
  onChange: (checkIn: string, checkOut: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const [range, setRange] = useState<DateRange | undefined>(checkIn && checkOut ? { from: toDate(checkIn), to: toDate(checkOut) } : undefined);
  const nights = nightsBetween(checkIn, checkOut);
  const today = toDate(todayPk());

  const label = checkIn && checkOut ? `${fmtDay(checkIn)} to ${fmtDay(checkOut)}` : 'Add dates';

  const apply = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from && r?.to && r.to > r.from) {
      const a = fromDate(r.from);
      let b = fromDate(r.to);
      if (nightsBetween(a, b) > 30) b = addDays(a, 30);
      onChange(a, b);
      setOpen(false);
    }
  };

  return (
    <Panel
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setRange(checkIn && checkOut ? { from: toDate(checkIn), to: toDate(checkOut) } : undefined);
      }}
      title="Choose your dates"
      trigger={
        <button type="button" className={cn('flex w-full items-center gap-3 text-left', className)}>
          <CalendarDays className="h-5 w-5 shrink-0 text-ink" />
          <span className="min-w-0">
            {!compact && <span className="block text-[13px] font-medium text-neutral-500">Dates</span>}
            <span className={cn('block truncate text-[15.5px] font-semibold', checkIn ? 'text-neutral-900' : 'text-neutral-500')}>
              {label}
              {nights > 0 && <span className="ml-1.5 font-normal text-neutral-500">{nights} night{nights === 1 ? '' : 's'}</span>}
            </span>
          </span>
        </button>
      }
    >
      <Calendar
        mode="range"
        numberOfMonths={mobile ? 1 : 2}
        selected={range}
        onSelect={apply}
        disabled={{ before: today }}
        defaultMonth={range?.from ?? today}
        min={1}
        max={30}
        className="mx-auto"
      />
      <p className="mt-1 text-center text-xs text-neutral-500">
        {range?.from && !range?.to ? 'Now choose your check-out date' : 'Tap your check-in, then your check-out date'}
      </p>
    </Panel>
  );
}

function Counter({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <div>
        <p className="text-[16px] font-semibold text-neutral-900">{label}</p>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 text-neutral-700 disabled:opacity-30">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-[16px] font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 text-neutral-700 disabled:opacity-30">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function GuestsField({ adults, children, rooms, onChange, className, compact }: {
  adults: number;
  children: number;
  rooms: number;
  onChange: (v: { adults: number; children: number; rooms: number }) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = `${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}, ${rooms} room${rooms === 1 ? '' : 's'}`;
  return (
    <Panel
      open={open}
      onOpenChange={setOpen}
      title="Guests and rooms"
      align="end"
      trigger={
        <button type="button" className={cn('flex w-full items-center gap-3 text-left', className)}>
          <Users className="h-5 w-5 shrink-0 text-ink" />
          <span className="min-w-0">
            {!compact && <span className="block text-[13px] font-medium text-neutral-500">Guests</span>}
            <span className="block truncate text-[15.5px] font-semibold text-neutral-900">{label}</span>
          </span>
        </button>
      }
    >
      <div className="w-full divide-y divide-neutral-100 md:w-72">
        <Counter label="Adults" hint="Age 13+" value={adults} min={1} max={30} onChange={(v) => onChange({ adults: v, children, rooms: Math.min(rooms, v) })} />
        <Counter label="Children" hint="Age 0–12" value={children} min={0} max={20} onChange={(v) => onChange({ adults, children: v, rooms })} />
        <Counter label="Rooms" value={rooms} min={1} max={Math.min(10, adults)} onChange={(v) => onChange({ adults, children, rooms: v })} />
      </div>
      <Button type="button" className="mt-3 w-full" onClick={() => setOpen(false)}>
        Done
      </Button>
    </Panel>
  );
}
