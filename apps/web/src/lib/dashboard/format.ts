import type { Service } from "#api/domain/dashboard/dashboard.ts";

/**
 * A unit row's full state, and the three fields that decide a fault.
 *
 * `schedule` is carried here but takes no part in judging: whether a unit is
 * healthy depends on how it ended, never on when it is next due.
 *
 * Named rather than inlined so `isDegraded` and `serviceTone` cannot drift
 * apart: both are the same question asked at two different scales, and the
 * defect this module guards against started precisely because the row and the
 * counter each answered it separately.
 */
export type ServiceState = Pick<
  Service,
  "state" | "kind" | "result" | "schedule"
>;

/**
 * Presentation helpers for the inspection sheet.
 *
 * The `DashboardOverview` shape itself is owned by the API (imported as a type
 * from `@hub/api`); only the formatting lives here.
 *
 * The one invariant this module exists to protect: a metric that could not be
 * scraped is `null` and must never render as a number. A fake "0% CPU" during an
 * outage is a defect, so `null` gets its own neutral tone instead of the healthy
 * one.
 */

/** Semantic tone for a reading. `null` is neutral, never "healthy". */
export type Tone = "pass" | "pending" | "fail" | "none";

export function safeDur(us: number): string {
  if (us < 1000) return `${us}µs`;
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)}ms`;
  return `${(us / 1_000_000).toFixed(2)}s`;
}

/**
 * Colour by load, not by taste.
 *
 * Returns a CSS custom property rather than a hex literal so the value comes
 * from the theme: the dark sheet inverts the palette, and a hardcoded green
 * here would not invert with it.
 */
export function gaugeTone(v: number | null): Tone {
  if (v === null) return "none";
  if (v > 80) return "fail";
  if (v > 60) return "pending";
  return "pass";
}

/**
 * systemd states, mapped to the form's three marks.
 *
 * Anything that is not `running` is the same "not passing" — an unreachable or
 * failed unit is one finding to a reader scanning a column, and splitting it
 * into several colours would make the column harder to read, not easier.
 */
export function serviceTone(
  unit: Pick<ServiceState, "state" | "kind" | "result">,
): Tone {
  // A oneshot that completed is not a fault even though it rests inactive, so
  // the tone follows `isDegraded` rather than the state string alone.
  return isDegraded(unit) ? "fail" : "pass";
}

/**
 * Whether a unit is a fault, per the state systemd reports.
 *
 * The bug this exists to prevent: reading `state !== "running"` counted every
 * `Type=oneshot` unit as degraded. A oneshot returns to `inactive` by design —
 * certbot-renew, pr-agent-worker and pr-agent-sync-hooks are all oneshot, all
 * timer-driven, all succeeding, and all showed as failures on every poll.
 *
 * A oneshot passes when its last run succeeded and fails when it did not. A
 * daemon fails whenever it is not running, because for a daemon `inactive` is
 * not a resting state, it is an outage.
 */
export function isDegraded(
  unit: Pick<ServiceState, "state" | "kind" | "result">,
): boolean {
  if (unit.result !== "success") return true;
  return unit.kind === "oneshot" ? false : unit.state !== "running";
}

/**
 * Number of units in a fault. The number a reader should act on.
 *
 * Takes the three judging fields rather than the whole `Service`: whether a
 * unit is degraded has never depended on when it is next due, and a signature
 * demanding a schedule would make every caller supply one it does not use.
 */
export function countDegraded(
  services: readonly Pick<ServiceState, "state" | "kind" | "result">[],
): number {
  return services.filter(isDegraded).length;
}

/** The four words a unit row can need, so this module owns no translations. */
export interface StatusWords {
  running: string;
  scheduled: string;
  completed: string;
  state: string;
}

/**
 * How a unit should be named in the ledger.
 *
 * "inactive" is a systemd mechanism, not a description of anything, and it is
 * the word that made a healthy host read as a broken one: a scheduled job sits
 * inactive between runs, so the ledger reported TLS renewal and the PR queue
 * worker as faults that had just succeeded. The reader wants to know whether
 * something is coming and when.
 *
 * The order matters, and each rung answers a different question:
 *
 *   - in a fault, the state is the fact (`failed`, `dead`). Never soften it.
 *   - a timer exists, so a job is waiting for its appointment: `scheduled`.
 *   - a finished job nothing will run again: `completed`.
 *   - otherwise, whatever systemd says — for a daemon, `inactive` is an
 *     outage and must keep reading like one.
 */
export function serviceLabel(unit: ServiceState, words: StatusWords): string {
  if (isDegraded(unit)) return unit.state || words.state;
  if (unit.schedule) return words.scheduled;
  return unit.kind === "oneshot" ? words.completed : words.running;
}

/**
 * When this unit runs next, as a reader reads a clock.
 *
 * Takes epoch milliseconds rather than the string systemd printed, so the host's
 * timestamp format is parsed once on the API side where it is known. Passing the
 * raw string to `new Date()` here rendered "Invalid Date" for every row,
 * because the timezone abbreviation systemd appends is not a parseable offset.
 *
 * Only the next run is shown. The last run is yesterday's news, and "when does
 * this fire again" is the question a reader has about a scheduled job.
 *
 * Returns null rather than a partial string when there is no next run: a bare
 * "↻" with nothing after it is worse than no line at all.
 */
export function scheduleDetail(
  schedule: NonNullable<ServiceState["schedule"]>,
  clock: (epochMs: number) => string,
): string | null {
  if (schedule.nextRun === null) return null;
  return `↻ ${clock(schedule.nextRun)}`;
}

export function fmtUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * Renders a reading, or an explicit absence.
 *
 * `—` is the form's null glyph: it is visible, it is not a number, and it can
 * never be misread as a measured zero.
 */
export function reading(
  value: number | null,
  render: (v: number) => string,
): string {
  return value === null ? "—" : render(value);
}

/**
 * A byte count in the unit a reader actually compares against.
 *
 * Binary units, because that is how disk and memory are sold and how the
 * numbers on this sheet were measured. `null` propagates rather than becoming
 * "0 B": an unanswered capacity query must not look like an empty disk.
 */
export function fmtBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  // One decimal below 10 keeps the column from jittering between 9.9 and 10.1
  // on every poll; above it, a tenth of a unit is noise nobody reads.
  const digits = value < 10 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/**
 * A percentage with the capacity it was measured against.
 *
 * Returns the two parts separately rather than one joined string so the sheet
 * can set them at different sizes: the percentage is the headline figure, the
 * total is the annotation that gives it meaning. A missing total yields an
 * empty annotation, never a fabricated one.
 */
export function withTotal(
  pct: number | null,
  used: number | null,
  total: number | null,
  render: (v: number) => string,
): { value: string; total: string | null } {
  if (pct === null) return { value: "—", total: null };
  if (total === null || used === null)
    return { value: render(pct), total: null };
  return {
    value: render(pct),
    total: `${fmtBytes(used)} / ${fmtBytes(total)}`,
  };
}
