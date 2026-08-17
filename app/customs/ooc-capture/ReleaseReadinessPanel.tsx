"use client";

/**
 * Release Readiness — the OOC capture screen's exit gate.
 *
 * BC-1 rework. The panel this replaces checked nine things, and every one of
 * them was about the *capture*: is there a reference, is there a PDF, is
 * duty recorded, is any hold live. Not one of them asked the question FC-06
 * actually gates on — **does the OOC agree with the Single Declaration?** So
 * an operator could key an OOC for the wrong AWB, tick nine green boxes, and
 * be told the cargo was ready for release.
 *
 * Worse, the old verdict fired on `passCount >= 7` out of 9. Two failing
 * checks — say an ANF hold and a missing duty record — still printed "Cargo
 * ready for release". A gate with a tolerance is not a gate.
 *
 * So the panel now has three blocks and one verdict:
 *   1. Capture artefacts — what the operator did. Still tickable, because
 *      these track work in progress on the form to the left.
 *   2. Agency and status holds — what is stopping it. Derived from the
 *      record and NOT tickable: an operator clicking past an ANF hold is
 *      exactly the failure mode the granularity was added to prevent.
 *   3. Reconciliation vs SD — the five `OocFieldCheck` fields (sdRef, awbNo,
 *      channel, packages, issuedAt), captured against expected.
 *
 * The verdict reads `oocVerified()` from lib/domain rather than re-deriving
 * eligibility, because customs.ts is explicit that two gates deriving
 * "verified" two different ways is how the demo ended up releasing cargo on
 * issuance alone. That predicate wants both halves: every field matching AND
 * a countersignature. Capture and verification are two events, and only the
 * second one opens the gate — which is why the countersign button below is
 * disabled while any of the five disagree.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  CheckCircle2,
  FileText,
  Keyboard,
  Lock,
  Package,
  Shield,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { FormField } from "@/components/primitives";
import {
  formEntry,
  oocMismatches,
  oocVerified,
  type OocFieldCheck,
  type OocVerifyField,
  type OutOfCharge,
} from "@/lib/domain";
import type { OocCandidate } from "./candidates";

interface Props {
  candidate: OocCandidate;
}

interface ArtefactCheck {
  label: string;
  icon: React.ReactNode;
  pass: boolean;
}

/** Field order is FC-06's, and matches `OocVerifyField` — do not re-sort. */
const VERIFY_FIELDS: { field: OocVerifyField; label: string }[] = [
  { field: "sdRef", label: "SD reference" },
  { field: "awbNo", label: "AWB number" },
  { field: "channel", label: "Risk channel" },
  { field: "packages", label: "Number of packages" },
  { field: "issuedAt", label: "Issue date" },
];

/**
 * Build the OOC record this screen is producing, so the verdict can be read
 * off the shared predicate rather than re-implemented locally.
 *
 * `source` is "keyed" and nothing else: this screen is, by definition, the
 * path taken when neither the gateway nor the scanner is available. Badging
 * it any other way would be a lie about provenance.
 */
function buildOoc(candidate: OocCandidate, countersignedAt: string | null): OutOfCharge {
  const capture = (v: string) =>
    formEntry(v, candidate.printSource, candidate.keyedBy, candidate.keyedAt);

  const checks: OocFieldCheck[] = VERIFY_FIELDS.map(({ field, label }) => ({
    field,
    label,
    captured: capture(candidate.print[field]),
    expected: candidate.sd[field],
    matches: candidate.print[field] === candidate.sd[field],
  }));

  return {
    oocNo: candidate.oocNo,
    docNumber: {
      series: "OOC",
      value: candidate.oocNo,
      sequence: Number(candidate.oocNo.slice(-5)),
      year: 2026,
      cargoClassId: null,
      continuesFromCmts: 9099,
    },
    source: "keyed",
    fetchedAt: null,
    scannedAt: null,
    keyedAt: candidate.keyedAt,
    issuedAt: candidate.print.issuedAt,
    issuingOfficer: candidate.issuingOfficer,
    documentId: `DOC-${candidate.oocNo}`,
    checks,
    verifiedAt: countersignedAt,
    verifiedBy: countersignedAt ? "n.hassan" : null,
  };
}

