import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectLocale } from "./detect.ts";
import { isLocale, negotiateLocale } from "./index.ts";

describe("detectLocale", () => {
  it("falls back to Indonesian when nothing matches", () => {
    assert.equal(detectLocale([]), "id");
    assert.equal(detectLocale(["fr-FR", "ja"]), "id");
  });

  it("honours the visitor's first known language", () => {
    assert.equal(detectLocale(["en-US", "en", "id"]), "en");
    assert.equal(detectLocale(["id-ID", "en-US"]), "id");
  });

  it("matches on the base tag, not the whole locale string", () => {
    // `en-GB` is not `en`, but nobody ships a third language.
    assert.equal(detectLocale(["en-GB"]), "en");
    assert.equal(detectLocale(["id-ID"]), "id");
  });

  it("is case insensitive", () => {
    assert.equal(detectLocale(["EN-us"]), "en");
    assert.equal(detectLocale(["Id-ID"]), "id");
  });

  it("always resolves to a locale the app can render", () => {
    for (const tags of [["en"], ["id"], ["fr", "en"], [], ["xx-YY"]]) {
      assert.ok(isLocale(detectLocale(tags)));
    }
  });
});

describe("negotiateLocale", () => {
  it("defaults to Indonesian when the visitor expresses no preference", () => {
    assert.equal(negotiateLocale(null), "id");
    assert.equal(negotiateLocale(""), "id");
  });

  it("honours an explicit English preference", () => {
    assert.equal(negotiateLocale("en-US,en;q=0.9"), "en");
    assert.equal(negotiateLocale("en-GB"), "en");
  });

  it("falls back to Indonesian for a language we do not have", () => {
    assert.equal(negotiateLocale("fr-FR,fr;q=0.9"), "id");
    assert.equal(negotiateLocale("ja"), "id");
  });

  it("agrees with the browser-side detector on shared inputs", () => {
    // The server writes the HTML lang and the client picks the route; when
    // these two disagree the page flashes the wrong language before redirect.
    for (const tag of ["id", "en", "en-US", "id-ID"]) {
      assert.equal(
        negotiateLocale(tag),
        detectLocale([tag]),
        `server and client disagree for "${tag}"`,
      );
    }
  });
});
