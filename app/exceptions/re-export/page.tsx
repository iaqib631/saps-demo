"use client";

/**
 * P3-5 · Re-export console — FC-10-B. (M16)
 *
 * Cargo that will never clear into Pakistan: the consignee refuses it,
 * customs rejects it, or clearance is simply impossible. It has to leave
 * again as an export — but the import AWB cannot close until it does, and
 * the accrued demurrage has to be settled first.
 *
 * Two amendments carried here:
 *   • **PSW-primary.** FC-10-B's amendment routes the re-export SD through
 *     PSW only — there is no WeBOC path on this branch, unlike FC-06 where
 *     WeBOC still runs in parallel.
 *   • **Charges gate.** §B6 settles charges *before* §B7 re-tenders. The
 *     order matters: re-tendering first loses the lien on the cargo.
 */

import { useMemo, useState } from "react";
import { Ban, FileCheck2, PlaneTakeoff, Wallet } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { AuditStrip, GatewayCard } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXCEPTION_THRESHOLD_DAYS,
  GATEWAYS,
  REEXPORT_STAGE_LABEL,
  formatDate,
  formatDateTime,
  formatPkr,
  listReExport,
  storageLocation,
  type ReExportCause,
  type ReExportStage,
} from "@/lib/domain";

const STAGE_ORDER: ReExportStage[] = [
  "B1-cannot-clear",
  "B2-re-export-hold",
  "B3-request-raised",
  "B4-sd-lodged",
  "B5-permission-granted",
  "B6-charges-settled",
  "B7-re-tendered",
  "B8-closed",
];

const CAUSE_LABEL: Record<ReExportCause, string> = {
  "cannot-clear": "Cannot be cleared",
  "consignee-refused": "Consignee refused delivery",
  "customs-rejected": "Customs rejected import",
};

