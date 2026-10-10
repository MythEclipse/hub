import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Container,
  Cpu,
  Database,
  ExternalLink,
  GitBranch,
  GitFork,
  HardDrive,
  Layers,
} from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "#/components/ui/badge";
import { buttonVariants } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  MotionItem,
  Reveal,
  ScaleReveal,
  StaggerContainer,
  Typewriter,
} from "#/components/ui/motion-primitives";
import { cn } from "#/lib/utils";

// ponytail: static data, fine for a personal portfolio. Move to CMS/content layer if > 50 items.
const skills = [
  { icon: HardDrive, label: "Backend (Bun, Elysia, Axum)" },
  { icon: Container, label: "Docker & Traefik" },
  { icon: Database, label: "PostgreSQL, Redis, NATS" },
  { icon: Cpu, label: "Rust, TypeScript, Python" },
  { icon: GitBranch, label: "CI/CD, GitHub Actions" },
  { icon: Layers, label: "Dapr, Prometheus, Jaeger" },
];

const techTags = [
  "TypeScript",
  "Rust",
  "Python",
  "Next.js",
  "React",
  "Bun",
  "Elysia",
  "Drizzle",
  "Axum",
  "TensorFlow",
  "ONNX",
  "Docker",
  "Traefik",
  "Tailscale",
  "Dapr",
  "NATS",
  "PostgreSQL",
  "Redis",
  "Prometheus",
  "Tauri",
];

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ── Hero — terminal-inspired ── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-28 text-center sm:py-36">
        {/* Animated gradient background */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.13_265_/_0.06)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,oklch(0.7_0.15_75_/_0.06)_0%,transparent_70%)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0, 1] as const }}
        />

        <div className="relative">
          <motion.p
            className="mb-2 font-mono text-xs text-muted-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <span className="text-primary dark:text-primary">~</span> whoami
          </motion.p>
          <motion.h1
            className="font-mono text-3xl font-bold tracking-tight sm:text-5xl"
            initial={{ y: 16 }}
            animate={{ y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              ease: [0.25, 0.1, 0, 1] as const,
            }}
          >
            <span className="text-muted-foreground">$&nbsp;</span>
            <Typewriter
              text="Asep Haryana Saputra"
              className="gradient-text font-mono"
              speed={0.045}
              startDelay={200}
            />
          </motion.h1>
          <motion.p
            className="mx-auto mt-3 max-w-lg font-mono text-xs text-muted-foreground sm:text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <span className="text-muted-foreground/50"># </span>
            Teknik Informatika student exploring backend systems, distributed
            infrastructure, and DevOps — still learning, still building.
          </motion.p>
        </div>

        <motion.div
          className="relative mt-10 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.a
            href="#projects"
            className={cn(buttonVariants({ size: "lg" }))}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            View Projects
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
            >
              <ArrowRight className="size-4" />
            </motion.span>
          </motion.a>
          <motion.a
            href="https://github.com/asepharyana"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            GitHub
            <ExternalLink className="size-4" />
          </motion.a>
        </motion.div>
      </section>

      {/* ── Content — staggered sections ── */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 pb-28">
        {/* About */}
        <Reveal>
          <div>
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              <span className="text-primary dark:text-primary">~</span> about
            </p>
            <div className="space-y-3 leading-relaxed text-muted-foreground">
              <p>
                I&rsquo;m a Teknik Informatika student passionate about backend
                engineering, distributed systems, and infrastructure. I spend my
                time building RESTful APIs, learning container orchestration
                with Docker &amp; Traefik, and exploring observability with
                OpenTelemetry &amp; Jaeger.
              </p>
              <p>
                I contributed to the ZeaVis Edu capstone team (&ldquo;AI for
                Smart Education&rdquo; by Pijak &times; IBM SkillsBuild), a
                5-person team where we divided tasks across Back-End, Front-End,
                and Machine Learning. I worked on the system architecture, API
                design, RESTful API development, and Docker deployment on VPS.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Skills & Tools */}
        <Reveal>
          <div>
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              <span className="text-primary dark:text-primary">~</span> skills
            </p>
            <StaggerContainer className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {skills.map((s) => {
                const Icon = s.icon;
                return (
                  <MotionItem key={s.label}>
                    <motion.div
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm transition-all duration-300"
                      whileHover={{
                        y: -2,
                        borderColor: "var(--ring)",
                        boxShadow: "0 4px 14px oklch(0 0 0 / 0.08)",
                      }}
                    >
                      <Icon className="size-4 shrink-0 text-primary dark:text-primary" />
                      <span>{s.label}</span>
                    </motion.div>
                  </MotionItem>
                );
              })}
            </StaggerContainer>
            <StaggerContainer
              staggerVariants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.03, delayChildren: 0.1 },
                },
              }}
              className="flex flex-wrap gap-1.5"
            >
              {techTags.map((t) => (
                <MotionItem key={t}>
                  <motion.span
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Badge
                      variant="outline"
                      className="text-[11px] font-normal transition-all duration-300 hover:border-primary/30 hover:bg-primary/5"
                    >
                      {t}
                    </Badge>
                  </motion.span>
                </MotionItem>
              ))}
            </StaggerContainer>
          </div>
        </Reveal>

        {/* Featured Project */}
        <Reveal>
          <div id="projects" className="scroll-mt-24">
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              <span className="text-primary dark:text-primary">~</span> featured
              project
            </p>
            <ScaleReveal>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Card className="relative overflow-hidden border-primary/10 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  {/* Gradient border accent */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />

                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">ZeaVis Edu</CardTitle>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Asisten Edukasi Interaktif untuk Deteksi Penyakit Daun
                          Jagung
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <motion.a
                          href="https://zeavisedu.asepharyana.my.id/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ExternalLink className="size-3.5" />
                          Live
                        </motion.a>
                        <motion.a
                          href="https://github.com/ATLAS-PJK-GM007/ZeaVis-Edu"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <GitFork className="size-3.5" />
                          Source
                        </motion.a>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p className="mb-4">
                      A Computer Vision-powered educational platform that helps
                      farmers, agricultural students, and field extension
                      officers identify corn leaf diseases by uploading a photo.
                      Built as a capstone project for the Pijak &times; IBM
                      SkillsBuild program.
                    </p>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <motion.div
                        className="rounded-lg border border-border bg-muted/30 p-3 transition-all duration-300"
                        whileHover={{
                          y: -2,
                          borderColor: "var(--ring)",
                          backgroundColor: "oklch(0.7 0.15 75 / 0.04)",
                        }}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                          What it does
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-xs">
                          <li>Upload a photo of a corn leaf</li>
                          <li>
                            AI classifies the disease &mdash; Blight, Rust, Leaf
                            Spot, or Healthy
                          </li>
                          <li>
                            Get treatment &amp; prevention recommendations
                          </li>
                        </ul>
                      </motion.div>
                      <motion.div
                        className="rounded-lg border border-border bg-muted/30 p-3 transition-all duration-300"
                        whileHover={{
                          y: -2,
                          borderColor: "var(--ring)",
                          backgroundColor: "oklch(0.7 0.15 75 / 0.04)",
                        }}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                          My role
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-xs">
                          <li>System architecture &amp; API design</li>
                          <li>
                            RESTful API (Bun + Elysia + Drizzle + PostgreSQL)
                          </li>
                          <li>Secure upload handling</li>
                          <li>
                            Docker deployment on VPS with Traefik &amp;
                            Tailscale
                          </li>
                        </ul>
                      </motion.div>
                    </div>

                    <StaggerContainer
                      staggerVariants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: { staggerChildren: 0.03 },
                        },
                      }}
                      className="mt-4 flex flex-wrap gap-1.5"
                    >
                      {[
                        "React",
                        "TypeScript",
                        "Bun",
                        "Elysia",
                        "Drizzle",
                        "PostgreSQL",
                        "Rust",
                        "Axum",
                        "ONNX",
                        "TensorFlow",
                        "EfficientNetV2B0",
                        "Tauri 2",
                        "Docker",
                        "Traefik",
                      ].map((t) => (
                        <MotionItem key={t}>
                          <motion.span
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {t}
                            </Badge>
                          </motion.span>
                        </MotionItem>
                      ))}
                    </StaggerContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </ScaleReveal>
          </div>
        </Reveal>

        {/* Infrastructure CTA */}
        <Reveal>
          <ScaleReveal>
            <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.25 }}>
              <Card className="relative overflow-hidden border-primary/10 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
                <CardContent className="flex flex-col items-center gap-4 py-10">
                  <p className="text-base font-medium">
                    This site doubles as a live infrastructure monitor.
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    The dashboard tracks Docker services, Traefik request
                    metrics, Prometheus system resources, and Jaeger traces —
                    all running on my VPS deployment.
                  </p>
                  <motion.a
                    href="/dashboard"
                    className={cn(buttonVariants())}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Live Dashboard
                    <ArrowRight className="size-4" />
                  </motion.a>
                </CardContent>
              </Card>
            </motion.div>
          </ScaleReveal>
        </Reveal>
      </div>

      {/* Footer */}
      <motion.footer
        className="mt-auto border-t py-6 text-center text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <p>
          &copy; {new Date().getFullYear()} Asep Haryana Saputra &mdash;{" "}
          <motion.a
            href="https://github.com/asepharyana"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
            whileHover={{ color: "var(--primary)" }}
          >
            GitHub
          </motion.a>
        </p>
      </motion.footer>
    </div>
  );
}
