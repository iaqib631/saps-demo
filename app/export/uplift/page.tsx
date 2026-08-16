"use client";

/**
 * FC-11 §E12–E13 · Payload compatibility, uplift, and file closure.
 *
 * The gap this closes, and it is the one that mattered most: the demo
 * treated **handover to ramp as the end of the export story**. FC-11 does
 * not. After E11 there is a decision — "Payload compatibility with Flight"
 * — whose No edge goes back to 09 Export Warehousing, annotated *"can be
 * offloaded depending upon weight provision"*.
 *
 * So cargo that passed every gate — screened, sealed, custody unbroken,
 * declaration cleared, build matching the PFM — can still come off the
 * aircraft, and when it does it re-enters the flow at warehousing rather
 * than dropping out of it. A model that stops at the ramp gate silently
 * claims a handover is an uplift. It is not; the aircraft decides.
 *
 * E13 closure is gated on the uplift actually happening, which is why an
 * offloaded consignment keeps its file open.
 *
 * BLK-02 — the export **invoice** half of FC-11's "15. Export Invoice /
 * Closure / Archive" is parked pending SAPS confirmation of the revenue
 * share (`INTERNATIONALCARGO`). The reference is shown; no amount is
 * invented behind it, and the gate says so rather than quietly passing.
 *
 * **Ported in from the retired `/export-cargo/manifest-handover`** (see
 * PORTAL_AND_DEDUP_PLAN.md §2.1): the airline handover checklist and its
 * acceptance signature. That screen's outbound message panel went to
 * `/export/buildup`, which is where §E10 sits.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  PlaneTakeoff,
  Scale,
  Undo2,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXPORT_STAGE_LABEL,
  EXPORT_STAGE_ORDER,
  evaluateClosure,
  evaluateUplift,
  formatDate,
  formatDateTime,
  formatKg,
  listExports,
  rampGateFor,
} from "@/lib/domain";

/** Index of the stage at which custody has physically left the shed. */
const HANDED_TO_RAMP = EXPORT_STAGE_ORDER.indexOf("E11-handed-to-ramp");

