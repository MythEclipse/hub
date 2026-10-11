import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { en } from "./i18n/en.ts";
import { id } from "./i18n/id.ts";
import { DEFAULT_LOCALE, LOCALES } from "./i18n/index.ts";
import { projects } from "./projects.ts";

/**
 * The dictionaries are hand-edited prose that no type checker reads, and the
 * project catalogue already proved the failure mode: a project name leaked
 * into a sentence meant to be general, and stray non-Latin fragments appeared
 * in Indonesian copy. Both shipped to production unnoticed.
 *
 * These assertions cover the dictionary itself, which projects.i18n.test.ts
 * does not reach.
 */
const dictionaries = { en, id } as const;

const profileStrings = (m: typeof en): string[] => [
  m.about.p1,
  m.about.p2,
  m.about.p3,
];

describe("profile copy", () => {
  /**
   * The profile makes a general statement about how the work is done. Naming
   * a project there duplicates the catalogue entry and dates the copy the day
   * that entry is renamed — the sentence has to keep holding on its own.
   */
  it("keeps the profile free of project names", () => {
    for (const p of projects) {
      // ZeaVis Edu also appears as "ZeaVis Edu — ..." in some titles; match
      // the leading identifier so a rename is still caught.
      const identifier = p.name.split(/[—\s]/)[0]?.trim();
      if (!identifier || identifier.length < 4) continue;
      for (const locale of LOCALES) {
        for (const s of profileStrings(dictionaries[locale])) {
          assert.ok(
            !s.includes(identifier),
            `the ${locale} profile names "${identifier}" — it belongs in the catalogue, not the prose`,
          );
        }
      }
    }
  });

  it("translates rather than copying the English into Indonesian", () => {
    assert.notEqual(id.about.p1, en.about.p1);
    assert.notEqual(id.about.p2, en.about.p2);
    assert.notEqual(id.about.p3, en.about.p3);
  });

  it("keeps Indonesian profile copy free of non-Latin contamination", () => {
    const allowed =
      /^[A-Za-z0-9À-ɏ\s.,;:!?'"()[\]{}/&%+=*#@<>~^$|\\—–\-_’‘“”…·×]*$/;
    for (const s of profileStrings(id)) {
      const offenders = [...s].filter((ch) => !allowed.test(ch));
      assert.deepEqual(
        offenders,
        [],
        `Indonesian profile copy contains non-Latin characters: ${offenders.join(" ")}`,
      );
      assert.doesNotMatch(s, /\|US:|\.replace\(/);
    }
  });

  /**
   * The profile used to read "I have carried products end to end", which
   * invites the question of who those products served. Nothing on this page
   * has users but its owner, so the disclaimer has to stay.
   */
  it("disclaims an audience, so the page cannot imply one it does not have", () => {
    assert.match(
      id.about.p2,
      /saya sendiri/i,
      "the Indonesian profile should say the work runs for its owner",
    );
    assert.match(
      en.about.p2,
      /my own use/i,
      "the English profile should say the work runs for its owner",
    );
  });
});

/**
 * Every key present in one locale must exist in the other. A missing string
 * renders as `undefined` on the page, which no compiler flags.
 */
describe("dictionaries are structurally identical", () => {
  it("has no key present in one locale and absent in the other", () => {
    const walk = (obj: unknown, prefix = ""): string[] => {
      if (typeof obj !== "object" || obj === null) return [prefix];
      return Object.entries(obj).flatMap(([k, v]) =>
        walk(v, prefix ? `${prefix}.${k}` : k),
      );
    };

    const enKeys = new Set(walk(en));
    const idKeys = new Set(walk(id));

    for (const k of enKeys) {
      assert.ok(idKeys.has(k), `id is missing "${k}"`);
    }
    for (const k of idKeys) {
      assert.ok(enKeys.has(k), `en is missing "${k}"`);
    }
    assert.ok(DEFAULT_LOCALE);
  });
});
