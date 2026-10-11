import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { FormHeader } from "#/components/shell/form-header";
import { isLocale } from "#/lib/i18n";
import { I18nProvider } from "#/lib/i18n/context";

/**
 * Parent route for every localised page.
 *
 * This file is named `$locale.tsx` rather than living in the `$locale/`
 * directory as a layout: TanStack's file router treats a directory child as a
 * sibling URL (`/$locale/layout`) rather than as a wrapper, which is why the
 * first attempt left `I18nProvider` above nothing and every page threw.
 */
export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) {
      throw redirect({ to: "/", params: {} });
    }
  },
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  return (
    <I18nProvider locale={locale}>
      <FormHeader />
      <Outlet />
    </I18nProvider>
  );
}
