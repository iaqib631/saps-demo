"use client";

/**
 * P3-6 · Long-stay case register.
 *
 * The canonical screen lists cases as a narrow rail of AWB numbers, stages and
 * dwell badges. Everything a compliance officer actually triages on — who the
 * consignee is, how many pieces are sitting there, what class they are, what
 * customs said, whose queue it is — was only ever on the legacy register, and
 * none of it fits in a 1/3-width rail. So the rail becomes a table and the
 * detail below gets the full width back.
 *
 * Selection stays where it was: clicking a row drives the detail stack, it does
 * not navigate. The AWB number is still a link to the hub, which is why the row
 * is a `<tr onClick>` rather than a button — a button cannot legally contain an
 * anchor.
 */

import { CalendarClock } from "lucide-react";
import AwbLink from "@/components/awb/AwbLink";
import { AgingBadge } from "@/components/primitives";
import {
  DISPOSITION_LABEL,
  LONGSTAY_STAGE_LABEL,
  formatDate,
  formatKg,
} from "@/lib/domain";
import {
  CUSTOMS_DECISION_LABEL,
  NOTICE_STATUS_LABEL,
  type CustomsDecision,
  type LongStayCaseFile,
  type NoticeStatus,
} from "./caseFile";

const NOTICE_TONE: Record<NoticeStatus, { bg: string; fg: string }> = {
  "not-notified": { bg: "#F1F5F9", fg: "#64748B" },
  "notice-sent": { bg: "#DBEAFE", fg: "#1B4F8B" },
  escalated: { bg: "#FEF3C7", fg: "#D97706" },
  "final-notice": { bg: "#FEE2E2", fg: "#DC2626" },
};

const DECISION_TONE: Record<CustomsDecision, { bg: string; fg: string }> = {
  pending: { bg: "#F1F5F9", fg: "#64748B" },
  "release-approved": { bg: "#DCFCE7", fg: "#16A34A" },
  auction: { bg: "#FFEDD5", fg: "#C2410C" },
  disposal: { bg: "#FEE2E2", fg: "#DC2626" },
};

function Pill({ tone, children }: { tone: { bg: string; fg: string }; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {children}
    </span>
  );
}

const HEADERS = [
  "Case #",
  "AWB #",
  "HAWB #",
  "Consignee",
  "Class",
  "Pieces",
  "Weight",
  "Arrived",
  "Dwell",
  "Notice status",
  "Stage",
  "Customs decision",
  "Final disposition",
  "Owner",
];

export default function CaseRegisterTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: LongStayCaseFile[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
        <CalendarClock size={15} className="text-[#64748B]" />
        <h3 className="text-[14px] font-semibold text-[#0F172A]">Case register</h3>
        <span className="text-[12px] text-[#64748B] ml-auto">{rows.length} cases</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                style={{ backgroundColor: selectedId === r.id ? "#EBF0F7" : undefined }}
              >
                <td className="px-4 py-3.5">
                  <span className="font-mono text-[12px] font-semibold text-[#0B2545] whitespace-nowrap">
                    {r.caseNo}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <AwbLink awbNo={r.AWBNO} awbId={r.awbId} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#475569]">{r.HWBNo ?? "—"}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] font-medium text-[#0F172A]">{r.consignee}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="text-[12px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-lg"
                    title={r.cargoClassName}
                  >
                    {r.cargoClassAbbr}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#475569]">{r.pieces}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#475569] whitespace-nowrap">
                    {formatKg(r.weightKg)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#475569] whitespace-nowrap">
                    {formatDate(r.arrivedAt)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <AgingBadge
                      totalDays={r.ageDays}
                      freeDays={r.freeDays}
                      section82Days={r.section82Days}
                      compact
                    />
                    <span
                      className="text-[10px] whitespace-nowrap"
                      style={{ color: r.daysToDeadline < 0 ? "#DC2626" : "#94A3B8" }}
                    >
                      {r.daysToDeadline < 0
                        ? `${Math.abs(r.daysToDeadline)}d past deadline`
                        : `${r.daysToDeadline}d to deadline`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <Pill tone={NOTICE_TONE[r.noticeStatus]}>
                    {NOTICE_STATUS_LABEL[r.noticeStatus]}
                  </Pill>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold bg-[#F3E8FF] text-[#7C3AED] whitespace-nowrap"
                    title={LONGSTAY_STAGE_LABEL[r.stage]}
                  >
                    {LONGSTAY_STAGE_LABEL[r.stage].split(". ")[0]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <Pill tone={DECISION_TONE[r.customsDecision]}>
                    {CUSTOMS_DECISION_LABEL[r.customsDecision]}
                  </Pill>
                </td>
                <td className="px-4 py-3.5">
                  {r.disposition ? (
                    <Pill tone={{ bg: "#DCFCE7", fg: "#16A34A" }}>
                      {DISPOSITION_LABEL[r.disposition]}
                    </Pill>
                  ) : (
                    <span className="text-[12px] text-[#CBD5E1]">Not recorded</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#475569] whitespace-nowrap">{r.owner}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
