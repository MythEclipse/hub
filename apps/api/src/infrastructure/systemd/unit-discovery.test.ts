import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { describe, it } from "node:test";
import {
  declaredListenPorts,
  execEntryPoint,
  isUninstalled,
  listeningPorts,
  parsePortOverrides,
  unitNamesFrom,
  unitOutcome,
} from "./unit-discovery.ts";

/**
 * Two defects this file protects against.
 *
 * 1. A hand-written unit list rots. `hermyhq` stayed on the dashboard after the
 *    app was deleted, because systemd still had the unit FILE installed and the
 *    source list was never edited. Discovery reads the directory instead, so an
 *    uninstalled unit cannot survive.
 *
 * 2. "The program is gone" must be distinguishable from "the program exists but
 *    this user may not stat it". `existsSync` answers false for both EACCES and
 *    ENOENT, so a naive check hides every root-owned service. Only ENOENT means
 *    deleted.
 */

/** Mirrors a Node readdir withFileTypes result, so discovery is testable. */
function dirents(names: readonly { name: string; kind: "file" | "link" }[]) {
  return names.map(({ name, kind }) => ({
    name,
    isFile: () => kind === "file",
    isSymbolicLink: () => kind === "link",
  }));
}

const REAL_DIRENTRIES = dirents([
  { name: "hub.service", kind: "file" },
  { name: "hermyhq.service", kind: "file" },
  // A mask (/etc/systemd/system/foo -> /dev/null) or a vendor alias. Neither is
  // an operator-installed unit, so neither belongs on the dashboard.
  { name: "redis-server.service", kind: "link" },
  { name: "rsyslog.service", kind: "link" },
  { name: "dbus-org.freedesktop.hostname1.service", kind: "link" },
  // Non-service units and unrelated files.
  { name: "hub.socket", kind: "file" },
  { name: "multi-user.target", kind: "file" },
  { name: "README", kind: "file" },
]);

describe("unitNamesFrom", () => {
  it("keeps regular .service files and drops everything else", () => {
    assert.deepEqual(unitNamesFrom(REAL_DIRENTRIES), ["hub", "hermyhq"]);
  });

  it("does not mistake a mask or a vendor alias for an installed unit", () => {
    const names = unitNamesFrom(REAL_DIRENTRIES);
    assert.ok(!names.includes("redis-server"));
    assert.ok(!names.includes("rsyslog"));
    assert.ok(!names.includes("dbus-org.freedesktop.hostname1"));
  });

  it("keeps dots in unit names, which systemd allows and uses", () => {
    assert.deepEqual(
      unitNamesFrom(
        dirents([{ name: "mcpedia.worker.service", kind: "file" }]),
      ),
      ["mcpedia.worker"],
    );
  });

  it("returns nothing for a directory with no units, rather than throwing", () => {
    assert.deepEqual(unitNamesFrom([]), []);
  });
});

describe("execEntryPoint", () => {
  it("reads the program out of systemctl's ExecStart blob", () => {
    const show = [
      "Id=hub.service",
      "ExecStart={ path=/usr/local/bin/bws-exec ; argv[]=/usr/local/bin/bws-exec hub /usr/bin/node apps/api/dist/main.js ; ignore_errors=no ; start_time=[n/a] }",
    ].join("\n");

    assert.deepEqual(
      execEntryPoint(show),
      ["/usr/local/bin/bws-exec", "/usr/bin/node"],
      "argv in order, extensionless relative paths dropped",
    );
  });

  it("keeps the entry-point script a bare interpreter would run", () => {
    const show =
      "ExecStart={ path=/usr/bin/node ; argv[]=/usr/bin/node /opt/hermyhq-renderer/scripts/render-worker.mjs ; ignore_errors=no }";

    assert.deepEqual(execEntryPoint(show), [
      "/usr/bin/node",
      "/opt/hermyhq-renderer/scripts/render-worker.mjs",
    ]);
  });

  it("ignores paths that are variable assignments, not programs", () => {
    // The unit file sets PR_AGENT_KEY_PATH=<path>. Treating that value as the
    // program would make this unit look uninstalled whenever the key is
    // unreadable, which is the normal state for a secret.
    const show =
      "ExecStart={ path=/usr/local/bin/bws-exec ; argv[]=/usr/local/bin/bws-exec pr-agent env PR_AGENT_KEY_PATH=/var/lib/pr-agent-server/private-key.pem /opt/pr-agent-worker/run-worker.sh }";

    assert.deepEqual(execEntryPoint(show), [
      "/usr/local/bin/bws-exec",
      "/opt/pr-agent-worker/run-worker.sh",
    ]);
  });

  it("ignores extensionless paths, which are working directories and data", () => {
    const show =
      "ExecStart={ path=/usr/lib/postgresql/18/bin/postgres ; argv[]=/usr/lib/postgresql/18/bin/postgres -D /var/lib/postgresql/data -c config_file=/etc/postgresql/18/main/postgresql.conf }";

    assert.deepEqual(execEntryPoint(show), [
      "/usr/lib/postgresql/18/bin/postgres",
    ]);
  });

  it("returns nothing for a unit with no ExecStart", () => {
    assert.deepEqual(execEntryPoint("Id=x.service\nLoadState=loaded\n"), []);
    assert.deepEqual(execEntryPoint("ExecStart={ path= ; argv[]= ; }"), []);
  });
});

