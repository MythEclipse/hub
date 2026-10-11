export const LOCALES = ["id", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "id";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The full copy surface, in one shape.
 *
 * Every field is required, so adding a string to one locale and forgetting the
 * other is a type error rather than an `undefined` that renders as blank space
 * in half the product. Contact values live here rather than in components:
 * they are content, they are translated (the label anyway), and they must
 * change in exactly one place.
 */
export interface Messages {
  meta: { title: string; description: string };
  form: {
    id: string;
    kind: string;
    revision: string;
    cycle: string;
    verifiedStamp: string;
    ledger: string;
    ledgerNote: string;
  };
  subject: {
    label: string;
    role: string;
    degree: string;
    degreeNote: string;
    countersign: string;
    overall: string;
    summary: string;
  };
  actions: {
    seeRunning: string;
    email: string;
    linkedin: string;
    github: string;
    dashboard: string;
    live: string;
    source: string;
    emailAddress: string;
    linkedinUrl: string;
  };
  status: {
    live: string;
    source: string;
    always: string;
    pass: string;
    fail: string;
    pending: string;
    noData: string;
    running: string;
    /** A `Type=oneshot` job that completed; it rests inactive by design. */
    completed: string;
    degraded: string;
    down: string;
    unknown: string;
    unreachable: string;
    allOperational: string;
    noServices: string;
    aboveThreshold: string;
    unitSuffix: string;
    servicesRunning: string;
  };
  about: { heading: string; p1: string; p2: string; p3: string };
  ledger: {
    count: string;
    whatItDoes: string;
    whatItDoesHint: string;
    whatItDoesClose: string;
    details: string;
    maintained: string;
  };
  dashboard: {
    title: string;
    note: string;
    node: string;
    cpu: string;
    ofCores: string;
    ram: string;
    disk: string;
    services: string;
    llm: string;
    traces: string;
    links: string;
    load: string;
    load1: string;
    load5: string;
    load15: string;
    netIn: string;
    netOut: string;
    uptime: string;
    reqRate: string;
    tokRate: string;
    tokSpeed: string;
    lines: string;
    duration: string;
    durationAvg: string;
    spans: string;
    error: string;
    returnTo: string;
  };
  footer: { built: string };
}
