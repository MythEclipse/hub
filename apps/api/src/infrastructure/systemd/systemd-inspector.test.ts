import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createSystemdInspector,
  parseSystemctlShow,
} from "./systemd-inspector.ts";

/**
 * The defect under test: `systemctl show` exits 0 even for a unit that does not
 * exist and reports LoadState=not-found. A parser keyed off a throw therefore
 * reported every unit missing on the current host as inactive and counted it
 * as degraded — inflating the "N degraded" badge and skewing the donut.
 *
 * The parsing tests run against fixture output rather than the live systemctl,
 * because a CI runner has none of the monitored units installed: a
 * host-dependent test passes on the VPS and fails on GitHub, which is the
 * opposite of useful. The fixture below is verbatim `systemctl show` output.
 */

const FIXTURE = `Id=caddy.service
LoadState=loaded
ActiveState=active

Id=pr-agent-server.service
LoadState=loaded
ActiveState=failed

Id=not-installed-here.service
LoadState=not-found
ActiveState=inactive

Id=idle.service
LoadState=loaded
ActiveState=inactive

`;

describe("parseSystemctlShow", () => {
  const webUnits = new Set(["caddy", "idle"]);

  it("maps active to running and reads hasWeb from webUnits", () => {
    const caddy = parseSystemctlShow(FIXTURE, webUnits).find(
      (s) => s.name === "caddy",
    );

    assert.deepEqual(caddy, { name: "caddy", state: "running", hasWeb: true });
  });

  it("skips units that are not installed on this host", () => {
    const services = parseSystemctlShow(FIXTURE, webUnits);

    assert.equal(
      services.find((s) => s.name === "not-installed-here"),
      undefined,
      "a not-found unit must not be reported as a service at all",
    );
    assert.deepEqual(
      services.map((s) => s.name),
      ["caddy", "pr-agent-server", "idle"],
    );
  });

  it("preserves failed and inactive states verbatim", () => {
    const states = new Map(
      parseSystemctlShow(FIXTURE, webUnits).map((s) => [s.name, s.state]),
    );

    assert.equal(states.get("pr-agent-server"), "failed");
    assert.equal(states.get("idle"), "inactive");
  });

  it("does not mark a unit web-facing when it is absent from webUnits", () => {
    const service = parseSystemctlShow(FIXTURE, webUnits).find(
      (s) => s.name === "pr-agent-server",
    );

    assert.equal(service?.hasWeb, false);
  });

  it("ignores empty and malformed blocks", () => {
    assert.deepEqual(parseSystemctlShow("", webUnits), []);
    assert.deepEqual(parseSystemctlShow("garbage\n", webUnits), []);
    // Id present but no ActiveState — nothing trustworthy to report.
    assert.deepEqual(parseSystemctlShow("Id=x.service\n", webUnits), []);
  });

  it("reports every missing unit as skipped rather than degraded", () => {
    const allMissing = Array.from(
      { length: 22 },
      (_, i) =>
        `Id=ghost-${i}.service\nLoadState=not-found\nActiveState=inactive`,
    ).join("\n\n");

    assert.deepEqual(
      parseSystemctlShow(allMissing, webUnits),
      [],
      "a host with none of the monitored units must show zero services, not 22 failures",
    );
  });
});

describe("listServices against the live systemctl", () => {
  it("yields no service for a unit that is not installed", async () => {
    const { listServices } = createSystemdInspector();
    const services = await listServices(
      ["definitely-not-a-real-unit-xyz"],
      new Set(),
    );

    assert.deepEqual(services, []);
  });

  it("returns at most one entry per requested unit, installed or not", async () => {
    const { listServices } = createSystemdInspector();
    const requested = ["definitely-not-a-real-unit-xyz", "another-fake-unit"];
    const names = (await listServices(requested, new Set())).map((s) => s.name);

    assert.equal(new Set(names).size, names.length, "no duplicate entries");
    for (const name of names) {
      assert.ok(requested.includes(name), `unrequested unit reported: ${name}`);
    }
  });

  it("degrades to an empty list when systemctl is unusable", async () => {
    // A host without systemd, or a hung D-Bus socket, must not throw: one dead
    // dependency cannot be allowed to take the whole overview down with it.
    const { listServices } = createSystemdInspector();
    const requested = ["caddy", "hub", "prometheus"];

    const services = await withShadowedSystemctl(() =>
      listServices(requested, new Set(["hub"])),
    );

    assert.deepEqual(services, [], "unavailable systemd means no services");
  });
});

/**
 * Runs `fn` with a `systemctl` on PATH that always fails, so the
 * systemd-unavailable path is exercised on a host where systemd works.
 */
async function withShadowedSystemctl<T>(fn: () => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "no-systemctl-"));
  const stub = join(dir, "systemctl");
  writeFileSync(stub, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}:${originalPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
}
