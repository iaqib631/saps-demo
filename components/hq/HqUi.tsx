"use client";

/**
 * HQ portal — the small shared pieces every HQ screen is built from.
 *
 * Grouped in one file deliberately: they are four ~20-line primitives that
 * only exist to keep five screens rendering the same card, the same meter and
 * the same severity marker. Four files would be four imports and one more
 * place for them to drift.
 *
 * THREE RULES THEY ENFORCE, and each is a decision about honesty rather than
 * taste:
 *
 *   1. **Every card names its source.** `source` is required on HqCard, not
 *      optional, and it renders. Every number on this portal is derived from
 *      lib/domain; the existing dashboards in this product hard-code "184
 *      Active Users" and "87% Integration Health", and the first thing a
 *      client does with a number is ask where it came from.
 *
 *   2. **No trend arrows anywhere.** There is no time series in this repo —
 *      every fixture is a single snapshot at DEMO_NOW — so a "+12%" here would
 *      be invented. HqStat has no trend prop and must not grow one.
 *
 *   3. **Severity is never colour alone.** SeverityPill always ships an icon
 *      and a word, so the state survives greyscale, print and colour-vision
 *      deficiency.
 */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Info,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Severity — the reserved status palette. These four colours mean state
 * and are never reused to distinguish one site from another.
 * ------------------------------------------------------------------ */

export type Severity = "good" | "warning" | "serious" | "critical" | "neutral";

const SEVERITY: Record<Severity, { fg: string; bg: string; border: string; Icon: LucideIcon }> = {
  good: { fg: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0", Icon: CheckCircle2 },
  warning: { fg: "#D97706", bg: "#FEF3C7", border: "#FDE68A", Icon: AlertTriangle },
  serious: { fg: "#DC2626", bg: "#FEE2E2", border: "#FECACA", Icon: CircleAlert },
  critical: { fg: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5", Icon: CircleAlert },
  neutral: { fg: "#64748B", bg: "#F1F5F9", border: "#E2E8F0", Icon: Info },
};

export function severityTone(s: Severity) {
  return SEVERITY[s];
}

export function SeverityPill({ severity, label }: { severity: Severity; label: string }) {
  const t = SEVERITY[severity];
  const { Icon } = t;
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[10px] font-bold"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export function HqCard({
  title,
  icon: Icon,
  /** Where the numbers come from — a function name in lib/domain, verbatim. */
  source,
  intro,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  source: string;
  intro?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[#E2E8F0] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={15} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          </div>
          {intro && <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">{intro}</p>}
          <p className="mt-1.5 font-mono text-[10px] text-[#94A3B8]">{source}</p>
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex flex-shrink-0 items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            {action.label} <ArrowUpRight size={12} />
          </Link>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Stat tile — a headline number with its unit and its provenance.
 * No trend, by construction. See rule 2 above.
 * ------------------------------------------------------------------ */

export function HqStat({
  label,
  value,
  detail,
  severity = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  severity?: Severity;
}) {
  const t = SEVERITY[severity];
  return (
    <div className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p
        className="mt-1 text-[24px] font-bold leading-none"
        style={{ color: severity === "neutral" ? "#0F172A" : t.fg }}
      >
        {value}
      </p>
      {detail && <p className="mt-1.5 text-[11px] leading-snug text-[#64748B]">{detail}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Meter — magnitude on one hue, light→dark by value. Not a category
 * colour: the site is named in text beside it, never encoded in the fill.
 * ------------------------------------------------------------------ */

export function Meter({
  pct,
  tone = "#1B4F8B",
  height = 8,
}: {
  /** 0–100. */
  pct: number;
  tone?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-[#EEF2F7]"
      style={{ height }}
      role="img"
      aria-label={`${clamped.toFixed(1)} percent`}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: tone, minWidth: clamped > 0 ? 4 : 0 }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The "cannot be fed" marker.
 *
 * A tile the client will ask for that no fixture can answer. Rendering the
 * reason is the whole point — a dashboard that looks authoritative and is
 * made up is the worst outcome available, and silence about a missing tile
 * reads as "we forgot" rather than "there is no data".
 * ------------------------------------------------------------------ */

export function NotAvailable({ title, reason, nearest }: { title: string; reason: string; nearest?: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
      <p className="text-[12px] font-semibold text-[#475569]">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{reason}</p>
      {nearest && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
          <span className="font-semibold text-[#64748B]">Nearest honest thing: </span>
          {nearest}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen header — the badge row / title / lede every HQ page opens with.
 * ------------------------------------------------------------------ */

export function HqScreenHeader({
  module,
  flow,
  title,
  lede,
}: {
  module: string;
  flow: string;
  title: string;
  lede: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-[18px] items-center rounded bg-[#EBF0F7] px-1.5 font-mono text-[10px] font-bold text-[#0B2545]">
          {module}
        </span>
        <span className="inline-flex h-[18px] items-center rounded bg-[#F1F5F9] px-1.5 font-mono text-[10px] font-bold text-[#64748B]">
          {flow}
        </span>
      </div>
      <h1 className="mt-1.5 text-[24px] font-bold leading-tight text-[#0F172A] lg:text-[30px]">
        {title}
      </h1>
      <p className="mt-1 max-w-[76ch] text-[13px] leading-relaxed text-[#64748B]">{lede}</p>
    </div>
  );
}
