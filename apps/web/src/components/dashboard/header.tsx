import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { springGentle } from "#/lib/motion";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

export function DashboardHeader() {
  const [time, setTime] = useState("");
  const { theme, setTheme } = useTheme();

  // Same query key as the dashboard page, so this shares one in-flight request
  // instead of running a second 15s poller.
  const { data, isError } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const services = data?.services ?? [];
  const total = services.length;
  const degraded = services.filter((s) => s.state !== "running").length;

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const isHealthy = total > 0 && degraded === 0;
  const hasIssues = degraded > 0;
  // An unreachable API is not an idle system. Without this branch the badge
  // reads "No services" and gaugeColor(null) returns green, so a total outage
  // is indistinguishable from a quiet host.
  const badge = isError
    ? "API unreachable"
    : total === 0
      ? "No services"
      : hasIssues
        ? `${degraded} degraded`
        : "All Systems Operational";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0, 1] }}
      className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b bg-background/80 px-5 py-3 backdrop-blur-2xl supports-backdrop-filter:bg-background/60"
    >
      <motion.a
        href="/"
        className="flex items-center gap-2.5"
        whileHover={{ x: 2 }}
        transition={{ duration: 0.2 }}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
          AH
        </span>
        <h1 className="text-base font-semibold">Asep Haryana</h1>
      </motion.a>
      <div className="flex items-center gap-2.5">
        <motion.div
          animate={
            hasIssues && !isError
              ? {
                  scale: [1, 1.02, 1],
                  transition: { repeat: Number.POSITIVE_INFINITY, duration: 3 },
                }
              : {}
          }
        >
          <Badge
            variant="outline"
            className={`h-auto gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isError
                ? "border-red-500/30 bg-red-900/20 text-red-400"
                : hasIssues
                  ? "border-amber-500/30 bg-amber-900/20 text-amber-500"
                  : total > 0
                    ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-400"
                    : ""
            }`}
          >
            {total > 0 && !isError && (
              <motion.span
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: isHealthy ? 2.5 : 1.5,
                  ease: "easeInOut",
                }}
                className={`h-1.5 w-1.5 rounded-full ${
                  hasIssues ? "bg-amber-500" : "bg-emerald-400"
                }`}
              />
            )}
            {badge}
          </Badge>
        </motion.div>
        <motion.div
          whileHover={{ rotate: 30 }}
          whileTap={{ rotate: 60, scale: 0.9 }}
          transition={springGentle}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="hidden dark:block!" />
            <Moon className="block dark:hidden!" />
          </Button>
        </motion.div>
        <motion.span
          key={time}
          initial={{ opacity: 0.6, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] tabular-nums text-muted-foreground"
        >
          {time}
        </motion.span>
      </div>
    </motion.header>
  );
}
