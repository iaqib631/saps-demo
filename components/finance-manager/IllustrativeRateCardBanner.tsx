"use client";

/**
 * The persistent "these rates are invented" banner.
 *
 * WHY IT IS A COMPONENT AND NOT A PARAGRAPH
 * -----------------------------------------
 * Two screens price off the illustrative rate card, and the warning has to
 * read identically on both — a rate card labelled loudly on one screen and
 * quietly on the other is labelled quietly. One component, one wording, drawn
 * from `RATE_CARD` in `lib/domain/tariff` so the text and the data version
 * together.
 *
 * WHY IT CANNOT BE DISMISSED
 * --------------------------
 * There is no close button and no `useState` behind it, deliberately. The
 * decision this implements (`CMTS_SCOPE_DECISIONS.md` § The data request) calls
 * for a PERSISTENT banner — not a tooltip, not a footnote — because the harm
 * being guarded against is somebody screenshotting a tariff table and quoting
 * it as SAPS's rates. A banner that can be closed is absent from exactly the
 * screenshot that matters.
 *
 * It also renders nothing at all once `RATE_CARD.isIllustrative` is false, so
 * the day the real extract lands the warning disappears everywhere in one edit
 * rather than being left behind over real numbers.
 */

import { AlertTriangle } from "lucide-react";
import { RATE_CARD } from "@/lib/domain/tariff";

export default function IllustrativeRateCardBanner({ screen }: { screen: string }) {
  if (!RATE_CARD.isIllustrative) return null;

  return (
    <div
      role="alert"
      className="rounded-[16px] border-2 p-4 sm:p-5 shadow-sm"
      style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle size={20} style={{ color: "#DC2626" }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold tracking-wide" style={{ color: "#B91C1C" }}>
              {RATE_CARD.headline}
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold inline-flex items-center font-mono">
              {RATE_CARD.id}
            </span>
          </div>

          <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "#7F1D1D" }}>
            {RATE_CARD.summary} {RATE_CARD.detail}
          </p>

          <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "#991B1B" }}>
            Every rate on {screen} resolves from{" "}
            <span className="font-mono">lib/domain/tariff.ts</span>, which stands in for six CMTS
            tables restored empty:{" "}
            <span className="font-mono">{RATE_CARD.emptyTables.join(" · ")}</span>.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px]" style={{ color: "#991B1B" }}>
            <span>
              Decision <span className="font-mono">{RATE_CARD.ticket}</span> · {RATE_CARD.decidedOn}
            </span>
            <span className="font-mono">{RATE_CARD.decisionRef}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The small mono token naming the CMTS column a value came from — the repo's
 * parity convention, matching the `VoucherField` marker on the godown-rent
 * screen. Used in table headers here, where a per-field label would not fit.
 */
export function CmtsCol({ name, tone = "muted" }: { name: string; tone?: "muted" | "strong" }) {
  return (
    <span
      className={`block text-[9px] font-mono font-normal normal-case tracking-normal ${
        tone === "strong" ? "text-[#94A3B8]" : "text-[#CBD5E1]"
      }`}
      title={`CMTS column: ${name}`}
    >
      {name}
    </span>
  );
}

/**
 * The "this table is invented" strip that sits on every rate table on these
 * screens. Shorter than the banner because it repeats often — the banner
 * carries the argument, this carries the reminder plus the source table name,
 * so a reader who scrolled past the banner still cannot mistake the numbers
 * for an extract.
 */
export function IllustrativeTableNote({
  table,
  what,
}: {
  table: string;
  what: string;
}) {
  if (!RATE_CARD.isIllustrative) return null;
  return (
    <div className="flex items-start gap-2 px-5 py-2.5 border-b border-[#FEE2E2] bg-[#FEF2F2]">
      <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold inline-flex items-center font-mono flex-shrink-0">
        ILLUSTRATIVE
      </span>
      <span className="text-[11px] leading-[18px]" style={{ color: "#991B1B" }}>
        Stands in for CMTS <span className="font-mono font-semibold">{table}</span>, restored empty.
        {" "}
        {what}
      </span>
    </div>
  );
}
