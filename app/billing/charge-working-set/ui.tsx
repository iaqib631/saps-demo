/**
 * Charge Working Set — the presentation primitives the three tabs share.
 *
 * These four shapes were local to `page.tsx` while the screen had one tab. They
 * moved here unchanged when `TempImportCalculation` and `ImportFreeHandedCalc`
 * joined `grCharges` on the same screen (Q8), because the whole argument for
 * putting the three paths on one screen is that a reader can compare them — and
 * they cannot compare three tabs that render a CMTS column name three different
 * ways. Nothing about the markup changed in the move.
 *
 * NOT a `components/` primitive. It is specific to this screen's parity idiom,
 * and `components/primitives` is reserved for concepts a flow amendment demands
 * in several places. Same reasoning as `app/airmail/ui.tsx`.
 */

import type { ReactNode } from "react";

/**
 * A CMTS column marker: 9px mono grey, the same token the sibling screens use.
 *
 * `name: null` is not the same as omitting the marker. It means the value beside
 * it is real and the table being rendered has no column for it — chargeable
 * weight and the tariff rate are both in that position — and saying so is the
 * finding. A blank would read as "not yet mapped", which is a different thing
 * entirely.
 */
export function CmtsCol({
  name,
  block,
  table,
}: {
  name: string | null;
  block?: boolean;
  /** The owning table, for the tooltip. Column spellings are per table. */
  table?: string;
}) {
  return (
    <span
      className={`${block ? "block" : ""} text-[9px] font-mono ${name === null ? "text-[#B45309] italic" : "text-[#CBD5E1]"} normal-case tracking-normal font-normal`}
      title={
        name === null
          ? `No column on ${table ?? "this table"}`
          : `CMTS column: ${name}${table ? ` (${table})` : ""}`
      }
    >
      {name ?? "no column"}
    </span>
  );
}

/**
 * One labelled value carrying its CMTS column.
 *
 * A null renders as the word `null` in the muted tone rather than as blank: on
 * a parity screen "this column exists and is empty" and "this column was never
 * mapped" are different findings, and an empty cell cannot tell them apart.
 */
export function Field({
  label,
  cmts,
  value,
  mono,
  tone,
  hint,
  table,
}: {
  label: string;
  /** Null where the value is real but the table has no column for it. */
  cmts: string | null;
  value: string | null;
  mono?: boolean;
  tone?: string;
  hint?: string;
  table?: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        <CmtsCol name={cmts} table={table} />
      </div>
      <span
        className={`text-[13px] font-medium break-words ${mono ? "font-mono" : ""}`}
        style={{ color: value === null ? "#CBD5E1" : (tone ?? "#0F172A") }}
      >
        {value ?? "null"}
      </span>
      {hint && <span className="text-[10px] text-[#94A3B8] leading-snug">{hint}</span>}
    </div>
  );
}

export function Card({
  icon,
  title,
  subtitle,
  right,
  children,
  footer,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[#64748B] mt-0.5 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">{footer}</div>
      )}
    </div>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`${right ? "text-right" : "text-left"} px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap align-bottom`}
    >
      {children}
    </th>
  );
}

/** A pass / fail chip, the shape every reconciliation on this screen ends with. */
export function CheckChip({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span
      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
      style={
        ok ? { backgroundColor: "#DCFCE7", color: "#16A34A" } : { backgroundColor: "#FEE2E2", color: "#DC2626" }
      }
    >
      {ok ? okLabel : badLabel}
    </span>
  );
}

/** `[sic]` — a legacy misspelling reproduced deliberately. */
export function Sic({ note }: { note: string }) {
  return (
    <span
      className="h-[16px] px-1.5 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono"
      title={note}
    >
      [sic]
    </span>
  );
}

export const BILL_TONE: Record<string, { bg: string; fg: string }> = {
  NORMAL: { bg: "#F1F5F9", fg: "#64748B" },
  SUPPLIMENT: { bg: "#FEF3C7", fg: "#D97706" },
  DUPLICATE: { bg: "#F5F3FF", fg: "#7C3AED" },
  FREEHAND: { bg: "#DBEAFE", fg: "#1B4F8B" },
};

export const SEVERITY_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  money: { bg: "#FEE2E2", fg: "#DC2626", label: "MONEY" },
  risk: { bg: "#FEF3C7", fg: "#B45309", label: "RISK" },
  unexercised: { bg: "#F1F5F9", fg: "#64748B", label: "DORMANT" },
};

/** Support tones for the three-path capability matrix. */
export const SUPPORT_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  yes: { bg: "#DCFCE7", fg: "#16A34A", label: "yes" },
  partial: { bg: "#FEF3C7", fg: "#B45309", label: "partial" },
  no: { bg: "#FEE2E2", fg: "#DC2626", label: "no" },
};
