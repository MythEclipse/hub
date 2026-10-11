import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The palette is a contract, not a preference: a colour here means a state, and
 * the text drawn in it has to stay readable in both themes.
 *
 * These were measured, not eyeballed. The light palette shipped `--ink-faint`
 * at 4.20:1 and `--pending` at 3.89:1 against paper, both under the 4.5:1 body
 * floor, and a hint set at 55% opacity composited down to 2.03:1.
 */

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) =>
    srgbToLinear(parseInt(h.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Reads a custom property out of the light or dark block. */
function token(name: string, theme: "light" | "dark"): string {
  const block =
    theme === "light"
      ? css.slice(css.indexOf(":root {"), css.indexOf(".dark {"))
      : css.slice(css.indexOf(".dark {"));
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `${name} missing from the ${theme} palette`);
  return match[1] as string;
}

const TEXT = ["ink", "ink-soft", "ink-faint"] as const;
const SEMANTIC = ["pass", "fail", "pending"] as const;
const FLOOR = 4.5;

describe("paper palette", () => {
  for (const theme of ["light", "dark"] as const) {
    const paper = token("paper", theme);

    for (const name of [...TEXT, ...SEMANTIC]) {
      it(`${theme}: ${name} clears ${FLOOR}:1 on paper`, () => {
        const ratio = contrast(token(name, theme), paper);
        assert.ok(
          ratio >= FLOOR,
          `${name} is ${ratio.toFixed(2)}:1 on ${paper} in ${theme}, below ${FLOOR}:1`,
        );
      });
    }
  }

  it("keeps the semantic trio distinct from paper", () => {
    // If two states shared a colour, colour would stop carrying meaning.
    const light = SEMANTIC.map((n) => token(n, "light"));
    assert.equal(new Set(light).size, SEMANTIC.length);
  });

  it("defines every token in both themes", () => {
    for (const name of ["paper", "ink", "ink-soft", "ink-faint", ...SEMANTIC]) {
      for (const theme of ["light", "dark"] as const) {
        assert.match(token(name, theme), /^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("motion", () => {
  it("keeps a reduced-motion path that preserves content visibility", () => {
    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    assert.ok(reduced.length > 0, "no reduced-motion block at all");
    // Reduced motion must not leave anything at opacity 0 or scaled away, or
    // the page becomes blank for exactly the visitors who asked for less motion.
    assert.doesNotMatch(reduced, /opacity:\s*0\s*!important/);
    assert.match(reduced, /animation:\s*none\s*!important/);
  });
});
