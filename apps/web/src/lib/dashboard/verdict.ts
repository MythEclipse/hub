import type { Tone } from "./format";

export interface VerdictInput {
  /** null while the first request is in flight or the API is unreachable. */
  error: boolean;
  services: number;
  degraded: number;
  /** Node percentages; null entries were not scraped and are not counted. */
  load: Array<number | null | undefined>;
}

export interface Verdict {
  text: string;
  tone: Tone;
}

/**
 * The sheet's conclusion.
 *
 * Computed from every reading rather than from the unit states alone: a host
 * whose services are all running but whose disk sits at 81% is not
 * "all systems operational", and a form whose verdict can be contradicted by
 * its own numbers is not a form.
 *
 * The header and the dashboard share this so the two can never disagree —
 * a verdict that changes depending on which component you are looking at is
 * worse than no verdict.
 */
export function sheetVerdict(
  input: VerdictInput,
  t: {
    unreachable: string;
    noServices: string;
    degraded: string;
    aboveThreshold: string;
    allOperational: string;
  },
): Verdict {
  if (input.error) return { text: t.unreachable, tone: "fail" };
  if (input.services === 0) return { text: t.noServices, tone: "pending" };
  if (input.degraded > 0) {
    return { text: `${input.degraded} ${t.degraded}`, tone: "pending" };
  }

  const strained = input.load.filter(
    (v): v is number => v != null && v > 80,
  ).length;
  if (strained > 0) {
    return { text: `${strained} ${t.aboveThreshold}`, tone: "pending" };
  }

  return { text: t.allOperational, tone: "pass" };
}