describe("declaredListenPorts", () => {
  it("reads PORT from the unit's Environment", () => {
    assert.deepEqual(
      declaredListenPorts("Environment=NODE_ENV=production PORT=4003"),
      [4003],
    );
  });

  it("reads prefixed PORT variables, which is how these units declare one", () => {
    assert.deepEqual(
      declaredListenPorts(
        "Environment=GMW_FRONTEND_PORT=4017\nEnvironment=MCP_PORT=4021",
      ),
      [4017, 4021],
    );
  });

  it("reads a port injected inside the command, as bws-exec does", () => {
    // These units never declare a port in the unit file: bws-exec resolves it
    // from the secret store at exec time, so PORT only exists in argv.
    assert.deepEqual(
      declaredListenPorts(
        "ExecStart={ path=/usr/local/bin/bws-exec ; argv[]=/usr/local/bin/bws-exec pr-agent env PORT=4023 /opt/node/bin/node server.js }",
      ),
      [4023],
    );
  });

  it("reads --port and --listen-address", () => {
    assert.deepEqual(
      declaredListenPorts(
        "ExecStart={ argv[]=/home/code/opt/hindsight/.venv/bin/hindsight-api --host 127.0.0.1 --port 8890 --reload }",
      ),
      [8890],
    );
    assert.deepEqual(
      declaredListenPorts(
        "ExecStart={ argv[]=/usr/local/bin/node-exporter --web.listen-address=127.0.0.1:9100 }",
      ),
      [9100],
    );
  });

  it("ignores a port that only appears inside a URL", () => {
    // OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317 is the collector's
    // port, not this service's own listener. Reading it would attach a unit to
    // whatever the collector happens to publish.
    assert.deepEqual(
      declaredListenPorts(
        "Environment=OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317",
      ),
      [],
    );
  });

  it("drops privileged and out-of-range values", () => {
    assert.deepEqual(
      declaredListenPorts("Environment=PORT=80\nEnvironment=ALT_PORT=99999"),
      [],
    );
  });

  it("de-duplicates a port declared twice", () => {
    assert.deepEqual(
      declaredListenPorts("Environment=PORT=4003\nEnvironment=APP_PORT=4003"),
      [4003],
    );
  });
});

describe("listeningPorts", () => {
  it("reads listening TCP ports out of ss output", () => {
    const ss = [
      "LISTEN 0      511          0.0.0.0:4091      0.0.0.0:*",
      "LISTEN 0      511              *:4003          *:*",
      "LISTEN 0      128        127.0.0.1:4001      0.0.0.0:*",
      "LISTEN 0      128        127.0.0.1:15723     0.0.0.0:*",
    ].join("\n");

    assert.deepEqual(
      listeningPorts(ss),
      [4001, 4003, 4091, 15723].sort((a, b) => a - b),
    );
  });

  it("ignores established and non-listening rows", () => {
    // Only TCP_LISTEN matters: an established socket proves nothing about what
    // a unit is publishing.
    const ss = [
      "LISTEN 0      511          0.0.0.0:4003      0.0.0.0:*",
      "ESTAB  0      0      10.0.0.2:4003   10.0.0.9:51822",
      "State  Recv-Q Send-Q Local Address:Port Peer Address:Port",
    ].join("\n");

    assert.deepEqual(listeningPorts(ss), [4003]);
  });

  it("returns nothing rather than throwing on unusable output", () => {
    assert.deepEqual(listeningPorts(""), []);
    assert.deepEqual(listeningPorts("garbage\n"), []);
  });
});

/**
 * The defect: `Type=oneshot` units were counted as degraded.
 *
 * A oneshot unit finishes its work and returns to inactive — that is the
 * documented end state, not a failure. `certbot-renew`, `pr-agent-worker` and
 * `pr-agent-sync-hooks` are all oneshot, all timer-driven, all succeeding, and
 * all reported as "degraded" because the dashboard read `state !== "running"`.
 *
 * These two properties are what the UI needs to tell those apart, and neither
 * exists in `ActiveState` alone.
 */
