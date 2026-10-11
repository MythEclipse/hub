import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Mail,
} from "lucide-react";
import { CheckMark, FieldLabel, Stamp } from "#/components/ui/form-primitives";
import { isDegraded } from "#/lib/dashboard/format";
import { interpolate } from "#/lib/i18n";
import { useI18n, useLocalePath } from "#/lib/i18n/context";
import { projects } from "#/lib/projects";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

export function PortfolioSheet() {
  const { t, locale } = useI18n();
  const localePath = useLocalePath();

  // The ledger's own health column is read from the same box the page is served
  // from, so the sheet's verdict is a measurement rather than a claim.
  const { data } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  // "Passing", not "running": a Type=oneshot job finishes and rests inactive by
  // design, so counting `state === "running"` understated this host by three
  // healthy timer-driven jobs and tinted the tally as a partial failure.
  const healthy = data?.services.filter((s) => !isDegraded(s)).length;
  const total = data?.services.length;
  const checkedAt = new Date().toLocaleTimeString(
    locale === "id" ? "id-ID" : "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div className="sheet-print mx-auto flex w-full max-w-[1240px] flex-1 flex-col md:flex-row">
      {/* ── Stub bar: the only solid ink on the sheet ───────────── */}
      <aside className="flex shrink-0 flex-row justify-between bg-ink px-4 py-3 md:w-[132px] md:flex-col md:justify-between md:px-5 md:py-6">
        <div className="flex gap-3 md:block">
          <div className="font-mono text-[28px] leading-none font-bold text-paper md:text-[34px]">
            {t.form.id}
          </div>
          <p className="mt-0 font-mono text-[9px] leading-[1.5] text-paper/60 md:mt-2 md:text-[9px]">
            {t.form.kind}
            <br />
            {t.form.revision}
          </p>
        </div>
        <div className="font-mono text-[9px] leading-[1.6] text-paper/60 md:text-right">
          {t.form.cycle}
          <br />
          <span className="text-[13px] text-paper">{checkedAt}</span>
        </div>
      </aside>

      {/* ── Subject + countersign ──────────────────────────────── */}
      <aside className="flex flex-col gap-7 border-t border-rule px-5 py-7 md:w-[196px] md:shrink-0 md:border-t-0 md:border-r md:px-5 md:py-7 lg:px-6">
        <div>
          <FieldLabel>{t.subject.label}</FieldLabel>
          <h1 className="mt-2.5 text-[19px] leading-[1.15] font-bold tracking-[-0.01em] text-balance">
            Asep Haryana Saputra
          </h1>
          <p className="mt-2 text-[11px] leading-[1.5] text-ink-faint">
            {t.subject.degree}
            <br />
            {t.subject.role}
          </p>
        </div>

        {/* The countersign is the primary action: this is the block a recruiter
            acts on, so it sits high and unstyled rather than behind a button. */}
        <div>
          <FieldLabel>{t.subject.countersign}</FieldLabel>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            <li>
              <a
                href="mailto:superaseph@gmail.com"
                className="inline-flex items-center gap-1.5 text-[11px] text-ink underline-offset-2 hover:underline"
              >
                <Mail size={11} className="shrink-0 text-ink-faint" />
                superaseph@gmail.com
              </a>
            </li>
            <li>
              <a
                href={t.actions.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-ink underline-offset-2 hover:underline"
              >
                <ExternalLink size={11} className="shrink-0 text-ink-faint" />
                linkedin.com/in/mytheclipse
              </a>
            </li>
            <li>
              <a
                href="https://github.com/asepharyana"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-ink underline-offset-2 hover:underline"
              >
                <ExternalLink size={11} className="shrink-0 text-ink-faint" />
                github.com/asepharyana
              </a>
            </li>
          </ul>
        </div>

        {/* The form's conclusion, read from the same machine the sheet is
            served from. Null renders as "no data" rather than a fake 0. */}
        <div className="md:mt-auto">
          <FieldLabel>{t.subject.overall}</FieldLabel>
          <div className="mt-1.5 border border-rule p-2.5">
            {total == null ? (
              <>
                <p className="reading text-[10px] text-pending">—</p>
                <p className="mt-1 font-mono text-[9px] text-ink-faint">
                  {t.status.noData}
                </p>
              </>
            ) : (
              <>
                <p
                  className={`reading text-[13px] font-bold ${
                    healthy === total ? "text-pass" : "text-pending"
                  }`}
                >
                  {healthy ?? 0} / {total}
                </p>
                <p className="mt-1 font-mono text-[9px] text-ink-faint">
                  {t.status.unitSuffix}
                </p>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Claim ledger ───────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col px-5 py-7 md:px-7 lg:px-8">
        <div className="max-w-[62ch]">
          <FieldLabel>{t.form.ledger}</FieldLabel>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-ink-soft">
            {t.form.ledgerNote}
          </p>
        </div>

        <div className="mt-4 h-px w-full bg-ink" />

        <ol className="flex flex-col">
          {projects.map((project, i) => (
            <LedgerRow key={project.name} index={i + 1} project={project} />
          ))}
        </ol>

        {/* Profile prose, below the ledger: a form records readings first and
            explains itself afterwards. */}
        <section className="mt-9">
          <FieldLabel>{t.about.heading}</FieldLabel>
          <div className="prose mt-2.5 flex flex-col gap-3">
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <p>{t.about.p3}</p>
          </div>
        </section>

        {/* Primary action: the sheet's own proof, one click away. */}
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-7">
          <p className="max-w-[46ch] text-[12px] leading-[1.55] text-ink-soft">
            {t.dashboard.note}
          </p>
          <div className="flex items-center gap-4">
            <Stamp>
              {interpolate(t.form.verifiedStamp, { time: checkedAt })}
            </Stamp>
            <a
              href={localePath("/dashboard")}
              className="inline-flex items-center gap-2 border border-ink px-4 py-2 font-mono text-[11px] font-bold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-ink hover:text-paper"
            >
              {t.actions.seeRunning}
              <ArrowRight size={12} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function LedgerRow({
  index,
  project,
}: {
  index: number;
  project: (typeof projects)[number];
}) {
  const { t, locale } = useI18n();

  // Status is read off the project record rather than asserted: a project with
  // no live URL cannot claim to be live. Each link carries its own tick, so a
  // missing link means a missing claim instead of a missing word.

  return (
    <li
      className="ledger-row relative border-b border-rule-soft py-5 transition-colors hover:bg-paper-raised"
      style={{ "--row-index": index - 1 } as React.CSSProperties}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_7.5rem]">
        <span className="reading pt-px text-[12px] font-bold text-ink-faint">
          {String(index).padStart(2, "0")}
        </span>

        <div className="min-w-0">
          <h2 className="text-[15px] leading-snug font-bold tracking-[-0.01em] text-ink">
            {project.name}
          </h2>
          <p className="mt-1 max-w-[68ch] text-[12px] leading-[1.55] text-ink-soft">
            {project.tagline[locale]}
          </p>
          {/* The one-line summary was present in the catalogue but never shown.
              It is the row's proof sentence, and it fills the column that was
              otherwise a channel of empty paper. */}
          <p className="mt-1.5 hidden max-w-[62ch] text-[11px] leading-[1.5] text-ink-faint xl:block">
            {project.summary[locale]}
          </p>
        </div>

        <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:col-start-3 sm:flex-col sm:items-end sm:gap-2">
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

      <details className="group mt-3 sm:ml-9">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-ink-faint uppercase transition-colors hover:text-ink">
          <ChevronRight
            size={10}
            aria-hidden
            className="transition-transform duration-200 group-open:rotate-90"
          />
          {t.ledger.whatItDoes}
          <span className="text-ink-faint group-open:hidden">
            {t.ledger.whatItDoesHint}
          </span>
          <span className="hidden group-open:inline">
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
    </li>
  );
}
