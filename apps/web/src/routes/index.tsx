import { createFileRoute, redirect } from "@tanstack/react-router";

import { detectLocale } from "#/lib/i18n/detect.ts";

/**
 * The bare domain carries no locale, so this picks one and gets out of the way.
 *
 * This route never renders. An earlier version mounted `PortfolioSheet` here
 * directly, which threw `useI18n must be used inside <I18nProvider>` on every
 * visit to `/` because the provider lives one level down, in `/$locale`.
 * Redirecting is the only correct behaviour for a path with no language on it.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: browserLocale() } });
  },
});

function browserLocale(): "id" | "en" {
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return detectLocale(tags.filter((tag): tag is string => Boolean(tag)));
}
