import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countDegraded,
  fmtBytes,
  fmtUptime,
  gaugeTone,
  isDegraded,
  reading,
  safeDur,
  scheduleDetail,
  serviceLabel,
  serviceTone,
  withTotal,
} from "./format.ts";

// Sibling-relative import on purpose: the `#/` alias lives only in
// apps/web/tsconfig.json and is resolved only by the Vite plugin, so Node's
// runner cannot follow it.

describe("safeDur", () => {
  it("formats each magnitude at its boundary", () => {
    assert.equal(safeDur(999), "999µs");
    assert.equal(safeDur(1000), "1.0ms");
    assert.equal(safeDur(1_000_000), "1.00s");
    assert.equal(safeDur(0), "0µs");
  });
});

describe("gaugeTone", () => {
  it("reports no data as neutral, never as healthy", () => {
    // Pass is the healthy signal; null used to render in it, which made a
    // scrape outage indistinguishable from a quiet host.
    assert.notEqual(gaugeTone(null), gaugeTone(0));
    assert.equal(gaugeTone(null), "none");
  });

  it("switches to pending over 60 and fail over 80", () => {
    assert.equal(gaugeTone(60), gaugeTone(0));
    assert.notEqual(gaugeTone(60.1), gaugeTone(60));
    assert.notEqual(gaugeTone(80.1), gaugeTone(60.1));
  });
});

describe("serviceTone", () => {
  const unit = (
    state: string,
    kind: "running" | "oneshot",
    result = "success",
  ) => ({ state, kind, result });

  it("marks a running service as passing", () => {
    assert.equal(serviceTone(unit("running", "running")), "pass");
    assert.equal(serviceTone(unit("failed", "running", "exit-code")), "fail");
  });

  it("treats every non-running daemon as the same finding", () => {
    // An unreachable or failed unit is one thing to a reader scanning a
    // column; splitting it into several colours would make the column harder
    // to read, not easier.
    assert.equal(
      serviceTone(unit("failed", "running", "exit-code")),
      serviceTone(unit("activating", "running", "exit-code")),
    );
    assert.equal(
      serviceTone(unit("failed", "running", "exit-code")),
      serviceTone(unit("deactivating", "running", "exit-code")),
    );
  });

  it("does not paint a completed oneshot as a fault", () => {
    // The row mark and the degraded counter are the same question; this is
    // where the oneshot defect was visible as a red row beside a green tally.
    assert.equal(serviceTone(unit("inactive", "oneshot")), "pass");
    assert.equal(serviceTone(unit("inactive", "oneshot", "exit-code")), "fail");
  });
});

describe("isDegraded", () => {
  const unit = (
    name: string,
    state: string,
    kind: "running" | "oneshot",
    result = "success",
  ) => ({ name, state, kind, result, hasWeb: false, hosts: [] });

  /**
   * The defect. Three healthy timer-driven jobs were reported as degraded on
   * every poll, because a `Type=oneshot` unit rests in `inactive` by design and
   * the dashboard read that as "not running".
   */
  it("does not degrade a oneshot that completed successfully", () => {
    assert.equal(
      isDegraded(unit("certbot-renew", "inactive", "oneshot")),
      false,
      "a finished certbot renewal is not a fault",
    );
    assert.equal(
      isDegraded(unit("pr-agent-worker", "inactive", "oneshot")),
      false,
    );
  });

  it("does degrade a oneshot whose last run failed", () => {
    // Inactive is fine; a non-success Result is the actual fault, and it is
    // what makes the difference between "done" and "broken".
    assert.equal(
      isDegraded(unit("pr-agent-worker", "inactive", "oneshot", "exit-code")),
      true,
    );
  });

  it("still degrades a daemon that is not running", () => {
    // For a daemon, inactive is not a resting state — it is an outage.
    assert.equal(isDegraded(unit("hub", "inactive", "running")), true);
    assert.equal(isDegraded(unit("scraper", "failed", "running")), true);
  });

  it("does not degrade a running daemon", () => {
    assert.equal(isDegraded(unit("hub", "running", "running")), false);
  });

  it("treats an unknown result as a fault rather than excusing it", () => {
    // Fail closed: a unit we cannot judge must not be counted as healthy.
    assert.equal(
      isDegraded(unit("mystery", "running", "running", "unknown")),
      true,
    );
  });
});

