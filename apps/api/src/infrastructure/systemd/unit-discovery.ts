import { execFile } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Where systemd keeps units an operator installed by hand. */
const ADMIN_UNIT_DIR = "/etc/systemd/system";

/**
 * Ports that cannot be read from the host, for the only reason they cannot:
 * the value lives in Bitwarden and is injected by `bws-exec` at exec time, so
 * no unit file, `ExecStart` or `Environment` ever states it.
 *
 * This is the one place a port is written down rather than discovered, and it
 * is deliberately narrow: nine units whose ExecStart is `/usr/local/bin/bws-exec
 * <app> …`. Everything else is read live.
 *
 * Kept outside the source tree because it is host state, not code, and it must
 * be editable without a deploy. A unit listed here whose unit file is gone is
 * ignored — discovery already answers that question, and no override can
 * resurrect a deleted service.
 *
 * Format: `unit=port`, one per line. No secrets: these are port numbers that
 * are already visible in the process table of every local user.
 */
const PORT_OVERRIDE_FILE = "/etc/hub/unit-ports.conf";

/** Caddy's admin API: the live source of truth for hostname -> upstream port. */
const CADDY_ADMIN_URL = "http://127.0.0.1:2019/config/apps/http/servers/";

/**
 * The subset of a readdir entry this module needs. Narrowing it keeps
 * `unitNamesFrom` testable without a real directory.
 */
export interface UnitDirent {
  name: string;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

/**
 * Unit names of everything an operator installed under /etc/systemd/system.
 *
 * Read from the host rather than kept in source, because a list written by hand
 * outlives what it names: `hermyhq` stayed on the dashboard for weeks after the
 * app and its unit were deleted, and no edit to the source could fix it — only
 * the filesystem knows. Discovery also removes the sync step where adding a
 * service meant remembering to edit a list.
 *
 * Symlinks are excluded. A symlink here is either a mask (-> /dev/null) or a
 * vendor alias (-> /usr/lib/...), and neither is an operator-installed service.
 * Following them would list apt-daily as a dashboard service.
 */
export function unitNamesFrom(
  entries: readonly UnitDirent[],
): readonly string[] {
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".service"))
    .map((entry) => entry.name.replace(/\.service$/, ""));
}

/** Lists the admin unit directory, or nothing if it cannot be read. */
export function discoverUnits(): readonly string[] {
  try {
    return unitNamesFrom(readdirSync(ADMIN_UNIT_DIR, { withFileTypes: true }));
  } catch {
    // No /etc/systemd/system at all: not systemd, or a container without it.
    return [];
  }
}

/**
 * Absolute paths a unit actually executes, in argv order.
 *
 * Filters argv down to what the kernel must have on disk for `ExecStart` to
 * succeed: the program and any script handed to an interpreter. Deliberately
 * excluded:
 *
 *   - extensionless paths — working directories (`-D /var/lib/postgresql/data`)
 *     and data files (`config_file=/etc/postgresql/…`). Those are unreadable to
 *     this user in the normal case, and counting them here would misreport
 *     every root-owned database as uninstalled.
 *   - values of `KEY=value` pairs inside `env`/`bws-exec` arguments, which are
 *     secret paths, not programs.
 *
 * The caller treats ENOENT on one of these as "this unit no longer exists";
 * EACCES must stay a non-signal or that check would bury healthy services.
 */
