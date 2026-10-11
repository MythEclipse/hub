import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createSystemdInspector } from "./systemd-inspector.ts";

/**
 * The adapter holds no logic of its own any more: every reading is made in
 * unit-discovery.ts against the host, at call time. What is left to protect is
 * the shape it promises, and how it fails.
 *
 * These assertions describe rules, never inventory. Naming pg-internal, or
 * asserting a non-zero count, would pass on the VPS and fail on a CI runner,
 * which has none of these units — the hermyhq regression and the ENOENT/EACCES
 * decision are guarded in unit-discovery.test.ts, where they actually live.
 */
describe("listServices", () => {
  it("reports each unit once, under a name systemd could have produced", async () => {
    const { listServices } = createSystemdInspector();
    const services = await listServices();

    for (const service of services) {
      assert.match(
        service.name,
        /^[\w.+@-]+$/,
        `not a unit name: ${service.name}`,
      );
    }
    assert.equal(
      new Set(services.map((s) => s.name)).size,
      services.length,
      "a unit reported twice",
    );
  });

  it("carries the kind and result the UI needs to judge a unit", async () => {
    // Without these the UI falls back to `state !== "running"`, which reports
    // every finished oneshot as degraded on every poll.
    const { listServices } = createSystemdInspector();

    for (const service of await listServices()) {
      assert.ok(
        service.kind === "running" || service.kind === "oneshot",
        `${service.name} has an unknown kind: ${service.kind}`,
      );
      assert.ok(service.result.length > 0, `${service.name} has no result`);
    }
  });

  it("claims a site only when it names a host for it", async () => {
    const { listServices } = createSystemdInspector();

    for (const service of await listServices()) {
      assert.equal(
        service.hasWeb,
        service.hosts.length > 0,
        `${service.name} disagrees with itself about having a site`,
      );
    }
  });

  it("publishes hostnames Caddy actually serves, never an invented one", async () => {
    const { listServices } = createSystemdInspector();

    for (const service of (await listServices()).filter((s) => s.hasWeb)) {
      for (const host of service.hosts) {
        assert.ok(
          host.includes(".") && !host.startsWith("http"),
          `${service.name} published a non-hostname: ${host}`,
        );
      }
    }
  });

  it("never reports a unit systemd could not find", async () => {
    const { listServices } = createSystemdInspector();

    for (const service of await listServices()) {
      assert.notEqual(service.state, "not-found", service.name);
    }
  });

  it("degrades to an empty list rather than throwing when systemd is unusable", async () => {
    // A host without systemd, or a hung D-Bus socket, must not throw: one dead
    // dependency cannot be allowed to take the whole overview down with it.
    const { listServices } = createSystemdInspector();

    assert.deepEqual(
      await withShadowedSystemctl(() => listServices()),
      [],
      "unavailable systemd means no services",
    );
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
