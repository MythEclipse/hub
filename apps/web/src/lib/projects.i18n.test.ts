import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCALES } from "./i18n/index.ts";
import { projects } from "./projects.ts";

/**
 * Both locales must be present and structurally identical for every project.
 *
 * A missing translation is not a type error here — `Record<Locale, string>`
 * in the data only guarantees the key exists at compile time if the literals
 * are written out, and a hand-edited catalogue can still drift. This walks the
 * actual values so drift fails the suite rather than the page.
 */
describe("projects catalogue is bilingual", () => {
  it("gives every translatable field in every locale", () => {
    for (const p of projects) {
      for (const locale of LOCALES) {
        assert.ok(
          p.tagline[locale]?.trim(),
          `${p.name} has no ${locale} tagline`,
        );
        assert.ok(
          p.summary[locale]?.trim(),
          `${p.name} has no ${locale} summary`,
        );
        assert.ok(
          p.highlights[locale]?.length,
          `${p.name} has no ${locale} highlights`,
        );
        if (p.context) {
          assert.ok(
            p.context[locale]?.trim(),
            `${p.name} has no ${locale} context`,
          );
        }
      }
    }
  });

  it("translates rather than copying the English into Indonesian", () => {
    for (const p of projects) {
      assert.notEqual(
        p.tagline.id,
        p.tagline.en,
        `${p.name} ships the English tagline in both locales`,
      );
      assert.notEqual(
        p.summary.id,
        p.summary.en,
        `${p.name} ships the English summary in both locales`,
      );
    }
  });

  /**
   * Regression: hand-edited Indonesian copy picked up stray non-Latin
   * fragments (`mahasiswa|US:`, `Challenges botкое阻`, `dan.merge`) — model
   * tokenisation drift in a file no type checker reads. Nothing else would
   * have caught it before a recruiter saw it.
   */
  it("keeps Indonesian copy free of non-Latin contamination", () => {
    // Latin-1 letters plus the punctuation this file legitimately uses.
    const allowed =
      /^[A-Za-z0-9À-ɏ\s.,;:!?'"()[\]{}/&%+=*#@<>~^$|\\—–\-_’‘“”…·×]*$/;
    for (const p of projects) {
      const strings: string[] = [
        p.tagline.id,
        p.summary.id,
        ...p.highlights.id,
        ...(p.context ? [p.context.id] : []),
      ];
      for (const s of strings) {
        const offenders = [...s].filter((ch) => !allowed.test(ch));
        assert.deepEqual(
          offenders,
          [],
          `${p.name} Indonesian copy contains non-Latin characters: ${offenders.join(" ")}`,
        );
        assert.doesNotMatch(
          s,
          /\|US:|\.replace\(/,
          `${p.name} Indonesian copy contains an editing artifact`,
        );
      }
    }
  });
});
