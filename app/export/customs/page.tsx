"use client";

/**
 * FC-11 §04–10 · Customs / ANF check, the correction loop, and the PSW export
 * declaration.
 *
 * The gap this closes: the demo modelled export customs as a single
 * cleared/not-cleared state. FC-11 does not draw it that way. It draws:
 *
 *   Custom / ANF Check ─┬→ Inspection for Clearance ─┐
 *                       └→ Document Check (AWB / GD) ─┴→ Clearance?
 *                                                        │ Yes → Physical Check
 *                                                        │ No  → Hold till correction?
 *                                                                 │ Yes → back to the check
 *                                                                 └ No  → Returned / Detained
 *
 * Two arms feeding one decision, and the hold is itself a decision with a
 * terminal reject on its No edge. A boolean cannot express a consignment
 * on its second correction round — which is the state an export desk
 * spends most of its day in, and the one a shipper phones about.
 *
 * So rounds are modelled individually and shown as a history. "Cleared on
 * round 2 after the GD came back signed" is a different operational fact
 * from "cleared", and only one of them tells you the desk is working.
 *
 * **Ported in from the retired `/export-cargo/customs`** (see
 * PORTAL_AND_DEDUP_PLAN.md §2.1): the Export GD register and the five desk
 * status chips. Rounds are what happened; the register is what the desk is
 * holding. This screen had the first and no way at all to see the second.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  FileWarning,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Stamp,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  CLEARANCE_OUTCOME_LABEL,
  EXPORT_STAGE_LABEL,
  clearanceState,
  formatDate,
  formatDateTime,
  formatPkr,
  listExports,
  type ClearanceOutcome,
  type ExportConsignment,
} from "@/lib/domain";

const OUTCOME_TONE: Record<ClearanceOutcome, { bg: string; fg: string; border: string }> = {
  cleared: { bg: "#DCFCE7", fg: "#16A34A", border: "#BBF7D0" },
  "held-for-correction": { bg: "#FEF3C7", fg: "#D97706", border: "#FDE68A" },
  "returned-to-shipper": { bg: "#FEE2E2", fg: "#DC2626", border: "#FCA5A5" },
  detained: { bg: "#FEE2E2", fg: "#DC2626", border: "#FCA5A5" },
};

const ARM_LABEL = {
  inspection: "Inspection for clearance",
  "document-check": "Document check — AWB / GD signed",
} as const;

/* ================================================================== *
 * Export-desk status — the vocabulary a clerk filters a day's book on
 *
 * Ported from the retired `/export-cargo/customs`, which had five statuses
 * (Filed / Under Review / Query / Cleared / Held) and no rounds. This screen
 * has rounds and no statuses. The two are not alternatives and neither
 * replaces the other: **rounds are what happened, status is where the file
 * sits now.** A clerk with a hundred consignments cannot read a hundred
 * round histories to find the six she has to chase today.
 *
 * So status is derived from the rounds rather than stored beside them —
 * one source of truth, two readings of it. Deriving also means the chips
 * cannot drift out of step with the histories underneath them, which is the
 * failure mode of carrying a status column by hand.
 * ================================================================== */

type DeskStatus = "Filed" | "Under Review" | "Query" | "Cleared" | "Held";

const DESK_STATUS_ORDER: DeskStatus[] = ["Filed", "Under Review", "Query", "Cleared", "Held"];

const DESK_STATUS_TONE: Record<DeskStatus, { bg: string; fg: string }> = {
  Filed: { bg: "#F1F5F9", fg: "#64748B" },
  "Under Review": { bg: "#FEF3C7", fg: "#D97706" },
  Query: { bg: "#FEE2E2", fg: "#DC2626" },
  Cleared: { bg: "#DCFCE7", fg: "#16A34A" },
  Held: { bg: "#FEE2E2", fg: "#DC2626" },
};