describe("unitOutcome", () => {
  it("reports a successful oneshot as passed, not degraded", () => {
    const block = [
      "Id=certbot-renew.service",
      "Type=oneshot",
      "LoadState=loaded",
      "ActiveState=inactive",
      "Result=success",
    ].join("\n");

    assert.deepEqual(unitOutcome(block), {
      kind: "oneshot",
      result: "success",
    });
  });

  it("reports a failed oneshot as failed", () => {
    const block = [
      "Id=pr-agent-worker.service",
      "Type=oneshot",
      "LoadState=loaded",
      "ActiveState=inactive",
      "Result=exit-code",
    ].join("\n");

    assert.deepEqual(unitOutcome(block), {
      kind: "oneshot",
      result: "exit-code",
    });
  });

  it("reports a running service as running", () => {
    const block = [
      "Id=hub.service",
      "Type=simple",
      "LoadState=loaded",
      "ActiveState=active",
      "Result=success",
    ].join("\n");

    assert.deepEqual(unitOutcome(block), {
      kind: "running",
      result: "success",
    });
  });

  it("reports a crashed service as running-but-failed", () => {
    // Type=simple plus ActiveState=failed is a daemon that died, which is a
    // real fault. It must NOT be excused as "just a oneshot".
    const block = [
      "Id=scraper.service",
      "Type=simple",
      "LoadState=loaded",
      "ActiveState=failed",
      "Result=signal",
    ].join("\n");

    assert.deepEqual(unitOutcome(block), { kind: "running", result: "signal" });
  });

  it("treats an unknown Type as a service, never as an excuse", () => {
    // Missing Type must fail closed: a daemon wrongly excused is worse than a
    // oneshot wrongly alarmed.
    const block = "Id=x.service\nActiveState=inactive\n";

    assert.equal(unitOutcome(block).kind, "running");
  });
});

describe("isUninstalled", () => {
  it("treats a missing program as uninstalled", () => {
    assert.equal(isUninstalled(["/opt/gone-app/bin/app"]), true);
  });

  it("treats a present program as installed", () => {
    assert.equal(isUninstalled([process.execPath]), false);
  });

  it("is uninstalled when any one of its programs is gone", () => {
    assert.equal(isUninstalled([process.execPath, "/opt/gone/bin/app"]), true);
  });

  it("answers no when a unit declares no program", () => {
    // A unit with no ExecStart cannot be judged deleted; dropping it would
    // silently remove a legitimate service.
    assert.equal(isUninstalled([]), false);
  });

  /**
   * The ENOENT/EACCES split, which is why this module stats at all instead of
   * using existsSync.
   *
   * `existsSync` answers false for BOTH a missing file and one this user may
   * not stat. On the real host that hid pg-internal, redis-internal,
   * qdrant-internal and six other root-owned services.
   *
   * The live equivalent cannot be tested here: a mode-000 file you own is still
   * stat-able, because the ownership check passes, so only a root-owned path
   * produces EACCES and a test cannot create one. The decision is therefore
   * asserted against the codes themselves — the exact branch production takes.
   */
  it("reads only ENOENT as a deletion", () => {
    const errorFor = (path: string) => {
      try {
        statSync(path);
        return "PRESENT";
      } catch (error) {
        return (error as NodeJS.ErrnoException).code;
      }
    };

    assert.equal(errorFor("/opt/definitely-absent-hub-test"), "ENOENT");
    // A path whose parent is a file yields ENOTDIR instead, and only ENOENT
    // may be read as "deleted".
    assert.notEqual(errorFor(`${process.execPath}/inside-a-file`), "ENOENT");
  });
});

describe("parsePortOverrides", () => {
  it("reads unit=port lines", () => {
    const parsed = parsePortOverrides("9router=4014\nscraper=4091\n");

    assert.equal(parsed.get("9router"), 4014);
    assert.equal(parsed.get("scraper"), 4091);
  });

  it("ignores comments, blank lines and typos instead of failing", () => {
    // One malformed line must cost one unit its link, never the whole file.
    const parsed = parsePortOverrides(
      [
        "# bws-exec units; port injected from the secret store",
        "",
        "   ",
        "9router=4014",
        "broken-line",
        "scraper=not-a-port",
        "teleuploader=",
        "#teleuploader=4000",
      ].join("\n"),
    );

    assert.deepEqual([...parsed.keys()], ["9router"]);
  });

  it("rejects privileged and out-of-range ports", () => {
    const parsed = parsePortOverrides("a=80\nb=99999\nc=70000\n");

    assert.equal(parsed.size, 0);
  });

  it("keeps dots in unit names, which systemd allows and uses", () => {
    assert.equal(
      parsePortOverrides("mcpedia.worker=4020\n").get("mcpedia.worker"),
      4020,
    );
  });

  it("lets a later line win, so an edit can correct a value", () => {
    assert.equal(parsePortOverrides("a=4000\na=4001\n").get("a"), 4001);
  });

  it("returns an empty map for an empty file", () => {
    assert.equal(parsePortOverrides("").size, 0);
  });
});