export default function ReExportPage() {
  const { scope, isHq } = useSite();
  const cases = useMemo(() => listReExport(scope), [scope]);

  const [selectedId, setSelectedId] = useState<number | null>(cases[0]?.id ?? null);
  const c = cases.find((x) => x.id === selectedId) ?? cases[0] ?? null;

  const psw = GATEWAYS.find((g) => g.code === "psw");
  const stageIdx = c ? STAGE_ORDER.indexOf(c.stage) : -1;
  const settledIdx = STAGE_ORDER.indexOf("B6-charges-settled");

  const rail: RailStep[] = c
    ? STAGE_ORDER.map((s) => ({
        key: s,
        label: REEXPORT_STAGE_LABEL[s],
        detail:
          s === "B1-cannot-clear"
            ? CAUSE_LABEL[c.cause]
            : s === "B2-re-export-hold" && c.holdLocationId
              ? `Re-export zone ${storageLocation(c.holdLocationId)?.ABBREVATION ?? "—"}`
              : s === "B3-request-raised"
                ? formatDateTime(c.raisedAt)
                : s === "B4-sd-lodged" && c.sdLodgedAt
                  ? `${c.sdRef} · ${formatDateTime(c.sdLodgedAt)}`
                  : s === "B5-permission-granted" && c.permissionGrantedAt
                    ? `${c.permissionRef} · ${formatDateTime(c.permissionGrantedAt)}`
                    : s === "B6-charges-settled" && c.chargesSettledAt
                      ? formatDateTime(c.chargesSettledAt)
                      : s === "B7-re-tendered" && c.reTenderedAt
                        ? `${c.exportAwbNo} · ${formatDateTime(c.reTenderedAt)}`
                        : s === "B8-closed" && c.closedAt
                          ? formatDateTime(c.closedAt)
                          : null,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Exceptions" }, { label: "Re-export" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M16
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-10-B
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Re-export Console
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Cargo leaving the country again without ever clearing into it. The import AWB stays open
            until the export is tendered.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open cases", value: String(cases.length), tone: "#0F172A" },
          {
            label: `Past ${EXCEPTION_THRESHOLD_DAYS["re-export"]}-day threshold`,
            value: String(
              cases.filter((x) => x.ageDays > EXCEPTION_THRESHOLD_DAYS["re-export"]).length,
            ),
            tone: "#DC2626",
          },
          {
            label: "Awaiting PSW permission",
            value: String(cases.filter((x) => !x.permissionGrantedAt).length),
            tone: "#D97706",
          },
          {
            label: "Outstanding charges",
            value: formatPkr(cases.reduce((n, x) => n + x.outstandingCharges, 0)),
            tone: "#1B4F8B",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[20px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No re-export cases at this site"
          description="FC-04 §11 action F4 forwards a CDR here, or the case opens from FC-06 when customs rejects the import outright."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="flex flex-col gap-5">
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                <Ban size={15} className="text-[#64748B]" />
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Case register</h3>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {cases.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setSelectedId(x.id)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.id === x.id ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {x.AWBNO}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                        style={
                          x.ageDays > EXCEPTION_THRESHOLD_DAYS["re-export"]
                            ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                            : { backgroundColor: "#F1F5F9", color: "#64748B" }
                        }
                      >
                        {x.ageDays}d
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1">{CAUSE_LABEL[x.cause]}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      Raised {formatDate(x.raisedAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* PSW-primary — no WeBOC on this branch */}
            {psw && (
              <div className="flex flex-col gap-2">
                <GatewayCard gateway={psw} />
                <p className="text-[11px] text-[#94A3B8] px-1">
                  FC-10-B routes through PSW only. Unlike FC-06, there is no parallel WeBOC path on
                  the re-export branch.
                </p>
              </div>
            )}
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                      <span className="h-[22px] px-2.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center gap-1">
                        <Ban size={10} />
                        {CAUSE_LABEL[c.cause].toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      IGM {c.IGMNO} · open {c.ageDays} days · raised {formatDate(c.raisedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <StageRail
                  steps={rail}
                  currentKey={c.stage}
                  title="FC-10-B progress"
                  tone="#DC2626"
                  note="B4 files in PSW (M09); B6 settles against FC-07 charges; B7 hands the cargo to FC-11 export."
                />

                <div className="flex flex-col gap-5">
                  {/* PSW filing */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <FileCheck2 size={15} className="text-[#64748B]" />
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        PSW filing — §B4–B5
                      </h3>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
                      {(
                        [
                          ["sdRef", c.sdRef],
                          ["sdLodgedAt", c.sdLodgedAt ? formatDate(c.sdLodgedAt) : null],
                          ["permissionRef", c.permissionRef],
                          [
                            "permissionGrantedAt",
                            c.permissionGrantedAt ? formatDate(c.permissionGrantedAt) : null,
                          ],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                          <span
                            className="text-[13px] font-medium break-words"
                            style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                          >
                            {v ?? "null"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Charges gate — §B6 before §B7 */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet size={15} className="text-[#64748B]" />
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Charges gate — §B6
                      </h3>
                    </div>

                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] text-[#64748B]">Outstanding</span>
                      <span
                        className="text-[20px] font-bold"
                        style={{ color: c.outstandingCharges > 0 ? "#DC2626" : "#16A34A" }}
                      >
                        {formatPkr(c.outstandingCharges)}
                      </span>
                    </div>

                    <div
                      className="mt-4 rounded-xl px-4 py-3 border"
                      style={
                        c.chargesSettledAt
                          ? { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
                          : { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }
                      }
                    >
                      <p
                        className="text-[12px] font-semibold"
                        style={{ color: c.chargesSettledAt ? "#16A34A" : "#D97706" }}
                      >
                        {c.chargesSettledAt
                          ? `Settled ${formatDateTime(c.chargesSettledAt)} — re-tender unblocked`
                          : "Not settled — re-tender blocked"}
                      </p>
                      <p
                        className="text-[11px] mt-1 leading-snug"
                        style={{ color: c.chargesSettledAt ? "#15803D" : "#92400E" }}
                      >
                        §B6 must complete before §B7. Re-tendering first would release the cargo and
                        with it the lien securing the accrued demurrage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* §B7–B8 */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PlaneTakeoff size={15} className="text-[#64748B]" />
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Re-tender &amp; closure — §B7–B8
                    </h3>
                  </div>
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={
                      stageIdx > settledIdx
                        ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                        : { backgroundColor: "#F1F5F9", color: "#64748B" }
                    }
                  >
                    {stageIdx > settledIdx ? "UNBLOCKED" : "BLOCKED BY §B6"}
                  </span>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                  {(
                    [
                      ["exportAwbNo", c.exportAwbNo],
                      ["reTenderedAt", c.reTenderedAt ? formatDateTime(c.reTenderedAt) : null],
                      ["closedAt", c.closedAt ? formatDateTime(c.closedAt) : null],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                      <span
                        className="text-[13px] font-medium break-words"
                        style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                      >
                        {v ?? "null"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <AuditStrip record={c} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
