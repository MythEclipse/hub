import { cn } from "#/lib/cn";

/**
 * The form's atoms.
 *
 * A printed sheet has square corners, hairline rules instead of shadows, and a
 * single hand for its readings. Both surfaces are built from these four, so the
 * world cannot drift between the portfolio and the dashboard: a boundary is a
 * 1px rule, a label is tracked mono uppercase, a figure is tabular mono, and
 * colour only ever reports a state.
 */

/** A label in the technician's hand. Never a heading, never a sentence. */
export function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("field-label", className)}>{children}</span>;
}

/**
 * The form's atom: a label above a value.
 *
 * Deliberately not a card. A panel in this world is bounded by a rule, so it
 * has no fill, no radius and no shadow.
 */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel>{label}</FieldLabel>
      <div className="reading text-[11px] text-ink">{children}</div>
    </div>
  );
}

/**
 * A drawn checkbox mark.
 *
 * Status in this world is a square with a stroke, not a coloured dot and never
 * a unicode glyph — a dot reads as decoration where a tick reads as a
 * technician's decision.
 */
export function CheckMark({
  state,
  label,
}: {
  state: "pass" | "fail" | "pending" | "empty";
  label: string;
}) {
  const tone = {
    pass: "border-pass text-pass",
    fail: "border-fail text-fail",
    pending: "border-pending text-pending",
    empty: "border-rule text-transparent",
  }[state];

  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={cn("size-2.5 shrink-0 border", tone)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {state === "pass" && <path d="M2 6.5 4.6 9 10 3.2" />}
        {state === "fail" && <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />}
        {state === "pending" && <path d="M2.5 6h7" />}
      </svg>
      <span className="font-mono text-[9px] tracking-[0.1em] text-inherit uppercase">
        {label}
      </span>
    </span>
  );
}

/**
 * The one piece of hand presence on the page: a 2px box, set slightly askew,
 * marking the form verified with the time it was checked.
 */
export function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span className="stamp inline-block rotate-[-2.5deg] border-2 border-pass px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.12em] text-pass uppercase">
      {children}
    </span>
  );
}
