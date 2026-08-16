"use client";

/**
 * P8-2 · Inter-station ownership handoff — M15, FC-09 amendment.
 *
 * "If the onward leg is another SAPS site (LHE/PEW): inter-station ownership
 *  handoff, synced via HQ, bond continuity preserved."
 *
 * This is the first screen where the FC-12 platform tier does real work.
 * Everywhere else the site switcher is a filter; here the site is the
 * *owner*, and ownership genuinely moves — origin proposes, HQ approves,
 * cargo travels, receiving site accepts.
 *
 * The load-bearing detail is **bond continuity**. Cargo under customs bond
 * that moves between stations must arrive still under bond. If the receiving
 * site accepts custody without a verified continuity reference, the
 * transhipment has quietly become an import — with duty consequences nobody
 * intended and no way to reconstruct when it happened.
 *
 * So the accept step is gated on continuity, not on arrival.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Link2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  HANDOFF_STATE_LABEL,
  SITES,
  formatDateTime,
  formatKg,
  listHandoffs,
  listTranshipments,
  type HandoffState,
} from "@/lib/domain";

const STATE_TONE: Record<HandoffState, { bg: string; fg: string }> = {
  "not-applicable": { bg: "#F1F5F9", fg: "#64748B" },
  proposed: { bg: "#FEF3C7", fg: "#D97706" },
  "hq-approved": { bg: "#DBEAFE", fg: "#1B4F8B" },
  "in-transit": { bg: "#F5F3FF", fg: "#7C3AED" },
  accepted: { bg: "#DCFCE7", fg: "#16A34A" },
  rejected: { bg: "#FEE2E2", fg: "#DC2626" },
};

const CHAIN: HandoffState[] = ["proposed", "hq-approved", "in-transit", "accepted"];

export default function HandoffPage() {
  const { scope, isHq } = useSite();
  const handoffs = useMemo(() => listHandoffs(scope), [scope]);
  const all = useMemo(() => listTranshipments(scope), [scope]);

  const unverified = handoffs.filter(
    (c) => c.handoff.state !== "not-applicable" && !c.handoff.bondContinuityVerified,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Transhipment" }, { label: "Inter-station Handoff" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M15
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-09 amendment · FC-12 platform tier
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Inter-station Ownership Handoff
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            When the onward leg is another SAPS station, ownership moves between sites through HQ —
            and the customs bond has to survive the move.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* The station tier */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={15} className="text-[#64748B]" />
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Stations &amp; the HQ sync tier
          </h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {SITES.map((s) => (
            <div
              key={s.code}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 min-w-[150px]"
            >
              <p className="text-[13px] font-bold text-[#0F172A]">{s.code}</p>
              <p className="text-[11px] text-[#64748B]">{s.name}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ backgroundColor: s.offlineCapable ? "#16A34A" : "#94A3B8" }}
                />
                <span className="text-[10px] text-[#94A3B8]">
                  {s.offlineCapable ? "offline-capable" : "online only"}
                  {s.pendingOutbox > 0 ? ` · ${s.pendingOutbox} queued` : ""}
                </span>
              </div>
            </div>
          ))}
          <ArrowRight size={16} className="text-[#CBD5E1]" />
          <div className="rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3 min-w-[150px]">
            <p className="text-[13px] font-bold text-[#1B4F8B]">HQ</p>
            <p className="text-[11px] text-[#1B4F8B]">Islamabad — oversight</p>
            <p className="text-[10px] text-[#475569] mt-1.5">
              Approves the move; CDC/outbox carries it
            </p>
          </div>
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-3">
          Every other screen treats the site as a filter. Here it is the <strong>owner</strong> —
          which is why the move needs an approval tier above both stations.
        </p>
      </div>

      {unverified.length > 0 && (
        <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] px-5 py-4 flex items-start gap-3">
          <ShieldAlert size={18} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-[#DC2626]">
              {unverified.length} handoff{unverified.length === 1 ? "" : "s"} without verified bond
              continuity
            </p>
            <p className="text-[12px] text-[#991B1B] mt-1">
              The receiving site cannot accept custody until continuity is verified. Accepting
              without it silently converts a transhipment into an import — duty becomes payable, and
              there is no record of when the bond lapsed.
            </p>
          </div>
        </div>
      )}

      {handoffs.length === 0 ? (
        <EmptyState
          title="No inter-station handoffs at this site"
          description={`${all.length} transhipment case${all.length === 1 ? "" : "s"} in the register, but none whose onward leg is another SAPS station. Handoffs only arise for KHI ↔ LHE ↔ PEW routings.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {handoffs.map((c) => {
            const h = c.handoff;
            const tone = STATE_TONE[h.state];
            const currentIdx = CHAIN.indexOf(h.state);
            return (
              <div key={c.id} className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        {c.transfer.UniqueIdentification}
                      </span>
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                      >
                        {HANDOFF_STATE_LABEL[h.state]}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      {c.transfer.NoOfPackages} pcs · {formatKg(c.transfer.Weight)} · onward{" "}
                      {c.transfer.TransferFlight}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-[28px] px-3 rounded-lg bg-[#F1F5F9] text-[#0F172A] text-[13px] font-bold inline-flex items-center">
                      {h.fromSite}
                    </span>
                    <ArrowRight size={16} className="text-[#94A3B8]" />
                    <span className="h-[28px] px-3 rounded-lg bg-[#EBF0F7] text-[#1B4F8B] text-[13px] font-bold inline-flex items-center">
                      {h.toSite}
                    </span>
                  </div>
                </div>

                {/* Chain */}
                <div className="px-5 py-4 border-b border-[#F1F5F9]">
                  <div className="flex items-stretch gap-2 flex-wrap">
                    {CHAIN.map((step, i) => {
                      const done = currentIdx > i;
                      const current = currentIdx === i;
                      const at =
                        step === "proposed"
                          ? h.proposedAt
                          : step === "hq-approved"
                            ? h.hqApprovedAt
                            : step === "accepted"
                              ? h.acceptedAt
                              : h.syncedAt;
                      return (
                        <div
                          key={step}
                          className="flex-1 min-w-[150px] rounded-xl border px-3 py-2.5"
                          style={{
                            borderColor: done ? "#BBF7D0" : current ? "#DDD6FE" : "#E2E8F0",
                            backgroundColor: done ? "#F0FDF4" : current ? "#F5F3FF" : "#FFFFFF",
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            {done ? (
                              <CheckCircle2 size={12} className="text-[#16A34A]" />
                            ) : current ? (
                              <RefreshCw size={12} className="text-[#7C3AED]" />
                            ) : (
                              <span className="h-[12px] w-[12px] rounded-full border border-[#CBD5E1]" />
                            )}
                            <span
                              className="text-[11px] font-semibold"
                              style={{
                                color: done ? "#16A34A" : current ? "#7C3AED" : "#94A3B8",
                              }}
                            >
                              {HANDOFF_STATE_LABEL[step]}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#94A3B8] mt-1">
                            {at ? formatDateTime(at) : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bond continuity — the gate */}
                <div
                  className="px-5 py-4"
                  style={{ backgroundColor: h.bondContinuityVerified ? "#F0FDF4" : "#FEF2F2" }}
                >
                  <div className="flex items-start gap-3">
                    <Link2
                      size={16}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: h.bondContinuityVerified ? "#16A34A" : "#DC2626" }}
                    />
                    <div className="flex-1">
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: h.bondContinuityVerified ? "#16A34A" : "#DC2626" }}
                      >
                        Bond continuity{" "}
                        {h.bondContinuityVerified ? "verified" : "NOT verified"}
                        {h.bondContinuityRef ? ` · ${h.bondContinuityRef}` : ""}
                      </p>
                      <p
                        className="text-[12px] mt-0.5"
                        style={{ color: h.bondContinuityVerified ? "#15803D" : "#991B1B" }}
                      >
                        {h.bondContinuityVerified
                          ? `${h.toSite} can accept custody — the cargo arrives still under the original bond.`
                          : `${h.toSite} cannot accept custody yet. Until continuity is verified, accepting would convert this transhipment into an import.`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 mt-4 pt-4 border-t"
                       style={{ borderColor: h.bondContinuityVerified ? "#BBF7D0" : "#FECACA" }}>
                    {(
                      [
                        ["hqApprovedBy", h.hqApprovedBy],
                        ["syncOutboxId", h.syncOutboxId],
                        ["syncedAt", h.syncedAt ? formatDateTime(h.syncedAt) : null],
                        ["acceptedBy", h.acceptedBy],
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

                  {h.rejectedReason && (
                    <p className="text-[12px] text-[#991B1B] mt-3">
                      Rejected: {h.rejectedReason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/transhipment/register"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          Transhipment register <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
