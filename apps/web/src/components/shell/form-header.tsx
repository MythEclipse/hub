import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useI18n, useLocalePath } from "#/lib/i18n/context";

const TONE_CLASS = {
  pass: "text-pass",
  pending: "text-pending",
  fail: "text-fail",
  none: "text-ink-faint",
} as const;

import { sheetVerdict } from "#/lib/dashboard/verdict";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

/**
 * The stub bar and the sheet's top rule.
 *
 * A triplicate form is perforated along one edge: the stub carries the form
 * number and the shift clock, and it is the only region of solid ink on the
 * page. That is why this bar is vertical and dark while everything else is
 * paper — the rule is doing the work, not a shadow.
 */
export function FormHeader() {
  const { t, locale } = useI18n();
  const localePath = useLocalePath();
  const { theme, setTheme } = useTheme();
  const [time, setTime] = useState("");

  // Same query key as the ledger, so one interval costs one request rather
  // than two independent pollers.
  const { data, isError } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const total = data?.services.length ?? 0;
  const degraded =
    data?.services.filter((s) => s.state !== "running").length ?? 0;

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString(locale === "id" ? "id-ID" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [locale]);

  // An unreachable API is not an idle system: without this the stamp would
  // read "0 units" and a total outage would look like a quiet host. The
  // verdict is shared with the dashboard so the two can never disagree.
  const verdict = sheetVerdict(
    {
      error: isError,
      services: total,
      degraded,
      load: [data?.node.cpu, data?.node.ram, data?.node.disk],
    },
    t.status,
  );

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <a
          href={localePath("/")}
          className="flex items-baseline gap-2.5 no-underline"
        >
          <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-ink">
            {t.form.id}
          </span>
          <span className="hidden text-[11px] text-ink-faint sm:inline">
            {t.form.kind}
          </span>
        </a>

        <div className="flex items-center gap-3">
          <span className={`reading text-[10px] ${TONE_CLASS[verdict.tone]}`}>
            {verdict.text}
          </span>
          <span className="reading text-[10px] text-ink-faint">{time}</span>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="cursor-pointer border border-rule p-1 text-ink transition-colors hover:border-ink hover:bg-paper-raised"
          >
            <Sun className="hidden dark:block" size={12} />
            <Moon className="block dark:hidden" size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
