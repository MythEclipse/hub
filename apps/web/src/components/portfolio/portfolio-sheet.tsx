import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Mail,
} from "lucide-react";
import type { CSSProperties } from "react";
import { AccessPanel } from "#/components/portfolio/access-panel";
import {
  CheckMark,
  FieldLabel,
  Lamp,
  Stamp,
} from "#/components/ui/form-primitives";
import { countDegraded, isDegraded, type Tone } from "#/lib/dashboard/format";
import { sheetVerdict } from "#/lib/dashboard/verdict";
import { interpolate } from "#/lib/i18n";
import { useI18n, useLocalePath } from "#/lib/i18n/context";
import { projects } from "#/lib/projects";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

/* Full literal class names so Tailwind can see them: each project row carries
   one of the six test-card bars as its identity. */
const BAR_CHIP = [
  "bg-bar-yellow",
  "bg-bar-cyan",
  "bg-bar-green",
  "bg-bar-magenta",
  "bg-bar-red",
  "bg-bar-blue",
] as const;

const BAR_VAR = [
  "var(--color-bar-yellow)",
  "var(--color-bar-cyan)",
  "var(--color-bar-green)",
  "var(--color-bar-magenta)",
  "var(--color-bar-red)",
  "var(--color-bar-blue)",
] as const;

const TONE_TEXT: Record<Tone, string> = {
  pass: "text-pass",
  pending: "text-pending",
  fail: "text-fail",
  none: "text-ink-faint",
};

