"use client";

/**
 * P1-6 · M04 Cargo Receipt & Acceptance.
 *
 * FC-01 §13 Acceptance Check → §14 Weighing / Dimensioning / Condition Check.
 * FC-02 terminal lane: counted & weighed → inspected → sorted.
 *
 * `IMPORTAWBDETAIL` (32 cols) carries a short-landing and damage vocabulary
 * the demo did not have — `Shortland` returned **0 hits** before this screen.
 * All 32 columns are represented.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Database,
  PackageCheck,
  Plane,
  ScanLine,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  DAMAGE_TYPES,
  PACK_TYPES,
  VARIANCE_TOLERANCE,
  VOLUMETRIC_DIVISOR,
  chargeableKg,
  detailsFor,
  formatKg,
  listAwbs,
  round2,
  variance,
  volumetricKg,
} from "@/lib/domain";

/**
 * CMTS acceptance lineage.
 *
 * This screen writes `IMPORTAWBDETAIL` and nothing else, which is why the
 * worksheet below carries that one table's name. But CMTS does not record the
 * acceptance *event* there — it records it in a separate trio, and absorbing
 * the legacy cargo-acceptance screen means absorbing those three tables too.
 *
 * The trio is cited on the export side (`app/export/acceptance`) and nowhere
 * on the import side, which left the migration reading as though
 * CARGOACCEPTANCE had no import counterpart. It does: this is the screen. A
 * reader tracing a legacy column has to be able to land here, so the lineage
 * is named on the screen rather than only in the domain layer.
 */
const CMTS_SOURCE_TABLES = [
  {
    table: "CARGOACCEPTANCE",
    meaning: "Acceptance header — receiving agent, station, timestamp, sign-off",
  },
  {
    table: "ACCEPTENCEDETAIL",
    meaning: "Per-line nature of goods, pieces, weight and dimensions",
  },
  {
    table: "CARGOACCEPTANCEHWB",
    meaning: "House breakdown when the accepted consignment is a consolidation",
  },
  {
    table: "IMPORTAWBDETAIL",
    meaning: "The import receipt itself — 32 columns, rendered above",
  },
];

