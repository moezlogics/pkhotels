'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRIES, TOP_COUNT, browserCountry, countryOf, flag, normalizePhone } from '@/lib/countries';
import { cn } from '@/lib/utils';

/**
 * A mobile number from anywhere: a country-code picker (Pakistan first) and
 * the number. Calls onChange with the number as the API wants it — 03… for
 * Pakistan, +<code><number> for everyone else — or the raw text while it is
 * still incomplete, so the caller can validate with normalizePhone().
 */
export default function PhoneField({
  value,
  onChange,
  invalid,
  className,
  id,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  id?: string;
  onBlur?: () => void;
}) {
  const startIso = () => {
    if (value?.startsWith('+')) {
      const c = COUNTRIES.filter((x) => value.startsWith('+' + x.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
      if (c) return c.iso;
    }
    return 'PK';
  };
  const [iso, setIso] = useState(startIso);
  const [local, setLocal] = useState(() => {
    if (!value) return '';
    if (value.startsWith('+')) {
      const c = countryOf(startIso());
      return c ? value.slice(c.dial.length + 1) : value;
    }
    return value;
  });

  // First visit from abroad: start on the visitor's own code.
  useEffect(() => {
    if (value) return;
    const b = browserCountry();
    if (b && b !== 'PK') setIso(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value set from outside (the account's saved number) replaces ours.
  useEffect(() => {
    const ours = compose(iso, local);
    if (value && value !== ours && normalizePhone(value)) {
      const i = startIso();
      setIso(i);
      const c = countryOf(i);
      setLocal(value.startsWith('+') && c ? value.slice(c.dial.length + 1) : value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function compose(i: string, l: string) {
    if (i === 'PK') return normalizePhone(l) || l;
    const c = countryOf(i)!;
    const digits = l.replace(/\D/g, '').replace(/^0+/, '');
    if (l.trim().startsWith('+')) return normalizePhone(l) || l;
    return digits ? `+${c.dial}${digits}` : '';
  }

  const c = countryOf(iso)!;
  return (
    <div className={cn('flex h-[52px] overflow-hidden rounded-xl border bg-white focus-within:border-ink', invalid ? 'border-red-500' : 'border-neutral-300', className)}>
      <label className="relative flex shrink-0 items-center gap-1 border-r border-neutral-200 pl-3 pr-2 text-[16px] text-ink">
        <span aria-hidden>{flag(iso)}</span>
        <span className="tabular">+{c.dial}</span>
        <ChevronDown className="h-4 w-4 text-neutral-400" />
        <select
          aria-label="Country code"
          value={iso}
          onChange={(e) => {
            setIso(e.target.value);
            onChange(compose(e.target.value, local));
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <optgroup label="Most used">
            {COUNTRIES.slice(0, TOP_COUNT).map((x) => <option key={x.iso} value={x.iso}>{x.name} (+{x.dial})</option>)}
          </optgroup>
          <optgroup label="All countries">
            {COUNTRIES.slice(TOP_COUNT).map((x) => <option key={x.iso} value={x.iso}>{x.name} (+{x.dial})</option>)}
          </optgroup>
        </select>
      </label>
      <input
        id={id}
        value={local}
        onBlur={onBlur}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(compose(iso, e.target.value));
        }}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={iso === 'PK' ? '0300 1234567' : 'Mobile number'}
        className="min-w-0 flex-1 bg-transparent px-3 text-[16px] text-ink outline-none"
      />
    </div>
  );
}