export function execEntryPoint(showOutput: string): readonly string[] {
  const argv = showOutput.match(/argv\[\]=(.*?)(?:;|\n|$)/s)?.[1] ?? "";
  const tokens = (argv.match(/(?:[^\s;,]|"[^"]*")+/g) ?? []).map((token) =>
    token.replace(/^"|"$/g, ""),
  );

  const paths: string[] = [];
  for (const [index, token] of tokens.entries()) {
    if (!token.startsWith("/")) continue;
    // KEY=value: an env var or a `config_file=/etc/...` style option value.
    if (/^[^=]+=/.test(token)) continue;
    // The value of the preceding flag: `-D /var/lib/postgresql/data`. Those are
    // working directories and config files, and they are routinely unreadable
    // to this user — counting them here would report every root-owned
    // database as uninstalled.
    if (index > 0 && /^--?[^\s=]+$/.test(tokens[index - 1])) continue;
    paths.push(token);
  }
  return paths;
}

/**
 * Ports a unit declares it listens on, ascending.
 *
 * These units declare ports in three different places, so all three are read:
 * `Environment=PORT=`, `Environment=SOME_PREFIX_PORT=`, and a `PORT=` injected
 * into argv by the `bws-exec` secret wrapper (which is the only place the port
 * appears for those units — the unit file never declares one).
 *
 * Anchored to a whole token, so a port inside a URL
 * (`OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317`) is not mistaken for
 * this service's own listener. That URL names a *different* service, and
 * reading it would attach a unit to whatever the peer happens to publish.
 */
export function declaredListenPorts(showOutput: string): readonly number[] {
  const ports = new Set<number>();

  // `PORT=`, `APP_PORT=`, `Environment=SOME_PORT=`: anchored to a token boundary
  // so a port inside a URL (`OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317`)
  // is not read as this service's own listener — that URL names a peer, not us.
  for (const match of showOutput.matchAll(
    /(?:^|[\s;=])[A-Za-z0-9_]*PORT=(\d+)/g,
  )) {
    ports.add(Number(match[1]));
  }

  // `--port 8890`, `--port=8890`, and prefixed forms like
  // `--web.listen-address=127.0.0.1:9100`. The trailing group must be
  // followed by a token end, so `--node-exporter` is not read as a port flag.
  for (const match of showOutput.matchAll(
    /--[\w.-]*(?:port|listen-address)(?:=|\s+)(\S*?)(\d{2,5})(?=\s|$|;)/g,
  )) {
    ports.add(Number(match[2]));
  }

  return [...ports]
    .filter((port) => port >= 1024 && port <= 65535)
    .sort((a, b) => a - b);
}

/**
 * Ports currently in LISTEN state, ascending.
 *
 * Deliberately unprivileged (`ss` without `-p`): this process runs as `hub`,
 * and socket attribution needs privileges it does not have. Only the ports
 * themselves are needed, since the port is the join key to Caddy's config.
 *
 * Parsed from text rather than trusted from any single format: the same parse
 * accepts `ss` output on any address family, and `LISTEN` is the only state
 * that means "this is accepting connections".
 */
export function listeningPorts(ssOutput: string): readonly number[] {
  const ports = new Set<number>();

  for (const line of ssOutput.split("\n")) {
    if (!/\bLISTEN\b/.test(line)) continue;
    const port = line.match(
      /(\d{1,3}(?:\.\d{1,3}){3}|\*|\[[\da-f:]+\]):(\d+)\s/,
    );
    if (port) ports.add(Number(port[2]));
  }

  return [...ports].sort((a, b) => a - b);
}

/**
 * What kind of unit this is, and how its last run ended.
 *
 * `ActiveState` alone cannot tell a finished job from a dead daemon: a oneshot
 * unit returns to `inactive` by design, exactly as a `Type=simple` unit does
 * after crashing. Reading `state !== "running"` therefore alarmed at three
 * healthy timer-driven jobs on every poll.
 *
 * `Result` is the field that disambiguates. It is `success` after a oneshot
 * completes and `exit-code`/`signal`/`timeout` when it genuinely failed, and it
 * is reset on every start, so it always describes the most recent run.
 *
 * An unreadable `Type` fails closed to `running`: a daemon wrongly excused as a
 * job is a worse error than a job wrongly reported as degraded.
 */
export function unitOutcome(block: string): {
  kind: "running" | "oneshot";
  result: string;
} {
  const type = /^Type=(\S+)/m.exec(block)?.[1];
  return {
    kind: type === "oneshot" ? "oneshot" : "running",
    result: /^Result=(\S+)/m.exec(block)?.[1] ?? "unknown",
  };
}

/**
 * True when a unit's program is genuinely gone from disk.
 *
 * The ENOENT/EACCES split is the entire point. This process runs as the unprivileged
 * `hub` user, and most service programs are root-owned: a missing file and an
 * unreadable one both make `existsSync` return false, so a plain existence check
 * reports pg-internal, redis-internal, qdrant-internal and half a dozen others as
 * deleted. `statSync`'s error code separates them.
 */
export function isUninstalled(paths: readonly string[]): boolean {
  return paths.some((path) => {
    try {
      statSync(path);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT";
    }
  });
}

/** Systemd state for every unit in one call, as blank-line-separated blocks. */
async function showUnits(units: readonly string[]): Promise<string> {
  if (units.length === 0) return "";
  try {
    const { stdout } = await execFileAsync(
      "systemctl",
      [
        "show",
        ...units.map((unit) => `${unit}.service`),
        "-p",
        "Id",
        "-p",
        "ActiveState",
        "-p",
        "LoadState",
        "-p",
        "Type",
        "-p",
        "Result",
        "-p",
        "ExecStart",
        "-p",
        "Environment",
        "--no-pager",
      ],
      { timeout: 2000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout;
  } catch {
    return "";
  }
}

/**
 * Hostnames Caddy currently publishes, keyed by the upstream port behind them.
 *
 * Read from the live admin API rather than a checked-in map, for the same
 * reason as `discoverUnits`: a hand-written hostname list goes stale silently.
 * It survives deletion of the site behind it, so the dashboard keeps publishing
 * a link to a hostname whose upstream answers 502 — the exact failure that left
 * `hamc.asepharyana.my.id` listed after the app was removed.
 *
 * Inverted deliberately: the port is the join key, because the port is what
 * systemd reports for a unit and the hostname is what Caddy reports. Nothing
 * else correlates the two.
 */
async function publishedHostnamesByPort(): Promise<Map<number, string[]>> {
  const byPort = new Map<number, Set<string>>();

  const collect = (
    routes: readonly Record<string, unknown>[],
    hosts: Set<string>,
    ports: Set<number>,
  ): void => {
    for (const route of routes) {
      for (const match of (route.match ?? []) as { host?: string[] }[]) {
        for (const host of match.host ?? []) hosts.add(host);
      }
      for (const handle of (route.handle ?? []) as Record<string, unknown>[]) {
        if (handle.handler === "subroute") {
          collect(handle.routes as Record<string, unknown>[], hosts, ports);
        }
        if (handle.handler === "reverse_proxy") {
          for (const upstream of (handle.upstreams ?? []) as {
            dial?: string;
          }[]) {
            const dial = upstream.dial?.match(/:(\d+)$/)?.[1];
            if (dial) ports.add(Number(dial));
          }
        }
      }
    }
  };

  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["--silent", "--max-time", "3", `${CADDY_ADMIN_URL}srv0/routes/`],
      { timeout: 4000, maxBuffer: 4 * 1024 * 1024 },
    );
    for (const route of JSON.parse(stdout) as Record<string, unknown>[]) {
      const hosts = new Set<string>();
      const ports = new Set<number>();
      collect([route], hosts, ports);
      for (const port of ports) {
        const known = byPort.get(port) ?? new Set<string>();
        for (const host of hosts) known.add(host);
        byPort.set(port, known);
      }
    }
  } catch {
    // Caddy absent, admin API closed, or malformed JSON. No hostnames is a
    // correct answer: a unit simply renders without links rather than guessing.
  }

  return new Map([...byPort].map(([port, hosts]) => [port, [...hosts].sort()]));
}

/**
 * Operator-declared ports, for the units whose port only exists in Bitwarden.
 *
 * Parsed as `unit=port`, ignoring blanks, comments and anything malformed: a
 * typo here must cost one unit its link, never the whole dashboard.
 */
export function parsePortOverrides(contents: string): Map<string, number> {
  const overrides = new Map<string, number>();

  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([\w.+@-]+)\s*=\s*(\d{2,5})\s*$/);
    if (!match) continue;
    const port = Number(match[2]);
    if (port >= 1024 && port <= 65535) overrides.set(match[1], port);
  }

  return overrides;
}

