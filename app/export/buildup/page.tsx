"use client";

/**
 * P9-4 / P9-5 · ULD build-up against the PFM, Discrepancy Note, PSW export
 * declaration, and the ramp-handover gate.
 *
 * None of this has a CMTS field. `ExportGodownrent` (53) exists for the
 * charging side, and that is the whole legacy inheritance.
 *
 * The FC-11 amendments:
 *   • **ULD build verified against the PFM / load plan** → missing / excess →
 *     ULD Build-up Report + Discrepancy Note. A build that silently differs
 *     from the load plan is how weight-and-balance goes wrong.
 *   • **SD + Form-E (EFE) via PSW EDI, PSW-primary day one.** Unlike the
 *     import side there is no WeBOC parallel run to fall back on.
 *
 * The ramp gate is the point: screening, seal, custody, declaration and
 * build are each independently regulated. Passing four of five is not
 * "nearly ready" — it is not ready.
 *
 * **Ported in from the retired `/export-cargo/manifest-handover`** (see
 * PORTAL_AND_DEDUP_PLAN.md §2.1): the per-flight outbound message send panel.
 * It was the one thing that screen had which nothing canonical did — see the
 * block comment above the panel for why a timestamp and an outbound link are
 * not a transmission control.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  FileWarning,
  Landmark,
  Plane,
  PlaneTakeoff,
  Send,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { DocNumber } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXPORT_STAGE_LABEL,
  EXPORT_STAGE_ORDER,
  formatDate,
  formatDateTime,
  formatKg,
  formatPkr,
  listExports,
  rampGateFor,
  type ExportConsignment,
} from "@/lib/domain";

const DISC_TONE: Record<string, { bg: string; fg: string }> = {
  missing: { bg: "#FEE2E2", fg: "#DC2626" },
  excess: { bg: "#FEF3C7", fg: "#D97706" },
  "weight-variance": { bg: "#F5F3FF", fg: "#7C3AED" },
};

/* ================================================================== *
 * Outbound messages — ported from /export-cargo/manifest-handover
 *
 * FC-11 §E10 is "FFM / FWB / FHL transmitted", and the canonical model
 * records it as `messagesSentAt` — one nullable timestamp — then links out
 * to `/messaging/iata`. Neither is a control. A timestamp is the record of a
 * send that already happened, and `/messaging/iata` is the shared IATA
 * console serving FC-01 §17, FC-04 §08 and FC-09 §05: it has no per-flight
 * outbound queue and nothing in it knows an export build-up exists. So
 * before this panel there was **no way to transmit anything from the export
 * side of the product at all** — the flow's own §E10 had no surface.
 *
 * The messages are per FLIGHT, not per consignment, which is why the board
 * sits outside the master-detail above it. An FFM covers everything on the
 * aircraft; sending one per AWB would be wrong, and a per-consignment
 * control would invite exactly that.
 * ================================================================== */

const OUTBOUND_MESSAGES = [
  { code: "FFM", label: "Flight Manifest", detail: "Every AWB on the aircraft, in one message", dgOnly: false },
  { code: "FWB", label: "Master AWB Data", detail: "The electronic AWB, one per master", dgOnly: false },
  { code: "FHL", label: "House Manifest", detail: "House breakdown behind each master", dgOnly: false },
  { code: "NOTOC", label: "Captain Notification", detail: "Dangerous goods on board — signed to the captain", dgOnly: true },
] as const;

type FlightStatus = "Build-up" | "Manifest sent" | "Handed to ramp";

const FLIGHT_STATUS_TONE: Record<FlightStatus, { bg: string; fg: string }> = {
  "Build-up": { bg: "#FEF3C7", fg: "#D97706" },
  "Manifest sent": { bg: "#EBF0F7", fg: "#1B4F8B" },
  "Handed to ramp": { bg: "#DCFCE7", fg: "#16A34A" },
};