function deskStatus(c: ExportConsignment): DeskStatus {
  const st = clearanceState(c.clearance);
  // Terminal customs outcomes — returned to shipper, or detained with customs
  // keeping the goods. "Held" is where a file stops, not where it waits.
  if (st.terminal) return "Held";
  // The loop is live: customs raised a defect and the shipper has not answered
  // it. That is a query in desk vocabulary, and it is the bucket that gets
  // worked, so it is deliberately toned as the loudest of the five.
  if (st.inCorrectionLoop) return "Query";
  if (st.cleared && c.declaration.clearedAt) return "Cleared";
  // Lodged and acknowledged by PSW, but no clearance yet — the file is with
  // customs, not with the shipper, which is a different phone call.
  if (c.declaration.sdLodgedAt) return "Under Review";
  return "Filed";
}

export default function ExportCustomsPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExports(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DeskStatus>("all");

  // The chip narrows the register AND the master list, so the two cannot show
  // different books. Selection falls back to the first visible row rather than
  // stranding a detail pane on a consignment the filter has hidden.
  const visible = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((x) => deskStatus(x) === statusFilter)),
    [rows, statusFilter],
  );
  const c = visible.find((x) => x.id === selected) ?? visible[0] ?? null;
  const state = c ? clearanceState(c.clearance) : null;

  const inLoop = rows.filter((x) => clearanceState(x.clearance).inCorrectionLoop);
  const terminal = rows.filter((x) => clearanceState(x.clearance).terminal);
  const withCorrections = rows.filter((x) => clearanceState(x.clearance).corrections > 0);

  const statusCounts = DESK_STATUS_ORDER.map((s) => ({
    status: s,
    count: rows.filter((x) => deskStatus(x) === s).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Customs & ANF" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M16
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §04–10
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              GREENFIELD
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Export Customs &amp; ANF
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The check, the correction loop, and the PSW export declaration.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#DDD6FE] bg-[#F5F3FF] px-5 py-4 flex items-start gap-3">
        <RotateCcw size={17} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-[#7C3AED]">
            The check is a loop, not a gate
          </p>
          <p className="text-[12px] text-[#4C1D95] mt-1 leading-relaxed">
            FC-11 routes a failed clearance to <strong>&ldquo;Hold till correction&rdquo;</strong>,
            which loops back to the Custom / ANF check on Yes and to{" "}
            <strong>returned to shipper / detained</strong> on No. Each pass is recorded separately
            below, because &ldquo;cleared on round 2 after the GD came back signed&rdquo; and
            &ldquo;cleared&rdquo; are different operational facts. Export is PSW-primary from day
            one — there is no WeBOC parallel run to fall back on as there is on the import side.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Consignments", value: String(rows.length), tone: "#0F172A" },
          { label: "In correction loop", value: String(inLoop.length), tone: inLoop.length ? "#D97706" : "#16A34A" },
          { label: "Needed a correction", value: String(withCorrections.length), tone: "#7C3AED" },
          { label: "Returned / detained", value: String(terminal.length), tone: terminal.length ? "#DC2626" : "#16A34A" },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[22px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No export consignments at this site"
          description="E05 runs after weighment and before the physical check."
        />
      ) : (
        <>
        {/* Ported from /export-cargo/customs — the register and its chips. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter("all")}
              className="h-8 px-3.5 rounded-full text-[12px] font-bold border transition-colors cursor-pointer"
              style={
                statusFilter === "all"
                  ? { backgroundColor: "#0B2545", color: "#FFFFFF", borderColor: "#0B2545" }
                  : { backgroundColor: "#FFFFFF", color: "#475569", borderColor: "#E2E8F0" }
              }
            >
              All {rows.length}
            </button>
            {statusCounts.map(({ status, count }) => {
              const active = statusFilter === status;
              const tone = DESK_STATUS_TONE[status];
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="h-8 px-3.5 rounded-full text-[12px] font-bold border transition-colors cursor-pointer"
                  style={
                    active
                      ? { backgroundColor: "#0B2545", color: "#FFFFFF", borderColor: "#0B2545" }
                      : {
                          backgroundColor: count ? tone.bg : "#FFFFFF",
                          color: count ? tone.fg : "#94A3B8",
                          borderColor: "#E2E8F0",
                        }
                  }
                >
                  {status} {count}
                </button>
              );
            })}
          </div>

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Export GD register
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                One row per declaration at the desk. Pick a row to read its round history below.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["AWB", "Export GD #", "Shipper", "Destination", "Status", "Filed at", "CHA"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((x) => {
                    const st = deskStatus(x);
                    const tone = DESK_STATUS_TONE[st];
                    return (
                      <tr
                        key={x.id}
                        onClick={() => setSelected(x.id)}
                        className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                        style={{ backgroundColor: c?.id === x.id ? "#EBF0F7" : undefined }}
                      >
                        <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
                          {x.awbNo}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                          {x.declaration.sdRef ?? "Not lodged"}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[#0F172A]">
                          {x.acceptance.SHIPPERNAME}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-[#475569]">
                          {x.acceptance.DESTINATION}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                            style={{ backgroundColor: tone.bg, color: tone.fg }}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                          {x.declaration.sdLodgedAt ? formatDateTime(x.declaration.sdLodgedAt) : "—"}
                        </td>
                        {/*
                          CMTS carries the clearing agent as AGENTNAME on
                          CARGOACCEPTANCE — CARGOAGENTNAME is the forwarder,
                          which is a different party. The legacy register's
                          "CHA" column is this one.
                        */}
                        <td className="px-4 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                          {x.acceptance.AGENTNAME}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && (
              <p className="px-5 py-4 text-[12px] text-[#94A3B8]">
                Nothing at this status. The five statuses exist so a real day&rsquo;s book can be
                narrowed; the seed carries five consignments and every one of them is through E05,
                so the spread here is thin by construction rather than by accident.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Stamp size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">At the export desk</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {visible.map((x) => {
                const st = clearanceState(x.clearance);
                const last = st.last;
                const tone = last ? OUTCOME_TONE[last.outcome] : OUTCOME_TONE.cleared;
                return (
                  <button
                    key={x.id}
                    onClick={() => setSelected(x.id)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.id === x.id ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {x.awbNo}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center flex-shrink-0"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                      >
                        {last ? CLEARANCE_OUTCOME_LABEL[last.outcome].toUpperCase() : "—"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.acceptance.DESTINATION} · {x.acceptance.AIRLINEABB} ·{" "}
                      {st.rounds} round{st.rounds === 1 ? "" : "s"}
                    </p>
                    {st.corrections > 0 && (
                      <p className="text-[11px] text-[#D97706] mt-0.5">
                        {st.corrections} correction{st.corrections === 1 ? "" : "s"} required
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {c && state && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Where it settled */}
              <div
                className="rounded-[16px] border p-5 flex items-start gap-3"
                style={{
                  borderColor: state.cleared
                    ? "#BBF7D0"
                    : state.terminal
                      ? "#FCA5A5"
                      : "#FDE68A",
                  backgroundColor: state.cleared
                    ? "#F0FDF4"
                    : state.terminal
                      ? "#FEF2F2"
                      : "#FFFBEB",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: state.cleared
                      ? "#DCFCE7"
                      : state.terminal
                        ? "#FEE2E2"
                        : "#FEF3C7",
                  }}
                >
                  {state.cleared ? (
                    <BadgeCheck size={17} className="text-[#16A34A]" strokeWidth={2.5} />
                  ) : state.terminal ? (
                    <ShieldAlert size={17} className="text-[#DC2626]" strokeWidth={2.5} />
                  ) : (
                    <FileWarning size={17} className="text-[#D97706]" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#0F172A]">
                    {c.awbNo} —{" "}
                    {state.cleared
                      ? state.corrections > 0
                        ? `cleared on round ${state.rounds} after ${state.corrections} correction${state.corrections === 1 ? "" : "s"}`
                        : "cleared on the first round"
                      : state.inCorrectionLoop
                        ? "held till correction — awaiting the shipper"
                        : state.terminal
                          ? CLEARANCE_OUTCOME_LABEL[c.clearance.settledAs!]
                          : "in progress"}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    {EXPORT_STAGE_LABEL[c.stage]}
                    {c.clearance.settledAt ? ` · settled ${formatDateTime(c.clearance.settledAt)}` : ""}
                  </p>
                </div>
              </div>

              {/* Round history */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Check rounds — both arms, each pass
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Inspection and document check feed the same Clearance? decision.
                  </p>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  {c.clearance.rounds.map((r) => {
                    const tone = OUTCOME_TONE[r.outcome];
                    return (
                      <div
                        key={r.round}
                        className="rounded-xl border px-4 py-3.5"
                        style={{ borderColor: tone.border, backgroundColor: tone.bg }}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-bold text-[#0F172A]">
                                Round {r.round}
                              </span>
                              <span
                                className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center"
                                style={{ backgroundColor: "#FFFFFF", color: tone.fg }}
                              >
                                {CLEARANCE_OUTCOME_LABEL[r.outcome]}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#64748B] mt-1">
                              {formatDateTime(r.startedAt)}
                              {r.closedAt ? ` → ${formatDateTime(r.closedAt)}` : " · open"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {r.arms.map((arm) => (
                            <div
                              key={arm}
                              className="rounded-lg bg-white border border-[#E2E8F0] px-3 py-2"
                            >
                              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                {ARM_LABEL[arm]}
                              </p>
                              <p className="text-[12px] text-[#0F172A] mt-0.5">
                                {arm === "inspection"
                                  ? (r.inspectingOfficer ?? "Not run this round")
                                  : (r.documentsSignedBy ?? "Not signed")}
                              </p>
                            </div>
                          ))}
                          {r.anfRequired && (
                            <div className="rounded-lg bg-white border border-[#E2E8F0] px-3 py-2">
                              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                ANF clearance
                              </p>
                              <p className="text-[12px] text-[#0F172A] mt-0.5">
                                {r.anfClearedAt
                                  ? `Cleared ${formatDateTime(r.anfClearedAt)}`
                                  : "Required — outstanding"}
                              </p>
                            </div>
                          )}
                        </div>

                        {r.defect && (
                          <div className="mt-3 rounded-lg bg-white border border-[#FCA5A5] px-3 py-2">
                            <p className="text-[10px] font-semibold text-[#DC2626] uppercase tracking-wider">
                              Defect to correct
                            </p>
                            <p className="text-[12px] text-[#0F172A] mt-0.5">{r.defect}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Declaration */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <ScrollText size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Export declaration — SD + Form-E via PSW EDI
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      PSW-primary from day one; no WeBOC fallback on the export side.
                    </p>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                  {(
                    [
                      ["SD reference", c.declaration.sdRef ?? "Not lodged"],
                      ["Lodged", c.declaration.sdLodgedAt ? formatDateTime(c.declaration.sdLodgedAt) : "—"],
                      ["PSW ack", c.declaration.pswAckRef ?? "—"],
                      ["Cleared", c.declaration.clearedAt ? formatDateTime(c.declaration.clearedAt) : "Not cleared"],
                      ["Form-E", c.declaration.formERef ?? "—"],
                      ["Form-E bank", c.declaration.formEBank ?? "—"],
                      ["Form-E value", formatPkr(c.declaration.formEValue)],
                      ["Form-E expiry", c.declaration.formEExpiry ? formatDate(c.declaration.formEExpiry) : "—"],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        {k}
                      </span>
                      <span className="text-[13px] font-medium text-[#0F172A] break-words">{v}</span>
                    </div>
                  ))}
                </div>
                {c.declaration.rejectionCode && (
                  <div className="mx-5 mb-5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#DC2626]">
                      Rejected — {c.declaration.rejectionCode}
                    </p>
                    <p className="text-[12px] text-[#0F172A] mt-0.5">
                      {c.declaration.rejectionText}
                    </p>
                  </div>
                )}
                <div className="px-5 pb-5">
                  <Link
                    href="/export/warehousing"
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[12px] font-semibold text-[#1B4F8B] no-underline transition-colors"
                  >
                    Classification &amp; warehousing (E07–E08)
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>

              <AuditStrip record={c} />
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
