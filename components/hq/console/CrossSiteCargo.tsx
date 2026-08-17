"use client";

/**
 * T4 · Cargo that is between two nodes right now.
 *
 * `listHandoffs("HQ")` returns the transhipment cases whose onward leg is
 * another SAPS station. At KHI scope the estate's one live leg returns nothing;
 * at PEW you see the origin end and nothing else. Only "HQ" returns the leg
 * itself — this is the single clearest artefact in the repo for what the tier
 * is for, and it needs no new model, because `InterStationHandoff` already
 * carries state, hqApprovedBy, syncOutboxId and bondContinuityVerified.
 *
 * The stake is written into lib/domain/transhipment.ts: "A handoff that breaks
 * bond continuity turns a transhipment into an import." An unverified
 * continuity reference on cargo already in transit is a duty consequence
 * waiting at the receiving end, and neither end's own screen shows both halves.
 */

import { ArrowRight, Route } from "lucide-react";
import AwbLink from "@/components/awb/AwbLink";
import { HqCard, SeverityPill } from "@/components/hq/HqUi";
import { HANDOFF_STATE_LABEL, formatKg, listHandoffs } from "@/lib/domain";

export default function CrossSiteCargo() {
  const legs = listHandoffs("HQ").filter((c) => c.handoff.state !== "not-applicable");
  const unverified = legs.filter((c) => !c.handoff.bondContinuityVerified);

  return (
    <HqCard
      title="Cargo between nodes"
      icon={Route}
      source="listHandoffs('HQ') · InterStationHandoff · lib/domain/transhipment.ts"
      intro="Ownership moving from one node to another. Each end's own portal sees half of this; the leg only exists at HQ scope."
      action={{ label: "Handoff approvals", href: "/hq/handoffs" }}
    >
      {legs.length === 0 ? (
        <p className="text-[12px] text-[#64748B]">
          No consignment is currently moving between nodes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {legs.map((c) => {
            const h = c.handoff;
            return (
              <div
                key={c.id}
                className="rounded-[12px] border px-4 py-3"
                style={{
                  borderColor: h.bondContinuityVerified ? "#E2E8F0" : "#FCA5A5",
                  backgroundColor: h.bondContinuityVerified ? "#F8FAFC" : "#FEF2F2",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                    <span className="text-[11px] text-[#64748B]">
                      {c.transfer.NoOfPackages} pcs · {formatKg(c.transfer.Weight)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-[26px] items-center rounded-lg bg-[#F1F5F9] px-2.5 text-[12px] font-bold text-[#0F172A]">
                      {h.fromSite}
                    </span>
                    <ArrowRight size={14} className="text-[#94A3B8]" />
                    <span className="inline-flex h-[26px] items-center rounded-lg bg-[#EBF0F7] px-2.5 text-[12px] font-bold text-[#1B4F8B]">
                      {h.toSite}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <SeverityPill
                    severity={h.state === "accepted" ? "good" : "neutral"}
                    label={HANDOFF_STATE_LABEL[h.state]}
                  />
                  <SeverityPill
                    severity={h.bondContinuityVerified ? "good" : "critical"}
                    label={
                      h.bondContinuityVerified
                        ? `Bond continuity verified · ${h.bondContinuityRef ?? "—"}`
                        : `Bond continuity NOT verified · ${h.bondContinuityRef ?? "no reference"}`
                    }
                  />
                  {h.hqApprovedBy && (
                    <span className="font-mono text-[10px] text-[#94A3B8]">
                      hqApprovedBy {h.hqApprovedBy}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unverified.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-[#991B1B]">
          {unverified.length === 1 ? "One leg is" : `${unverified.length} legs are`} travelling
          without a verified continuity reference. The receiving node cannot accept custody until
          that is settled — accepting anyway converts the transhipment into an import, and duty
          becomes payable with no record of when the bond lapsed.
        </p>
      )}
    </HqCard>
  );
}
