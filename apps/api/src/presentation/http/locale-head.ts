/**
 * Locale-aware `<head>` for the SPA document.
 *
 * The SPA is one static `index.html` served for every path, so `lang="en"` on
 * the tag was wrong for an Indonesian page — the browser, screen readers and
 * search engines were all told the wrong language. The server sees the real
 * `Accept-Language` header here, and the URL carries the visitor's explicit
 * choice, so both are available at this one point.
 *
 * Kept as a pure string transform with no Hono dependency so it can be unit
 * tested against a fixture document: the failure it prevents is invisible in
 * a smoke test and silent in production.
 */

const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = "id";

/** Reads the `/{locale}` prefix, if the path carries one. */
export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return (LOCALES as readonly string[]).includes(first ?? "")
    ? (first as Locale)
    : null;
}

/**
 * Picks the locale for a document request.
 *
 * An explicit path prefix always wins over the header: someone who followed a
 * link to `/en` must not be redirected to Indonesian because their browser
 * happens to be set to it.
 */
export function resolveLocale(
  pathname: string,
  acceptLanguage: string | null,
): Locale {
  const fromPath = localeFromPath(pathname);
  if (fromPath) return fromPath;

  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((part) => {
        const [tag, ...params] = part.trim().split(";");
        const q = params
          .map((p) => p.trim())
          .find((p) => p.startsWith("q="))
          ?.slice(2);
        return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
      })
      .filter((e) => Number.isFinite(e.q))
      .sort((a, b) => b.q - a.q);

    for (const { base } of ranked) {
      if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Rewrites the document head for the resolved locale.
 *
 * Sets `lang`, and injects `hreflang` alternates plus a canonical link so a
 * recruiter sharing `/id` shares the Indonesian sheet. Any pre-existing
 * alternates are replaced rather than appended, so a rebuilt document cannot
 * accumulate them.
 */
export function withLocaleHead(
  html: string,
  locale: Locale,
  origin = "",
): string {
  const alternates = LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${origin}/${l}" />`,
  ).join("");

  let out = html.replace(
    /<html([^>]*)\slang="[^"]*"([^>]*)>/,
    `<html$1 lang="${locale}"$2>`,
  );

  // No lang attribute at all: add one rather than silently skipping the fix.
  if (out === html && !/<html[^>]*\slang=/.test(html)) {
    out = html.replace(/<html/, `<html lang="${locale}"`);
  }

  const head = alternates.replace(/\s+/g, " ").trim();

  if (/<head[^>]*>/.test(out)) {
    out = out.replace(/<head([^>]*)>/, `<head$1>${head}`);
  }

  return out;
}
