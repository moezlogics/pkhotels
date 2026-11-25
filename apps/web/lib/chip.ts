import { cn } from '@/lib/utils';

/**
 * The filter chips on results pages — areas, rental types, sizes. Round,
 * compact pills; the selected one is filled with the brand colour.
 */
export function chipClass(selected: boolean, className?: string) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium transition-colors',
    selected ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
    className,
  );
}
