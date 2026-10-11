import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useRouteContext,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex flex-1 items-center justify-center font-mono text-sm text-ink-faint">
      404 — not found
    </div>
  ),
});

function RootComponent() {
  const { queryClient } = useRouteContext({ from: Route.id });

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-full flex-col bg-paper text-ink">
          {/* The form header is locale-scoped copy, so it renders inside the
              $locale layout rather than here: this route sits above the
              I18nProvider and has no locale to read. */}
          <Outlet />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