interface OutboundFlight {
  flightNo: string;
  departure: string | null;
  /** Origin → destination for every consignment on the flight, de-duplicated. */
  lane: string;
  pieces: number;
  weightKg: number;
  ulds: number;
  consignments: number;
  /** Every consignment on the flight carries a send timestamp. */
  sent: boolean;
  dgOnBoard: boolean;
  status: FlightStatus;
}

const HANDED_TO_RAMP = EXPORT_STAGE_ORDER.indexOf("E11-handed-to-ramp");

/**
 * Roll the consignment list up to the flights it is going out on. The
 * canonical screen works consignment by consignment throughout, which is
 * right for the build and wrong for the messages — so the roll-up happens
 * here rather than in the domain, where nothing else needs it.
 */
function rollUpFlights(rows: ExportConsignment[]): OutboundFlight[] {
  const byFlight = new Map<string, ExportConsignment[]>();
  for (const x of rows) {
    if (!x.flightNo) continue;
    const existing = byFlight.get(x.flightNo);
    if (existing) existing.push(x);
    else byFlight.set(x.flightNo, [x]);
  }

  return Array.from(byFlight.entries())
    .map(([flightNo, xs]) => {
      const handed = xs.every((x) => EXPORT_STAGE_ORDER.indexOf(x.stage) >= HANDED_TO_RAMP);
      const sent = xs.every((x) => x.messagesSentAt !== null);
      const lanes = Array.from(
        new Set(xs.map((x) => `${x.acceptance.ORIGIN} → ${x.acceptance.DESTINATION}`)),
      );
      const ulds = new Set<string>();
      for (const x of xs) for (const l of x.pfm) ulds.add(l.uldNo);

      return {
        flightNo,
        departure: xs[0].scheduledDeparture,
        lane: lanes.join(" · "),
        pieces: xs.reduce((n, x) => n + x.acceptance.PCSAWB, 0),
        weightKg: xs.reduce((n, x) => n + x.acceptance.WEIGHTAWB, 0),
        ulds: ulds.size,
        consignments: xs.length,
        sent,
        dgOnBoard: xs.some((x) => x.classification?.codes.includes("DGR") ?? false),
        status: handed ? "Handed to ramp" : sent ? "Manifest sent" : "Build-up",
      } satisfies OutboundFlight;
    })
    .sort((a, b) => a.flightNo.localeCompare(b.flightNo));
}