export default function ExportUpliftPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExports(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(null);
  const c = rows.find((x) => x.id === selected) ?? rows[0] ?? null;

  /*
   * The carrier's acceptance signature, keyed by consignment. It is held at
   * screen level because the domain has nowhere to put it — see the block
   * comment above the handover card. `signDraft` is what is being typed;
   * `signedBy` is what was committed, and keeping them apart is what makes
   * the checklist item flip on the signature rather than on a keystroke.
   */
  const [signDraft, setSignDraft] = useState<Record<number, string>>({});
  const [signedBy, setSignedBy] = useState<Record<number, string>>({});

  const uplift = c ? evaluateUplift(c.uplift, c.booking) : null;
  const closure = c
    ? evaluateClosure({
        uplift: c.uplift,
        declaration: c.declaration,
        closure: c.closure,
        messagesSentAt: c.messagesSentAt,
      })
    : null;
  const ramp = c ? rampGateFor(c.id) : null;

  const onboarded = rows.filter((x) => x.uplift?.outcome === "onboarded");
  const offloaded = rows.filter((x) => x.uplift?.outcome === "offloaded");
  const closed = rows.filter((x) => x.closure?.fileClosedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Uplift & Closure" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M16 · M20
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §E12–E13
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center font-mono">
              BLK-02
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Uplift &amp; Closure
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The aircraft&rsquo;s decision, and what it takes to close the file.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#DDD6FE] bg-[#F5F3FF] px-5 py-4 flex items-start gap-3">
        <Undo2 size={17} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-[#7C3AED]">
            Handover to ramp is not uplift
          </p>
          <p className="text-[12px] text-[#4C1D95] mt-1 leading-relaxed">
            FC-11&rsquo;s payload decision sits <em>after</em> the ramp handover, and its No edge
            returns cargo to <strong>09 Export Warehousing</strong> — &ldquo;can be offloaded
            depending upon weight provision&rdquo;. A consignment can clear all five ramp
            conditions and still not fly. That is why the ramp gate and this decision are shown
            side by side below, and why an offload leaves the file open.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Assessed", value: `${onboarded.length + offloaded.length} / ${rows.length}`, tone: "#0F172A" },
          { label: "Onboarded", value: String(onboarded.length), tone: "#16A34A" },
          { label: "Offloaded", value: String(offloaded.length), tone: offloaded.length ? "#D97706" : "#16A34A" },
          { label: "Files closed", value: String(closed.length), tone: "#0F172A" },
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
          description="E12 runs at the aircraft, after the ramp handover at E11."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <PlaneTakeoff size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Consignments</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {rows.map((x) => (
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
                      style={{
                        backgroundColor: !x.uplift
                          ? "#F1F5F9"
                          : x.uplift.outcome === "onboarded"
                            ? "#DCFCE7"
                            : "#FEF3C7",
                        color: !x.uplift
                          ? "#94A3B8"
                          : x.uplift.outcome === "onboarded"
                            ? "#16A34A"
                            : "#D97706",
                      }}
                    >
                      {!x.uplift ? "NOT ASSESSED" : x.uplift.outcome.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {x.flightNo ?? "—"} · {x.acceptance.DESTINATION}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                    {EXPORT_STAGE_LABEL[x.stage]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {c && uplift && closure && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Ramp gate vs payload — deliberately adjacent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="rounded-[16px] border p-5"
                  style={{
                    borderColor: ramp?.canHandOver ? "#BBF7D0" : "#FCA5A5",
                    backgroundColor: ramp?.canHandOver ? "#F0FDF4" : "#FEF2F2",
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    E11 — ramp gate
                  </p>
                  <p
                    className="text-[15px] font-bold mt-1"
                    style={{ color: ramp?.canHandOver ? "#16A34A" : "#DC2626" }}
                  >
                    {ramp?.canHandOver ? "Cleared for handover" : "Blocked"}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1">
                    {ramp?.canHandOver
                      ? "All five conditions pass."
                      : `Blocked by ${ramp?.blockedBy.map((b) => b.label).join(", ")}.`}
                  </p>
                  <Link
                    href="/export/buildup"
                    className="text-[12px] font-semibold text-[#1B4F8B] hover:underline no-underline inline-flex items-center gap-1 mt-2"
                  >
                    Ramp conditions
                    <ArrowUpRight size={12} />
                  </Link>
                </div>

                <div
                  className="rounded-[16px] border p-5"
                  style={{
                    borderColor: !uplift.assessed
                      ? "#E2E8F0"
                      : uplift.compatible
                        ? "#BBF7D0"
                        : "#FDE68A",
                    backgroundColor: !uplift.assessed
                      ? "#F8FAFC"
                      : uplift.compatible
                        ? "#F0FDF4"
                        : "#FFFBEB",
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    E12 — payload compatibility
                  </p>
                  <p
                    className="text-[15px] font-bold mt-1"
                    style={{
                      color: !uplift.assessed
                        ? "#94A3B8"
                        : uplift.compatible
                          ? "#16A34A"
                          : "#D97706",
                    }}
                  >
                    {!uplift.assessed
                      ? "Not assessed"
                      : uplift.compatible
                        ? "Onboarded"
                        : "Offloaded"}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1">{uplift.summary}</p>
                </div>
              </div>

              {/*
               * Airline handover & acceptance signature — ported from
               * /export-cargo/manifest-handover.
               *
               * The canonical ramp gate on /export/buildup has five
               * conditions, and every one of them is something SAPS asserts
               * about its own work: screened, sealed, custody unbroken,
               * declaration cleared, build matching the load plan. None of
               * them is the carrier saying "received".
               *
               * So the moment custody actually leaves the terminal — the one
               * moment a cargo claim turns on — is the single point in the
               * export chain with no record behind it. FC-11 has no field for
               * the airline's acceptance, which is why the signature is
               * captured here rather than read off the consignment: the gap
               * is real, and papering over it with a derived boolean would
               * hide it.
               *
               * The first three items are derived. Only the fourth is keyed.
               */}
              {(() => {
                const built = c.pfm.length > 0 && c.pfm.every((l) => l.builtAt !== null);
                const manifested = c.messagesSentAt !== null;
                const atRamp = EXPORT_STAGE_ORDER.indexOf(c.stage) >= HANDED_TO_RAMP;
                // Membership rather than truthiness: a signature is captured or
                // it is not, and an empty string is not a signature.
                const signed = c.id in signedBy;
                const signature = signedBy[c.id] ?? "";
                const draft = signDraft[c.id] ?? "";

                const steps = [
                  {
                    code: "buildup",
                    label: "Build-up complete",
                    pass: built,
                    detail: built
                      ? `${c.pfm.length} ULD(s) built${c.pfm[0]?.builtBy ? ` by ${c.pfm[0].builtBy}` : ""}`
                      : c.pfm.length === 0
                        ? "Nothing built against the load plan"
                        : "A ULD on the plan has not been built",
                  },
                  {
                    code: "ffm",
                    label: "Manifest sent (FFM)",
                    pass: manifested,
                    detail: manifested
                      ? `Transmitted ${formatDateTime(c.messagesSentAt!)}`
                      : "FFM / FWB / FHL not transmitted",
                  },
                  {
                    code: "ramp",
                    label: "ULDs handed to ramp",
                    pass: atRamp,
                    detail: atRamp
                      ? `At or past E11 · ${EXPORT_STAGE_LABEL[c.stage]}`
                      : `Still at ${EXPORT_STAGE_LABEL[c.stage]}`,
                  },
                  {
                    code: "signed",
                    label: "Airline acceptance signed",
                    pass: signed,
                    detail: signed
                      ? `Signed for the carrier by ${signature}`
                      : "No carrier signature captured — nothing records the transfer of custody",
                  },
                ];

                const readyToSign = built && manifested && atRamp;
                const complete = steps.every((s) => s.pass);

                return (
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={15} className="text-[#64748B]" />
                        <div>
                          <h3 className="text-[14px] font-semibold text-[#0F172A]">
                            Airline handover — §E11
                          </h3>
                          <p className="text-[11px] text-[#94A3B8]">
                            What the carrier signs for, as distinct from what SAPS certifies
                          </p>
                        </div>
                      </div>
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                        style={
                          complete
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEF3C7", color: "#D97706" }
                        }
                      >
                        {complete ? "HANDOVER COMPLETE" : "HANDOVER OPEN"}
                      </span>
                    </div>

                    <div className="divide-y divide-[#F1F5F9]">
                      {steps.map((s) => (
                        <div key={s.code} className="px-5 py-3 flex items-start gap-2.5">
                          {s.pass ? (
                            <CheckCircle2
                              size={15}
                              className="text-[#16A34A] flex-shrink-0 mt-0.5"
                            />
                          ) : (
                            <div className="w-[15px] h-[15px] rounded-full border-2 border-[#CBD5E1] flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#0F172A]">{s.label}</p>
                            <p
                              className="text-[11px] mt-0.5"
                              style={{ color: s.pass ? "#64748B" : "#92400E" }}
                            >
                              {s.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-5 flex flex-col gap-3 border-t border-[#F1F5F9]">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          Acceptance signature — carrier representative
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            value={signed ? signature : draft}
                            disabled={signed}
                            onChange={(e) =>
                              setSignDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            placeholder="Name and staff number of the ramp officer signing"
                            className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] disabled:bg-[#F8FAFC] disabled:text-[#64748B] flex-1 min-w-[240px]"
                          />
                          <button
                            onClick={() =>
                              setSignedBy((prev) => ({ ...prev, [c.id]: draft.trim() }))
                            }
                            disabled={!readyToSign || draft.trim() === "" || signed}
                            className="h-9 px-4 rounded-lg text-[13px] font-bold text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                            style={{
                              backgroundColor:
                                readyToSign && draft.trim() !== "" && !signed
                                  ? "#16A34A"
                                  : "#CBD5E1",
                            }}
                          >
                            Mark handover complete
                          </button>
                        </div>
                      </div>

                      {!readyToSign && (
                        <p className="text-[11px] text-[#92400E]">
                          The carrier cannot sign for what has not been handed over. The three
                          derived items above have to stand first.
                        </p>
                      )}

                      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                        Signing closes §E11. It does not close the file — the payload decision
                        below can still bring this cargo back off the aircraft, and an offload
                        returns it to E08 warehousing rather than to the counter.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* The payload numbers */}
              {c.uplift && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Scale size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        The payload decision
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        Assessed against payload at the ULD position, not against the booking.
                      </p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                    {(
                      [
                        ["Available payload", formatKg(c.uplift.availablePayloadKg)],
                        ["Offered", formatKg(c.uplift.offeredWeightKg)],
                        [
                          "Margin",
                          `${uplift.marginKg !== null && uplift.marginKg > 0 ? "+" : ""}${formatKg(uplift.marginKg ?? 0)}`,
                        ],
                        [
                          "vs booked allotment",
                          uplift.overBookedKg === null
                            ? "—"
                            : `${uplift.overBookedKg > 0 ? "+" : ""}${formatKg(uplift.overBookedKg)}`,
                        ],
                        ["Assessed by", c.uplift.assessedBy],
                        ["Assessed at", formatDateTime(c.uplift.assessedAt)],
                        [
                          "Onboarded at",
                          c.uplift.onboardedAt ? formatDateTime(c.uplift.onboardedAt) : "—",
                        ],
                        ["Flight", c.flightNo ?? "—"],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          {k}
                        </span>
                        <span className="text-[13px] font-medium text-[#0F172A] break-words">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>

                  {c.uplift.outcome === "offloaded" && (
                    <div className="mx-5 mb-5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#D97706]">
                        Offloaded — returned to E08 warehousing
                      </p>
                      <p className="text-[12px] text-[#92400E] mt-0.5">
                        {c.uplift.offloadReason}
                      </p>
                      {c.uplift.rebookedFlightNo && (
                        <p className="text-[12px] text-[#92400E] mt-1">
                          Rebooked onto <strong>{c.uplift.rebookedFlightNo}</strong> departing{" "}
                          {formatDate(c.uplift.rebookedDeparture!)}.{" "}
                          <Link
                            href="/export/warehousing"
                            className="font-semibold text-[#1B4F8B] hover:underline no-underline"
                          >
                            See it back in the store
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* E13 closure gate */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <Archive size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      E13 — closure &amp; archive
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      An offloaded consignment keeps its file open until it flies.
                    </p>
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: closure.canClose ? "#BBF7D0" : "#FDE68A",
                      backgroundColor: closure.canClose ? "#F0FDF4" : "#FFFBEB",
                    }}
                  >
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: closure.canClose ? "#16A34A" : "#D97706" }}
                    >
                      {closure.canClose
                        ? "All conditions met — file can be closed"
                        : `${closure.blockedBy.length} condition${closure.blockedBy.length === 1 ? "" : "s"} outstanding`}
                    </p>
                  </div>

                  {closure.conditions.map((cond) => (
                    <div
                      key={cond.code}
                      className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                      style={{
                        borderColor: cond.pass ? "#E2E8F0" : "#FDE68A",
                        backgroundColor: cond.pass ? "#FFFFFF" : "#FFFBEB",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#0F172A]">{cond.label}</p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">{cond.detail}</p>
                      </div>
                      {cond.pass ? (
                        <CheckCircle2 size={18} className="text-[#16A34A] flex-shrink-0" />
                      ) : (
                        <XCircle size={18} className="text-[#D97706] flex-shrink-0" />
                      )}
                    </div>
                  ))}

                  {c.closure && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-2">
                      {(
                        [
                          ["Invoice ref", c.closure.invoiceRef ?? "—"],
                          ["File closed", c.closure.fileClosedAt ? formatDateTime(c.closure.fileClosedAt) : "Open"],
                          ["Archive ref", c.closure.archiveRef ?? "—"],
                          ["Closed by", c.closure.closedBy ?? "—"],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            {k}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] break-words">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* BLK-02 stays visible rather than being quietly filled in */}
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#D97706]">
                      BLK-02 — export revenue share is not modelled
                    </p>
                    <p className="text-[12px] text-[#92400E] mt-0.5">
                      FC-11&rsquo;s end node is &ldquo;Export Invoice / Closure / Archive&rdquo;.
                      Closure and archive are built. The invoice carries a reference but no
                      amount: how export revenue splits between SAPS and the carrier
                      (<span className="font-mono">INTERNATIONALCARGO</span>) is unconfirmed, and
                      inventing a number here would make the demo assert a commercial term nobody
                      has agreed. Awaiting SAPS.
                    </p>
                  </div>
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