export default function ReleaseReadinessPanel({ candidate }: Props) {
  const { addToast } = useToast();

  // The four artefact checks stay operator-driven: they mirror the keying
  // form to the left, which holds its own field state, so the operator ticks
  // them off as each one is filled.
  const [artefacts, setArtefacts] = useState<ArtefactCheck[]>([
    { label: "OOC reference entered", icon: <FileText size={14} />, pass: false },
    { label: "OOC PDF uploaded", icon: <FileText size={14} />, pass: false },
    { label: "Duty paid recorded", icon: <Package size={14} />, pass: false },
    { label: "Tax paid recorded", icon: <Package size={14} />, pass: false },
  ]);

  const [countersignedAt, setCountersignedAt] = useState<string | null>(null);

  const ooc = useMemo(
    () => buildOoc(candidate, countersignedAt),
    [candidate, countersignedAt],
  );
  const mismatches = oocMismatches(ooc);
  const reconciles = mismatches.length === 0;
  const verified = oocVerified(ooc);

  // Derived, never tickable. Each of the four agencies is asked separately
  // because they release separately — ANF and ASF are different agencies and
  // a discrepancy hold is warehouse-side, so "one hold chip" cannot say who
  // has to act.
  const blockers = [
    {
      label: "No active customs hold",
      icon: <Shield size={14} />,
      pass: !candidate.holds.includes("customs"),
      detail: "Customs hold — released by the appraising officer",
    },
    {
      label: "No ANF hold",
      icon: <Lock size={14} />,
      pass: !candidate.holds.includes("anf"),
      detail: "Anti-Narcotics Force — released by ANF, not by customs",
    },
    {
      label: "No ASF hold",
      icon: <Lock size={14} />,
      pass: !candidate.holds.includes("asf"),
      detail: "Airport Security Force — released by ASF, not by customs",
    },
    {
      label: "No discrepancy hold",
      icon: <AlertTriangle size={14} />,
      pass: !candidate.holds.includes("discrepancy"),
      detail: "Raised from a CDR — closes with the discrepancy, not the OOC",
    },
    {
      label: "AWB status eligible for release",
      icon: <CheckCircle size={14} />,
      pass: candidate.status === "OOC Pending" || candidate.status === "Examined",
      detail: `Current status: ${candidate.status}`,
    },
  ];

  const artefactsDone = artefacts.every((a) => a.pass);
  const noBlockers = blockers.every((b) => b.pass);

  // The whole gate, stated once. Every clause has to hold — there is no
  // count threshold, because a threshold lets a failing check through.
  const eligible = artefactsDone && noBlockers && verified;

  const passCount =
    artefacts.filter((a) => a.pass).length +
    blockers.filter((b) => b.pass).length +
    ooc.checks.filter((c) => c.matches).length;
  const totalCount = artefacts.length + blockers.length + ooc.checks.length;
  const progress = (passCount / totalCount) * 100;

  const toggleArtefact = (index: number) => {
    setArtefacts((prev) => {
      const next = prev.map((a, i) => (i === index ? { ...a, pass: !a.pass } : a));
      addToast(
        `${next[index].label} ${next[index].pass ? "marked ready" : "marked pending"}`,
        "success",
      );
      return next;
    });
  };

  const handleCountersign = () => {
    if (!reconciles) {
      addToast("Cannot countersign — the OOC does not agree with the SD", "error");
      return;
    }
    setCountersignedAt("31 May 2026 16:05");
    addToast("Reconciliation countersigned", "success");
  };

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-bold text-[#0F172A]">Release Readiness</h2>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Capture artefacts, live holds, and the OOC reconciled against the SD
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
            {passCount} PASS
          </span>
          <span className="text-[11px] font-bold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded-full">
            {totalCount - passCount} PENDING
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#64748B]">Readiness</span>
            <span className="text-[12px] font-bold text-[#0F172A]">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: eligible ? "#16A34A" : progress >= 60 ? "#D97706" : "#DC2626",
              }}
            />
          </div>
        </div>

        {/* 1 — capture artefacts */}
        <div>
          <h3 className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5">
            Capture artefacts
          </h3>
          <div className="space-y-2">
            {artefacts.map((item, index) => (
              <button
                key={item.label}
                onClick={() => toggleArtefact(index)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left"
                style={{
                  backgroundColor: item.pass ? "#DCFCE7" : "#F8FAFC",
                  borderColor: item.pass ? "#86EFAC" : "#E2E8F0",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.pass ? "#16A34A" : "#F1F5F9" }}
                >
                  {item.pass ? (
                    <Check size={14} className="text-white" />
                  ) : (
                    <div className="text-[#94A3B8]">{item.icon}</div>
                  )}
                </div>
                <span
                  className="text-[13px] font-semibold flex-1"
                  style={{ color: item.pass ? "#16A34A" : "#475569" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={
                    item.pass
                      ? { color: "#16A34A", backgroundColor: "rgba(255,255,255,0.6)" }
                      : { color: "#D97706", backgroundColor: "#FEF3C7" }
                  }
                >
                  {item.pass ? "PASS" : "PENDING"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2 — holds and status, derived */}
        <div>
          <h3 className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5">
            Holds &amp; status
          </h3>
          <div className="space-y-2">
            {blockers.map((item) => (
              <div
                key={item.label}
                className="w-full flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: item.pass ? "#F8FAFC" : "#FEF2F2",
                  borderColor: item.pass ? "#E2E8F0" : "#FCA5A5",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.pass ? "#DCFCE7" : "#FEE2E2" }}
                >
                  {item.pass ? (
                    <Check size={14} className="text-[#16A34A]" />
                  ) : (
                    <div className="text-[#DC2626]">{item.icon}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: item.pass ? "#475569" : "#DC2626" }}
                  >
                    {item.label}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{item.detail}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={
                    item.pass
                      ? { color: "#16A34A", backgroundColor: "#DCFCE7" }
                      : { color: "#DC2626", backgroundColor: "#FEE2E2" }
                  }
                >
                  {item.pass ? "CLEAR" : "BLOCKING"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3 — the reconciliation, which is the actual control */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <h3 className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">
              Reconciliation vs SD
            </h3>
            <span className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-[#F5F3FF] text-[#7C3AED]">
              <Keyboard size={10} strokeWidth={2.5} />
              KEYED CAPTURE
            </span>
          </div>
          <div className="space-y-2">
            {ooc.checks.map((chk) => (
              <div
                key={chk.field}
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: chk.matches ? "#E2E8F0" : "#FCA5A5",
                  backgroundColor: chk.matches ? "#FFFFFF" : "#FEF2F2",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <FormField label={chk.label} value={chk.captured} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        SD says
                      </p>
                      <p className="text-[13px] font-medium text-[#0F172A]">{chk.expected}</p>
                    </div>
                    {chk.matches ? (
                      <CheckCircle2 size={18} className="text-[#16A34A]" />
                    ) : (
                      <XCircle size={18} className="text-[#DC2626]" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleCountersign}
            disabled={!reconciles || countersignedAt !== null}
            className="mt-3 w-full h-10 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            style={
              countersignedAt
                ? { backgroundColor: "#DCFCE7", color: "#16A34A", cursor: "default" }
                : reconciles
                  ? { backgroundColor: "#0B2545", color: "#FFFFFF", cursor: "pointer" }
                  : { backgroundColor: "#F1F5F9", color: "#94A3B8", cursor: "not-allowed" }
            }
          >
            <ShieldCheck size={15} />
            {countersignedAt
              ? `Countersigned by ${ooc.verifiedBy} · ${countersignedAt}`
              : reconciles
                ? "Countersign reconciliation"
                : "Cannot countersign — fields disagree with the SD"}
          </button>
        </div>

        {/* The verdict. One clause per reason, so a blocked AWB says why. */}
        <div
          className="rounded-xl border px-4 py-3"
          style={
            eligible
              ? { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
              : { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }
          }
        >
          <div className="flex items-center gap-2">
            {eligible ? (
              <CheckCircle2 size={16} className="text-[#16A34A]" />
            ) : (
              <AlertTriangle size={16} className="text-[#DC2626]" />
            )}
            <span
              className="text-[13px] font-bold"
              style={{ color: eligible ? "#16A34A" : "#DC2626" }}
            >
              {eligible ? "Cargo ready for release" : "Cannot release"}
            </span>
          </div>
          <p
            className="text-[12px] mt-1"
            style={{ color: eligible ? "#15803D" : "#991B1B" }}
          >
            {eligible
              ? "Every artefact captured, no hold live, and the OOC agrees with the declaration on all five checked fields."
              : [
                  !reconciles &&
                    `${mismatches.length} field${mismatches.length === 1 ? "" : "s"} disagree${
                      mismatches.length === 1 ? "s" : ""
                    } with the SD — ${mismatches.map((m) => m.label.toLowerCase()).join(", ")}`,
                  reconciles && !verified && "reconciliation not countersigned yet",
                  !noBlockers &&
                    `${blockers.filter((b) => !b.pass).length} blocker still live`,
                  !artefactsDone &&
                    `${artefacts.filter((a) => !a.pass).length} capture artefact outstanding`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}
