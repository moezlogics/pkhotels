"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: "bg-[#f7f5fc] text-ink", value: "text-ink" },
  success: {
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-700",
  },
  warning: { icon: "bg-highlight text-ink", value: "text-ink" },
  danger: { icon: "bg-red-50 text-red-600", value: "text-red-700" },
  info: { icon: "bg-ink text-white", value: "text-ink" },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tone?: StatTone;
  hint?: string;
  /** Makes the whole card a link into the filtered list view. */
  href?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  href,
  loading,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-neutral-500">{label}</p>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            styles.icon,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p
          className={cn(
            "font-display mt-2 text-[28px] font-bold tabular-nums tracking-tight sm:text-[34px]",
            styles.value,
          )}
        >
          {typeof value === "number" ? value.toLocaleString("en-PK") : value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    "rounded-[22px] border border-[color:var(--border)] bg-white p-4 transition-shadow sm:p-5",
    href &&
      "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block")}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
