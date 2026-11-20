import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FieldLabel } from "#/components/ui/form-primitives";
import { useI18n } from "#/lib/i18n/context";

/**
 * The router credentials, published on the portfolio.
 *
 * This block is the falsifiability claim made literal. The dashboard says the
 * router is reachable; this hands the visitor the key so they can check it
 * themselves, from their own terminal, without an account.
 *
 * It renders nothing when `access` is null (the key is unconfigured), rather
 * than an empty box: a credentials panel with a blank key is worse than no
 * panel, because it looks like a bug in the page instead of a decision.
 */
export function AccessPanel({
  access,
}: {
  access: {
    baseUrl: string;
    model: string;
    apiKey: string;
    curl: string;
  } | null;
}) {
  const { t } = useI18n();

  if (!access) return null;

  return (
    <section className="mt-12">
      <div className="max-w-[62ch]">
        <FieldLabel>{t.access.heading}</FieldLabel>
        <p className="mt-2 text-[12px] leading-[1.6] text-ink-soft">
          {t.access.note}
        </p>
      </div>

      <div className="mt-5 h-px w-full bg-ink" />

      <dl className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-3">
        <Value label={t.access.baseUrl} value={access.baseUrl} />
        <Value label={t.access.model} value={access.model} />
        <Value label={t.access.apiKey} value={access.apiKey} masked />
      </dl>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>{t.access.example}</FieldLabel>
          <CopyButton text={access.curl} />
        </div>
        <pre className="mt-2 overflow-x-auto border border-rule bg-paper-raised px-4 py-3 font-mono text-[11px] leading-[1.7] text-ink">
          <code>{access.curl}</code>
        </pre>
      </div>

      <p className="mt-4 max-w-[68ch] text-[11px] leading-[1.6] text-ink-faint">
        {t.access.freeNote}
      </p>
    </section>
  );
}

/**
 * One credential field.
 *
 * The key is shown in full rather than masked: it is published on purpose, and
 * a masked key would force a visitor to open devtools to copy the thing the
 * page is offering them.
 */
function Value({
  label,
  value,
  masked = false,
}: {
  label: string;
  value: string;
  /** Reserved for a field that is not meant to be read at a glance. */
  masked?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-paper px-4 py-3">
      <dt className="field-label">{label}</dt>
      <dd
        className={`reading truncate text-[12px] text-ink ${masked ? "select-all" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Copy-to-clipboard with a confirmation that resets.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can reject on a
 * denied permission, so the failure path is silent rather than throwing: the
 * text is selectable either way, and a rejected promise must not surface as an
 * unhandled rejection in the console.
 */
function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = useCallback(() => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => {});
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex cursor-pointer items-center gap-1.5 border border-rule px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-ink-faint uppercase transition-colors hover:border-ink hover:text-ink"
    >
      {copied ? (
        <Check size={10} aria-hidden />
      ) : (
        <Copy size={10} aria-hidden />
      )}
      {copied ? t.actions.copied : t.actions.copy}
    </button>
  );
}
