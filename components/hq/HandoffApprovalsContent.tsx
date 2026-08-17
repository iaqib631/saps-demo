"use client";

/**
 * Handoff Approvals — FC-12 §03 · FC-09.
 *
 * WHY THIS SCREEN EXISTS AT ALL. `InterStationHandoff` (lib/domain/transhipment.ts)
 * already carries `state: "hq-approved"`, `hqApprovedAt`, `hqApprovedBy`,
 * `syncOutboxId`, `syncedAt`, `bondContinuityRef` and `bondContinuityVerified`.
 * `HANDOFF_STATE_LABEL` literally reads "proposed": "Proposed by the origin
 * site" → "hq-approved": "Approved by HQ". And /transhipment/handoff opens by
 * saying "origin proposes, HQ approves, cargo travels, receiving site accepts"
 * — then renders read-only, with no approve or reject control anywhere on it.
 *
 * The HQ approval act is modelled, typed, fixtured and homeless. This is its
 * home. Nothing here is invented; it is a dangling edge picked up.
 *
 * WHY IT IS NOT A COPY OF /transhipment/handoff. That screen is the origin and
 * receiving sites' view of their own consignment, and it is correct as a read.
 * This one is the tier ABOVE both of them, and it holds two things neither end
 * can:
 *
 *   1. **The decision.** Approving a handoff moves ownership of cargo between
 *      two nodes. Neither node can grant itself that.
 *   2. **The sync-integrity check.** HQ is the only tier holding both the
 *      node's `lastSyncAt` and the outbox row's `syncedAt`. When they
 *      contradict each other — an outbox row that claims to have synced after
 *      its own node last pushed, or after the clock — that is a CDC fault, and
 *      it is invisible from either end. It is computed here, live, rather than
 *      described, so it appears and disappears with the data.
 *
 * DECISIONS ARE SESSION-LOCAL. There is no backend; a reload restores the
 * fixture. That is stated on the screen rather than left for the client to
 * discover, and the approval stamp uses DEMO_NOW rather than Date.now() so the
 * demo stays reproducible.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Link2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import AwbLink from "@/components/awb/AwbLink";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ToastContext";
import { HqCard, SeverityPill } from "@/components/hq/HqUi";
import {
  DEMO_NOW,
  HANDOFF_STATE_LABEL,
  SITES,
  formatDateTime,
  formatKg,
  listHandoffs,
  type HandoffState,
  type InterStationHandoff,
  type SiteCode,
} from "@/lib/domain";

/** The principal HQ decisions are recorded against — the same one the fixture
 *  already names as hqApprovedBy, and the same one the delegation register at
 *  /hq/site-admins holds the cross-site grant for. */
const HQ_PRINCIPAL = "hq.oversight";

const CHAIN: HandoffState[] = ["proposed", "hq-approved", "in-transit", "accepted"];

type Overlay = Partial<InterStationHandoff> & { heldAtReceiving?: string | null };

/* ------------------------------------------------------------------ *
 * Sync integrity — the check only HQ can run
 * ------------------------------------------------------------------ */

interface IntegrityFinding {
  label: string;
  detail: string;
}

