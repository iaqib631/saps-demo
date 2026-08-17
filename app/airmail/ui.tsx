"use client";

/**
 * P9-6 · Small shared pieces for the airmail route tree (M26 / FC-18).
 *
 * Five screens render the same three things — a card shell, a labelled field
 * with a CMTS parity token, and a KPI tile — so they live here.
 *
 * WHY NOT `components/awb/AwbTabs.tsx`'s `Field`, which is the same shape:
 * because airmail is deliberately not a variant of the AWB. Postal cargo
 * moves on a delivery bill against a dispatch and is counted in receptacles;
 * importing the AWB module's field renderer would put an `import` edge from
 * M26 to M03 that says the opposite, and would pull the whole AWB tab bundle
 * — every AWB domain fixture it reads — into these screens for one component.
 * Everything genuinely shared lives in `components/primitives`, and this file
 * is the airmail-local remainder, not a second copy of the kit.
 *
 * `CmtsToken` is the one thing here that is not a re-skin. It renders the
 * parity marker in two weights, because in this module a column name is not
 * uniformly trustworthy: the counts are evidenced and most of the names are
 * modelled. See `cmtsColumnEvidenced` in lib/domain/airmail.ts.
 */

import Link from "next/link";
import { cmtsColumnEvidenced } from "@/lib/domain/airmail";

/* ------------------------------------------------------------------ *
 * CMTS parity token
 * ------------------------------------------------------------------ */

export function CmtsToken({ column }: { column: string }) {
  // The column name is quoted verbatim, misspellings included — see rule 5
  // in lib/domain/airmail.ts. Never normalise the case here.
  const evidenced = cmtsColumnEvidenced(column);
  return (
    <span
      className="text-[9px] font-mono whitespace-nowrap"
      style={{ color: evidenced ? "#94A3B8" : "#CBD5E1" }}
      title={
        evidenced
          ? `CMTS column: ${column} — named in the migration reports.`
          : `CMTS column: ${column} — modelled. The reports give this table's column count but not its column names; SAPS have to confirm this one.`
      }
    >
      {column}
      {evidenced ? "" : "?"}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Field
 * ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  cmts,
  mono,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  /** The CMTS column this maps to — parity is checkable on screen. */
  cmts?: string;
  mono?: boolean;
  tone?: "default" | "muted" | "warn" | "bad" | "ok";
}) {
  const colour =
    tone === "muted"
      ? "#94A3B8"
      : tone === "warn"
        ? "#D97706"
        : tone === "bad"
          ? "#DC2626"
          : tone === "ok"
            ? "#16A34A"
            : "#0F172A";

  const empty = value === null || value === undefined || value === "";

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        {cmts && <CmtsToken column={cmts} />}
      </div>
      <div
        className={`min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center text-[13px] font-medium break-words ${
          mono ? "font-mono" : ""
        }`}
        style={{ color: colour }}
      >
        {empty ? <span className="text-[#CBD5E1]">null</span> : value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  icon,
  right,
  children,
  footer,
  className = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden ${className}`}
    >
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          {icon && <span className="mt-0.5 flex-shrink-0 text-[#64748B]">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{subtitle}</p>
            )}
          </div>
        </div>
        {right}
      </div>
      {children}
      {footer && (
        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#64748B] leading-relaxed">{footer}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * KPI tile
 * ------------------------------------------------------------------ */

export function Kpi({
  label,
  value,
  tone = "#0F172A",
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className="text-[22px] font-bold mt-1" style={{ color: tone }}>
        {value}
      </p>
      {note && <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chips
 * ------------------------------------------------------------------ */

export function Chip({
  children,
  bg,
  fg,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/** The one chip that appears on four of the five screens. */
export function IrregularityChip({ open }: { open: boolean }) {
  return open ? (
    <Chip bg="#FEE2E2" fg="#DC2626">
      IN IRREGULARITY
    </Chip>
  ) : (
    <Chip bg="#DCFCE7" fg="#16A34A">
      CN-43 CLOSED
    </Chip>
  );
}

/* ------------------------------------------------------------------ *
 * Dispatch link — every cross-screen reference lands on the same route
 * ------------------------------------------------------------------ */

export function DispatchLink({
  id,
  dispatchNo,
  className = "",
}: {
  id: number;
  dispatchNo: string;
  className?: string;
}) {
  return (
    <Link
      href={`/airmail/${id}`}
      className={`font-mono text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline ${className}`}
    >
      {dispatchNo}
    </Link>
  );
}
