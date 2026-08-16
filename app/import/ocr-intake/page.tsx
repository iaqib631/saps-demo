"use client";



import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileScan,
  PencilLine,
  Plus,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import { OcrAcceptanceGate } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  CARGO_CLASSES,
  DOCUMENT_TYPE_LABEL,
  OCR_CONFIDENCE_THRESHOLD,
  ocrState,
  VARIANCE_TOLERANCE,
  cargoSubClass,
  formatKg,
  formatPkr,
  listAwbs,
  round2,
  subClassesOf,
  variance,
  type OcrValue,
} from "@/lib/domain";

const STEPS = [
  { id: "05a", label: "Scan", icon: ScanLine, hint: "MAWB / HAWB / Manifest" },
  { id: "05b", label: "Extract", icon: Sparkles, hint: "Confidence · confirm · correct" },
  { id: "05e", label: "Declared vs physical", icon: FileScan, hint: "Capture what arrived" },
  { id: "05f", label: "Commit", icon: Check, hint: "Verified AWB summary" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/**
 * Standard air-cargo commodity categories — what a cargo terminal
 * actually receives. The goods field is a pick from this list, not free
 * text, so intake classification stays consistent line to line.
 */
const GOODS_CATEGORIES = [
  "General cargo",
  "Pharmaceuticals",
  "Perishables — fruit & vegetables",
  "Perishables — meat & seafood",
  "Flowers & plants",
  "Consumer electronics",
  "Textiles & garments",
  "Automotive parts",
  "Machinery & spare parts",
  "Dangerous goods (DGR)",
  "Live animals (AVI)",
  "Valuables (VAL)",
  "Courier & mail",
  "Human remains (HUM)",
] as const;

interface WorkingLine {
  id: number;
  goods: OcrValue<string>;
  pcs: OcrValue<number>;
  weightKg: OcrValue<number>;
  volumeM3: OcrValue<number>;
  /** 05e — physically received. */
  receivedPcs: number;
  receivedWeightKg: number;
  receivedVolumeM3: number;
  confirmed: boolean;
}

export default function OcrIntakePage() {
  const { scope } = useSite();

  // Candidates: anything at or before AWB summary — the intake queue.
  const queue = useMemo(
    () => listAwbs({ scope }).filter((a) => ["handover", "doc-verification", "awb-summary", "reconciliation"].includes(a.stage)),
    [scope],
  );

  const [awbId, setAwbId] = useState<number | null>(queue[0]?.AWBId ?? null);
  const awb = queue.find((a) => a.AWBId === awbId) ?? queue[0] ?? null;

  const [step, setStep] = useState<StepId>("05a");
  const [scanned, setScanned] = useState(false);
  const [lines, setLines] = useState<WorkingLine[]>([]);
  const [classId, setClassId] = useState<number>(awb?.CARGOCLASSID ?? 1);
  const [subClassId, setSubClassId] = useState<number>(awb?.cargoSubClassId ?? 101);
  const [committed, setCommitted] = useState(false);

  // The subclass the 05f commit step is currently pointed at. Resolved once so
  // the classification label and its MINCHARGES floor cannot drift apart.
  const subClass = cargoSubClass(subClassId);

  // 05b — the extraction. Seeded from the AWB so the numbers are consistent
  // with the rest of the fixture set rather than invented per render.
  function runExtraction() {
    if (!awb) return;
    const n = 3;
    const confidences = [0.98, 0.74, 0.88];
    // Seeds come from GOODS_CATEGORIES so the select always has a match.
    const seedGoods = ["Pharmaceuticals", "Textiles & garments", "Consumer electronics"];
    const built: WorkingLine[] = Array.from({ length: n }, (_, i) => {
      const pcs = Math.round(awb.TOTALPCS / n);
      const kg = round2(awb.TOTALWEIGHT / n);
      const vol = round2(kg / 167);
      const c = confidences[i];
      return {
        id: i + 1,
        goods: { extracted: seedGoods[i], value: seedGoods[i], confidence: c, state: c >= OCR_CONFIDENCE_THRESHOLD ? "auto-accepted" : "needs-review" },
        pcs: { extracted: pcs, value: pcs, confidence: Math.min(0.99, c + 0.05), state: Math.min(0.99, c + 0.05) >= OCR_CONFIDENCE_THRESHOLD ? "auto-accepted" : "needs-review" },
        weightKg: { extracted: kg, value: kg, confidence: c, state: c >= OCR_CONFIDENCE_THRESHOLD ? "auto-accepted" : "needs-review" },
        volumeM3: { extracted: vol, value: vol, confidence: Math.max(0.6, c - 0.1), state: Math.max(0.6, c - 0.1) >= OCR_CONFIDENCE_THRESHOLD ? "auto-accepted" : "needs-review" },
        receivedPcs: pcs,
        receivedWeightKg: kg,
        receivedVolumeM3: vol,
        confirmed: c >= OCR_CONFIDENCE_THRESHOLD,
      };
    });
    setLines(built);
    setScanned(true);
    setStep("05b");
  }

  const outstanding = lines.filter((l) => !l.confirmed).length;
  const allAccepted = lines.length > 0 && outstanding === 0;

  /**
   * FC-01 05c (runs inside the 05b screen) — the operator accepts the line
   * as it stands.
   *
   * Confirming is *not* correcting. This previously stamped
   * `operator-corrected` on goods / weight / volume regardless, which put
   * "OCR read X · corrected by n.hassan" under fields nobody had touched
   * and where extracted === value. A fabricated audit trail is worse than
   * none, so acceptance now only sets `confirmed`.
   */
  function confirmLine(id: number) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, confirmed: true } : l)));
  }

  /**
   * FC-01 05d (runs inside the 05b screen) — the actual correction.
   * Recomputes the review state from the
   * domain helper so a value edited back to what OCR read stops claiming
   * to be corrected, and a genuine edit is attributed.
   */
  function correctField<K extends "goods" | "pcs" | "weightKg" | "volumeM3">(
    id: number,
    field: K,
    next: WorkingLine[K]["value"],
  ) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const cur = l[field];
        const corrected = next !== cur.extracted;
        return {
          ...l,
          [field]: {
            ...cur,
            value: next,
            state: ocrState(cur.confidence, corrected),
            ...(corrected ? { correctedBy: "n.hassan" } : { correctedBy: undefined }),
          },
        } as WorkingLine;
      }),
    );
  }

  function setReceived(id: number, field: "receivedPcs" | "receivedWeightKg" | "receivedVolumeM3", v: number) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [field]: v } : l)));
  }

  /**
   * A row the OCR skipped entirely, keyed by hand. Confidence 0 marks it
   * as manual (no % chip), and it starts unconfirmed so the 05c gate
   * still forces the operator to fill it in and confirm before commit.
   */
  function addLine() {
    setLines((ls) => {
      const id = ls.length ? Math.max(...ls.map((l) => l.id)) + 1 : 1;
      const manual = { confidence: 0, state: "needs-review" as const };
      return [
        ...ls,
        {
          id,
          goods: { extracted: "", value: "", ...manual },
          pcs: { extracted: 0, value: 0, ...manual },
          weightKg: { extracted: 0, value: 0, ...manual },
          volumeM3: { extracted: 0, value: 0, ...manual },
          receivedPcs: 0,
          receivedWeightKg: 0,
          receivedVolumeM3: 0,
          confirmed: false,
        },
      ];
    });
  }

  /** Drop a row — a hallucinated extraction or a manual row keyed in error. */
  function removeLine(id: number) {
    setLines((ls) => ls.filter((l) => l.id !== id));
  }

  // 05e — totals and variance
  const totals = useMemo(() => {
    const declaredPcs = lines.reduce((n, l) => n + l.pcs.value, 0);
    const physicalPcs = lines.reduce((n, l) => n + l.receivedPcs, 0);
    const declaredKg = round2(lines.reduce((n, l) => n + l.weightKg.value, 0));
    const physicalKg = round2(lines.reduce((n, l) => n + l.receivedWeightKg, 0));
    const declaredVol = round2(lines.reduce((n, l) => n + l.volumeM3.value, 0));
    const physicalVol = round2(lines.reduce((n, l) => n + l.receivedVolumeM3, 0));
    return {
      pieces: variance(declaredPcs, physicalPcs),
      weightKg: variance(declaredKg, physicalKg),
      volumeM3: variance(declaredVol, physicalVol),
    };
  }, [lines]);

  const overTolerance =
    totals.pieces.overTolerance || totals.weightKg.overTolerance || totals.volumeM3.overTolerance;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  if (!awb) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "OCR Intake" }]} />
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-[#0F172A]">Intake queue is empty at {scope}</p>
          <p className="text-[13px] text-[#64748B] mt-1">
            Switch site in the header, or check the flight board for arriving cargo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "OCR Intake Workbench" }]} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M02 → M03
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                FC-01 05a–05f
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
              OCR Intake Workbench
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Scan, auto-extract with per-item confidence, correct only what needs it, then record
              what physically arrived.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Intake queue ({queue.length})
            </span>
            <select
              value={awbId ?? ""}
              onChange={(e) => {
                setAwbId(Number(e.target.value));
                setStep("05a");
                setScanned(false);
                setLines([]);
                setCommitted(false);
              }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none cursor-pointer font-mono"
            >
              {queue.map((a) => (
                <option key={a.AWBId} value={a.AWBId}>
                  {a.AWBNO} — {a.stage}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = s.id === step;
            const reachable = scanned || s.id === "05a";
            return (
              <div key={s.id} className="flex items-center flex-shrink-0">
                <button
                  disabled={!reachable}
                  onClick={() => reachable && setStep(s.id)}
                  className="flex flex-col items-center gap-1.5 min-w-[104px] px-2 py-1 rounded-lg transition-colors"
                  style={{ cursor: reachable ? "pointer" : "not-allowed", opacity: reachable ? 1 : 0.45 }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: active ? "#0B2545" : done ? "#16A34A" : "#F1F5F9",
                      color: active || done ? "white" : "#94A3B8",
                    }}
                  >
                    <s.icon size={16} />
                  </div>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: active ? "#0B2545" : done ? "#16A34A" : "#94A3B8" }}
                  >
                    {s.id}
                  </span>
                  <span
                    className="text-[11px] text-center leading-tight"
                    style={{ color: active ? "#0B2545" : "#64748B", fontWeight: active ? 700 : 500 }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-6 h-[2px] flex-shrink-0"
                    style={{ backgroundColor: done ? "#16A34A" : "#E2E8F0" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AWB context */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3">
          {[
            ["AWB", awb.AWBNO],
            ["IGM", awb.IGMNO],
            ["Flight", awb.FLIGHT],
            ["Declared pieces", String(awb.TOTALPCS)],
            ["Declared weight", formatKg(awb.TOTALWEIGHT)],
          ].map(([l, v]) => (
            <div key={l} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {l}
              </span>
              <span className="text-[13px] font-semibold text-[#0F172A] font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- 05a Scan ---- */}
      {step === "05a" && (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-[16px] font-semibold text-[#0F172A]">05a · Scan documents</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            MAWB, HAWB and manifest from the flight pouch. Scanner source, not a file upload.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {(["MAWB", "HAWB", "MANIFEST"] as const).map((t) => (
              <div
                key={t}
                className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 flex flex-col items-center gap-2"
              >
                <ScanLine size={24} className="text-[#94A3B8]" />
                <p className="text-[13px] font-semibold text-[#0F172A]">{DOCUMENT_TYPE_LABEL[t]}</p>
                <p className="text-[11px] text-[#94A3B8]">Feeder scanner — Canon DR-G2140</p>
              </div>
            ))}
          </div>

          <button
            onClick={runExtraction}
            className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#1B4F8B] transition-colors"
          >
            <Sparkles size={15} />
            Scan &amp; extract
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* ---- 05b Extract — acceptance gate + inline correction ---- */}
      {step === "05b" && (
        <div className="flex flex-col gap-5">
          <OcrAcceptanceGate total={lines.length} outstanding={outstanding} />

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-[16px] font-semibold text-[#0F172A]">
                  05b · Extracted line items
                </h2>
                <p className="text-[13px] text-[#64748B] mt-1">
                  Item, category, quantity, volume and weight — each with a confidence score against
                  a {Math.round(OCR_CONFIDENCE_THRESHOLD * 100)}% threshold. Every field is editable
                  after extraction: fix anything OCR misread, add a line if it skipped one, then
                  confirm each flagged line.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5 mt-5">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: l.confirmed ? "#E2E8F0" : "#FDE68A",
                    backgroundColor: l.confirmed ? "white" : "#FFFBEB",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-[12px] font-bold text-[#64748B]">Line {l.id}</span>
                    <div className="flex items-center gap-2">
                      {l.confirmed ? (
                        <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#DCFCE7] text-[#16A34A]">
                          Confirmed
                        </span>
                      ) : (
                        <button
                          onClick={() => confirmLine(l.id)}
                          className="h-8 px-3 rounded-lg bg-[#D97706] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#B45309] transition-colors"
                        >
                          Review &amp; confirm
                        </button>
                      )}
                      <button
                        onClick={() => removeLine(l.id)}
                        title="Delete line"
                        aria-label={`Delete line ${l.id}`}
                        className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-white text-[#94A3B8] hover:text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Every field stays editable after extraction — pieces
                      included, since it drives the 05e declared-vs-physical
                      variance and so the CDR. */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <GoodsField ocr={l.goods} onChange={(v) => correctField(l.id, "goods", v)} />
                    <NumberField
                      label="Pieces"
                      ocr={l.pcs}
                      step={1}
                      onChange={(v) => correctField(l.id, "pcs", v)}
                    />
                    <NumberField
                      label="Gross weight (kg)"
                      ocr={l.weightKg}
                      step={0.01}
                      onChange={(v) => correctField(l.id, "weightKg", v)}
                    />
                    <NumberField
                      label="Volume (m³)"
                      ocr={l.volumeM3}
                      step={0.01}
                      onChange={(v) => correctField(l.id, "volumeM3", v)}
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={addLine}
                className="h-11 rounded-xl border border-dashed border-[#CBD5E1] text-[13px] font-semibold text-[#64748B] cursor-pointer hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={15} />
                Add line — key a row the OCR skipped
              </button>
            </div>

            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-[#E2E8F0]">
              <button
                disabled={!allAccepted}
                onClick={() => setStep("05e")}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-[13px] font-semibold transition-colors"
                style={{
                  backgroundColor: allAccepted ? "#0B2545" : "#F1F5F9",
                  color: allAccepted ? "white" : "#94A3B8",
                  cursor: allAccepted ? "pointer" : "not-allowed",
                }}
              >
                Continue to 05e
                <ArrowRight size={15} />
              </button>
              {!allAccepted && (
                <span className="text-[12px] text-[#D97706]">
                  {lines.length === 0
                    ? "Blocked — no line items; add at least one row"
                    : `Blocked — ${outstanding} item${outstanding === 1 ? "" : "s"} below threshold and unconfirmed`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- 05e Declared vs physical ---- */}
      {step === "05e" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
            <h2 className="text-[16px] font-semibold text-[#0F172A]">
              05e · Declared (OCR) vs physical (received)
            </h2>
            <p className="text-[13px] text-[#64748B] mt-1">
              Variance over {Math.round(VARIANCE_TOLERANCE * 100)}% auto-raises a CDR at FC-04. Maps
              onto the CMTS pairs PCS/RECEIVEDPCS, WEIGTH/RECEIVEDWT, CHARGEWEIGTH/CHARGEDRECEIVEDWT.
            </p>

            <div className="overflow-x-auto mt-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                    <th className="text-left px-3 py-2">Line</th>
                    <th className="text-right px-3 py-2">Declared pcs</th>
                    <th className="text-right px-3 py-2">Received pcs</th>
                    <th className="text-right px-3 py-2">Declared kg</th>
                    <th className="text-right px-3 py-2">Received kg</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b border-[#F1F5F9]">
                      <td className="px-3 py-2.5 font-medium">{l.goods.value}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#64748B]">{l.pcs.value}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={l.receivedPcs}
                          onChange={(e) => setReceived(l.id, "receivedPcs", Number(e.target.value))}
                          className="w-20 h-8 px-2 rounded-lg border border-[#E2E8F0] text-right font-mono text-[13px] outline-none focus:border-[#2E75B6]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#64748B]">
                        {l.weightKg.value}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={l.receivedWeightKg}
                          onChange={(e) =>
                            setReceived(l.id, "receivedWeightKg", Number(e.target.value))
                          }
                          className="w-24 h-8 px-2 rounded-lg border border-[#E2E8F0] text-right font-mono text-[13px] outline-none focus:border-[#2E75B6]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              {(
                [
                  ["Pieces", totals.pieces],
                  ["Weight (kg)", totals.weightKg],
                  ["Volume (m³)", totals.volumeM3],
                ] as const
              ).map(([label, v]) => (
                <div
                  key={label}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: v.overTolerance ? "#FECACA" : "#E2E8F0",
                    backgroundColor: v.overTolerance ? "#FEF2F2" : "white",
                  }}
                >
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {label}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-[18px] font-bold text-[#0F172A] font-mono">
                      {v.physical}
                    </span>
                    <span className="text-[12px] text-[#94A3B8] font-mono">/ {v.declared}</span>
                  </div>
                  <p
                    className="text-[12px] font-semibold mt-1 font-mono"
                    style={{ color: v.overTolerance ? "#DC2626" : v.delta === 0 ? "#16A34A" : "#D97706" }}
                  >
                    {v.delta > 0 ? "+" : ""}
                    {v.delta} ({(v.ratio * 100).toFixed(1)}%)
                    {v.overTolerance ? " — over tolerance" : ""}
                  </p>
                </div>
              ))}
            </div>

            {overTolerance && (
              <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
                <p className="text-[13px] font-semibold text-[#DC2626]">
                  Variance exceeds tolerance — a CDR will be raised automatically on commit
                </p>
                <p className="text-[12px] text-[#991B1B] mt-1">
                  FC-04 amendment: Shortage / Overage / Wrong Weight fall straight out of intake, so
                  the discrepancy is caught here rather than waiting to be spotted.
                </p>
              </div>
            )}

            <button
              onClick={() => setStep("05f")}
              className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#1B4F8B] transition-colors"
            >
              Continue to 05f
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ---- 05f Commit ---- */}
      {step === "05f" && (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
          <h2 className="text-[16px] font-semibold text-[#0F172A]">05f · Commit verified AWB summary</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            Classification is set here, not later — the FC-02 amendment requires class and subclass
            at indexation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Cargo class · CARGOCLASSID
              </span>
              <select
                value={classId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setClassId(id);
                  setSubClassId(subClassesOf(id)[0]?.SUBCLASSID ?? subClassId);
                }}
                className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none cursor-pointer"
              >
                {CARGO_CLASSES.map((c) => (
                  <option key={c.ID} value={c.ID}>
                    {c.ABBREVATION} — {c.NAME}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Cargo subclass · CARGOSUBCLASS
              </span>
              <select
                value={subClassId}
                onChange={(e) => setSubClassId(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none cursor-pointer"
              >
                {subClassesOf(classId).map((s) => (
                  <option key={s.SUBCLASSID} value={s.SUBCLASSID}>
                    {s.ABBREVATION} — {s.NAME}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* What the subclass chosen above costs the consignment.
           *
           * MINCHARGES belongs on this step and not on the master screen alone
           * because the pick made here is the first moment the floor is set:
           * a GCR-L line and an AFU-H line differ by thousands of rupees before
           * a single day of storage accrues, and the operator committing the
           * summary is the last person who can still change it.
           *
           * It is a floor, not a line item — FC-07 bills the greater of the
           * computed storage total and this — which is why zero is spelled out
           * rather than shown as a bare "0". A zero subclass (HUM, DIP, the
           * customs-held ones) means no minimum applies, not free storage, and
           * that misreading is exactly the one that survives to invoicing. */}
          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Minimum charge
                </span>
                <span className="font-mono text-[9px] text-[#CBD5E1]">CARGOSUBCLASS.MINCHARGES</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-1 max-w-[62ch]">
                {subClass.MINCHARGES === 0
                  ? `${subClass.ABBREVATION} carries no floor — storage bills at the computed total. Zero means no minimum applies, not free.`
                  : "FC-07 bills the computed storage total or this, whichever is greater. Changing the subclass above changes the floor."}
              </p>
            </div>
            <span
              className="text-[18px] font-bold font-mono whitespace-nowrap"
              style={{ color: subClass.MINCHARGES === 0 ? "#94A3B8" : "#0F172A" }}
            >
              {formatPkr(subClass.MINCHARGES)}
            </span>
          </div>

          <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
            <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
              Summary to commit
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Lines", String(lines.length)],
                ["Pieces (received)", String(totals.pieces.physical)],
                ["Weight (received)", formatKg(totals.weightKg.physical)],
                ["Classification", subClass.ABBREVATION],
                ["IGM linkage", awb.IGMNO],
                ["Variance", overTolerance ? "Over tolerance" : "Within tolerance"],
              ].map(([l, v]) => (
                <div key={l} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    {l}
                  </span>
                  <span className="text-[13px] font-semibold text-[#0F172A]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {committed ? (
            <div className="mt-5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
              <p className="text-[14px] font-semibold text-[#16A34A]">
                Committed — AWB summary verified
              </p>
              <p className="text-[12px] text-[#15803D] mt-1">
                Hands to FC-01 step 06 (AWB summary preparation) and on to indexing.
                {overTolerance ? " A CDR was raised from the intake variance." : ""}
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Link
                  href="/import/indexing"
                  className="h-9 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold no-underline inline-flex items-center"
                >
                  Continue to indexing
                </Link>
                <Link
                  href={`/awb/${awb.AWBId}?tab=intake`}
                  className="h-9 px-4 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] no-underline inline-flex items-center"
                >
                  View on AWB hub
                </Link>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCommitted(true)}
              className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#16A34A] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#15803D] transition-colors"
            >
              <Check size={15} />
              Commit verified summary
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Extract-screen field controls — always editable after extraction.
 * The confidence chrome mirrors `OcrConfidenceField`, but the control
 * is a plain select / number input so the operator corrects any field
 * directly instead of through an explicit edit mode.
 * ------------------------------------------------------------------ */

const OCR_STATE_STYLE = {
  "auto-accepted": { bg: "#DCFCE7", fg: "#16A34A", border: "#BBF7D0", Icon: Check },
  "needs-review": { bg: "#FEF3C7", fg: "#D97706", border: "#FDE68A", Icon: AlertTriangle },
  "operator-corrected": { bg: "#EDE9FE", fg: "#7C3AED", border: "#DDD6FE", Icon: PencilLine },
} as const;

function fieldBorder(ocr: OcrValue<string> | OcrValue<number>) {
  // Confidence 0 = manually keyed row — neutral border, no OCR signal.
  return ocr.confidence === 0 ? "#E2E8F0" : OCR_STATE_STYLE[ocr.state].border;
}

function FieldChrome({
  label,
  ocr,
  children,
}: {
  label: string;
  ocr: OcrValue<string> | OcrValue<number>;
  children: ReactNode;
}) {
  const manual = ocr.confidence === 0;
  const s = OCR_STATE_STYLE[ocr.state];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        {manual ? (
          <span className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center bg-[#F1F5F9] text-[#64748B]">
            Manual
          </span>
        ) : (
          <span
            className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1"
            style={{ backgroundColor: s.bg, color: s.fg }}
          >
            <s.Icon size={10} strokeWidth={2.5} />
            {ocr.state === "operator-corrected"
              ? "Corrected"
              : `${Math.round(ocr.confidence * 100)}%`}
          </span>
        )}
      </div>
      {children}
      {!manual && ocr.state === "operator-corrected" && (
        <span className="text-[10px] text-[#7C3AED]">
          OCR read {String(ocr.extracted)} · corrected by {ocr.correctedBy}
        </span>
      )}
      {!manual && ocr.state === "needs-review" && (
        <span className="text-[10px] text-[#D97706]">
          Below {Math.round(OCR_CONFIDENCE_THRESHOLD * 100)}% threshold — operator confirmation
          required
        </span>
      )}
    </div>
  );
}

function GoodsField({ ocr, onChange }: { ocr: OcrValue<string>; onChange: (v: string) => void }) {
  return (
    <FieldChrome label="Goods category" ocr={ocr}>
      <select
        value={ocr.value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-2.5 rounded-lg border bg-white text-[13px] outline-none cursor-pointer w-full"
        style={{ borderColor: fieldBorder(ocr) }}
      >
        <option value="" disabled>
          Select category…
        </option>
        {GOODS_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </FieldChrome>
  );
}

function NumberField({
  label,
  ocr,
  step,
  onChange,
}: {
  label: string;
  ocr: OcrValue<number>;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <FieldChrome label={label} ocr={ocr}>
      <input
        type="number"
        min={0}
        step={step}
        value={ocr.value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 px-2.5 rounded-lg border bg-white text-[13px] font-mono outline-none w-full"
        style={{ borderColor: fieldBorder(ocr) }}
      />
    </FieldChrome>
  );
}
