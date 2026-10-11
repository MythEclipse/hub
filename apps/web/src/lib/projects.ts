/**
 * Project catalogue for the portfolio ledger.
 *
 * Every entry is a project that exists in a repo under github.com/asepharyana
 * and, where claimed, answers 200 on its public hostname. Descriptions state
 * what the code actually does — a claim here that the repository contradicts
 * is a bug in this file.
 *
 * Bilingual by construction: `name`, `stack` and `links` are product truth and
 * stay in one language, because a project name and its tech list are proper
 * nouns a recruiter searches. Only the prose that explains the work is
 * translated, and the Indonesian is written as Indonesian rather than as a
 * rendering of the English.
 *
 * Static data: fine for a personal portfolio. Move to a CMS/content layer if
 * this ever exceeds ~50 items.
 */

import type { Locale } from "./i18n";

export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  /** Display name, matching the repo name where one exists. Never translated. */
  name: string;
  /** One line, no period — it sits directly under the name. */
  tagline: Record<Locale, string>;
  /** Two or three sentences on what it does and why it exists. */
  summary: Record<Locale, string>;
  /** Concrete mechanisms, not adjectives. */
  highlights: Record<Locale, readonly string[]>;
  stack: readonly string[];
  links: readonly ProjectLink[];
  /** Attribution that is not implied by the name: team work, or a fork. */
  context?: Record<Locale, string>;
}

/** Live site first, then source. Omit a link rather than point it nowhere. */
function links(live?: string, source?: string): ProjectLink[] {
  const out: ProjectLink[] = [];
  if (live) out.push({ label: "Live", href: live });
  if (source) out.push({ label: "Source", href: source });
  return out;
}

