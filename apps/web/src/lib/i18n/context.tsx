import { createContext, useContext, useMemo } from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type Messages,
  messages as messagesFor,
} from "./index";

interface I18nValue {
  locale: Locale;
  t: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return { locale: resolved, t: messagesFor(resolved) };
  }, [locale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return value;
}

/**
 * Prefixes an in-app path with the active locale.
 *
 * Every internal link goes through this, so a visitor who reads the Indonesian
 * sheet never lands on an English one — the language is carried by the URL
 * rather than by remembered state.
 */
export function useLocalePath() {
  const { locale } = useI18n();
  return useMemo(
    () => (path: string) => {
      const clean = path.startsWith("/") ? path : `/${path}`;
      return `/${locale}${clean === "/" ? "" : clean}`;
    },
    [locale],
  );
}