describe("serviceLabel", () => {
  // Epoch ms, as the API now sends: 04:09 WIB and 04:02 WIB the next day.
  const timer = {
    lastRun: new Date("2026-10-11T04:09:09+07:00").getTime(),
    nextRun: new Date("2026-10-12T04:02:50+07:00").getTime(),
  };
  const words = {
    running: "running",
    scheduled: "scheduled",
    completed: "completed",
    disabled: "disabled",
    state: "inactive",
  };

  it("names a waiting job by what will start it, not by its resting state", () => {
    // The defect: certbot-renew read "inactive" beside a green mark, which
    // described systemd's mechanism and hid why the unit exists at all.
    assert.equal(
      serviceLabel(
        {
          state: "inactive",
          kind: "oneshot",
          result: "success",
          schedule: timer,
        },
        words,
      ),
      words.scheduled,
    );
  });

  it("still says scheduled with no next run known", () => {
    // pr-agent-worker's timer is monotonic: systemd states a last trigger and
    // no wall-clock next elapse. The appointment is real even if unquantified.
    assert.equal(
      serviceLabel(
        {
          state: "inactive",
          kind: "oneshot",
          result: "success",
          schedule: { lastRun: timer.lastRun, nextRun: null },
        },
        words,
      ),
      words.scheduled,
    );
  });

  it("says completed for a finished job nothing will run again", () => {
    // tailscale-routes: a successful oneshot with no timer. Not a fault, and
    // definitely not waiting for an appointment.
    assert.equal(
      serviceLabel(
        {
          state: "inactive",
          kind: "oneshot",
          result: "success",
          schedule: null,
        },
        words,
      ),
      words.completed,
    );
  });

  it("keeps the raw systemd state for a daemon that is not running", () => {
    // mc-sky. Calling this "scheduled" would promise a timer that does not
    // exist; calling it "completed" would launder an outage.
    assert.equal(
      serviceLabel(
        {
          state: "inactive",
          kind: "running",
          result: "success",
          schedule: null,
        },
        words,
      ),
      words.state,
    );
  });

  it("reports the systemd state verbatim when the unit is in a fault", () => {
    for (const result of ["exit-code", "signal", "timeout"]) {
      assert.equal(
        serviceLabel(
          { state: "failed", kind: "oneshot", result, schedule: timer },
          words,
        ),
        "failed",
        `a ${result} run was described as healthy`,
      );
    }
  });

  it("renders the next run, the appointment a reader can act on", () => {
    // The last run is yesterday's news; "when does this fire again" is the
    // question a reader actually has about a scheduled job.
    // A clock, exactly as the row builds one from the epoch it is handed.
    const clock = (epochMs: number) =>
      new Date(epochMs).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      });
    const rendered = scheduleDetail(timer, clock) ?? "";

    assert.equal(rendered, "↻ 04:02", "the next run was not made readable");
    assert.equal(
      /04:09/.test(rendered),
      false,
      "the last run crowded out the next one",
    );
  });

  it("renders no schedule at all when there is no next run", () => {
    assert.equal(
      scheduleDetail({ lastRun: timer.lastRun, nextRun: null }, (v) =>
        String(v),
      ),
      null,
      "a schedule with no next run must not render a dangling arrow",
    );
  });
});

describe("countDegraded", () => {
  it("counts only real faults across a mixed host", () => {
    const services = [
      {
        name: "hub",
        state: "running",
        kind: "running" as const,
        result: "success",
        hasWeb: true,
        hosts: [],
      },
      {
        name: "certbot-renew",
        state: "inactive",
        kind: "oneshot" as const,
        result: "success",
        hasWeb: false,
        hosts: [],
      },
      {
        name: "pr-agent-worker",
        state: "inactive",
        kind: "oneshot" as const,
        result: "success",
        hasWeb: false,
        hosts: [],
      },
      {
        name: "scraper",
        state: "failed",
        kind: "running" as const,
        result: "exit-code",
        hasWeb: false,
        hosts: [],
      },
    ];

    assert.equal(countDegraded(services), 1, "only the crashed daemon");
  });

  it("counts nothing for a wholly healthy host", () => {
    const services = [
      {
        name: "hub",
        state: "running",
        kind: "running" as const,
        result: "success",
        hasWeb: true,
        hosts: [],
      },
      {
        name: "certbot-renew",
        state: "inactive",
        kind: "oneshot" as const,
        result: "success",
        hasWeb: false,
        hosts: [],
      },
    ];

    assert.equal(countDegraded(services), 0);
  });
});

describe("reading", () => {
  it("never renders a missing value as a number", () => {
    assert.equal(
      reading(null, (v) => `${v}%`),
      "—",
    );
    assert.equal(
      reading(0, (v) => `${v}%`),
      "0%",
    );
  });
});

describe("fmtUptime", () => {
  it("rolls up through every unit", () => {
    assert.equal(fmtUptime(30), "30s");
    assert.equal(fmtUptime(90), "1m 30s");
    assert.equal(fmtUptime(3900), "1h 5m");
    assert.equal(fmtUptime(90_000), "1d 1h");
    assert.equal(fmtUptime(-5), "0s", "negative uptime must not go negative");
  });
});

describe("fmtBytes", () => {
  it("scales into a unit a reader compares against", () => {
    assert.equal(fmtBytes(512), "512 B");
    assert.equal(fmtBytes(1536), "1.5 KB");
    assert.equal(fmtBytes(123_690_532_864), "115 GB");
    assert.equal(fmtBytes(16_763_211_776), "16 GB");
  });

  it("renders an unanswered query as the null glyph, never 0 B", () => {
    assert.equal(fmtBytes(null), "—");
  });
});

describe("withTotal", () => {
  const pct = (v: number) => `${v.toFixed(1)}%`;

  it("gives a percentage its denominator", () => {
    const r = withTotal(81.9, 101_320_409_088, 123_690_532_864, pct);
    assert.equal(r.value, "81.9%");
    assert.equal(r.total, "94 GB / 115 GB");
  });

  it("keeps the figure but drops the annotation when the total is missing", () => {
    // A true reading should not disappear because its denominator is missing.
    const r = withTotal(81.9, null, null, pct);
    assert.equal(r.value, "81.9%");
    assert.equal(r.total, null);
  });

  it("never pairs a real total with a missing used figure", () => {
    const r = withTotal(50, null, 123_690_532_864, pct);
    assert.equal(r.total, null);
  });

  it("renders both parts as the null glyph when nothing was scraped", () => {
    const r = withTotal(null, null, null, pct);
    assert.equal(r.value, "—");
    assert.equal(r.total, null);
  });
});