/** Ports Caddy publishes, restricted to upstreams that are actually accepting. */
function liveHostnames(
  byPort: ReadonlyMap<number, readonly string[]>,
  ports: readonly number[],
): string[] {
  return [...new Set(ports.flatMap((port) => byPort.get(port) ?? []))].sort();
}

export interface DiscoveredService {
  name: string;
  state: string;
  /** "running" for a daemon, "oneshot" for a job that finishes and exits. */
  kind: "running" | "oneshot";
  /** Outcome of the most recent run: success, exit-code, signal, timeout… */
  result: string;
  /** False when the unit file survived but the program it runs did not. */
  installed: boolean;
  /** Ports the unit declares, ascending. */
  ports: readonly number[];
  /** Hostnames Caddy publishes on any of those ports. */
  hosts: readonly string[];
}

/** Ports currently accepting connections on this host. */
async function liveListenPorts(): Promise<Set<number>> {
  try {
    const { stdout } = await execFileAsync("ss", ["-ltnH"], {
      timeout: 2000,
      maxBuffer: 1024 * 1024,
    });
    return new Set(listeningPorts(stdout));
  } catch {
    // No `ss`, or no permission to read the socket table. Treated as "nothing
    // is listening", so units render without links rather than with dead ones.
    return new Set();
  }
}

