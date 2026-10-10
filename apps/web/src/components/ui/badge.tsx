import type { HTMLAttributes } from "react";
import { cn } from "#/lib/utils";

/**
 * Hand-written replacement for the shadcn badge.
 * No class-variance-authority: a plain string map keyed by variant.
 */

const BADGE_VARIANTS = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border text-foreground",
} as const;

const BADGE_BASE =
  "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors";

export type BadgeVariant = keyof typeof BADGE_VARIANTS;

export function badgeVariants({
  variant = "default",
  className,
}: {
  variant?: BadgeVariant;
  className?: string;
} = {}) {
  return cn(BADGE_BASE, BADGE_VARIANTS[variant], className);
}

export function Badge({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={badgeVariants({ variant, className })} {...props} />;
}
