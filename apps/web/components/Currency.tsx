'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { browserCountry } from '@/lib/countries';
import { cn } from '@/lib/utils';

/*
 * Prices stay in rupees — that is what the guest pays at the hotel. Visitors
 * from abroad also see an approximate amount in their own currency
 * ("≈ US$48"). Rates are the admin's (Settings → fxRates), so nothing depends
 * on an outside service; the choice is remembered in this browser.
 */

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani rupee' },
  { code: 'USD', symbol: 'US$', label: 'US dollar' },
  { code: 'GBP', symbol: '£', label: 'British pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'AED', symbol: 'AED ', label: 'UAE dirham' },
  { code: 'SAR', symbol: 'SAR ', label: 'Saudi riyal' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian dollar' },
  { code: 'CNY', symbol: '¥', label: 'Chinese yuan' },
];

const BY_COUNTRY: Record<string, string> = {
  US: 'USD', GB: 'GBP', AE: 'AED', SA: 'SAR', CA: 'CAD', AU: 'AUD', CN: 'CNY', QA: 'USD', OM: 'USD', KW: 'USD', BH: 'USD',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', PT: 'EUR', GR: 'EUR',
};

type Ctx = { code: string; setCode: (c: string) => void; rates: Record<string, number> };
const CurrencyContext = createContext<Ctx>({ code: 'PKR', setCode: () => undefined, rates: {} });
const KEY = 'ph-currency';

export function parseRates(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of String(s || '').split(',')) {
    const [k, v] = part.split('=');
    const n = Number(v);
    if (k && n > 0) out[k.trim().toUpperCase()] = n;
  }
  return out;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const settings = useSiteSettings() as any;
  const rates = useMemo(() => parseRates(settings?.fxRates || 'USD=280,GBP=355,EUR=300,AED=76,SAR=75,CAD=205,AUD=185,CNY=39'), [settings?.fxRates]);
  const [code, setCodeState] = useState('PKR');

  useEffect(() => {
    let saved = '';
    try {
      saved = localStorage.getItem(KEY) || '';
    } catch {
      /* private mode */
    }
    const guess = BY_COUNTRY[browserCountry()] || '';
    const pick = saved || guess;
    if (pick && (pick === 'PKR' || rates[pick])) setCodeState(pick);
  }, [rates]);

  const setCode = (c: string) => {
    setCodeState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
  };
  return <CurrencyContext.Provider value={{ code, setCode, rates }}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

/** "≈ US$48" for a rupee amount, or nothing when the visitor uses rupees. */
export function Approx({ pkr, className, prefix = '≈ ' }: { pkr: number; className?: string; prefix?: string }) {
  const { code, rates } = useCurrency();
  if (!pkr || code === 'PKR' || !rates[code]) return null;
  const v = pkr / rates[code]!;
  const cur = CURRENCIES.find((c) => c.code === code);
  const n = v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v >= 10 ? 0 : 1);
  return <span className={cn('whitespace-nowrap', className)} title="Approximate — you pay in Pakistani rupees">{prefix}{cur?.symbol ?? code + ' '}{n}</span>;
}

/** The small "PKR ▾" switch in the header menu and footer. */
export function CurrencyPicker({ className, dark }: { className?: string; dark?: boolean }) {
  const { code, setCode, rates } = useCurrency();
  return (
    <label className={cn('relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold', dark ? 'bg-white/10 text-white' : 'bg-surface text-ink', className)}>
      <Globe className="h-4 w-4" />
      {code}
      <select aria-label="Show prices in" value={code} onChange={(e) => setCode(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {CURRENCIES.filter((c) => c.code === 'PKR' || rates[c.code]).map((c) => (
          <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
        ))}
      </select>
    </label>
  );
}
