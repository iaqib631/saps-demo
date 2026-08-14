"use client";

/**
 * P3-1 · CDR queue table.
 *
 * The canonical register is a rail of CDR references, and a rail cannot be
 * sorted. That matters more here than it looks: a queue is read in priority
 * order or in age order, never in insertion order, and every triage decision
 * an operator makes is "what is oldest and hottest that nobody owns".
 *
 * The pieces-affected column is the other reason this is a table. The
 * canonical screen shows declared/physical/delta/ratio on the *selected* CDR,
 * which answers "how bad is this one" and never "which one is worst".
 *
 * Rows are `<tr onClick>` rather than buttons because the AWB cell is a link
 * and the action cell holds buttons — neither may legally nest inside a
 * button. The action buttons stop propagation so acting on a row does not also
 * re-select it out from under the operator.
 */

import {
  ArrowUpCircle,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  StickyNote,
  UserPlus,
  Zap,
} from "lucide-react";
import AwbLink from "@/components/awb/AwbLink";
import { CDR_ORIGIN_LABEL, DISCREPANCY_LABEL, formatDateTime, isDispatchOrigin } from "@/lib/domain";
import {
  CDR_PRIORITY_LABEL,
  CDR_QUEUE_STATE_LABEL,
  CDR_SLA_HOURS,
  CDR_STAGE_SHORT,
  CDR_UNASSIGNED,
  formatAge,
  type CdrPriority,
  type CdrQueueRow,
  type CdrQueueState,
  type QueueSortKey,
} from "./queueLayer";

const PRIORITY_TONE: Record<CdrPriority, { bg: string; fg: string }> = {
  high: { bg: "#FEE2E2", fg: "#DC2626" },
  medium: { bg: "#FEF3C7", fg: "#D97706" },
  low: { bg: "#F1F5F9", fg: "#64748B" },
};

const QUEUE_TONE: Record<CdrQueueState, { bg: string; fg: string; dot: string }> = {
  unassigned: { bg: "#FEF3C7", fg: "#D97706", dot: "#D97706" },
  assigned: { bg: "#E0E7FF", fg: "#4338CA", dot: "#4338CA" },
  escalated: { bg: "#FEE2E2", fg: "#DC2626", dot: "#DC2626" },
  resolved: { bg: "#DCFCE7", fg: "#16A34A", dot: "#16A34A" },
  closed: { bg: "#F1F5F9", fg: "#64748B", dot: "#94A3B8" },
};

const COLUMNS: Array<{ key: QueueSortKey | "actions"; header: string; sortable: boolean }> = [
  { key: "cdrRef", header: "CDR #", sortable: true },
  { key: "AWBNO", header: "AWB #", sortable: true },
  { key: "type", header: "Type", sortable: true },
  { key: "origin", header: "Origin", sortable: true },
  { key: "piecesAffected", header: "Pieces", sortable: true },
  { key: "raisedAt", header: "Raised", sortable: true },
  { key: "status", header: "FC-04 stage", sortable: true },
  { key: "owner", header: "Owner", sortable: true },
  { key: "queueState", header: "Queue status", sortable: true },
  { key: "ageHours", header: "Age", sortable: true },
  { key: "priority", header: "Priority", sortable: true },
  { key: "actions", header: "Actions", sortable: false },
];

function RowAction({
  Icon,
  title,
  color,
  onClick,
}: {
  Icon: typeof UserPlus;
  title: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] cursor-pointer transition-colors"
    >
      <Icon size={14} style={{ color }} />
    </button>
  );
}

export default function CdrQueueTable({
  rows,
  selectedId,
  onSelect,
  sortKey,
  sortDirection,
  onSort,
  onAction,
}: {
  rows: CdrQueueRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  sortKey: QueueSortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: QueueSortKey) => void;
  onAction: (verb: string, row: CdrQueueRow) => void;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2 flex-wrap">
        <ClipboardList size={15} className="text-[#64748B]" />
        <h3 className="text-[14px] font-semibold text-[#0F172A]">CDR queue</h3>
        <span className="text-[12px] text-[#64748B] ml-auto">
          {rows.length} CDRs · sorted by {sortKey === "ageHours" ? "age" : sortKey} (
          {sortDirection})
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSort(col.key as QueueSortKey)}
                  className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap select-none"
                  style={{
                    color: sortKey === col.key ? "#0B2545" : "#64748B",
                    cursor: col.sortable ? "pointer" : "default",
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <ArrowUpDown size={11} style={{ opacity: sortKey === col.key ? 1 : 0.35 }} />
                    )}
                  </span>
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
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-semibold text-[#0B2545] whitespace-nowrap">
                      {r.cdrRef}
                    </span>
                    {r.autoRaised && (
                      <span
                        className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[9px] font-bold inline-flex items-center gap-0.5"
                        title="Auto-raised from intake variance"
                      >
                        <Zap size={8} />
                        AUTO
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <AwbLink awbNo={r.AWBNO} awbId={r.awbId} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[13px] text-[#0F172A] whitespace-nowrap">
                    {DISCREPANCY_LABEL[r.type]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: isDispatchOrigin(r.origin) ? "#FFEDD5" : "#EBF0F7",
                      color: isDispatchOrigin(r.origin) ? "#C2410C" : "#1B4F8B",
                    }}
                    title={CDR_ORIGIN_LABEL[r.origin]}
                  >
                    {isDispatchOrigin(r.origin) ? "Dispatch" : "Intake"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="text-[13px]"
                    style={{ color: r.piecesAffected === null ? "#CBD5E1" : "#0F172A" }}
                  >
                    {r.piecesAffected ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[12px] text-[#64748B] whitespace-nowrap">
                    {formatDateTime(r.raisedAt)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-[12px] text-[#475569] whitespace-nowrap font-mono">
                    {CDR_STAGE_SHORT[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{
                      color: r.owner === CDR_UNASSIGNED ? "#D97706" : "#0F172A",
                      fontWeight: r.owner === CDR_UNASSIGNED ? 600 : 400,
                    }}
                  >
                    {r.owner}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: QUEUE_TONE[r.queueState].bg,
                      color: QUEUE_TONE[r.queueState].fg,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: QUEUE_TONE[r.queueState].dot }}
                    />
                    {CDR_QUEUE_STATE_LABEL[r.queueState]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="text-[13px] font-semibold whitespace-nowrap"
                    style={{ color: r.overSla ? "#DC2626" : "#16A34A" }}
                    title={r.overSla ? `Past the ${CDR_SLA_HOURS}h SLA target` : "Within SLA"}
                  >
                    {formatAge(r.ageHours)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold"
                    style={{
                      backgroundColor: PRIORITY_TONE[r.priority].bg,
                      color: PRIORITY_TONE[r.priority].fg,
                    }}
                  >
                    {CDR_PRIORITY_LABEL[r.priority]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-0.5">
                    <RowAction
                      Icon={UserPlus}
                      title={r.owner === CDR_UNASSIGNED ? "Assign owner" : "Reassign owner"}
                      color="#1B4F8B"
                      onClick={() => onAction("Assign owner", r)}
                    />
                    <RowAction
                      Icon={ArrowUpCircle}
                      title="Escalate"
                      color="#DC2626"
                      onClick={() => onAction("Escalate", r)}
                    />
                    <RowAction
                      Icon={CheckCircle2}
                      title="Mark resolved"
                      color="#16A34A"
                      onClick={() => onAction("Mark resolved", r)}
                    />
                    <RowAction
                      Icon={StickyNote}
                      title="Add note"
                      color="#64748B"
                      onClick={() => onAction("Add note", r)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