export function PortfolioSheet() {
  const { t, locale } = useI18n();
  const localePath = useLocalePath();

  // The card's own health reading is taken from the same box the page is served
  // from, so the tally is a measurement rather than a claim.
  const { data, isError } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const services = data?.services ?? [];
  // "Passing", not "running": a Type=oneshot job finishes and rests inactive by
  // design, so counting `state === "running"` understated this host by three
  // healthy timer-driven jobs and tinted the tally as a partial failure.
  const healthy = services.filter((s) => !isDegraded(s)).length;
  const total = services.length;
  const hasData = !isError && data != null;

  const verdict = sheetVerdict(
    {
      error: isError,
      services: total,
      degraded: countDegraded(services),
      load: [data?.node.cpu, data?.node.ram, data?.node.disk],
    },
    t.status,
  );

  const checkedAt = new Date().toLocaleTimeString(
    locale === "id" ? "id-ID" : "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div className="sheet-print mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pb-16 sm:px-6 lg:px-8">
      {/* ── Hero: the subject card on air ──────────────────────── */}
      <section className="relative border border-rule">
        <Corners />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="px-6 py-10 sm:px-9 sm:py-12 lg:px-12 lg:py-12">
            <p className="field-label">
              <span className="text-ink">{t.form.id}</span>
              {" · "}
              {t.form.kind}
              {" · "}
              {t.form.revision}
            </p>
            <h1 className="mt-4 text-[clamp(2.5rem,6.5vw,4rem)] leading-[0.95] font-bold tracking-[-0.035em] text-balance">
              Asep Haryana Saputra
            </h1>
            <p className="mt-3 max-w-[46ch] text-[13px] leading-[1.6] text-ink-soft sm:text-[14px]">
              {t.subject.degree} — {t.subject.role}
            </p>

            {/* The countersign is the primary action: this is the block a
                recruiter acts on, so it sits high and unstyled rather than
                behind a button. */}
            <div className="mt-7">
              <FieldLabel>{t.subject.countersign}</FieldLabel>
              <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2.5">
                <li>
                  <a
                    href={`mailto:${t.actions.emailAddress}`}
                    className="group inline-flex items-center gap-2 text-[13px] text-ink underline-offset-4 hover:underline"
                  >
                    <Mail
                      size={13}
                      className="shrink-0 text-ink-faint transition-colors group-hover:text-ink"
                    />
                    {t.actions.emailAddress}
                  </a>
                </li>
                <li>
                  <a
                    href={t.actions.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-[13px] text-ink underline-offset-4 hover:underline"
                  >
                    <ExternalLink
                      size={13}
                      className="shrink-0 text-ink-faint transition-colors group-hover:text-ink"
                    />
                    linkedin.com/in/mytheclipse
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/asepharyana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-[13px] text-ink underline-offset-4 hover:underline"
                  >
                    <ExternalLink
                      size={13}
                      className="shrink-0 text-ink-faint transition-colors group-hover:text-ink"
                    />
                    github.com/asepharyana
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* ── Live tally: the transmission's own reading ──────── */}
          <div className="relative flex flex-col border-t border-rule px-6 py-9 sm:px-9 lg:border-t-0 lg:border-l lg:px-10 lg:py-12">
            <Crosshair className="pointer-events-none absolute top-7 right-7 hidden size-14 text-rule lg:block" />
            <div>
              <FieldLabel>{t.subject.overall}</FieldLabel>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span
                  className={`reading text-[44px] leading-none font-bold ${
                    hasData ? TONE_TEXT[verdict.tone] : "text-ink-faint"
                  }`}
                >
                  {hasData ? `${healthy} / ${total}` : "—"}
                </span>
                <span className="reading text-[11px] text-ink-faint">
                  {hasData ? t.status.unitSuffix : t.status.noData}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Lamp tone={hasData ? verdict.tone : "none"} />
                <span
                  className={`reading text-[10px] font-bold tracking-[0.08em] uppercase ${
                    hasData ? TONE_TEXT[verdict.tone] : "text-ink-faint"
                  }`}
                >
                  {hasData ? verdict.text : t.status.noData}
                </span>
              </div>
              <div className="mt-6">
                <Stamp>
                  {interpolate(t.form.verifiedStamp, { time: checkedAt })}
                </Stamp>
              </div>
            </div>

            <div className="mt-10 lg:mt-auto lg:pt-10">
              <p className="max-w-[34ch] text-[11px] leading-[1.6] text-ink-soft">
                {t.dashboard.note}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Claim ledger ────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="max-w-[62ch]">
          <FieldLabel>{t.form.ledger}</FieldLabel>
          <p className="mt-2 text-[12px] leading-[1.6] text-ink-soft">
            {t.form.ledgerNote}
          </p>
        </div>

        <div className="mt-5 h-px w-full bg-ink" />

        <ol>
          {projects.map((project, i) => (
            <LedgerRow
              key={project.name}
              index={i + 1}
              project={project}
              barClass={BAR_CHIP[i % BAR_CHIP.length]}
              barVar={BAR_VAR[i % BAR_VAR.length]}
            />
          ))}
        </ol>
      </section>

      {/* ── Router credentials: the proof, handed over ──────────── */}
      <AccessPanel access={data?.access ?? null} />

      {/* ── Profile ─────────────────────────────────────────────── */}
      <section className="mt-12 grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
        <FieldLabel>{t.about.heading}</FieldLabel>
        <div className="prose flex flex-col gap-3">
          <p>{t.about.p1}</p>
          <p>{t.about.p2}</p>
          <p>{t.about.p3}</p>
        </div>
      </section>

      {/* ── Primary action: the card's own proof, one click away ── */}
      <section className="mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-ink pt-8">
        <p className="max-w-[46ch] text-[12px] leading-[1.6] text-ink-soft">
          {t.dashboard.note}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Stamp>
            {interpolate(t.form.verifiedStamp, { time: checkedAt })}
          </Stamp>
          <a
            href={localePath("/dashboard")}
            className="inline-flex items-center gap-2 bg-ink px-5 py-3 font-mono text-[11px] font-bold tracking-[0.08em] text-paper uppercase transition-colors hover:bg-ink-soft"
          >
            {t.actions.seeRunning}
            <ArrowRight size={12} />
          </a>
        </div>
      </section>
    </div>
  );
}

function LedgerRow({
  index,
  project,
  barClass,
  barVar,
}: {
  index: number;
  project: (typeof projects)[number];
  barClass: (typeof BAR_CHIP)[number];
  barVar: (typeof BAR_VAR)[number];
}) {
  const { t, locale } = useI18n();

  // Status is read off the project record rather than asserted: a project with
  // no live URL cannot claim to be live. Each link carries its own tick, so a
  // missing link means a missing claim instead of a missing word.

  return (
    <li
      className="ledger-row group relative border-b border-rule-soft transition-colors hover:bg-paper-raised/60"
      style={{ "--row-index": index - 1, "--row-bar": barVar } as CSSProperties}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5 gap-y-3 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="flex items-center gap-3 pt-[3px]">
          <span aria-hidden="true" className={`size-2.5 ${barClass}`} />
          <span className="reading text-[12px] font-bold text-ink-faint">
            {String(index).padStart(2, "0")}
          </span>
        </span>

        <div className="min-w-0">
          <h2 className="text-[17px] leading-snug font-bold tracking-[-0.01em] text-ink">
            {project.name}
          </h2>
          <p className="mt-1 max-w-[68ch] text-[12px] leading-[1.6] text-ink-soft">
            {project.tagline[locale]}
          </p>
          {/* The one-line summary was present in the catalogue but never shown.
              It is the row's proof sentence, and it fills the column that was
              otherwise a channel of empty paper. */}
          <p className="mt-1.5 hidden max-w-[62ch] text-[11px] leading-[1.5] text-ink-faint xl:block">
            {project.summary[locale]}
          </p>

          <details className="group/details mt-4">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-ink-faint uppercase transition-colors hover:text-ink">
              <ChevronRight
                size={10}
                aria-hidden
                className="transition-transform duration-200 group-open/details:rotate-90"
              />
              {t.ledger.whatItDoes}
              <span className="text-ink-faint group-open/details:hidden">
                {t.ledger.whatItDoesHint}
              </span>
              <span className="hidden group-open/details:inline">
                {t.ledger.whatItDoesClose}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-4 border-l border-rule pl-4 lg:grid lg:grid-cols-2 lg:gap-6">
              <ul className="flex flex-col gap-1.5">
                {project.highlights[locale].map((h) => (
                  <li
                    key={h}
                    className="text-[12px] leading-[1.5] text-ink-soft before:mr-2 before:text-ink-faint before:content-['—']"
                  >
                    {h}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{t.ledger.details}</FieldLabel>
                <p className="text-[12px] leading-[1.5] text-ink-soft">
                  {project.context?.[locale] ?? t.ledger.maintained}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="font-mono text-[9px] tracking-[0.06em] text-ink-faint"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
          {project.links.map((link) => (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-ink-faint uppercase transition-colors hover:text-ink"
            >
              <CheckMark
                state="pass"
                label={link.label === "Live" ? t.status.live : t.status.source}
              />
              <ArrowUpRight
                size={9}
                aria-hidden
                className="transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
              />
            </a>
          ))}
        </div>
      </div>
    </li>
  );
}

/** The four registration marks framing the subject card. */
function Corners() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="absolute top-0 left-0 h-3.5 w-3.5 border-t-2 border-l-2 border-ink" />
      <span className="absolute top-0 right-0 h-3.5 w-3.5 border-t-2 border-r-2 border-ink" />
      <span className="absolute bottom-0 left-0 h-3.5 w-3.5 border-b-2 border-l-2 border-ink" />
      <span className="absolute right-0 bottom-0 h-3.5 w-3.5 border-r-2 border-b-2 border-ink" />
    </div>
  );
}

/** The registration circle: a lens-alignment target, drawn not decorated. */
function Crosshair({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <circle cx="32" cy="32" r="26" strokeWidth="1" />
      <path d="M32 1v11M32 52v11M1 32h11M52 32h11" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="2.5" strokeWidth="1" />
    </svg>
  );
}
