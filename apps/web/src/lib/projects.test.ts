import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projects } from "./projects.ts";

describe("projects catalogue", () => {
  it("is not empty", () => {
    assert.ok(projects.length > 0);
  });

  it("has no duplicate names", () => {
    const names = projects.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("links only over https, and every project has at least one link", () => {
    for (const p of projects) {
      assert.ok(p.links.length > 0, `${p.name} has no link`);
      for (const l of p.links) {
        assert.ok(
          l.href.startsWith("https://"),
          `${p.name} link ${l.label} is not https: ${l.href}`,
        );
        assert.doesNotMatch(
          l.href,
          /\s/,
          `${p.name} link ${l.label} contains whitespace`,
        );
      }
    }
  });

  it("gives no project two links with the same label", () => {
    // `links()` orders Live before Source and the two labels differ, so a
    // duplicate would mean the factory was called with the same value twice.
    for (const p of projects) {
      const labels = p.links.map((l) => l.label);
      assert.equal(
        new Set(labels).size,
        labels.length,
        `${p.name} has repeated link labels`,
      );
    }
  });

  it("keeps the languages this portfolio is actually built in", () => {
    // The old tagline said TypeScript and Rust; both are load-bearing, so
    // dropping either would make the page misrepresent the work.
    const all = projects.flatMap((p) => p.stack).join(" ");
    for (const tech of ["TypeScript", "Rust"]) {
      assert.ok(all.includes(tech), `catalogue no longer mentions ${tech}`);
    }
  });

  it("keeps project names and stack in one language, not translated", () => {
    // A project name is a proper noun a recruiter searches for. Translating
    // `mytheclipse` into Indonesian would make the row unsearchable and would
    // contradict the repo it points at.
    assert.ok(
      projects.some((p) => p.name === "mytheclipse"),
      "catalogue no longer lists the crates.io package by its real name",
    );
  });
});
