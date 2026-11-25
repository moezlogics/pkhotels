import { cn } from "@/lib/utils";
import { DEFAULT_SITE_NAME } from "@/lib/site-settings";

/**
 * The PakHotels mark: a rounded tile in the brand colour holding a white
 * hotel bed under a crescent-roof arch, with one warm dot — "a room is ready
 * for you". The tile carries its own background, so the mark reads the same
 * on the white header and on the dark footer.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect x="2" y="2" width="96" height="96" rx="26" className="fill-primary" />
      <path d="M22 74 V40 a4 4 0 0 1 8 0 V56 H78 a4 4 0 0 1 4 4 V74 a4 4 0 0 1 -8 0 V70 H30 V74 a4 4 0 0 1 -8 0 Z" fill="#ffffff" />
      <rect x="34" y="44" width="40" height="10" rx="5" fill="#ffffff" />
    </svg>
  );
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  name = DEFAULT_SITE_NAME,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  /** The site name (Settings → Site name); its last word takes the brand colour. */
  name?: string;
}) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : "";
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <BrandMark className={cn("h-8 w-8", markClassName)} />
      <span
        className={cn(
          "text-[19px] font-semibold leading-none tracking-tight",
          textClassName,
        )}
      >
        {words.join(" ")}
        {last && (
          <>
            {" "}
            <span className="text-ink">{last}</span>
          </>
        )}
      </span>
    </span>
  );
}