export default function AcceptancePage() {
  const { scope } = useSite();
  const candidates = useMemo(
    () =>
      listAwbs({ scope }).filter((a) =>
        ["indexation", "tagging", "segregation", "acceptance", "stored"].includes(a.stage),
      ),
    [scope],
  );
  const [awbId, setAwbId] = useState<number>(candidates[0]?.AWBId ?? 0);
  const awb = candidates.find((a) => a.AWBId === awbId) ?? candidates[0];
  const details = awb ? detailsFor(awb.AWBId) : [];

  // Live weighing panel — the FC-07 §05/§06 formulas, computed here at acceptance.
  const [dims, setDims] = useState({ l: 120, w: 80, h: 90 });
  const [actual, setActual] = useState(awb?.TOTALWEIGHT ?? 0);
  const vol = volumetricKg({ lengthCm: dims.l, widthCm: dims.w, heightCm: dims.h, unit: "cm" });
  const chargeable = chargeableKg(actual, vol);

  // FC-01 §14 condition-check vocabulary — legacy CMTS acceptance fields (demo mock).
  const [packageCondition, setPackageCondition] = useState<string>("Intact");
  const [sealStatus, setSealStatus] = useState<string>("Unbroken");
  const PACKAGE_CONDITIONS = ["Intact", "Minor damage", "Major damage", "Tampered"] as const;
  const SEAL_STATUSES = ["Unbroken", "Broken — seal #", "Missing", "Re-sealed"] as const;

  // Legacy CMTS HAWB / routing identity + receiving-agent sign-off (demo mock).
  const identity = { hawb: "HWB-DBS-001", flight: "EK 612 · 12 May 2026", origin: "DXB" };
  const receiver = { name: "Ahmed Khan", station: "KHI · AFU", timestamp: "13 May 2026, 14:22" };
  const sealNumber = "SP-238911";

  if (!awb) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "Acceptance" }]} />
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-[#0F172A]">Nothing to accept at {scope}</p>
        </div>
      </div>
    );
  }

  const totalShort = details.reduce((n, d) => n + d.SHORTLANDED, 0);
  const totalDamaged = details.reduce((n, d) => n + d.DAMAGEPCS, 0);
  const totalDeclared = details.reduce((n, d) => n + d.PCS, 0);
  const totalReceived = details.reduce((n, d) => n + d.RECEIVEDPCS, 0);
  const v = variance(totalDeclared, totalReceived);

  // FC-01 §13 acceptance checklist — legacy CMTS sign-off items (demo mock).
  const acceptanceChecklist = [
    { label: "Documents verified", note: "MAWB · HAWB · NOTOC · NOA", done: true },
    {
      label: "Piece count matches manifest",
      note: `${totalReceived} / ${totalDeclared} pieces`,
      done: totalReceived === totalDeclared,
    },
    { label: "Weight within tolerance", note: "±2% variance band", done: !v.overTolerance },
    { label: "Package condition", note: packageCondition, done: packageCondition === "Intact" },
    {
      label: "Seal verification",
      note: `Seal# ${sealNumber} · unbroken`,
      done: sealStatus === "Unbroken",
    },
    { label: "Evidence photos captured", note: "3 photos · top / side / seal", done: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "Cargo Acceptance" }]} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M04
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                FC-01 §13–14
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
              Cargo Receipt &amp; Acceptance
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Piece-by-piece receipt including short-landed, damaged and part-received cargo.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {(
                [
                  ["HAWB", identity.hawb, null],
                  ["Flight", identity.flight, Plane],
                  ["Origin", identity.origin, null],
                ] as const
              ).map(([label, value, Icon]) => (
                <span
                  key={label}
                  className="h-7 px-2.5 rounded-lg border border-[#E2E8F0] bg-white inline-flex items-center gap-1.5 text-[12px]"
                >
                  {Icon ? <Icon size={12} className="text-[#94A3B8]" /> : null}
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="font-mono font-semibold text-[#0F172A]">{value}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Acceptance queue ({candidates.length})
            </span>
            <select
              value={awbId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setAwbId(id);
                const n = candidates.find((a) => a.AWBId === id);
                if (n) setActual(n.TOTALWEIGHT);
              }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none cursor-pointer font-mono"
            >
              {candidates.map((a) => (
                <option key={a.AWBId} value={a.AWBId}>
                  {a.AWBNO} — {a.stage}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Declared pieces", value: totalDeclared, tone: "#0F172A" },
          { label: "Received pieces", value: totalReceived, tone: totalReceived === totalDeclared ? "#16A34A" : "#DC2626" },
          { label: "Short-landed", value: totalShort, tone: totalShort ? "#DC2626" : "#16A34A" },
          { label: "Damaged pieces", value: totalDamaged, tone: totalDamaged ? "#D97706" : "#16A34A" },
          { label: "Variance", value: `${(v.ratio * 100).toFixed(1)}%`, tone: v.overTolerance ? "#DC2626" : "#16A34A" },
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

      {v.overTolerance && (
        <div className="rounded-[16px] border border-[#FECACA] bg-[#FEF2F2] p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#DC2626]">
              Variance exceeds the {Math.round(VARIANCE_TOLERANCE * 100)}% tolerance
            </p>
            <p className="text-[12px] text-[#991B1B] mt-1">
              FC-04 amendment: this auto-raises a CDR — Shortage / Overage / Wrong Weight fall
              straight out of acceptance rather than waiting to be spotted.
            </p>
            <Link
              href={`/awb/${awb.AWBId}?tab=exceptions`}
              className="inline-flex items-center gap-1 h-9 px-3 mt-3 rounded-lg bg-[#DC2626] text-white text-[12px] font-semibold no-underline"
            >
              Open CDR <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* FC-01 §14 weighing & dimensioning */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <Scale size={16} className="text-[#64748B]" />
          <h2 className="text-[16px] font-semibold text-[#0F172A]">
            §14 · Weighing &amp; dimensioning
          </h2>
        </div>
        <p className="text-[13px] text-[#64748B]">
          Chargeable weight is computed here, not at billing — FC-07 §05–06 uses these values.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-5">
          {(
            [
              ["Length (cm)", dims.l, (n: number) => setDims({ ...dims, l: n })],
              ["Width (cm)", dims.w, (n: number) => setDims({ ...dims, w: n })],
              ["Height (cm)", dims.h, (n: number) => setDims({ ...dims, h: n })],
              ["Actual weight (kg)", actual, (n: number) => setActual(n)],
            ] as const
          ).map(([label, val, set]) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                {label}
              </span>
              <input
                type="number"
                value={val}
                onChange={(e) => set(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-mono outline-none focus:border-[#2E75B6]"
              />
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Volumetric
            </span>
            <div className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center text-[13px] font-mono font-semibold text-[#0F172A]">
              {vol}
            </div>
            <span className="text-[10px] text-[#94A3B8] font-mono">
              L×W×H / {VOLUMETRIC_DIVISOR}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Chargeable
            </span>
            <div
              className="h-10 px-3 rounded-lg border flex items-center text-[13px] font-mono font-bold"
              style={{
                borderColor: chargeable === vol ? "#FDE68A" : "#BBF7D0",
                backgroundColor: chargeable === vol ? "#FFFBEB" : "#F0FDF4",
                color: chargeable === vol ? "#D97706" : "#16A34A",
              }}
            >
              {chargeable}
            </div>
            <span className="text-[10px] text-[#94A3B8] font-mono">max(actual, volumetric)</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Billed on
            </span>
            <div className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center text-[13px] font-semibold text-[#0F172A]">
              {chargeable === vol && vol > actual ? "Volume" : "Weight"}
            </div>
          </div>
        </div>

        {/* FC-01 §14 condition check — package condition + seal verification */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6 pt-5 border-t border-[#E2E8F0]">
          {/* Package condition */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <PackageCheck size={14} className="text-[#64748B]" />
              <span className="text-[12px] font-semibold text-[#0F172A]">Package condition</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PACKAGE_CONDITIONS.map((c) => {
                const active = packageCondition === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPackageCondition(c)}
                    className="h-8 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center transition-colors"
                    style={{
                      borderColor: active ? "#2E75B6" : "#E2E8F0",
                      backgroundColor: active ? "#EBF0F7" : "#FFFFFF",
                      color: active ? "#0B2545" : "#64748B",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seal verification */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#64748B]" />
              <span className="text-[12px] font-semibold text-[#0F172A]">Seal verification</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SEAL_STATUSES.map((s) => {
                const active = sealStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSealStatus(s)}
                    className="h-8 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center transition-colors"
                    style={{
                      borderColor: active ? "#2E75B6" : "#E2E8F0",
                      backgroundColor: active ? "#EBF0F7" : "#FFFFFF",
                      color: active ? "#0B2545" : "#64748B",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="flex items-end gap-3 flex-wrap mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Seal number
                </span>
                <input
                  type="text"
                  defaultValue={sealNumber}
                  className="h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-mono outline-none focus:border-[#2E75B6]"
                />
              </div>
              <button
                type="button"
                className="h-10 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-[#0F172A] inline-flex items-center gap-2"
              >
                <ScanLine size={14} className="text-[#64748B]" />
                Scan seal barcode
              </button>
            </div>
          </div>
        </div>

        {/* General acceptance evidence */}
        <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
          <button
            type="button"
            className="h-10 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-[#0F172A] inline-flex items-center gap-2"
          >
            <Camera size={14} className="text-[#64748B]" />
            Capture evidence photo
          </button>
        </div>
      </div>

      {/* IMPORTAWBDETAIL — all 32 columns across the line rows */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">Acceptance worksheet</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            CMTS IMPORTAWBDETAIL — 32 columns, one row per detail line
          </p>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {details.map((d) => (
            <div key={d.DetailId} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#64748B]">Line {d.SEQUENCE}</span>
                  <span className="text-[13px] font-semibold text-[#0F172A]">{d.GOODS}</span>
                </div>
                <div className="flex items-center gap-2">
                  {d.SHORTLANDED > 0 && (
                    <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#FEE2E2] text-[#DC2626]">
                      {d.SHORTLANDED} short-landed
                    </span>
                  )}
                  {d.DAMAGEPCS > 0 && (
                    <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#FEF3C7] text-[#D97706]">
                      {d.DAMAGEPCS} damaged
                    </span>
                  )}
                  {d.Shipment === "PART" && (
                    <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#DBEAFE] text-[#1B4F8B]">
                      part shipment
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-4">
                {(
                  [
                    ["PCS", d.PCS, "declared"],
                    ["RECEIVEDPCS", d.RECEIVEDPCS, d.RECEIVEDPCS < d.PCS ? "short" : "ok"],
                    ["WEIGTH", round2(d.WEIGTH), "declared"],
                    ["RECEIVEDWT", round2(d.RECEIVEDWT), d.RECEIVEDWT < d.WEIGTH ? "short" : "ok"],
                    ["CHARGEWEIGTH", round2(d.CHARGEWEIGTH), "declared"],
                    ["CHARGEDRECEIVEDWT", round2(d.CHARGEDRECEIVEDWT), "ok"],
                    ["SHORTLANDED", d.SHORTLANDED, d.SHORTLANDED ? "short" : "ok"],
                    ["SHORTLANDEDREC", d.SHORTLANDEDREC, "ok"],
                    ["IsShortDetailed", d.IsShortDetailed ? "Yes" : "No", d.IsShortDetailed ? "short" : "ok"],
                    ["PartRemaining", d.PartRemaining, d.PartRemaining ? "short" : "ok"],
                    ["PartReceievd", d.PartReceievd, "ok"],
                    ["Shipment", d.Shipment, "ok"],
                    ["TYPEOFPACK", d.TYPEOFPACK, "ok"],
                    ["TYPEOFDAM", d.TYPEOFDAM, d.TYPEOFDAM ? "damage" : "ok"],
                    ["DAMAGEPCS", d.DAMAGEPCS, d.DAMAGEPCS ? "damage" : "ok"],
                    ["DAMAGEWEIGHT", round2(d.DAMAGEWEIGHT), d.DAMAGEWEIGHT ? "damage" : "ok"],
                    ["ClassId", d.ClassId, "ok"],
                    ["SplitClassId", d.SplitClassId, "ok"],
                    ["DetendUniqueIdentification", d.DetendUniqueIdentification, "ok"],
                    ["UniqueIdentification", d.UniqueIdentification, "ok"],
                    ["IsLock", d.IsLock ? "Yes" : "No", "ok"],
                    ["IsHold", d.IsHold ? "Yes" : "No", d.IsHold ? "damage" : "ok"],
                    ["Remarks", d.Remarks, "ok"],
                    ["DFLAG", d.DFLAG ? "Y" : "N", "ok"],
                  ] as const
                ).map(([k, val, tone]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-[#CBD5E1] truncate">{k}</span>
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{
                        color:
                          tone === "short" ? "#DC2626" : tone === "damage" ? "#D97706" : tone === "declared" ? "#64748B" : "#0F172A",
                      }}
                    >
                      {val === null || val === undefined || val === "" ? "—" : String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {d.DEMAGEDETAIL && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 flex items-start gap-2">
                    <Camera size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-[#D97706]">Damage detail</p>
                      <p className="text-[12px] text-[#92400E] mt-0.5">{d.DEMAGEDETAIL}</p>
                      <p className="text-[11px] text-[#A16207] mt-1">
                        Photos attach to the AWB evidence pack (M02) and feed DamageDetail at P3-2.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reference lists — feed P10-3 master data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
          <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">Pack types</h3>
          <div className="flex flex-wrap gap-2">
            {PACK_TYPES.map((p) => (
              <span
                key={p}
                className="h-7 px-2.5 rounded-full bg-[#F1F5F9] text-[#0F172A] text-[12px] font-medium inline-flex items-center"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
          <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">Damage types</h3>
          <div className="flex flex-wrap gap-2">
            {DAMAGE_TYPES.map((p) => (
              <span
                key={p}
                className="h-7 px-2.5 rounded-full bg-[#FEF3C7] text-[#D97706] text-[12px] font-medium inline-flex items-center"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FC-01 §13 acceptance checklist + receiving-agent sign-off */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 size={16} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">Acceptance checklist</h3>
          </div>
          <div className="flex flex-col divide-y divide-[#F1F5F9]">
            {acceptanceChecklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3 py-2.5">
                <span
                  className="h-5 w-5 rounded-full inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: item.done ? "#DCFCE7" : "#FEF3C7",
                    color: item.done ? "#16A34A" : "#D97706",
                  }}
                >
                  {item.done ? <CheckCircle2 size={14} /> : <AlertTriangle size={12} />}
                </span>
                <span className="text-[13px] font-medium text-[#0F172A] flex-1">{item.label}</span>
                <span className="text-[12px] text-[#64748B] font-mono truncate">{item.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Receiving agent sign-off */}
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <UserCheck size={16} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">Receiving agent</h3>
          </div>
          <div className="flex flex-col gap-3">
            {(
              [
                ["Receiver", receiver.name],
                ["Station", receiver.station],
                ["Timestamp", receiver.timestamp],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[13px] font-semibold text-[#0F172A]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="h-10 px-4 rounded-lg bg-[#16A34A] text-white text-[13px] font-semibold inline-flex items-center gap-2"
        >
          <BadgeCheck size={15} />
          Accept &amp; Generate Certificate
        </button>
        <AwbLink
          awbNo={awb.AWBNO}
          awbId={awb.AWBId}
          className="h-10 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold no-underline inline-flex items-center"
        >
          Open on AWB hub
        </AwbLink>
        <Link
          href="/warehouse-manager/putaway"
          className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] no-underline inline-flex items-center"
        >
          Continue to storage allocation
        </Link>
        <span className="text-[12px] text-[#94A3B8]">
          Total accepted: {formatKg(details.reduce((n, d) => n + d.RECEIVEDWT, 0))}
        </span>
      </div>

      {/* CMTS source tables — see CMTS_SOURCE_TABLES above for why the
          acceptance trio is named here and not only on the export side. */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Database size={15} className="text-[#64748B]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">CMTS source tables</h3>
            <p className="text-[11px] text-[#94A3B8]">
              What this screen absorbs from the legacy cargo-acceptance module
            </p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2.5">
          {CMTS_SOURCE_TABLES.map((t) => (
            <div key={t.table} className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] font-semibold text-[#1B4F8B] flex-shrink-0">
                {t.table}
              </span>
              <span className="text-[11px] text-[#64748B]">{t.meaning}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
