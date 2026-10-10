/**
 * Presentation helpers for the dashboard.
 *
 * The `DashboardData` shape itself is owned by the API (imported as a type from
 * `@hub/api`); only the formatting lives here.
 */

export function safeDur(us: number): string {
  if (us < 1000) return `${us}µs`;
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)}ms`;
  return `${(us / 1_000_000).toFixed(2)}s`;
}

export function gaugeColor(v: number | null): string {
  // Neutral grey, not green. Green is the healthy signal, and painting "we
  // could not scrape this" in the healthy colour made an outage look fine.
  if (v === null) return "#6e7681";
  if (v > 80) return "#f85149";
  if (v > 60) return "#d29922";
  return "#3fb950";
}

export function serviceIndicator(state: string): string {
  switch (state) {
    case "running":
      return "bg-green-400";
    case "jaeger":
      return "bg-blue-400";
    default:
      return "bg-red-400";
  }
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
