"use client";

/**
 * "What does this rate card actually produce?" — resolved, then priced.
 *
 * WHY THIS PANEL EARNS ITS PLACE
 * ------------------------------
 * A rate card you can only read is a rate card nobody can check. The failure
 * this guards against is subtle and expensive: the tariff screen shows one set
 * of numbers, the charge engine bills from another, and nothing on either
 * screen would notice. So this panel does not re-implement pricing — it calls
 * the SAME `calculateCharges()` the vouchers are cut from, feeding it inputs
 * resolved from the card by `resolveChargeInputs()`, and shows every
 * intermediate step.
 *
 * Not one number below is written in this file. Every rate comes from
 * `lib/domain/tariff`, every derived amount from `lib/domain/finance`. The only
 * things this component owns are the four controls and the layout.
 *
 * It also reports where the engine and the card DISAGREE, rather than
 * smoothing it over — the weight/subclass band selection CMTS does and the
 * engine does not (CMTS_SCHEMA_AUDIT §3.2/§3.3), a location band the stay
 * crosses that a single per-day figure cannot express, and the free period the
 * engine grants twice. A tariff screen that hides those is worse than none.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CARGO_SUBCLASSES,
  DEMO_NOW,
  MS_PER_DAY,
  calculateCharges,
  cargoClass,
  dwell,
  formatPkr,
} from "@/lib/domain";
import {
  ILLUSTRATIVE_TARIFF_OVERRIDES,
  overrideStorage,
  rateAssignment,
  resolveChargeInputs,
  resolveOverride,
  type TariffOverride,
} from "@/lib/domain/tariff";
import { CmtsCol } from "@/components/finance-manager/IllustrativeRateCardBanner";

const CONTRACTS = ["", ...new Set(ILLUSTRATIVE_TARIFF_OVERRIDES.map((o) => o.contract))];

function Field({
  label,
  cmts,
  children,
}: {
  label: string;
  cmts?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
        {label}
        {cmts && <CmtsCol name={cmts} />}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] focus:outline-none focus:border-[#1B4F8B]";

function Line({
  label,
  value,
  sub,
  strong,
  muted,
}: {
  label: string;
  value: string;
  sub?: string | null;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-2.5 border-b border-[#E2E8F0] last:border-b-0">
      <div className="min-w-0">
        <span
          className={`text-[13px] ${strong ? "font-bold text-[#0F172A]" : muted ? "text-[#94A3B8]" : "text-[#475569]"}`}
        >
          {label}
        </span>
        {sub && (
          <span className="block text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{sub}</span>
        )}
      </div>
      <span
        className={`font-mono whitespace-nowrap ${
          strong ? "text-[15px] font-bold text-[#0B2545]" : muted ? "text-[13px] text-[#94A3B8]" : "text-[13px] text-[#0F172A]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function GapNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5">
      <span className="text-[11px] leading-relaxed block" style={{ color: "#B45309" }}>
        {children}
      </span>
    </div>
  );
}

export default function ResolutionPreview({
  onOverrideChange,
}: {
  onOverrideChange?: (o: TariffOverride | null) => void;
}) {
  const [subClassId, setSubClassId] = useState(107);
  const [weightKg, setWeightKg] = useState(820);
  const [pieces, setPieces] = useState(4);
  const [dwellDays, setDwellDays] = useState(12);
  const [contract, setContract] = useState("");

  const sub = CARGO_SUBCLASSES.find((s) => s.SUBCLASSID === subClassId)!;
  const cls = cargoClass(sub.CLASSID);
  const assignment = rateAssignment(subClassId);

  const result = useMemo(() => {
    // Dwell is expressed as a control, so the two timestamps the engine wants
    // are derived from the demo's fixed "now" — no Date.now(), so the whole
    // panel is reproducible in a walkthrough.
    const asOf = DEMO_NOW;
    const intakeAt = new Date(Date.parse(DEMO_NOW) - dwellDays * MS_PER_DAY).toISOString();
    const arrivalAt = new Date(Date.parse(intakeAt) - 4 * 3600_000).toISOString();

    const chargeableDaysGuess = Math.max(0, dwellDays - cls.freeDays);
    const resolved = resolveChargeInputs({
      classId: sub.CLASSID,
      subClassId,
      weightKg,
      pieces,
      chargeableDays: chargeableDaysGuess,
    });

    const calc = calculateCharges({
      awbId: 0,
      arrivalAt,
      intakeAt,
      asOf,
      cargoClassId: sub.CLASSID,
      cargoSubClassId: subClassId,
      actualKg: weightKg,
      // Volumetric deliberately under actual so `chargeableKg` resolves to the
      // actual weight — the greater-of rule is exercised by the AWB fixtures,
      // and a second variable here would obscure what this panel is showing.
      volumetricKg: Math.round(weightKg * 0.8),
      handlingRatePerKg: resolved.handlingRatePerKg.value,
      locationChargePerDay: resolved.locationChargePerDay.value,
      taxPercent: resolved.taxPercent.value,
    });

    const aging = dwell(intakeAt, asOf, cls.freeDays, resolved.section82Days);
    const ov = resolveOverride({ classId: sub.CLASSID, contract: contract || null });
    const overrideAmount = ov.override
      ? overrideStorage(ov.override, calc.chargeableDays, calc.chargeableKg)
      : null;

    return { resolved, calc, aging, ov, overrideAmount };
  }, [subClassId, weightKg, pieces, dwellDays, contract, cls.freeDays, sub.CLASSID]);

  const { resolved, calc, aging, ov, overrideAmount } = result;

  // Report the winning override upward so the matrix can highlight the row —
  // one resolution, two views of it, and they cannot disagree. In an effect
  // rather than in render: calling the parent's setter during render is a
  // React error, and the highlight is a consequence of the resolution, not an
  // input to it.
  const winnerId = ov.override?.id ?? null;
  useEffect(() => {
    onOverrideChange?.(ov.override);
  }, [ov.override, onOverrideChange]);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="text-[15px] font-bold text-[#0F172A]">Resolution preview</h2>
        <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed max-w-3xl">
          The card resolved into the arguments the charge engine takes, then priced by that engine —
          the same <span className="font-mono">calculateCharges()</span> a godown-rent voucher is cut
          from. Change a control and every number below moves together.
        </p>
      </div>

      {/* ------------------------- controls ------------------------- */}
      <div className="px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Field label="Subclass" cmts="SUBCLASSID">
          <select
            value={subClassId}
            onChange={(e) => setSubClassId(Number(e.target.value))}
            className={`${INPUT} pr-8`}
          >
            {CARGO_SUBCLASSES.map((s) => (
              <option key={s.SUBCLASSID} value={s.SUBCLASSID}>
                {s.ABBREVATION} — {s.NAME}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Chargeable weight" cmts="CHARGEABLEWEIGHT">
          <input
            type="number"
            min={0}
            value={weightKg}
            onChange={(e) => setWeightKg(Math.max(0, Number(e.target.value)))}
            className={INPUT}
          />
        </Field>

        <Field label="Pieces" cmts="TOTALPIECES">
          <input
            type="number"
            min={1}
            value={pieces}
            onChange={(e) => setPieces(Math.max(1, Number(e.target.value)))}
            className={INPUT}
          />
        </Field>

        <Field label="Dwell days" cmts="DAYS">
          <input
            type="number"
            min={0}
            value={dwellDays}
            onChange={(e) => setDwellDays(Math.max(0, Number(e.target.value)))}
            className={INPUT}
          />
        </Field>

        <Field label="Contract">
          <select
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            className={`${INPUT} pr-8`}
          >
            {CONTRACTS.map((c) => (
              <option key={c || "none"} value={c}>
                {c || "Published card only"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
        {/* -------------------- resolved inputs -------------------- */}
        <div>
          <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <span className="text-[12px] font-bold text-[#0F172A]">Resolved from the card</span>
            <span className="block text-[11px] text-[#64748B] mt-0.5">
              {cls.ABBREVATION} · {sub.ABBREVATION} · zone{" "}
              <span className="font-mono">{assignment.zoneAbbr}</span> ·{" "}
              {resolved.slabsSelected.length} band set
            </span>
          </div>

          <Line
            label="Free days"
            value={String(resolved.freeDays)}
            sub={`Zero-amount rate band derives ${resolved.freeDaysFromZeroBand} — the CMTS way of storing the same allowance`}
          />
          <Line
            label="Handling rate"
            value={`${formatPkr(resolved.handlingRatePerKg.value)} /kg`}
            sub={resolved.handlingRatePerKg.explanation}
          />
          <Line
            label="Location charge"
            value={`${formatPkr(resolved.locationChargePerDay.value)} /day`}
            sub={resolved.locationChargePerDay.explanation}
          />
          <Line
            label="Tax"
            value={`${resolved.taxPercent.value}%`}
            sub={resolved.taxPercent.explanation}
          />
          <Line
            label="Minimum charge floor"
            value={formatPkr(resolved.minimumCharge)}
            sub="CARGOSUBCLASS.MINCHARGES — an alternative to the computed total, never an addition"
          />
          <Line
            label="Section 82 threshold"
            value={`${resolved.section82Days} days`}
            sub={
              aging.longStay
                ? `Past the threshold by ${Math.abs(aging.daysToSection82)} days — disposal pipeline`
                : `${aging.daysToSection82} days remaining · counted on total dwell, not the chargeable remainder`
            }
          />

          <div className="p-4 flex flex-col gap-2">
            {resolved.enginePricesDifferently && (
              <GapNote>
                <span className="font-semibold">Card and engine disagree on the band set.</span> The
                card selects the {sub.ABBREVATION} bands for this weight; the engine prices every
                consignment from the general-cargo light-weight set, because per-subclass and
                per-weight rate selection (CMTS_SCHEMA_AUDIT §3.2/§3.3) is not implemented in{" "}
                <span className="font-mono">finance.ts</span>. The storage figure below is the
                engine&apos;s, not the card&apos;s.
              </GapNote>
            )}
            {resolved.locationBandCrossed && (
              <GapNote>
                <span className="font-semibold">The stay crosses a zone rate band.</span>{" "}
                LOCATIONCHARGES bands this zone by day, and the engine takes a single per-day
                figure, so the escalation is not applied.
              </GapNote>
            )}
            {resolved.freeDays > 0 && (
              <GapNote>
                <span className="font-semibold">The free period is granted twice.</span> The engine
                subtracts {resolved.freeDays} free days, then walks bands whose first{" "}
                {resolved.freeDays} are rated zero — so cargo is effectively free for{" "}
                {resolved.freeDays * 2} days rather than {resolved.freeDays}. It under-bills, which
                is the visible direction, and it is an engine defect rather than a card defect: the
                zero band is how CMTS stores the allowance.
              </GapNote>
            )}
          </div>
        </div>

        {/* -------------------- what the engine produced -------------------- */}
        <div>
          <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <span className="text-[12px] font-bold text-[#0F172A]">Priced by the engine</span>
            <span className="block text-[11px] text-[#64748B] mt-0.5">
              calculateCharges() · tariff version{" "}
              <span className="font-mono">{calc.tariffVersion}</span>
            </span>
          </div>

          <Line
            label="Dwell"
            value={`${calc.totalDays} days`}
            sub="Measured from cargo intake, not flight arrival"
          />
          <Line
            label="Chargeable days"
            value={String(calc.chargeableDays)}
            sub={`${calc.totalDays} dwell − ${calc.freeDays} free`}
          />
          <Line label="Chargeable weight" value={`${calc.chargeableKg} kg`} />

          {calc.slabLines.length === 0 ? (
            <Line
              label="Storage"
              value={formatPkr(0)}
              sub="Still inside the free period — no band produces an amount"
              muted
            />
          ) : (
            calc.slabLines.map((l) => (
              <Line
                key={l.label}
                label={`Storage · ${l.label}`}
                value={formatPkr(l.amount)}
                sub={`${l.daysInBand} day${l.daysInBand === 1 ? "" : "s"} × ${formatPkr(l.ratePerKgPerDay)}/kg/day × ${l.chargeableKg} kg`}
              />
            ))
          )}

          <Line label="Handling" value={formatPkr(calc.handlingAmount)} />
          <Line label="Location charges" value={formatPkr(calc.locationChargesAmount)} />
          {calc.surcharges.map((s) => (
            <Line
              key={s.code}
              label={`Surcharge · ${s.label}`}
              value={formatPkr(s.amount)}
              sub={`${s.percent}% of storage`}
              muted={s.amount === 0}
            />
          ))}
          <Line label="Documentation" value={formatPkr(calc.documentationCharges)} />
          <Line label="Deconsolidation" value={formatPkr(calc.deconsolidationCharges)} />
          <Line label="Special handling" value={formatPkr(calc.specialHandlingCharges)} />
          <Line
            label="Sub-total"
            value={formatPkr(calc.subTotal)}
            sub={
              calc.subTotal === calc.minimumCharges
                ? `Floor applied — components came to less than the ${formatPkr(calc.minimumCharges)} minimum`
                : `Above the ${formatPkr(calc.minimumCharges)} floor, so the floor adds nothing`
            }
          />
          <Line label={`Tax · ${calc.taxPercent}%`} value={formatPkr(calc.taxAmount)} />
          <Line label="Total" value={formatPkr(calc.total)} strong />

          {/* ---------------- override, if one applies ---------------- */}
          <div className="p-4">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
              <span className="text-[12px] font-bold text-[#0F172A] block">
                Negotiated override
              </span>
              <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">{ov.reason}</p>

              {ov.override && overrideAmount && (
                <div className="mt-2.5 pt-2.5 border-t border-[#E2E8F0]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-[#475569]">
                      Storage at the agreed rate
                      <span className="block text-[11px] text-[#64748B] mt-0.5">
                        {overrideAmount.explanation}
                      </span>
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                      {formatPkr(overrideAmount.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mt-2">
                    <span className="text-[12px] text-[#475569]">
                      Against the published card&apos;s storage
                    </span>
                    <span
                      className="font-mono text-[13px] font-semibold whitespace-nowrap"
                      style={{
                        color:
                          overrideAmount.amount < calc.storageAmount ? "#15803D" : "#B91C1C",
                      }}
                    >
                      {overrideAmount.amount < calc.storageAmount ? "−" : "+"}
                      {formatPkr(Math.abs(overrideAmount.amount - calc.storageAmount))}
                    </span>
                  </div>
                </div>
              )}

              {ov.rejected.length > 0 && (
                <p className="text-[11px] text-[#94A3B8] mt-2.5 leading-relaxed">
                  Not applied: {ov.rejected.map((r) => `${r.name} (${r.status})`).join(" · ")}
                </p>
              )}

              {winnerId !== null && (
                <p className="text-[11px] text-[#64748B] mt-2">
                  Highlighted in the matrix below.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
