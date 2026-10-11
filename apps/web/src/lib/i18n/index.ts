import { en } from "./en.ts";
import { id } from "./id.ts";
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type Messages,
} from "./types.ts";

export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  type Locale,
  type Messages,
} from "./types.ts";

const DICTIONARIES: Record<Locale, Messages> = { id, en };

export function messages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/**
 * Substitutes `{name}` placeholders.
 *
 * Deliberately not a template language: every call site passes values it
 * already holds, so an interpolation layer that can loop or evaluate would be
 * machinery no call site uses. A missing key throws rather than printing
 * `{time}` — a literal placeholder in a live verification stamp reads as a
 * bug to the visitor, which is exactly what it is.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Missing i18n value for "${key}" in "${template}"`);
    }
    return String(value);
  });
}

/**
 * Picks the locale for a request that did not carry one in the path.
 *
 * Reads `Accept-Language` so a recruiter in Indonesia who opens the bare
 * domain lands on Indonesian rather than being routed by IP. Indonesian is the
 * default because it is the owner's working language, and English is the
 * fallback when the header asks for something we do not have.
 */
export function negotiateLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: tag.toLowerCase(), q: q ? Number.parseFloat(q) : 1 };
    })
    .filter((entry) => Number.isFinite(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
