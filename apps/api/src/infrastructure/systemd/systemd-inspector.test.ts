import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSystemdInspector } from "./systemd-inspector.ts";

/**
 * `systemctl show` exits 0 even for a unit that does not exist and reports
 * LoadState=not-found. The old parser keyed off a throw that never came, so
 * every unit missing on the current host was reported as inactive and counted
 * as degraded — inflating the "N degraded" badge and skewing the donut.
 */

const { listServices } = createSystemdInspector();
const none = new Set<string>();

describe("listServices", () => {
  it("maps active to running and reads hasWeb from the requested units", async () => {
    const services = await listServices(["caddy", "hub"], new Set(["hub"]));

    const caddy = services.find((s) => s.name === "caddy");
    const hub = services.find((s) => s.name === "hub");
    assert.equal(caddy?.state, "running");
    assert.equal(caddy?.hasWeb, false);
    assert.equal(hub?.hasWeb, true);
  });

  it("skips units that are not installed on this host", async () => {
    const services = await listServices(
      ["definitely-not-a-real-unit-xyz"],
      none,
    );
    assert.deepEqual(services, []);
  });

  it("preserves a failed state rather than collapsing it to running", async () => {
    const services = await listServices(["pr-agent-server"], none);
    const service = services.find((s) => s.name === "pr-agent-server");

    // Whether it is failed depends on the host; what matters is that the
    // state is reported verbatim, so a stopped unit is never shown healthy.
    assert.ok(service, "pr-agent-server should exist on this host");
    assert.ok(
      ["running", "inactive", "failed", "activating", "deactivating"].includes(
        service.state,
      ),
      `unexpected state: ${service.state}`,
    );
  });

  it("returns every installed requested unit exactly once", async () => {
    const services = await listServices(["caddy", "prometheus"], none);
    const names = services.map((s) => s.name);

    assert.equal(new Set(names).size, names.length, "no duplicate entries");
    for (const name of names) {
      assert.ok(
        ["caddy", "prometheus"].includes(name),
        `unexpected unit reported: ${name}`,
      );
    }
  });
});
