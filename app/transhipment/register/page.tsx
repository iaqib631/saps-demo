"use client";

/**
 * P8-1 · Transhipment register, bonded zone, permit & re-tender — M15,
 * FC-09. **New module.**
 *
 * M15 sat at "not-started" through Phases 0–7 while two live flows pointed
 * into it: FC-01 branches to transhipment, and FC-03 routes cargo to a
 * transhipment bonded zone. Both were dead ends.
 *
 * CMTS gives one table — `AWBTRANSFER` (25 cols). The permit, the bond
 * supervision trail and the connecting-flight wait have no legacy home at
 * all, which is why cargo under bond was effectively untracked between
 * arrival and re-tender.
 *
 * The re-tender gate (§10) is the substance: cargo cannot leave until the
 * permit is live, the bond trail is unbroken, charges are raised and the
 * onward flight is confirmed. A lapsed permit is not paperwork — it means
 * the cargo is sitting outside the terms customs allowed it in under.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PlaneTakeoff,
  ScrollText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  DEMO_NOW,
  SUPERVISION_KIND_LABEL,
  TRANSHIPMENT_STAGE_LABEL,
  TRANSHIPMENT_STAGE_ORDER,
  formatDate,
  formatDateTime,
  formatKg,
  formatPkr,
  listTranshipments,
  permitDaysRemaining,
  permitLapsed,
  retenderGateFor,
  storageLocation,
} from "@/lib/domain";

export default function TranshipmentRegisterPage() {
  const { scope, isHq } = useSite();
  const cases = useMemo(() => listTranshipments(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(cases[0]?.id ?? null);
  const c = cases.find((x) => x.id === selected) ?? cases[0] ?? null;
  const gate = c ? retenderGateFor(c.awbId) : null;

  const [tab, setTab] = useState<"gate" | "transfer" | "supervision">("gate");

  const lapsed = cases.filter((x) => x.permit && permitLapsed(x.permit, DEMO_NOW));

  const rail: RailStep[] = c
    ? TRANSHIPMENT_STAGE_ORDER.map((s) => ({
        key: s,
        label: TRANSHIPMENT_STAGE_LABEL[s],
        detail:
          s === "T04-bonded-zone" && c.locationId
            ? (storageLocation(c.locationId)?.NAME ?? null)
            : s === "T05-rct-sent" && c.rctSentAt
              ? formatDateTime(c.rctSentAt)
              : s === "T06-permit-issued" && c.permit
                ? `${c.permit.permitNo} · bond ${c.permit.bondRef}`
                : s === "T07-under-supervision"
                  ? `${c.supervision.length} supervision events`
                  : s === "T08-awaiting-flight"
                    ? c.onwardFlight
                      ? `${c.onwardFlight} · ${c.scheduledDeparture ? formatDate(c.scheduledDeparture) : "TBC"}`
                      : "No connecting flight allocated"
                    : s === "T09-charges-raised" && c.chargesRaisedAt
                      ? formatPkr(c.storageCharges)
                      : s === "T11-tfd-sent" && c.tfdSentAt
                        ? formatDateTime(c.tfdSentAt)
                        : s === "T12-departed" && c.depSentAt
                          ? formatDateTime(c.depSentAt)
                          : null,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Transhipment" }, { label: "Register" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M15
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-09 · AWBTRANSFER 25 cols
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              NEW MODULE
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Transhipment &amp; Bonded Transfer
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Cargo that never enters Pakistan — held under customs bond until the connecting flight.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Under bond", value: String(cases.length), tone: "#0F172A" },
          { label: "Permits lapsed", value: String(lapsed.length), tone: "#DC2626" },
          {
            label: "Ready to re-tender",
            value: String(cases.filter((x) => retenderGateFor(x.awbId)?.canRetender).length),
            tone: "#16A34A",
          },
          {
            label: "Longest dwell",
            value: cases.length ? `${Math.max(...cases.map((x) => x.dwellDays))}d` : "—",
            tone: "#D97706",
          },
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

      {cases.length === 0 ? (
        <EmptyState
          title="No transhipment cargo at this site"
          description="FC-01 branches here when the manifest marks a consignment for onward carriage rather than local import."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <ScrollText size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Bonded register</h3>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {cases.map((x) => {
                const g = retenderGateFor(x.awbId);
                const lap = x.permit && permitLapsed(x.permit, DEMO_NOW);
                return (
                  <button
                    key={x.id}
                    onClick={() => setSelected(x.id)}
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
                          g?.canRetender
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {g?.canRetender ? "READY" : `${g?.blockedBy.length ?? 0} BLOCK`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                      {TRANSHIPMENT_STAGE_LABEL[x.stage]}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] text-[#94A3B8]">{x.dwellDays}d in bond</span>
                      {lap && (
                        <span className="h-[16px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                          PERMIT LAPSED
                        </span>
                      )}
                      {x.handoff.state !== "not-applicable" && (
                        <span className="h-[16px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[9px] font-bold inline-flex items-center">
                          → {x.handoff.toSite}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        {c.transfer.UniqueIdentification}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      In on {c.inboundFlight} · {c.transfer.NoOfPackages} pcs ·{" "}
                      {formatKg(c.transfer.Weight)} ·{" "}
                      {storageLocation(c.locationId ?? 0)?.ABBREVATION ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      Onward
                    </p>
                    <p className="text-[14px] font-bold text-[#0F172A]">
                      {c.onwardFlight ?? "not allocated"}
                    </p>
                    <p className="text-[11px] text-[#64748B]">{c.transfer.TransferTo}</p>
                  </div>
                </div>

                {/* Permit strip */}
                {c.permit && (
                  <div
                    className="mt-4 rounded-xl border px-4 py-3"
                    style={
                      permitLapsed(c.permit, DEMO_NOW)
                        ? { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }
                        : { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }
                    }
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock
                          size={14}
                          style={{
                            color: permitLapsed(c.permit, DEMO_NOW) ? "#DC2626" : "#16A34A",
                          }}
                        />
                        <span
                          className="text-[12px] font-semibold"
                          style={{
                            color: permitLapsed(c.permit, DEMO_NOW) ? "#DC2626" : "#16A34A",
                          }}
                        >
                          {c.permit.permitNo} ·{" "}
                          {permitLapsed(c.permit, DEMO_NOW)
                            ? `lapsed ${Math.abs(permitDaysRemaining(c.permit, DEMO_NOW))} days ago`
                            : `${permitDaysRemaining(c.permit, DEMO_NOW)} days remaining`}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        bond {c.permit.bondRef} · {formatPkr(c.permit.bondAmount)}
                      </span>
                    </div>
                    {permitLapsed(c.permit, DEMO_NOW) && (
                      <p className="text-[11px] text-[#991B1B] mt-1.5">
                        The cargo is sitting outside the terms customs admitted it under. The permit
                        must be re-issued before re-tender — this is not a paperwork lag.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["gate", "Re-tender gate"],
                    ["transfer", "AWBTRANSFER (25)"],
                    ["supervision", `Bond supervision (${c.supervision.length})`],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: tab === v ? "#0B2545" : "#FFFFFF",
                      color: tab === v ? "#FFFFFF" : "#475569",
                      borderColor: tab === v ? "#0B2545" : "#E2E8F0",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "gate" && gate && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <StageRail
                    steps={rail}
                    currentKey={c.stage}
                    title="FC-09 progress"
                    tone="#7C3AED"
                    note="T05/T11/T12 fan out to the messaging engine (RCT, TFD, DEP). T09 raises charges against the onward carrier, not the consignee."
                  />

                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-[#64748B]" />
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Re-tender gate — §10
                        </h3>
                      </div>
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                        style={
                          gate.canRetender
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {gate.canRetender ? "CAN RE-TENDER" : "BLOCKED"}
                      </span>
                    </div>
                    <div className="divide-y divide-[#F1F5F9]">
                      {gate.conditions.map((x) => (
                        <div key={x.code} className="px-5 py-3 flex items-start gap-2.5">
                          <span className="flex-shrink-0 mt-0.5">
                            {!x.applicable ? (
                              <span className="h-[15px] w-[15px] rounded-full bg-[#F1F5F9] inline-flex items-center justify-center text-[9px] font-bold text-[#94A3B8]">
                                –
                              </span>
                            ) : x.pass ? (
                              <CheckCircle2 size={15} className="text-[#16A34A]" />
                            ) : (
                              <XCircle size={15} className="text-[#DC2626]" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p
                              className="text-[13px] font-medium"
                              style={{ color: x.applicable ? "#0F172A" : "#94A3B8" }}
                            >
                              {x.label}
                            </p>
                            <p
                              className="text-[11px] mt-0.5"
                              style={{
                                color: !x.applicable ? "#94A3B8" : x.pass ? "#64748B" : "#991B1B",
                              }}
                            >
                              {x.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "transfer" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">Transfer record</h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      CMTS AWBTRANSFER — all 25 columns, the only legacy table FC-09 has
                    </p>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                    {(
                      [
                        ["AWBTRANSID", String(c.transfer.AWBTRANSID)],
                        ["AirlineId", c.transfer.AirlineId],
                        ["AirlineName", c.transfer.AirlineName],
                        ["AirlineAbb", c.transfer.AirlineAbb],
                        ["ArrivalDate", formatDate(c.transfer.ArrivalDate)],
                        ["ArrivalTime", c.transfer.ArrivalTime],
                        ["FlightNo", c.transfer.FlightNo],
                        ["TotalWeight", formatKg(c.transfer.TotalWeight)],
                        ["Destination", c.transfer.Destination],
                        ["AirportName", c.transfer.AirportName],
                        ["TransferTo", c.transfer.TransferTo],
                        ["SerialNo", String(c.transfer.SerialNo)],
                        ["AWBNo", c.transfer.AWBNo],
                        ["Origin", c.transfer.Origin],
                        ["NoOfPackages", String(c.transfer.NoOfPackages)],
                        ["Weight", formatKg(c.transfer.Weight)],
                        ["Remarks", c.transfer.Remarks],
                        ["UniqueIdentification", c.transfer.UniqueIdentification],
                        ["IGMNO", c.transfer.IGMNO],
                        ["TransferBy", c.transfer.TransferBy],
                        ["CreatedOn", formatDate(c.transfer.CreatedOn)],
                        ["Staff", c.transfer.Staff],
                        ["TransferFlight", c.transfer.TransferFlight],
                        ["HWBNO", c.transfer.HWBNO],
                        ["CityId", String(c.transfer.CityId)],
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
                  <AuditStrip record={c} />
                </div>
              )}

              {tab === "supervision" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Digital bond supervision
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      An AirVault addition — CMTS records the transfer, never the custody in between.
                    </p>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {c.supervision.map((s) => (
                      <div
                        key={s.id}
                        className="px-5 py-3.5"
                        style={{ backgroundColor: s.clean ? undefined : "#FEF2F2" }}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.clean ? (
                              <CheckCircle2 size={14} className="text-[#16A34A]" />
                            ) : (
                              <XCircle size={14} className="text-[#DC2626]" />
                            )}
                            <span className="text-[13px] font-semibold text-[#0F172A]">
                              {SUPERVISION_KIND_LABEL[s.kind]}
                            </span>
                            <span className="text-[11px] text-[#94A3B8]">
                              {s.piecesObserved}/{s.piecesExpected} pcs
                              {s.tagsRead !== null ? ` · ${s.tagsRead} tags` : ""}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                            {formatDateTime(s.at)}
                          </span>
                        </div>
                        <p
                          className="text-[12px] mt-1"
                          style={{ color: s.clean ? "#475569" : "#991B1B" }}
                        >
                          {s.finding}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          {s.by}
                          {s.customsOfficer ? ` · customs: ${s.customsOfficer}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B]">
                      A gap in this trail is what makes a bond hard to discharge — customs is
                      entitled to evidence of custody for the whole period, not just at each end.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/transhipment/handoff"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  <PlaneTakeoff size={12} /> Inter-station handoff <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/storage/bonded"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Bonded area <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