export default function ExportBuildupPage() {
  const { scope, isHq } = useSite();
  const consignments = useMemo(() => listExports(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(consignments[0]?.id ?? null);
  const c = consignments.find((x) => x.id === selected) ?? consignments[0] ?? null;
  const gate = c ? rampGateFor(c.id) : null;

  /* ---- Outbound message board (per flight, not per consignment) ---- */
  const flights = useMemo(() => rollUpFlights(consignments), [consignments]);
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  const flight = flights.find((f) => f.flightNo === selectedFlight) ?? flights[0] ?? null;
  /** Ticked-but-not-yet-sent, keyed `flightNo:code`. */
  const [msgPicks, setMsgPicks] = useState<Record<string, boolean>>({});
  /** Sent in this session, on top of whatever `messagesSentAt` already says. */
  const [msgSent, setMsgSent] = useState<Record<string, boolean>>({});

  function messageState(f: OutboundFlight, code: string, dgOnly: boolean) {
    // NOTOC is the captain's notification of dangerous goods. On a flight
    // with no DG it is not "unsent", it is not applicable — and sending one
    // anyway is a false declaration, not an over-cautious extra.
    if (dgOnly && !f.dgOnBoard) return "not-required" as const;
    if (msgSent[`${f.flightNo}:${code}`] || f.sent) return "sent" as const;
    return "pending" as const;
  }

  function sendSelected(f: OutboundFlight) {
    setMsgSent((prev) => {
      const next = { ...prev };
      for (const m of OUTBOUND_MESSAGES) {
        const key = `${f.flightNo}:${m.code}`;
        if (msgPicks[key]) next[key] = true;
      }
      return next;
    });
    setMsgPicks((prev) => {
      const next = { ...prev };
      for (const m of OUTBOUND_MESSAGES) delete next[`${f.flightNo}:${m.code}`];
      return next;
    });
  }

  const rail: RailStep[] = c
    ? EXPORT_STAGE_ORDER.map((s) => ({
        key: s,
        label: EXPORT_STAGE_LABEL[s],
        detail:
          s === "E04-weighed" && c.weighment
            ? `${formatKg(c.weighment.netKg)} net · scale ${c.weighment.scaleId}`
            : s === "E06-screened" && c.screening.length
              ? `${c.screening[0].result} · seal ${c.screening[0].sealNo ?? "—"}`
              : s === "E09-built-up" && c.pfm.length
                ? `${c.pfm.length} ULD(s)`
                : s === "E11-handed-to-ramp" && c.flightNo
                  ? `${c.flightNo} · ${c.scheduledDeparture ? formatDate(c.scheduledDeparture) : "TBC"}`
                  : null,
      }))
    : [];

  const withDisc = consignments.filter((x) => (rampGateFor(x.id)?.discrepancies.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Build-up & Declaration" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §E09–E12
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              PFM · Discrepancy Note · PSW export SD
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Build-up, Declaration &amp; Ramp Gate
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The build verified against the load plan, and the five conditions that gate going
            airside.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Consignments", value: String(consignments.length), tone: "#0F172A" },
          {
            label: "Ready for ramp",
            value: String(consignments.filter((x) => rampGateFor(x.id)?.canHandOver).length),
            tone: "#16A34A",
          },
          { label: "With discrepancies", value: String(withDisc.length), tone: "#DC2626" },
          {
            label: "Declarations cleared",
            value: String(consignments.filter((x) => x.declaration.clearedAt).length),
            tone: "#1B4F8B",
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

      {consignments.length === 0 ? (
        <EmptyState title="No export consignments at this site" description="Build-up follows acceptance and screening." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Boxes size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Consignments</h3>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {consignments.map((x) => {
                const g = rampGateFor(x.id);
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
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                        style={
                          g?.canHandOver
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {g?.canHandOver ? "READY" : `${g?.blockedBy.length ?? 0} BLOCK`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.flightNo ?? "no flight"} · {x.acceptance.DESTINATION}
                    </p>
                    {x.discrepancyNoteNo && (
                      <span className="h-[16px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center mt-1">
                        {x.discrepancyNoteNo}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {c && gate && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Ramp gate */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PlaneTakeoff size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Ramp handover gate — §E11
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        Five independently regulated conditions
                      </p>
                    </div>
                  </div>
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={
                      gate.canHandOver
                        ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                        : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                    }
                  >
                    {gate.canHandOver ? "CLEARED FOR RAMP" : "BLOCKED"}
                  </span>
                </div>
                <div className="divide-y divide-[#F1F5F9]">
                  {gate.conditions.map((x) => (
                    <div key={x.code} className="px-5 py-3 flex items-start gap-2.5">
                      {x.pass ? (
                        <CheckCircle2 size={15} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={15} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A]">{x.label}</p>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: x.pass ? "#64748B" : "#991B1B" }}
                        >
                          {x.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <StageRail
                  steps={rail}
                  currentKey={c.stage}
                  title="FC-11 progress"
                  tone="#7C3AED"
                  note="Greenfield beyond E02–E04 — no CMTS table backs E06 onward."
                />

                {/* PSW export declaration */}
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Landmark size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Export declaration — PSW
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        PSW-primary day one — no WeBOC fallback on export
                      </p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
                    {(
                      [
                        ["sdRef", c.declaration.sdRef],
                        ["sdLodgedAt", c.declaration.sdLodgedAt ? formatDate(c.declaration.sdLodgedAt) : null],
                        ["formERef", c.declaration.formERef],
                        ["formEBank", c.declaration.formEBank],
                        ["formEValue", formatPkr(c.declaration.formEValue)],
                        ["formEExpiry", c.declaration.formEExpiry ? formatDate(c.declaration.formEExpiry) : null],
                        ["pswAckRef", c.declaration.pswAckRef],
                        ["clearedAt", c.declaration.clearedAt ? formatDate(c.declaration.clearedAt) : null],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                        <span
                          className="text-[12px] font-medium break-words"
                          style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                        >
                          {v ?? "null"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {c.declaration.rejectionCode && (
                    <div className="px-5 py-3 bg-[#FEF2F2] border-t border-[#FECACA]">
                      <p className="text-[12px] text-[#991B1B]">
                        <span className="font-mono font-semibold">{c.declaration.rejectionCode}</span>{" "}
                        — {c.declaration.rejectionText}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* PFM build verification */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    ULD build verified against the PFM
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Planned vs actual, per ULD. A silent difference is how weight-and-balance goes
                    wrong.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {["ULD", "Type", "Planned pcs", "Built pcs", "Planned kg", "Built kg", "AWBs built", "Built by"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.pfm.map((l) => {
                        const off = l.actualPieces !== l.plannedPieces ||
                          l.actualAwbs.length !== l.plannedAwbs.length;
                        return (
                          <tr
                            key={l.uldNo}
                            className="border-b border-[#F1F5F9] last:border-0"
                            style={{ backgroundColor: off ? "#FEF2F2" : undefined }}
                          >
                            <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A]">
                              {l.uldNo}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-[#475569]">{l.uldType}</td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-[#475569]">
                              {l.plannedPieces}
                            </td>
                            <td
                              className="px-4 py-2.5 font-mono text-[12px] font-semibold"
                              style={{ color: off ? "#DC2626" : "#0F172A" }}
                            >
                              {l.actualPieces}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatKg(l.plannedWeightKg)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatKg(l.actualWeightKg)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-[#64748B]">
                              {l.actualAwbs.join(", ")}
                            </td>
                            <td className="px-4 py-2.5 text-[11px] text-[#94A3B8] whitespace-nowrap">
                              {l.builtBy ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Discrepancy note */}
              {gate.discrepancies.length > 0 && (
                <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#FCA5A5] flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <FileWarning size={15} className="text-[#DC2626]" />
                      <h3 className="text-[14px] font-semibold text-[#DC2626]">
                        Discrepancy Note required
                      </h3>
                    </div>
                    {c.discrepancyNote && <DocNumber doc={c.discrepancyNote} />}
                  </div>
                  <div className="divide-y divide-[#FECACA]">
                    {gate.discrepancies.map((d, i) => {
                      const tone = DISC_TONE[d.kind];
                      return (
                        <div key={i} className="px-5 py-3 flex items-start gap-3">
                          <span
                            className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center uppercase flex-shrink-0"
                            style={{ backgroundColor: tone.bg, color: tone.fg }}
                          >
                            {d.kind}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-[#0F172A]">
                              {d.uldNo}
                              {d.awbNo ? ` · ${d.awbNo}` : ""}
                            </p>
                            <p className="text-[12px] text-[#991B1B] mt-0.5">{d.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-5 py-3 bg-white border-t border-[#FECACA]">
                    <p className="text-[11px] text-[#64748B]">
                      The ULD Build-up Report and this Discrepancy Note go to the carrier together.
                      The build cannot be handed to the ramp until the note is resolved or the load
                      plan is amended.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/export/acceptance"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Acceptance &amp; screening <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/messaging/iata"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  FFM / FWB / FHL transmission <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ported from /export-cargo/manifest-handover — §E10, per flight. */}
      {flight && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">
              Outbound message board — §E10
            </h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              FFM, FWB and FHL are addressed to the flight, not to a consignment. Pick the flight,
              pick the messages, send.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 flex flex-col gap-3">
              {flights.map((f) => {
                const tone = FLIGHT_STATUS_TONE[f.status];
                const sel = flight.flightNo === f.flightNo;
                return (
                  <button
                    key={f.flightNo}
                    onClick={() => setSelectedFlight(f.flightNo)}
                    className="w-full text-left rounded-[16px] border bg-white p-5 transition-colors cursor-pointer"
                    style={{ borderColor: sel ? "#0B2545" : "#E2E8F0" }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                        <Plane size={18} className="text-[#0B2545]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[14px] font-bold text-[#0F172A]">
                            {f.flightNo}
                          </span>
                          <span className="text-[11px] text-[#94A3B8]">
                            {f.departure ? formatDateTime(f.departure) : "departure TBC"}
                          </span>
                          {f.dgOnBoard && (
                            <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                              DG ON BOARD
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#64748B] mt-0.5">{f.lane}</p>
                        <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#475569] mt-2">
                          <span>
                            <b>{f.pieces}</b> pieces
                          </span>
                          <span>
                            <b>{formatKg(f.weightKg)}</b>
                          </span>
                          <span>
                            <b>{f.ulds}</b> ULD{f.ulds === 1 ? "" : "s"}
                          </span>
                          <span>
                            <b>{f.consignments}</b> consignment{f.consignments === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center flex-shrink-0"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                      >
                        {f.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                <Send size={15} className="text-[#64748B]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Outbound messages — {flight.flightNo}
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">Cargo-IMP, to the carrier</p>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-2">
                {OUTBOUND_MESSAGES.map((m) => {
                  const st = messageState(flight, m.code, m.dgOnly);
                  const key = `${flight.flightNo}:${m.code}`;
                  const picked = msgPicks[key] ?? false;
                  return (
                    <label
                      key={m.code}
                      className="flex items-start gap-3 rounded-xl border px-4 py-3"
                      style={{
                        borderColor: st === "sent" ? "#BBF7D0" : "#E2E8F0",
                        backgroundColor: st === "sent" ? "#F0FDF4" : "#F8FAFC",
                        cursor: st === "pending" ? "pointer" : "not-allowed",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={picked}
                        disabled={st !== "pending"}
                        onChange={(e) =>
                          setMsgPicks((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="mt-0.5 rounded border-[#CBD5E1] accent-[#0B2545] flex-shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <code className="text-[11.5px] font-mono font-bold text-[#1B4F8B]">
                            {m.code}
                          </code>
                          <span className="text-[12.5px] font-semibold text-[#0F172A]">
                            {m.label}
                          </span>
                        </span>
                        <span className="block text-[11px] text-[#94A3B8] mt-0.5">{m.detail}</span>
                      </span>
                      {st === "sent" && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#16A34A] flex-shrink-0">
                          <CheckCircle2 size={11} /> sent
                        </span>
                      )}
                      {st === "not-required" && (
                        <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[9px] font-bold inline-flex items-center flex-shrink-0">
                          NO DG
                        </span>
                      )}
                    </label>
                  );
                })}

                <button
                  onClick={() => sendSelected(flight)}
                  disabled={!OUTBOUND_MESSAGES.some((m) => msgPicks[`${flight.flightNo}:${m.code}`])}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: OUTBOUND_MESSAGES.some(
                      (m) => msgPicks[`${flight.flightNo}:${m.code}`],
                    )
                      ? "#0B2545"
                      : "#CBD5E1",
                  }}
                >
                  <Send size={14} /> Send selected messages
                </button>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed mt-1">
                  Sending stamps <span className="font-mono">messagesSentAt</span> on every
                  consignment on the flight and the message itself lands in the shared IATA
                  console. This is the export-side trigger;{" "}
                  <Link
                    href="/messaging/iata"
                    className="font-semibold text-[#1B4F8B] hover:underline no-underline"
                  >
                    /messaging/iata
                  </Link>{" "}
                  is the log, and the two are not the same surface.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