/** Operator-declared ports for units whose port is secret-injected. */
async function readPortOverrides(): Promise<ReadonlyMap<string, number>> {
  try {
    return parsePortOverrides(await readFile(PORT_OVERRIDE_FILE, "utf8"));
  } catch {
    // Absent file, or unreadable: every unit falls back to its declared port.
    return new Map();
  }
}

/**
 * Every installed unit on the host, with its state and published hostnames.
 *
 * The one behaviour worth stating: a unit whose ExecStart program has been
 * deleted is dropped, not reported as inactive. That is the `hermyhq` case. Its
 * unit file outlived the app, so systemd calls it loaded and inactive, and every
 * state-based filter keeps it on the dashboard forever. Nothing about its state
 * can distinguish it from a service that is merely stopped — only the missing
 * program can.
 */
export async function discoverServices(): Promise<DiscoveredService[]> {
  const units = discoverUnits();
  const [show, hostnames, listening, overrides] = await Promise.all([
    showUnits(units),
    publishedHostnamesByPort(),
    liveListenPorts(),
    readPortOverrides(),
  ]);

  const services: DiscoveredService[] = [];

  for (const name of units) {
    const block = show
      .split("\n\n")
      .find((candidate) => candidate.startsWith(`Id=${name}.service\n`));
    if (!block || /^LoadState=not-found$/m.test(block)) continue;
    if (isUninstalled(execEntryPoint(block))) continue;

    const state = /^ActiveState=(\w+)/m.exec(block)?.[1] ?? "unknown";
    const { kind, result } = unitOutcome(block);
    const declared = declaredListenPorts(block);
    const override = overrides.get(name);
    // The declared port wins when there is one, so a unit whose ExecStart
    // states its port never depends on the override file being present.
    const ports = override ? [...new Set([...declared, override])] : declared;

    services.push({
      name,
      state: state === "active" ? "running" : state,
      kind,
      result,
      installed: true,
      ports,
      // Only a port that is accepting right now can have a live site behind it.
      // Caddy keeps serving a hostname long after its upstream is gone, and
      // `hamc.asepharyana.my.id` answering 502 was the visible symptom.
      hosts: liveHostnames(
        hostnames,
        ports.filter((port) => listening.has(port)),
      ),
    });
  }

  return services;
}