export const projects: readonly Project[] = [
  {
    name: "ZeaVis Edu",
    tagline: {
      en: "Computer Vision diagnosis for corn leaf disease",
      id: "Deteksi Computer Vision untuk penyakit daun jagung",
    },
    summary: {
      en: "An educational app that helps farmers, agriculture students and field extension officers identify corn leaf disease from a photo — Blight, Rust, Leaf Spot or Healthy — with treatment guidance alongside the verdict. Built as a capstone for the Pijak × IBM SkillsBuild programme.",
      id: "Aplikasi belajar yang membantu petani, mahasiswa pertanian, dan penyuluh lapangan mengenali penyakit daun jagung dari foto — Hawar, Karat, Bercak Daun, atau Sehat — lengkap dengan panduan penanganan di samping hasil diagnosisnya. Dibangun sebagai capstone untuk program Pijak × IBM SkillsBuild.",
    },
    highlights: {
      en: [
        "EfficientNetV2B0 classifier trained in Keras, served through a Rust inference service (Axum + ONNX Runtime)",
        "Bun + Elysia API with Drizzle and PostgreSQL; React 19 + Vite web client",
        "Tauri 2 build for Android, so the diagnosis works in the field without a browser",
        "Streamed, size-validated uploads — the untrusted path into the system",
      ],
      id: [
        "Classifier EfficientNetV2B0 dilatih di Keras, disajikan lewat service inferensi Rust (Axum + ONNX Runtime)",
        "API Bun + Elysia dengan Drizzle dan PostgreSQL; klien web React 19 + Vite",
        "Build Tauri 2 untuk Android, sehingga diagnosis tetap jalan di lapangan tanpa browser",
        "Upload streaming dengan validasi ukuran — satu-satunya jalur data tak dipercaya ke sistem",
      ],
    },
    stack: [
      "TypeScript",
      "Rust",
      "Bun",
      "Elysia",
      "Axum",
      "Drizzle",
      "PostgreSQL",
      "ONNX Runtime",
      "TensorFlow",
      "Tauri 2",
    ],
    links: links(
      "https://zeavisedu.asepharyana.my.id/",
      "https://github.com/ATLAS-PJK-GM007/ZeaVis-Edu",
    ),
    context: {
      en: "Capstone team of five — I owned system architecture, the RESTful API, and deployment.",
      id: "Tim capstone beranggotakan lima orang — saya memegang arsitektur sistem, API RESTful, dan deployment.",
    },
  },
  {
    name: "GMW — Guild Moderation Watcher",
    tagline: {
      en: "LLM moderation for a Discord guild, with an audit trail",
      id: "Moderasi LLM untuk server Discord, lengkap dengan jejak audit",
    },
    summary: {
      en: "A self-hosted watcher for a Discord guild. It captures every message and the evidence around it, judges each one against a written policy with an LLM, deletes what violates that policy, and shows the whole pipeline on a live dashboard.",
      id: "Penjaga self-hosted untuk satu server Discord. Menangkap setiap pesan beserta bukti di sekitarnya, menilainya terhadap kebijakan tertulis menggunakan LLM, menghapus yang melanggar kebijakan itu, lalu menampilkan seluruh pipeline-nya di dasbor langsung.",
    },
    highlights: {
      en: [
        "Capture never waits on the model — messages queue as rows, workers claim them under a time-boxed lease",
        "A message the model could not read is never auto-deleted, at any confidence",
        "Every enforcement attempt is written to an audit table, not inferred from a deleted_at flag",
        "Seven dashboard views over Postgres and Redis, updated live over WebSocket",
      ],
      id: [
        "Penangkapan tidak pernah menunggu model — pesan masuk antrean sebagai baris, worker mengambilnya dengan lease berdurasi tetap",
        "Pesan yang tidak terbaca model tidak pernah dihapus otomatis,Whatever confidence-nya",
        "Setiap upaya penindakan ditulis ke tabel audit, bukan disimpulkan dari flag deleted_at",
        "Tujuh tampilan dasbor di atas Postgres dan Redis, diperbarui langsung lewat WebSocket",
      ],
    },
    stack: [
      "TypeScript",
      "Node.js",
      "Hono",
      "oRPC",
      "Drizzle",
      "PostgreSQL",
      "Redis",
      "discord.js",
      "TanStack Router",
      "prom-client",
    ],
    links: links(
      "https://gmw.asepharyana.my.id/",
      "https://github.com/asepharyana/GMW",
    ),
  },
  {
    name: "scraper",
    tagline: {
      en: "Rust/Axum scraping and image-proxy API",
      id: "API scraping dan image-proxy berbasis Rust/Axum",
    },
    summary: {
      en: "A public HTTP API over sources that have no usable API: anime and comic aggregators, social-media video, and an image proxy. Ships an OpenAPI document and a Swagger UI, and exports its own metrics.",
      id: "API HTTP publik untuk sumber-sumber yang memang tidak punya API yang layak: agregator anime dan komik, video media sosial, serta image proxy. Menyertakan dokumen OpenAPI dan Swagger UI, serta mengekspor metriknya sendiri.",
    },
    highlights: {
      en: [
        "Nine route groups — anime, comics, downloaders, search, stalk, image proxy, tools — behind one Axum router",
        "OpenTelemetry metrics over OTLP, with the middleware wired at the router rather than per handler",
        "Rate limiting, retry and cache-aside built from the published Mytheclipse crates",
        "Playwright fallback for hosts where a plain HTTP fetch hits an anti-bot challenge",
      ],
      id: [
        "Sembilan route group — anime, komik, downloader, pencarian, stalk, image proxy, tools — di belakang satu router Axum",
        "Metrik OpenTelemetry lewat OTLP, dengan middleware dipasang di router, bukan per handler",
        "Rate limiting, retry, dan cache-aside dibangun dari crate Mytheclipse yang dipublikasikan",
        "Fallback Playwright untuk host yang menaruh tembok anti-bot saat diambil dengan HTTP biasa",
      ],
    },
    stack: [
      "Rust",
      "Axum",
      "Tokio",
      "utoipa",
      "OpenTelemetry",
      "Redis",
      "Playwright",
      "Swagger UI",
    ],
    links: links(
      "https://scraper.asepharyana.my.id/docs",
      "https://github.com/asepharyana/scraper",
    ),
  },
  {
    name: "pr-agent-server",
    tagline: {
      en: "GitHub App that reviews and merges its own PRs",
      id: "GitHub App yang melakukan review dan merge atas pull request-nya sendiri",
    },
    summary: {
      en: "A GitHub App that runs an LLM review over every pull request and can merge on its own judgement. Webhook in, review queue, diff budgeted into a prompt, verdict posted back — all through a self-hosted OpenAI-compatible endpoint.",
      id: "GitHub App yang menjalankan review LLM atas setiap pull request dan bisa merge berdasarkan penilaiannya sendiri. Webhook masuk, antrean review, diff yang sudah dibatasi masuk ke prompt, lalu verdict dikirim balik — semuanya lewat endpoint OpenAI-compatible yang di-host sendiri.",
    },
    highlights: {
      en: [
        "HMAC-verified webhook, deduped per PR, two reviews in flight",
        "Diff is budgeted before it is prompted, so a large PR cannot blow the context window",
        "A worker app re-polls open PRs on a timer, so a missed webhook is not a missed review",
        "Web UI over the full review history",
      ],
      id: [
        "Webhook diverifikasi HMAC, didedup per PR, dua review berjalan bersamaan",
        "Diff dibatasi sebelum masuk prompt, jadi PR besar tidak bisa menabrak context window",
        "Aplikasi worker menanyakan ulang PR terbuka secara berkala, jadi webhook yang terlewat bukan berarti review yang terlewat",
        "Web UI untuk seluruh riwayat review",
      ],
    },
    stack: [
      "TypeScript",
      "Node.js",
      "Hono",
      "oRPC",
      "Drizzle",
      "GitHub App",
      "TanStack Router",
      "Vitest",
    ],
    links: links(
      "https://pr-agent.asepharyana.my.id/",
      "https://github.com/asepharyana/pr-agent-server",
    ),
  },
  {
    name: "MCPedia",
    tagline: {
      en: "Markdown knowledge base, readable by humans and agents",
      id: "Basis pengetahuan Markdown, bisa dibaca manusia dan agent",
    },
    summary: {
      en: "Content lives as plain Markdown in Git. It is indexed into Postgres — weighted full-text plus chunked embeddings — and served through one Core layer that the web UI, the MCP server, the API and the worker all share.",
      id: "Konten tinggal sebagai Markdown biasa di dalam Git. Terindeks ke Postgres — full-text berbobot plus embedding per potongan — lalu disajikan lewat satu lapisan Core yang dipakai bersama oleh web UI, MCP server, API, dan worker.",
    },
    highlights: {
      en: [
        "The same content is queryable by a person in a browser and by an agent over MCP",
        "Weighted tsvector search alongside cosine similarity, not one instead of the other",
        "A BullMQ worker reindexes on a git push webhook, so the index follows the repository",
        "One shared Core: no interface re-implements business logic",
      ],
      id: [
        "Konten yang sama bisa dijawab orang di browser dan agent lewat MCP",
        "Pencarian tsvector berbobot berdampingan dengan cosine similarity, bukan salah satu saja",
        "Worker BullMQ membangun ulang index saat webhook git push, jadi index mengikuti repository",
        "Satu Core bersama: tidak ada antarmuka yang mengulang ulang logika bisnis",
      ],
    },
    stack: [
      "TypeScript",
      "Next.js 16",
      "tRPC",
      "PostgreSQL",
      "pgvector",
      "BullMQ",
      "MCP",
    ],
    links: links(
      "https://wiki.asepharyana.my.id/",
      "https://github.com/asepharyana/mcpedia",
    ),
  },
  {
    name: "TeleUploader",
    tagline: {
      en: "File uploads to Telegram, and an S3-compatible front door",
      id: "Upload file ke Telegram, plus pintu masuk kompatibel S3",
    },
    summary: {
      en: "Upload files to a private Telegram channel and get a public download link back. It also speaks enough S3 to be mounted as a bucket, which is how it backs the upload front end.",
      id: "Upload file ke channel Telegram privat dan dapatkan tautan unduhan publik. Service ini juga bicara cukup banyak S3 untuk bisa dipasang sebagai bucket, dan itulah cara ia menopang front end upload.",
    },
    highlights: {
      en: [
        "S3-compatible surface: SigV4 auth, range reads, multipart, virtual-host addressing",
        "Bounded concurrency and streaming, so a large object never sits fully in memory",
        "Hono + oRPC over Drizzle and PostgreSQL behind PgBouncer",
        "Deploys as a single systemd unit — the Docker path is legacy and unused",
      ],
      id: [
        "Permukaan S3-compatible: autentikasi SigV4, range read, multipart, alamat virtual-host",
        "Concurrency terbatas dan streaming, sehingga objek besar tidak pernah utuh di memori",
        "Hono + oRPC di atas Drizzle dan PostgreSQL di belakang PgBouncer",
        "Deploy sebagai satu unit systemd — jalur Docker sudah usang dan tidak terpakai",
      ],
    },
    stack: [
      "TypeScript",
      "Hono",
      "oRPC",
      "Drizzle",
      "PostgreSQL",
      "AWS SDK",
      "Telegram Bot API",
      "Vitest",
    ],
    links: links(
      "https://upload.asepharyana.my.id/",
      "https://github.com/asepharyana/TeleUploader",
    ),
  },
];
