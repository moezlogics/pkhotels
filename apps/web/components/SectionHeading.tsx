import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One way to title a section across the public site: a small "• LABEL"
 * eyebrow, a tight display heading (wrap a word in <span className="mark">
 * for the yellow highlighter), one line of context, and a round "See all"
 * on the right.
 */
export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  href,
  hrefLabel = "See all",
  className,
  dark,
  as: Tag = "h2",
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Shortcut for the usual "See all" link. */
  href?: string;
  hrefLabel?: string;
  className?: string;
  dark?: boolean;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 md:mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cn("eyebrow mb-2", dark && "eyebrow-light")}>{eyebrow}</p>}
        <Tag className={cn("font-display text-[28px] font-bold leading-[1.05] md:text-[40px]", dark ? "text-white" : "text-ink")}>{title}</Tag>
        {description && <p className={cn("mt-1.5 max-w-xl text-[15.5px] md:text-[17px]", dark ? "text-white/65" : "text-neutral-500")}>{description}</p>}
      </div>
      {action ? (
        <div className="shrink-0">{action}</div>
      ) : href ? (
        <Link
          href={href}
          aria-label={typeof title === "string" ? `${hrefLabel}: ${title}` : hrefLabel}
          className={cn(
            "group inline-flex shrink-0 items-center gap-2 rounded-full text-[15px] font-semibold",
            dark ? "text-white" : "text-ink",
          )}
        >
          <span className="hidden sm:inline">{hrefLabel}</span>
          <span className={cn("grid h-10 w-10 place-items-center rounded-full border transition group-hover:bg-primary group-hover:border-primary group-hover:text-white", dark ? "border-white/25" : "border-ink/15 bg-white")}>
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ) : null}
    </div>
  );
}
