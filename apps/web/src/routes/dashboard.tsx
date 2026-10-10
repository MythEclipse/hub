import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Donut } from "#/components/dashboard/donut";
import { Gauge } from "#/components/dashboard/gauge";
import { Sparkline } from "#/components/dashboard/sparkline";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { AnimatedNumber } from "#/components/ui/motion-primitives";
import {
  fmtUptime,
  gaugeColor,
  safeDur,
  serviceIndicator,
} from "#/lib/dashboard/format";
import { orpc } from "#/libs/orpc/client";

const POLL_INTERVAL_MS = 15000;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0, 1] as const },
  },
};

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  // Shared with the header via the same query key, so both components are
  // served by ONE request per interval instead of two independent pollers.
  const { data, isError } = useQuery({
    ...orpc.dashboard.getOverview.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const running =
    data?.services.filter((s) => s.state === "running").length ?? 0;
  const degraded = (data?.services.length ?? 0) - running;
  // `!== null` would be true while `data` is still undefined (undefined !==
  // null), so the resource cards rendered all-null gauges on first paint and
  // popped when data landed. `!= null` also rejects undefined.
  const hasNode = data?.node.cpu != null || data?.node.ram != null;
  const hasTraffic =
    (data?.rps?.length ?? 0) > 0 || (data?.errors?.length ?? 0) > 0;
  const node = data?.node;

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-3">
      <motion.div
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Without this the API being down renders as a normal dashboard full
            of zeros — a fake healthy-looking outage. */}
        {isError && (
          <Card className="col-span-full border-red-500/30 bg-red-950/20">
            <CardContent className="py-4 text-center text-xs text-red-400">
              Cannot reach the hub API. Retrying every {POLL_INTERVAL_MS / 1000}
              s.
            </CardContent>
          </Card>
        )}
        {/* Services */}
        <motion.div variants={cardVariants}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Services</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {data?.services.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent>
              {data?.services.length ? (
                <div className="flex flex-wrap gap-1">
                  {data.services.map((s, i) => (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, delay: 0.1 + i * 0.03 }}
                    >
                      <Badge
                        variant="outline"
                        className="h-auto gap-1.5 px-2 py-1.5 text-xs font-normal"
                      >
                        <motion.span
                          animate={
                            s.state === "running"
                              ? {
                                  opacity: [0.5, 1, 0.5],
                                }
                              : {}
                          }
                          transition={{
                            repeat: Number.POSITIVE_INFINITY,
                            duration: 2.5,
                            ease: "easeInOut",
                          }}
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${serviceIndicator(s.state)}`}
                        />
                        <span className="font-mono text-[10px]">{s.name}</span>
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">
                  No services detected
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Overview */}
        <motion.div variants={cardVariants}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                <StatBox
                  value={data?.services.length}
                  label="Total"
                  color="text-blue-400"
                />
                <StatBox
                  value={running}
                  label="Healthy"
                  color="text-green-400"
                />
                <StatBox
                  value={data?.traces.length ?? 0}
                  label="Traces"
                  color="text-blue-400"
                />
                <StatBox
                  value={
                    data?.errors?.length
                      ? data.errors[data.errors.length - 1].toFixed(2)
                      : undefined
                  }
                  label="LLM err/s"
                  color="text-red-400"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Health */}
        <motion.div variants={cardVariants}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader>
              <CardTitle>Health</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Donut running={running} degraded={degraded} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Links */}
        <motion.div variants={cardVariants}>
          <Card className="h-full transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader>
              <CardTitle>Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {data?.links.map((l) => (
                  <motion.a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-border px-2 py-1 text-[10px] text-blue-400 no-underline transition-colors hover:border-blue-400 hover:bg-muted"
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {l.label}
                  </motion.a>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Resources */}
        {hasNode && (
          <motion.div variants={cardVariants}>
            <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>System Resources</CardTitle>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] font-normal"
                >
                  {node?.load1?.toFixed(2)} {node?.load5?.toFixed(2)}{" "}
                  {node?.load15?.toFixed(2)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <Gauge
                    pct={node?.cpu ?? null}
                    color={gaugeColor(node?.cpu ?? null)}
                    label="CPU Usage"
                    unit="%"
                  />
                  <Gauge
                    pct={node?.ram ?? null}
                    color={gaugeColor(node?.ram ?? null)}
                    label="Memory Usage"
                    unit="%"
                  />
                  <Gauge
                    pct={node?.disk ?? null}
                    color={gaugeColor(node?.disk ?? null)}
                    label="Disk Usage"
                    unit="%"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* LLM Inference */}
        <motion.div variants={cardVariants}>
          <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>LLM Inference</CardTitle>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] font-normal"
              >
                {data?.llm.uptime != null
                  ? `${fmtUptime(data.llm.uptime)} up`
                  : "no data"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                <StatBox
                  value={
                    data?.llm.reqRate != null
                      ? data.llm.reqRate.toFixed(1)
                      : undefined
                  }
                  label="Req/s (5m)"
                  color="text-blue-400"
                />
                <StatBox
                  value={
                    data?.llm.tokRate != null
                      ? `${data.llm.tokRate.toFixed(0)}`
                      : undefined
                  }
                  label="Tokens/s (5m)"
                  color="text-green-400"
                />
                <StatBox
                  value={
                    data?.llm.tokSpeed != null
                      ? `${data.llm.tokSpeed.toFixed(0)}`
                      : undefined
                  }
                  label="Gen tok/s"
                  color="text-purple-400"
                />
                <StatBox
                  value={data?.llm.reqSpark?.length ? "live" : undefined}
                  label="Sparkline"
                  color="text-yellow-400"
                />
              </div>
              {data?.llm.reqSpark?.length ? (
                <div className="mt-2">
                  <Sparkline data={data.llm.reqSpark} color="#58a6ff" />
                </div>
              ) : (
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  No traffic yet &mdash; send a prompt on{" "}
                  <a
                    className="text-blue-400 underline"
                    href="https://ai.asepharyana.my.id"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ai.asepharyana.my.id
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Request Rate */}
        {hasTraffic && (
          <motion.div variants={cardVariants}>
            <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Request Rate</CardTitle>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {data?.rps?.length
                    ? `${data.rps[data.rps.length - 1].toFixed(1)}/s`
                    : "-"}
                </Badge>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Sparkline data={data?.rps ?? []} color="#58a6ff" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Load Average */}
        {hasNode && (
          <motion.div variants={cardVariants}>
            <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Load Average</CardTitle>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {data?.latency?.length
                    ? data.latency[data.latency.length - 1].toFixed(2)
                    : "-"}
                </Badge>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Sparkline data={data?.latency ?? []} color="#bc8cff" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error Rate */}
        {hasTraffic && (
          <motion.div variants={cardVariants}>
            <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Error Rate</CardTitle>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {data?.errors?.length
                    ? `${data.errors[data.errors.length - 1].toFixed(1)}/s`
                    : "-"}
                </Badge>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Sparkline data={data?.errors ?? []} color="#f85149" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Trace Volume */}
        <motion.div variants={cardVariants}>
          <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trace Volume</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {data?.traces.length ?? 0} traces
              </Badge>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Sparkline data={data?.traceVolume ?? []} color="#3fb950" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Traces */}
        <motion.div variants={cardVariants} className="2xl:col-span-2">
          <Card className="transition-shadow duration-300 hover:shadow-md hover:shadow-border/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Traces</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {data?.traces.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent>
              {data?.traces.length ? (
                <ul className="list-none">
                  {data.traces.map((t, i) => (
                    <motion.li
                      // biome-ignore lint/suspicious/noArrayIndexKey: trace data has no unique id
                      key={`${t.service}-${t.operation}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
                      className="flex items-center justify-between gap-1.5 border-b border-border py-1.5 text-[11px] last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.service}</div>
                        <div className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
                          {t.operation}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono font-medium text-blue-400">
                          {safeDur(t.duration)}
                        </span>
                        <span>{t.spans}</span>
                        {t.hasError && (
                          <motion.span
                            className="rounded-sm bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-500"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{
                              repeat: Number.POSITIVE_INFINITY,
                              duration: 2,
                            }}
                          >
                            err
                          </motion.span>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">
                  No traces &mdash; data appears once services send OTel
                  telemetry
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatBox({
  value,
  label,
  color,
}: {
  value: number | string | undefined;
  label: string;
  color: string;
}) {
  return (
    <motion.div
      className="rounded-lg bg-muted/50 p-2.5 text-center transition-colors duration-300 hover:bg-muted/80"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`font-mono text-lg font-bold leading-tight ${color}`}>
        {typeof value === "number" ? (
          <AnimatedNumber value={value} />
        ) : (
          (value ?? "-")
        )}
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </motion.div>
  );
}
