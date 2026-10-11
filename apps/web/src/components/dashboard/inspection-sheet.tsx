import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { FieldLabel, Stamp } from "#/components/ui/form-primitives";
import {
  countDegraded,
  fmtUptime,
  gaugeTone,
  reading,
  type ServiceState,
  safeDur,
  scheduleDetail,
  serviceLabel,
  serviceTone,
  type Tone,
  withTotal,
} from "#/lib/dashboard/format";
import { sheetVerdict } from "#/lib/dashboard/verdict";
import { interpolate } from "#/lib/i18n";
import { useI18n, useLocalePath } from "#/lib/i18n/context";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

const TONE_CLASS: Record<Tone, string> = {
  pass: "text-pass",
  pending: "text-pending",
  fail: "text-fail",
  none: "text-ink-faint",
};

export function InspectionSheet() {
  const { t, locale } = useI18n();
  const localePath = useLocalePath();

  // Same key as the header and the ledger: one request serves the whole app.
  const { data, isError, isPending } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const checkedAt = new Date().toLocaleTimeString(
    locale === "id" ? "id-ID" : "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  );

  const services = data?.services ?? [];
  // A oneshot rests in `inactive` by design, so counting `state !== "running"`
  // reported three healthy timer-driven jobs as degraded on every poll.
  const degraded = countDegraded(services);

  const verdict = sheetVerdict(
    {
      error: isError,
      services: services.length,
      degraded,
      load: [data?.node.cpu, data?.node.ram, data?.node.disk],
    },
    t.status,
  );

  return (
    <div className="sheet-print mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
      {/* ── Sheet head ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink px-5 py-6 md:px-7">
        <div>
          <FieldLabel>{t.subject.label}</FieldLabel>
          <h1 className="mt-2 text-[26px] leading-none font-bold tracking-[-0.02em]">
            {t.dashboard.title}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[12px] leading-[1.55] text-ink-soft">
            {t.dashboard.note}
          </p>
          <p
            className={`reading mt-2 text-[11px] font-bold ${TONE_CLASS[verdict.tone]}`}
          >
            {verdict.text}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {services.length > 0 && (
            <Stamp>
              {interpolate(t.form.verifiedStamp, { time: checkedAt })}
            </Stamp>
          )}
          <a
            href={localePath("/")}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint uppercase underline-offset-2 hover:text-ink hover:underline"
          >
            <ArrowLeft size={11} />
            {t.dashboard.returnTo}
          </a>
        </div>
      </div>

      {/* ── Node + router readings ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px border-b border-rule bg-rule md:grid-cols-4 lg:grid-cols-6">
        <Reading
          label={t.dashboard.cpu}
          tone={gaugeTone(data?.node.cpu ?? null)}
          detail={
            data?.node.cpuCores != null
              ? interpolate(t.dashboard.ofCores, { n: data.node.cpuCores })
              : null
          }
        >
          {reading(data?.node.cpu ?? null, (v) => `${v.toFixed(1)}%`)}
        </Reading>
        <Reading
          label={t.dashboard.ram}
          tone={gaugeTone(data?.node.ram ?? null)}
          detail={
            withTotal(
              data?.node.ram ?? null,
              data?.node.ramBytes?.used ?? null,
              data?.node.ramBytes?.total ?? null,
              (v) => `${v.toFixed(1)}%`,
            ).total
          }
        >
          {reading(data?.node.ram ?? null, (v) => `${v.toFixed(1)}%`)}
        </Reading>
        <Reading
          label={t.dashboard.disk}
          tone={gaugeTone(data?.node.disk ?? null)}
          detail={
            withTotal(
              data?.node.disk ?? null,
              data?.node.diskBytes?.used ?? null,
              data?.node.diskBytes?.total ?? null,
              (v) => `${v.toFixed(1)}%`,
            ).total
          }
        >
          {reading(data?.node.disk ?? null, (v) => `${v.toFixed(1)}%`)}
        </Reading>
        <Reading label={t.dashboard.uptime} tone="pass">
          {reading(data?.llm.uptime ?? null, fmtUptime)}
        </Reading>
        <Reading label={t.dashboard.reqRate} tone="pass">
          {reading(data?.llm.reqRate ?? null, (v) => v.toFixed(2))}
        </Reading>
        <Reading label={t.dashboard.tokSpeed} tone="pass">
          {reading(data?.llm.tokSpeed ?? null, (v) => `${v.toFixed(0)} t/s`)}
        </Reading>
      </div>

      {/* ── Service ledger ──────────────────────────────────────── */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-7">
          <div className="flex items-baseline gap-3">
            <FieldLabel>{t.dashboard.services}</FieldLabel>
            {/* The count states its own denominator: "29 running of 29 units"
                answers how many are expected, which a bare 29 does not. */}
            <span className="reading text-[11px] text-ink-faint">
              {services.length > 0
                ? interpolate(t.status.servicesRunning, {
                    n: services.length,
                  })
                : `${services.length} ${t.status.unitSuffix}`}
            </span>
          </div>
          {degraded > 0 && (
            <span className="reading text-[10px] text-fail">
              {degraded} {t.status.degraded}
            </span>
          )}
        </div>

        <div className="h-px w-full bg-rule" />

        {isPending ? (
          <p className="px-5 py-6 font-mono text-[11px] text-ink-faint md:px-7">
            {t.status.pending}…
          </p>
        ) : isError ? (
          // An unreachable API is not an idle host: this is the one place that
          // says so in words, rather than rendering an empty column.
          <div className="px-5 py-6 md:px-7">
            <p className="reading text-[12px] font-bold text-fail">
              {t.status.unreachable}
            </p>
            <p className="prose mt-1.5">{t.dashboard.note}</p>
          </div>
        ) : services.length === 0 ? (
          <p className="px-5 py-6 font-mono text-[11px] text-ink-faint md:px-7">
            {t.status.noServices}
          </p>
        ) : (
          <ul className="flex flex-col">
            {services.map((service) => (
              <ServiceRow key={service.name} service={service} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Reading({
  label,
  tone,
  detail,
  children,
}: {
  label: string;
  tone: Tone;
  /** The denominator, when one was scraped. Absent renders nothing at all. */
  detail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-paper px-5 py-4 md:px-7">
      <FieldLabel>{label}</FieldLabel>
      <span className={`reading text-[15px] font-bold ${TONE_CLASS[tone]}`}>
        {children}
      </span>
      {detail && (
        <span className="reading text-[10px] text-ink-faint">{detail}</span>
      )}
    </div>
  );
}

function ServiceRow({
  service,
}: {
  service: ServiceState & { name: string; hosts: readonly string[] };
}) {
  const tone = serviceTone(service);
  const { t, locale } = useI18n();
  const nextRun = service.schedule
    ? scheduleDetail(service.schedule, (stamp) =>
        new Date(stamp).toLocaleTimeString(
          locale === "id" ? "id-ID" : "en-GB",
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        ),
      )
    : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-soft px-5 py-2.5 transition-colors hover:bg-paper-raised md:px-7">
      <span className="reading w-[150px] shrink-0 truncate text-[12px] font-bold">
        {service.name}
      </span>

      <span
        className={`reading w-[92px] shrink-0 text-[10px] ${TONE_CLASS[tone]}`}
      >
        {serviceLabel(service, {
          running: t.status.running,
          scheduled: t.status.scheduled,
          completed: t.status.completed,
          state: t.status.unknown,
        })}
      </span>

      <span className="reading flex-1 truncate text-[10px] text-ink-faint">
        {service.hosts.length > 0 ? service.hosts.join(" · ") : "—"}
      </span>

      {/* The appointment, not the history: "when does this next run" is the
          question a reader has about a scheduled job, and the last run is
          yesterday's news. */}
      {nextRun && (
        <span className="reading shrink-0 font-mono text-[9px] text-ink-faint">
          {nextRun}
        </span>
      )}

      {service.hosts.length > 0 && (
        <a
          href={`https://${service.hosts[0]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[9px] tracking-[0.1em] text-ink-faint uppercase underline-offset-2 hover:text-ink hover:underline"
        >
          {t.actions.live}
        </a>
      )}
    </li>
  );
}

/** Exported for the trace panel below the ledger. */
export function traceDuration(us: number) {
  return safeDur(us);
}