function integrityFindings(h: InterStationHandoff): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const now = Date.parse(DEMO_NOW);
  const origin = SITES.find((s) => s.code === h.fromSite);

  for (const [field, iso] of [
    ["proposedAt", h.proposedAt],
    ["hqApprovedAt", h.hqApprovedAt],
    ["syncedAt", h.syncedAt],
    ["acceptedAt", h.acceptedAt],
  ] as const) {
    if (iso && Date.parse(iso) > now) {
      const mins = Math.round((Date.parse(iso) - now) / 60000);
      out.push({
        label: `${field} is ahead of the clock`,
        detail: `Recorded ${formatDateTime(iso)}, which is ${mins} minutes after the current time (${formatDateTime(DEMO_NOW)}). A handoff cannot be stamped in the future; the offset reads like a UTC value authored as local.`,
      });
    }
  }

  if (origin && h.syncedAt && Date.parse(h.syncedAt) > Date.parse(origin.lastSyncAt)) {
    out.push({
      label: `${h.fromSite} outbox row post-dates the node's last push`,
      detail: `${h.syncOutboxId ?? "The outbox row"} is stamped ${formatDateTime(h.syncedAt)}, but ${h.fromSite} last pushed to HQ at ${formatDateTime(origin.lastSyncAt)} and still holds ${origin.pendingOutbox} queued rows. A node cannot have delivered a row after its own last delivery — the CDC stamp and the node's sync state disagree.`,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */

export default function HandoffApprovalsContent() {
  const cases = useMemo(
    () => listHandoffs("HQ").filter((c) => c.handoff.state !== "not-applicable"),
    [],
  );
  const [overlays, setOverlays] = useState<Record<number, Overlay>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const { addToast } = useToast();

  const merged = cases.map((c) => ({ ...c, h: { ...c.handoff, ...(overlays[c.id] ?? {}) } }));

  const set = (id: number, patch: Overlay) =>
    setOverlays((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));

  const approve = (id: number, awb: string) => {
    set(id, {
      state: "hq-approved",
      hqApprovedAt: DEMO_NOW,
      hqApprovedBy: HQ_PRINCIPAL,
      rejectedReason: null,
    });
    addToast(`HQ approved the handoff for ${awb}. Session-local — a reload restores the fixture.`, "success");
  };

  const reject = (id: number, awb: string) => {
    const reason = (reasons[id] ?? "").trim();
    if (!reason) {
      addToast("A rejection needs a reason — it is what the origin site acts on.", "error");
      return;
    }
    set(id, { state: "rejected", rejectedReason: reason, hqApprovedAt: null, hqApprovedBy: null });
    addToast(`Handoff for ${awb} rejected and returned to the origin site.`, "success");
  };

  const verifyContinuity = (id: number, ref: string | null, awb: string) => {
    set(id, { bondContinuityVerified: true });
    addToast(
      `Bond continuity ${ref ?? ""} verified for ${awb}. The receiving node can now accept custody.`.trim(),
      "success",
    );
  };

  const holdAtReceiving = (id: number, to: SiteCode, awb: string) => {
    set(id, { heldAtReceiving: DEMO_NOW });
    addToast(`${to} instructed to hold ${awb} on arrival pending continuity verification.`, "success");
  };

  const awaiting = merged.filter((c) => c.h.state === "proposed");
  const inFlight = merged.filter((c) => c.h.state === "hq-approved" || c.h.state === "in-transit");
  const settled = merged.filter((c) => c.h.state === "accepted" || c.h.state === "rejected");
  const unverified = merged.filter(
    (c) => !c.h.bondContinuityVerified && c.h.state !== "rejected",
  );

  if (cases.length === 0) {
    return (
      <EmptyState
        title="No inter-station handoffs on the estate"
        description="Handoffs only arise when a transhipment's onward leg is another SAPS node — KHI, LHE or PEW. Nothing is currently routed between two of them."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The queue summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Awaiting HQ decision", n: awaiting.length, sev: awaiting.length > 0 ? "warning" : "good" },
          { label: "Approved and moving", n: inFlight.length, sev: "neutral" },
          { label: "Settled", n: settled.length, sev: "neutral" },
        ].map((x) => (
          <div key={x.label} className="rounded-[12px] border border-[#E2E8F0] bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {x.label}
            </p>
            <p className="mt-1 text-[24px] font-bold leading-none text-[#0F172A]">{x.n}</p>
          </div>
        ))}
      </div>

      {unverified.length > 0 && (
        <div className="flex items-start gap-3 rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] px-5 py-4">
          <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-[#DC2626]" />
          <div>
            <p className="text-[14px] font-semibold text-[#DC2626]">
              {unverified.length} handoff{unverified.length === 1 ? "" : "s"} without verified bond
              continuity
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#991B1B]">
              A handoff that breaks bond continuity turns a transhipment into an import. The
              receiving node cannot accept custody until the continuity reference is verified —
              accepting without it makes duty payable with no record of when the bond lapsed. HQ
              holds this decision because the bond spans both nodes and neither owns it alone.
            </p>
          </div>
        </div>
      )}

      {merged.map((c) => {
        const h = c.h;
        const currentIdx = CHAIN.indexOf(h.state);
        const findings = integrityFindings(h);
        return (
          <section key={c.id} className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                  <span className="font-mono text-[11px] text-[#94A3B8]">
                    {c.transfer.UniqueIdentification}
                  </span>
                  <SeverityPill
                    severity={
                      h.state === "rejected"
                        ? "serious"
                        : h.state === "accepted"
                          ? "good"
                          : h.state === "proposed"
                            ? "warning"
                            : "neutral"
                    }
                    label={HANDOFF_STATE_LABEL[h.state]}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-[#64748B]">
                  {c.transfer.NoOfPackages} pcs · {formatKg(c.transfer.Weight)} · onward{" "}
                  {c.transfer.TransferFlight} · dwell {c.dwellDays}d in the bonded zone
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-[28px] items-center rounded-lg bg-[#F1F5F9] px-3 text-[13px] font-bold text-[#0F172A]">
                  {h.fromSite}
                </span>
                <ArrowRight size={16} className="text-[#94A3B8]" />
                <span className="inline-flex h-[28px] items-center rounded-lg bg-[#EBF0F7] px-3 text-[13px] font-bold text-[#1B4F8B]">
                  {h.toSite}
                </span>
              </div>
            </header>

            {/* Chain */}
            <div className="border-b border-[#F1F5F9] px-5 py-4">
              <div className="flex flex-wrap items-stretch gap-2">
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
                      className="min-w-[150px] flex-1 rounded-xl border px-3 py-2.5"
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
                          style={{ color: done ? "#16A34A" : current ? "#7C3AED" : "#94A3B8" }}
                        >
                          {HANDOFF_STATE_LABEL[step]}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#94A3B8]">
                        {at ? formatDateTime(at) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bond continuity + the HQ decision */}
            <div
              className="px-5 py-4"
              style={{ backgroundColor: h.bondContinuityVerified ? "#F0FDF4" : "#FEF2F2" }}
            >
              <div className="flex items-start gap-3">
                <Link2
                  size={16}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: h.bondContinuityVerified ? "#16A34A" : "#DC2626" }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: h.bondContinuityVerified ? "#16A34A" : "#DC2626" }}
                  >
                    Bond continuity {h.bondContinuityVerified ? "verified" : "NOT verified"}
                    {h.bondContinuityRef ? ` · ${h.bondContinuityRef}` : ""}
                  </p>
                  <p
                    className="mt-0.5 text-[12px]"
                    style={{ color: h.bondContinuityVerified ? "#15803D" : "#991B1B" }}
                  >
                    {h.bondContinuityVerified
                      ? `${h.toSite} can accept custody — the cargo arrives still under the original bond.`
                      : `${h.toSite} cannot accept custody yet. Until continuity is verified, accepting would convert this transhipment into an import.`}
                  </p>
                  {h.heldAtReceiving && (
                    <p className="mt-1 text-[12px] font-semibold text-[#991B1B]">
                      Hold instruction issued to {h.toSite} at {formatDateTime(h.heldAtReceiving)}.
                    </p>
                  )}
                </div>
              </div>

              <div
                className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t pt-4 md:grid-cols-4"
                style={{ borderColor: h.bondContinuityVerified ? "#BBF7D0" : "#FECACA" }}
              >
                {(
                  [
                    ["hqApprovedBy", h.hqApprovedBy],
                    ["hqApprovedAt", h.hqApprovedAt ? formatDateTime(h.hqApprovedAt) : null],
                    ["syncOutboxId", h.syncOutboxId],
                    ["acceptedBy", h.acceptedBy],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-[#CBD5E1]">{k}</span>
                    <span
                      className="break-words text-[12px] font-medium"
                      style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                    >
                      {v ?? "null"}
                    </span>
                  </div>
                ))}
              </div>

              {h.rejectedReason && (
                <p className="mt-3 text-[12px] text-[#991B1B]">Rejected: {h.rejectedReason}</p>
              )}

              {/* Controls */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {h.state === "proposed" ? (
                  <>
                    <button
                      onClick={() => approve(c.id, c.AWBNO)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <ShieldCheck size={15} /> Approve the move
                    </button>
                    <input
                      value={reasons[c.id] ?? ""}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Reason, if rejecting"
                      className="h-9 min-w-[220px] flex-1 rounded-xl border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B]"
                    />
                    <button
                      onClick={() => reject(c.id, c.AWBNO)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#FCA5A5] bg-white px-4 text-[13px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-[#64748B]">
                    Approve / reject applies only while a handoff is{" "}
                    <span className="font-semibold">proposed</span>. This one is already{" "}
                    <span className="font-semibold">{HANDOFF_STATE_LABEL[h.state].toLowerCase()}</span>
                    , so the decision left to HQ is the continuity one.
                  </p>
                )}
              </div>

              {!h.bondContinuityVerified && h.state !== "rejected" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => verifyContinuity(c.id, h.bondContinuityRef, c.AWBNO)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <ShieldCheck size={15} /> Record continuity verification
                  </button>
                  <button
                    onClick={() => holdAtReceiving(c.id, h.toSite, c.AWBNO)}
                    disabled={Boolean(h.heldAtReceiving)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-4 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-default disabled:opacity-50"
                  >
                    <ShieldAlert size={15} />
                    {h.heldAtReceiving ? `Held at ${h.toSite}` : `Hold at ${h.toSite} on arrival`}
                  </button>
                </div>
              )}
            </div>

            {/* Sync integrity — computed, not described */}
            {findings.length > 0 && (
              <div className="border-t border-[#FDE68A] bg-[#FFFBEB] px-5 py-4">
                <p className="text-[13px] font-semibold text-[#B45309]">
                  Sync integrity — {findings.length} finding{findings.length === 1 ? "" : "s"} on
                  this record
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#92400E]">
                  HQ is the only tier holding both the node&apos;s sync state and the outbox row it
                  produced, so these contradictions are invisible from either end of the leg.
                </p>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {findings.map((f) => (
                    <li key={f.label} className="rounded-[10px] border border-[#FDE68A] bg-white px-3 py-2">
                      <p className="text-[12px] font-semibold text-[#0F172A]">{f.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{f.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      <HqCard
        title="What an approval here does, and does not, do"
        icon={ShieldAlert}
        source="session state — no backend"
        intro="Stated on the screen rather than left for a client to discover."
      >
        <ul className="flex flex-col gap-2">
          {[
            "The decision is held in this browser session. A reload restores the fixture — nothing is persisted, because there is no backend to persist to.",
            "Approval stamps DEMO_NOW rather than the wall clock, so a walkthrough reproduces exactly.",
            "Approving does not move the cargo, notify the receiving node, or write an outbox row. It records the decision that the CDC sync would carry.",
            "The receiving node's acceptance gate is modelled in evaluateRetender() and reads bondContinuityVerified — the same field this screen sets.",
          ].map((t) => (
            <li key={t} className="text-[12px] leading-relaxed text-[#64748B]">
              — {t}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link
            href="/transhipment/handoff"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            The sites&apos; own view of the same leg <ArrowUpRight size={12} />
          </Link>
          <Link
            href="/transhipment/register"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            Transhipment register <ArrowUpRight size={12} />
          </Link>
        </div>
      </HqCard>
    </div>
  );
}
