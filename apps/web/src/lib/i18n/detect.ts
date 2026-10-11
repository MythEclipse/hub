import { DEFAULT_LOCALE, isLocale, type Locale } from "./types.ts";

/**
 * Picks a locale from the browser's own preference list.
 *
 * The bare domain has to choose a language before anything renders, and in a
 * client-side SPA the document's `Accept-Language` header is gone by then —
 * `navigator.languages` is the only place the visitor's preference still
 * exists. The server keeps its own copy of this decision in `locale-head.ts`
 * for the HTML it serves, so the two agree.
 *
 * Taking the list as an argument rather than reading `navigator` here keeps
 * this pure and testable; the route supplies the real value.
 */
export function detectLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
