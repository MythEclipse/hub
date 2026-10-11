import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The `/` route once mounted `PortfolioSheet` directly and threw
 * `useI18n must be used inside <I18nProvider>` on every visit, because the
 * provider lives one level down in `/$locale`.
 *
 * Node's test runner cannot import a `.tsx` file at all
 * (ERR_UNKNOWN_FILE_EXTENSION), so this asserts on the route's source rather
 * than importing it. The check is deliberately narrow: it forbids a
 * `component:` on the root route, which is the one thing that places a
 * component above the provider.
 */
const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");

describe("root route", () => {
  it("never mounts a component above the locale provider", () => {
    assert.ok(
      !/\bcomponent\s*:/.test(source),
      "the / route must redirect, never render: a component there sits outside I18nProvider",
    );
  });

  it("redirects into the locale layout", () => {
    assert.match(source, /redirect\(\{\s*to:\s*"\/\$locale"/);
  });

  it("delegates the language choice to the tested detector", () => {
    // The route supplies the browser's preference list; detectLocale decides.
    // Asserting the delegation rather than banning navigator access, which is
    // the only way a client-side route can see a language preference at all.
    assert.match(source, /detectLocale\(/);
    assert.match(source, /import \{ detectLocale \}/);
  });
});
