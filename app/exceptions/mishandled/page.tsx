"use client";

/**
 * P3-4 · Mishandled / misrouted cargo — FC-10-A. **New module (M17).**
 *
 * CMTS has no table for this. `AWBTRANSFER` (25 cols) is the closest thing
 * and it is a generic transfer record — it cannot express "arrived at the
 * wrong station", cannot hold the airline's recovery instruction, and has
 * no notion of the three recovery actions. So the whole branch is invisible
 * in the legacy system and the cargo simply sits.
 *
 * FC-10-A's three recovery options each need different fields, which is the
 * substance of this screen:
 *   • forward to correct destination  → onward routing + re-tender carrier
 *   • re-route under original AWB     → no new AWB, routing amended
 *   • corrective AWB / endorsement    → corrective AWB no. + endorsement ref
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlaneTakeoff, Route, Send, Signpost } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXCEPTION_THRESHOLD_DAYS,
  MISHANDLED_STAGE_LABEL,
  RECOVERY_ACTION_LABEL,
  formatDate,
  formatDateTime,
  listMishandled,
  storageLocation,
  type MishandledStage,
  type RecoveryAction,
} from "@/lib/domain";

const STAGE_ORDER: MishandledStage[] = [
  "A1-identified",
  "A2-exception-hold",
  "A3-cdr-raised",
  "A4-airline-notified",
  "A5-instruction-received",
  "A6-recovery-selected",
  "A7-re-tendered",
  "A8-closed",
];

/** Each recovery option requires a different field set — FC-10-A. */
const RECOVERY_FIELDS: Record<RecoveryAction, { fields: string[]; note: string }> = {
  "forward-correct-destination": {
    fields: ["onwardRouting", "reTenderCarrier", "reTenderedAt"],
    note: "Cargo moves on under a fresh routing. The original AWB stays the commercial document.",
  },
  "reroute-original-awb": {
    fields: ["onwardRouting", "reTenderCarrier", "reTenderedAt"],
    note: "No new AWB is cut — the routing is amended and the carrier re-tenders against the original.",
  },
  "corrective-awb": {
    fields: ["correctiveAwbNo", "endorsementRef", "reTenderCarrier", "reTenderedAt"],
    note: "A corrective AWB or endorsement is issued. This is the only option that mints a new document number.",
  },
};

export default function MishandledPage() {
  const { scope, isHq } = useSite();
  const cases = useMemo(() => listMishandled(scope), [scope]);

  const [selectedId, setSelectedId] = useState<number | null>(cases[0]?.id ?? null);
  const c = cases.find((x) => x.id === selectedId) ?? cases[0] ?? null;

  /** Walkthrough affordance for FC-10-A §A6 — no backend to persist to. */
  const [draftRecovery, setDraftRecovery] = useState<RecoveryAction | null>(null);
  const recovery = c?.recoveryAction ?? draftRecovery;

  const overdue = cases.filter((x) => x.ageDays > EXCEPTION_THRESHOLD_DAYS.mishandled);

  const rail: RailStep[] = c
    ? STAGE_ORDER.map((s) => ({
        key: s,
        label: MISHANDLED_STAGE_LABEL[s],
        detail:
          s === "A1-identified"
            ? formatDateTime(c.identifiedAt)
            : s === "A2-exception-hold" && c.holdLocationId
              ? `Exception zone ${storageLocation(c.holdLocationId)?.ABBREVATION ?? "—"}`
              : s === "A3-cdr-raised" && c.cdrRef
                ? c.cdrRef
                : s === "A4-airline-notified" && c.airlineNotifiedAt
                  ? formatDateTime(c.airlineNotifiedAt)
                  : s === "A5-instruction-received" && c.instructionAt
                    ? `${c.instructionRef} · ${formatDateTime(c.instructionAt)}`
                    : s === "A6-recovery-selected" && c.recoveryAction
                      ? RECOVERY_ACTION_LABEL[c.recoveryAction]
                      : s === "A7-re-tendered" && c.reTenderedAt
                        ? `${c.reTenderCarrier} · ${formatDateTime(c.reTenderedAt)}`
                        : s === "A8-closed" && c.closedAt
                          ? formatDateTime(c.closedAt)
                          : null,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Exceptions" }, { label: "Mishandled Cargo" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M17
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-10-A
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              NEW MODULE
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Mishandled / Misrouted Cargo
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Cargo that arrived where it should not have. No CMTS table covers this branch — the
            legacy system has no record of it at all.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open cases", value: String(cases.length), tone: "#7C3AED" },
          {
            label: `Past ${EXCEPTION_THRESHOLD_DAYS.mishandled}-day threshold`,
            value: String(overdue.length),
            tone: "#DC2626",
          },
          {
            label: "Awaiting instruction",
            value: String(cases.filter((x) => !x.instructionAt).length),
            tone: "#D97706",
          },
          {
            label: "Oldest case",
            value: cases.length ? `${Math.max(...cases.map((x) => x.ageDays))}d` : "—",
            tone: "#1B4F8B",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[24px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No mishandled cargo at this site"
          description="FC-04 §11 action F3 forwards a CDR into this branch, or the case opens directly at FC-01 when the offload is identified."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Signpost size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Case register</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {cases.map((x) => (
                <button
                  key={x.id}
                  onClick={() => {
                    setSelectedId(x.id);
                    setDraftRecovery(null);
                  }}
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
                        x.ageDays > EXCEPTION_THRESHOLD_DAYS.mishandled
                          ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          : { backgroundColor: "#F1F5F9", color: "#64748B" }
                      }
                    >
                      {x.ageDays}d
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                    {MISHANDLED_STAGE_LABEL[x.stage]}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Identified {formatDate(x.identifiedAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                      <span className="h-[22px] px-2.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center gap-1">
                        <Route size={10} />
                        MISROUTED
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      IGM {c.IGMNO} · in exception hold {c.ageDays} days
                      {c.cdrRef && (
                        <>
                          {" · "}
                          <Link
                            href="/exceptions/cdr"
                            className="font-mono font-semibold text-[#1B4F8B] no-underline hover:underline"
                          >
                            {c.cdrRef}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {c.instructionText && (
                  <div className="mt-4 rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Send size={13} className="text-[#1B4F8B]" />
                      <p className="text-[12px] font-semibold text-[#1B4F8B]">
                        Airline instruction {c.instructionRef}
                      </p>
                    </div>
                    <p className="text-[13px] text-[#0F172A]">{c.instructionText}</p>
                    <p className="text-[11px] text-[#64748B] mt-1">
                      Received {c.instructionAt ? formatDateTime(c.instructionAt) : "—"}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <StageRail
                  steps={rail}
                  currentKey={c.stage}
                  title="FC-10-A progress"
                  tone="#7C3AED"
                  note="A3 raises a CDR in FC-04; A7 re-tenders to the outbound carrier and hands the cargo to FC-11 export."
                />

                {/* A6 — recovery action, each with its own required fields */}
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Recovery action — §A6
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 mb-3">
                    Three options. They are not interchangeable — each demands a different field
                    set, which is why a single generic transfer record cannot carry this branch.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {(Object.keys(RECOVERY_ACTION_LABEL) as RecoveryAction[]).map((a) => {
                      const active = recovery === a;
                      const spec = RECOVERY_FIELDS[a];
                      return (
                        <button
                          key={a}
                          onClick={() => setDraftRecovery(a)}
                          className="text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer hover:border-[#94A3B8]"
                          style={{
                            borderColor: active ? "#7C3AED" : "#E2E8F0",
                            backgroundColor: active ? "#F5F3FF" : "#FFFFFF",
                          }}
                        >
                          <p
                            className="text-[13px] font-semibold"
                            style={{ color: active ? "#7C3AED" : "#0F172A" }}
                          >
                            {RECOVERY_ACTION_LABEL[a]}
                          </p>
                          <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                            {spec.note}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {spec.fields.map((f) => (
                              <span
                                key={f}
                                className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-mono inline-flex items-center"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!c.recoveryAction && (
                    <p className="text-[11px] text-[#D97706] mt-3 pt-3 border-t border-[#F1F5F9]">
                      No recovery action committed — the case is parked at{" "}
                      {MISHANDLED_STAGE_LABEL[c.stage].split(". ")[0]}. Selecting above is a
                      walkthrough affordance; nothing is persisted.
                    </p>
                  )}
                </div>
              </div>

              {/* Re-tender block */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <PlaneTakeoff size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Re-tender — §A7
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Hands the cargo to the outbound carrier and into FC-11
                    </p>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                  {(
                    [
                      ["correctiveAwbNo", c.correctiveAwbNo],
                      ["endorsementRef", c.endorsementRef],
                      ["onwardRouting", c.onwardRouting],
                      ["reTenderCarrier", c.reTenderCarrier],
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
