"use client";

/**
 * P9-6 · Airmail dispatch detail — the FC-18 record, M26.
 *
 * THE POINT OF THIS SCREEN IS §04 → §05.
 *
 * CMTS put `LOOSEPARCELSGROSSWT` and `LOOSEPARCELSPHYSICALWT` side by side
 * with an `IRREGULARITY varchar(40)` beside them and nothing anywhere saying
 * how far apart the first two may drift before the third gets written. The
 * threshold lived in an operator's head, which is why no two clerks agreed
 * and why the column could never be reported on.
 *
 * So the variance strip below is not decoration. It shows the measured delta,
 * the tolerance it is being tested against, the absolute floor under that
 * tolerance, and the kilograms of headroom left — and it shows them whether
 * or not the dispatch is in trouble, because a rule you can only see when it
 * trips is a rule nobody can argue with in advance.
 *
 * And when it does trip, the result is a `MailIrregularity` — a CN-43
 * verification note with a status, a notification trail and an instruction —
 * not a label. The legacy 40-character column is rendered underneath it,
 * truncated exactly as the migration would truncate it, which is the clearest
 * available argument for why the free-text column should not be the source of
 * truth.
 *
 * WHAT IS NOT HERE: an AWB number, a consignee, a piece count. A postal
 * dispatch has none of them.
 */

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  FileText,
  Landmark,
  Scale,
  Send,
  Signature,
  XCircle,
} from "lucide-react";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { AuditStrip } from "@/components/primitives";
import { formatDate, formatDateTime, formatKg } from "@/lib/domain";
import {
  AIRMAIL_STAGE_LABEL,
  AIRMAIL_STAGE_ORDER,
  AIRMAIL_WEIGHT_TOLERANCE,
  DUTIABLE_OUTCOME_LABEL,
  MAIL_IRREGULARITY_KIND_LABEL,
  MAIL_IRREGULARITY_STATUS_LABEL,
  RECEPTACLE_CONDITION_LABEL,
  RECEPTACLE_KIND_LABEL,
  VARIANCE_DIRECTION_LABEL,
  dispatchVariance,
  evaluateOnwardTransfer,
  isIrregularityOpen,
  legacyIrregularityText,
  mailTypeZone,
  receptacleDeltaKg,
  type AirmailDispatch,
} from "@/lib/domain/airmail";
import AirmailNav from "../AirmailNav";
import { Card, Chip, Field, IrregularityChip, Kpi } from "../ui";

type Tab = "weights" | "bill" | "storage" | "onward" | "customs";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "weights", label: "§03–05 · Weights & irregularity" },
  { key: "bill", label: "AIRMAILDELIVERYBILL (24 of 25)" },
  { key: "storage", label: "§06 · Segregation" },
  { key: "onward", label: "§07–08 · Onward leg" },
  { key: "customs", label: "§09 · Customs" },
];

export default function DispatchDetail({ dispatch: d }: { dispatch: AirmailDispatch }) {
  const [tab, setTab] = useState<Tab>("weights");

  const v = dispatchVariance(d);
  const gate = evaluateOnwardTransfer(d);
  const irr = d.irregularity;
  const irrOpen = irr !== null && isIrregularityOpen(irr);

  // The threshold §04 actually tests against: the percentage, floored.
  const thresholdKg = Math.max(v.toleranceKg, v.floorKg);
  const absDelta = Math.abs(v.measure.delta);
  const meterPct = thresholdKg === 0 ? 0 : Math.min(100, (absDelta / thresholdKg) * 100);

  const rail: RailStep[] = AIRMAIL_STAGE_ORDER.map((s) => ({
    key: s,
    label: AIRMAIL_STAGE_LABEL[s],
    detail:
      s === "AM01-received"
        ? `${d.arrivedFlight} · ${formatDateTime(d.arrivedAt)}`
        : s === "AM02-identified"
          ? `${d.poOrigin.code} → ${d.poDestination.code} · ${d.mailType.Abbreviation}`
          : s === "AM03-weighed"
            ? `${d.receptacles.filter((r) => r.weighedKg !== null).length} of ${d.receptacles.length} on the scale`
            : s === "AM04-variance-checked"
              ? v.pending
                ? "Not asked yet — §03 incomplete"
                : v.beyondTolerance
                  ? `Yes — ${absDelta.toFixed(2)} kg past a ${thresholdKg.toFixed(2)} kg threshold`
                  : `No — ${formatKg(v.headroomKg)} headroom`
              : s === "AM05-irregularity"
                ? irr
                  ? `${irr.cn43Ref} · ${MAIL_IRREGULARITY_STATUS_LABEL[irr.status]}`
                  : "Not raised"
                : s === "AM06-segregated"
                  ? d.segregation.length
                    ? `${d.segregation.length} mail type(s) · ${[...new Set(d.segregation.map((x) => x.zoneCode))].join(", ")}`
                    : "Not segregated"
                  : s === "AM07-onward-decided"
                    ? d.onwardLegRequired
                      ? "Yes — transfer manifest required"
                      : "No — terminates here"
                    : s === "AM08-transfer-manifested"
                      ? (d.transfer?.TRANSFERNO ?? "No manifest raised")
                      : s === "AM09-customs-presented"
                        ? d.customs
                          ? DUTIABLE_OUTCOME_LABEL[d.customs.outcome]
                          : "Nothing dutiable"
                        : s === "AM10-handed-over"
                          ? d.handedOverAt
                            ? `${formatDateTime(d.handedOverAt)} · ${d.bill.Deliverdto ?? "recipient not recorded"}`
                            : "Not handed over"
                          : s === "AM11-closed"
                            ? d.closedAt
                              ? formatDateTime(d.closedAt)
                              : "Open"
                            : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <AirmailNav
        crumb={d.dispatchNo}
        title={d.dispatchNo}
        subtitle={
          <>
            {d.mailType.MailType} · {d.poOrigin.name} → {d.poDestination.name} · received off{" "}
            {d.arrivedFlight} against delivery bill{" "}
            <span className="font-mono text-[#0F172A]">{d.av7No}</span>
          </>
        }
      />

      {/* ---- The §04 strip. Always visible, whatever tab is open. ---- */}
      <div
        className="rounded-[16px] border px-5 py-4"
        style={
          v.pending
            ? { borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }
            : v.beyondTolerance
              ? { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }
              : { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }
        }
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Scale
              size={16}
              style={{ color: v.pending ? "#64748B" : v.beyondTolerance ? "#DC2626" : "#16A34A" }}
            />
            <h2 className="text-[15px] font-bold text-[#0F172A]">
              §04 — gross versus physical against tolerance
            </h2>
          </div>
          <span
            className="h-[24px] px-3 rounded-full text-[11px] font-bold inline-flex items-center"
            style={
              v.pending
                ? { backgroundColor: "#F1F5F9", color: "#64748B" }
                : v.beyondTolerance
                  ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  : { backgroundColor: "#DCFCE7", color: "#16A34A" }
            }
          >
            {v.pending
              ? "NOT WEIGHED — DECISION NOT YET ASKED"
              : v.beyondTolerance
                ? "YES — BEYOND TOLERANCE, §05 RAISED"
                : "NO — INSIDE TOLERANCE"}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-3 mt-4">
          <Field
            label="AV7 gross"
            cmts="LOOSEPARCELSGROSSWT"
            value={formatKg(d.weights.looseParcelsGrossKg)}
            mono
          />
          <Field
            label="Physical"
            cmts="LOOSEPARCELSPHYSICALWT"
            value={v.pending ? null : formatKg(d.weights.looseParcelsPhysicalKg)}
            mono
          />
          <Field
            label="Variance"
            value={
              v.pending
                ? null
                : `${v.measure.delta > 0 ? "+" : ""}${v.measure.delta.toFixed(2)} kg · ${(
                    v.measure.ratio * 100
                  ).toFixed(2)}%`
            }
            mono
            tone={v.pending ? "muted" : v.beyondTolerance ? "bad" : "ok"}
          />
          <Field
            label="Tolerance"
            value={`${(AIRMAIL_WEIGHT_TOLERANCE * 100).toFixed(1)}% = ${v.toleranceKg.toFixed(
              2,
            )} kg · floor ${v.floorKg.toFixed(2)} kg`}
            mono
          />
          <Field
            label="Headroom"
            value={v.pending ? null : `${v.headroomKg.toFixed(2)} kg`}
            mono
            tone={v.pending ? "muted" : v.headroomKg < 0 ? "bad" : "ok"}
          />
        </div>

        {!v.pending && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white border border-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${meterPct}%`,
                  backgroundColor: v.beyondTolerance ? "#DC2626" : "#16A34A",
                }}
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
              {VARIANCE_DIRECTION_LABEL[v.direction]}. The bar is {absDelta.toFixed(2)} kg of the{" "}
              {thresholdKg.toFixed(2)} kg the rule allows — the greater of{" "}
              {(AIRMAIL_WEIGHT_TOLERANCE * 100).toFixed(1)}% of gross and a {v.floorKg.toFixed(2)} kg
              floor. The floor is there so a rounding wobble on a light dispatch does not raise a
              CN-43 a clerk then has to talk their way out of.{" "}
              <span className="font-semibold">
                Both the tolerance and the floor are AirVault&apos;s — CMTS has no tolerance column,
                so SAPS have never had to state this number.
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Receptacles"
          value={String(d.receptacles.length)}
          note={`${d.receptacles.filter((r) => r.weighedKg === null).length} not presented`}
          tone={d.receptacles.some((r) => r.weighedKg === null) ? "#D97706" : "#0F172A"}
        />
        <Kpi
          label="Declared on tags"
          value={formatKg(d.weights.declaredReceptacleKg)}
          note="Sum of the CN-35 tag weights"
        />
        <Kpi
          label="On the scale"
          value={formatKg(d.weights.weighedReceptacleKg)}
          note="Excludes receptacles never presented"
        />
        <Kpi
          label="Dutiable items"
          value={d.customs ? String(d.customs.cn22Count + d.customs.cn23Count) : "0"}
          note={d.customs ? DUTIABLE_OUTCOME_LABEL[d.customs.outcome] : "Nothing dutiable"}
          tone={d.customs?.outcome === "detained" ? "#DC2626" : "#0F172A"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <StageRail
          steps={rail}
          currentKey={d.stage}
          title="FC-18 progress"
          tone="#7C3AED"
          note="§10 (tariff vs Post Office contract) and §12 (closed and archived) have no stage here: §10 is BLK-01 and unanswerable without an airmail rate, and §12 folds into M20 audit & archive."
        />

        <div className="xl:col-span-2 flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                style={{
                  backgroundColor: tab === t.key ? "#0B2545" : "#FFFFFF",
                  color: tab === t.key ? "#FFFFFF" : "#475569",
                  borderColor: tab === t.key ? "#0B2545" : "#E2E8F0",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---------------- §03–05 ---------------- */}
          {tab === "weights" && (
            <>
              <Card
                title="§03 · Receptacles counted and weighed"
                icon={<Boxes size={15} />}
                subtitle="An AirVault addition — CMTS records Packages and Weight on the bill and nothing beneath them, so a legacy short dispatch could say the total was short but never which receptacle was."
                footer="A receptacle is a closed unit with its own UPU identifier and its own tag weight. It is deliberately not modelled as a Piece: flattening receptacles into pieces would lose exactly the fact §04 needs."
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="bg-white border-b border-[#E2E8F0]">
                        {[
                          "Receptacle (UPU)",
                          "Kind",
                          "Type",
                          "CN-35 tag",
                          "Scale",
                          "Delta",
                          "Condition",
                          "Dutiable",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3 whitespace-nowrap text-[#0B2545]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.receptacles.map((r) => {
                        const delta = receptacleDeltaKg(r);
                        const missing = r.weighedKg === null;
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-[#F1F5F9] last:border-0"
                            style={{
                              backgroundColor: missing
                                ? "#FEF2F2"
                                : r.condition !== "sound"
                                  ? "#FFFBEB"
                                  : undefined,
                            }}
                          >
                            <td className="px-4 py-2.5 font-mono text-[11px] text-[#0F172A] whitespace-nowrap">
                              {r.receptacleNo}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                              {RECEPTACLE_KIND_LABEL[r.kind]}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-[#475569]">
                              {r.mailTypeAbb}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-[#0F172A] whitespace-nowrap">
                              {r.declaredKg.toFixed(2)} kg
                            </td>
                            <td className="px-4 py-2.5 text-[12px] whitespace-nowrap">
                              {missing ? (
                                <span className="text-[#CBD5E1]">—</span>
                              ) : (
                                <span className="text-[#0F172A]">{r.weighedKg?.toFixed(2)} kg</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] whitespace-nowrap">
                              {delta === null ? (
                                <span className="text-[#DC2626] font-semibold">
                                  −{r.declaredKg.toFixed(2)} kg
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color:
                                      Math.abs(delta) >= 1
                                        ? "#DC2626"
                                        : delta === 0
                                          ? "#94A3B8"
                                          : "#475569",
                                    fontWeight: Math.abs(delta) >= 1 ? 700 : 500,
                                  }}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {delta.toFixed(2)} kg
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-[#475569]">
                                  {RECEPTACLE_CONDITION_LABEL[r.condition]}
                                </span>
                                {!r.sealIntact && (
                                  <Chip bg="#FEE2E2" fg="#DC2626">
                                    SEAL
                                  </Chip>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-[#475569]">
                              {r.dutiableItems || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {irr ? (
                <Card
                  title={`§05 · ${MAIL_IRREGULARITY_KIND_LABEL[irr.kind]} — ${irr.cn43Ref}`}
                  icon={<AlertTriangle size={15} />}
                  subtitle="A CN-43 verification note is the real postal instrument — what one administration raises against another when a dispatch arrives irregular. CMTS reduced it to 40 characters of free text."
                  right={<IrregularityChip open={irrOpen} />}
                >
                  <div className="p-5 flex flex-col gap-4">
                    <p className="text-[12px] text-[#334155] leading-relaxed">{irr.narrative}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3">
                      <Field label="Status" value={MAIL_IRREGULARITY_STATUS_LABEL[irr.status]} />
                      <Field label="Raised" value={`${formatDateTime(irr.raisedAt)} · ${irr.raisedBy}`} />
                      <Field
                        label="Observed gross"
                        value={formatKg(irr.observedGrossKg)}
                        mono
                      />
                      <Field
                        label="Observed physical"
                        value={formatKg(irr.observedPhysicalKg)}
                        mono
                      />
                      <Field
                        label="Variance frozen at raising"
                        value={`${irr.varianceKg.toFixed(2)} kg · ${(irr.varianceRatio * 100).toFixed(2)}%`}
                        mono
                        tone="bad"
                      />
                      <Field
                        label="Tolerance in force"
                        value={`${(irr.toleranceApplied * 100).toFixed(1)}%`}
                        mono
                      />
                      <Field
                        label="Post Office notified"
                        value={irr.poNotifiedAt ? formatDateTime(irr.poNotifiedAt) : null}
                      />
                      <Field
                        label="Carrier notified"
                        value={irr.airlineNotifiedAt ? formatDateTime(irr.airlineNotifiedAt) : null}
                      />
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                        Receptacles implicated
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {irr.receptaclesAffected.map((n) => (
                          <span
                            key={n}
                            className="font-mono text-[11px] px-2 py-1 rounded bg-[#FEF2F2] text-[#991B1B]"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1.5">
                        The note names units, not just a total. That is the whole reason the
                        receptacle table above exists.
                      </p>
                    </div>

                    {irr.instructionText && (
                      <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
                        <p className="text-[11px] font-semibold text-[#166534] uppercase tracking-wider">
                          Instruction received
                          {irr.instructionReceivedAt
                            ? ` · ${formatDateTime(irr.instructionReceivedAt)}`
                            : ""}
                        </p>
                        <p className="text-[12px] text-[#166534] mt-1 leading-relaxed">
                          {irr.instructionText}
                        </p>
                      </div>
                    )}

                    {/* The legacy column, derived and truncated. */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                          What migrates back into CMTS
                        </span>
                        <span className="text-[9px] font-mono text-[#94A3B8]">
                          IRREGULARITY varchar(40)
                        </span>
                      </div>
                      <p className="font-mono text-[12px] text-[#0F172A] mt-1.5 px-3 py-2 rounded-lg bg-white border border-[#E2E8F0] inline-block">
                        {legacyIrregularityText(irr)}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
                        Derived from the record above, never keyed — and truncated to the column&apos;s
                        real width. Everything else on this card is what forty characters cannot
                        hold: the status, the two notifications, the instruction, and which
                        receptacles were implicated. This is the argument for the record being the
                        source and the column being its shadow.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                      <p className="text-[11px] text-[#92400E] leading-relaxed">
                        <span className="font-semibold">Open question, recorded rather than hidden.</span>{" "}
                        FC-18&apos;s amendment says an airmail irregularity should be raised through
                        the FC-04 CDR mechanism with the dispatch number as the entity, so there is
                        one record of one fact rather than two.{" "}
                        <span className="font-mono">CDR</span> currently requires an{" "}
                        <span className="font-mono">awbId</span>,{" "}
                        <span className="font-mono">AWBNO</span> and{" "}
                        <span className="font-mono">IGMNO</span>, and a postal dispatch has no air
                        waybill — so <span className="font-mono">cdrRef</span> is{" "}
                        <span className="font-mono">{String(irr.cdrRef)}</span> until the CDR entity
                        accepts a dispatch. Widening it is a change to a file this module does not
                        own.
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <Link
                      href="/airmail/irregularities"
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                    >
                      All CN-43 notes <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card
                  title="§05 · No irregularity raised"
                  icon={<CheckCircle2 size={15} />}
                  subtitle="§04 answered No, so §05 never ran."
                >
                  <div className="px-5 py-4">
                    <p className="text-[12px] text-[#475569] leading-relaxed">
                      {v.pending
                        ? "The dispatch has not been through the scale yet, so §04 has not been asked. A physical weight of zero against a declared gross is not a 100% variance — it is an absent measurement, and the register says so rather than raising a note nobody can act on."
                        : `The measured difference is ${absDelta.toFixed(2)} kg against a ${thresholdKg.toFixed(2)} kg threshold, leaving ${v.headroomKg.toFixed(2)} kg of headroom. The legacy IRREGULARITY column stays null.`}
                    </p>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ---------------- The delivery bill ---------------- */}
          {tab === "bill" && (
            <Card
              title="Delivery bill — the AV7"
              icon={<FileText size={15} />}
              subtitle="AIRMAILDELIVERYBILL · 24 modelled columns of 25; the surrogate Id is excluded because with no backend a database identity carries no meaning."
              footer={
                <>
                  Column names carrying <span className="font-mono font-semibold">?</span> are
                  modelled: the migration reports give this table&apos;s column count and seven of
                  its concepts, not its column names. Hover any token for its status. Spellings such
                  as <span className="font-mono">ManifiestId</span>,{" "}
                  <span className="font-mono">PODESTINATIONs</span>,{" "}
                  <span className="font-mono">Deliverdto</span> and{" "}
                  <span className="font-mono">PartOrShortPackeges</span> are deliberate and must not
                  be tidied — this schema really does contain{" "}
                  <span className="font-mono">RECIEVEDBY</span>,{" "}
                  <span className="font-mono">GrosssWeight</span> and{" "}
                  <span className="font-mono">Nonuseabel</span>.
                </>
              }
            >
              <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                <Field label="Manifest" cmts="ManifiestId" value={String(d.bill.ManifiestId)} mono />
                <Field label="IGM number" cmts="IGMNO" value={d.bill.IGMNO} mono />
                <Field label="Flight" cmts="FLIGHT" value={d.bill.FLIGHT} mono />
                <Field label="Registration" cmts="REGNO" value={d.bill.REGNO} mono />
                <Field
                  label="Cargo date"
                  cmts="CARGODATE"
                  value={d.bill.CARGODATE ? formatDateTime(d.bill.CARGODATE) : null}
                />
                <Field label="Airline" cmts="AIRLINENAME" value={d.bill.AIRLINENAME} />
                <Field label="Origin" cmts="ORIGIN" value={d.bill.ORIGIN} mono />
                <Field label="Destination" cmts="DESTINATION" value={d.bill.DESTINATION} mono />
                <Field label="Shipment type" cmts="ShipmentType" value={d.bill.ShipmentType} mono />
                <Field label="Dispatch number" cmts="MailDispatch" value={d.bill.MailDispatch} mono />
                <Field
                  label="PO of origin"
                  cmts="POORIGIN"
                  value={d.bill.POORIGIN ? `${d.bill.POORIGIN} — ${d.poOrigin.name}` : null}
                />
                <Field
                  label="PO of destination"
                  cmts="PODESTINATIONs"
                  value={
                    d.bill.PODESTINATIONs
                      ? `${d.bill.PODESTINATIONs} — ${d.poDestination.name}`
                      : null
                  }
                />
                <Field
                  label="Mail type"
                  cmts="MailType"
                  value={`${d.bill.MailType} — ${d.mailType.MailType}`}
                />
                <Field label="Receptacles" cmts="Packages" value={String(d.bill.Packages)} mono />
                <Field label="Declared weight" cmts="Weight" value={`${d.bill.Weight} kg`} mono />
                <Field
                  label="Loose parcels gross"
                  cmts="LOOSEPARCELSGROSSWT"
                  value={d.bill.LOOSEPARCELSGROSSWT.toFixed(3)}
                  mono
                />
                <Field
                  label="Loose parcels physical"
                  cmts="LOOSEPARCELSPHYSICALWT"
                  value={d.bill.LOOSEPARCELSPHYSICALWT.toFixed(3)}
                  mono
                  tone={v.beyondTolerance ? "bad" : "default"}
                />
                <Field
                  label="Irregularity"
                  cmts="IRREGULARITY"
                  value={d.bill.IRREGULARITY}
                  mono
                  tone={d.bill.IRREGULARITY ? "bad" : "default"}
                />
                <Field
                  label="Part / short receptacles"
                  cmts="PartOrShortPackeges"
                  value={d.bill.PartOrShortPackeges === null ? null : String(d.bill.PartOrShortPackeges)}
                  mono
                />
                <Field
                  label="Part / short weight"
                  cmts="PartOrShortWeight"
                  value={d.bill.PartOrShortWeight === null ? null : `${d.bill.PartOrShortWeight} kg`}
                  mono
                />
                <Field
                  label="Transfer status"
                  cmts="TRANSFERSTATUS"
                  value={d.bill.TRANSFERSTATUS ? "1 — onward leg raised" : "0 — no onward leg"}
                  mono
                />
                <Field label="Transfer number" cmts="TRANSFERNO" value={d.bill.TRANSFERNO} mono />
                <Field label="Delivered to" cmts="Deliverdto" value={d.bill.Deliverdto} />
                <Field label="Remarks" cmts="REMARKS" value={d.bill.REMARKS} />
              </div>

              <div className="px-5 pb-5 flex flex-col gap-4">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      AV7 number
                    </span>
                    <span className="text-[9px] font-mono text-[#94A3B8]">
                      AirVault addition on the dispatch
                    </span>
                  </div>
                  <p className="font-mono text-[13px] text-[#0F172A] mt-1">{d.av7No}</p>
                  <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
                    <span className="font-mono">AV7NO</span> exists only on{" "}
                    <span className="font-mono">AIRMAILTRANSFERMANIFEST</span>, not on the delivery
                    bill — so a dispatch that terminates here has no AV7 number anywhere in CMTS,
                    even though §01 receives the mail <em>against</em> that bill. Carried on the
                    dispatch to close the hole, and flagged rather than papered over.
                  </p>
                </div>

                <AuditStrip
                  record={d}
                  extra={[
                    { label: "Dispatch date", value: formatDate(d.dispatchDate) },
                    { label: "Site", value: d.site },
                  ]}
                />
              </div>
            </Card>
          )}

          {/* ---------------- §06 ---------------- */}
          {tab === "storage" && (
            <Card
              title="§06 · Segregated and stored by mail type"
              icon={<Boxes size={15} />}
              subtitle="One row per mail type in this dispatch. A dispatch may mix categories across its receptacles, which is why segregation is per type and not per dispatch."
              footer="No mail-type → zone rule exists in CARGOSUBCLASSLOCATION, so FC-03 cannot allocate airmail today. The zones below are AirVault's, and are the missing rule stated rather than assumed."
            >
              {d.segregation.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="text-[12px] text-[#64748B]">
                    Not segregated yet — the dispatch is at {AIRMAIL_STAGE_LABEL[d.stage]}.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {d.segregation.map((s) => {
                    const zone = mailTypeZone(s.mailTypeAbb);
                    return (
                      <div
                        key={s.mailTypeAbb}
                        className="px-5 py-3.5 flex items-start justify-between gap-3 flex-wrap"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                              {s.mailTypeAbb}
                            </span>
                            <span className="text-[13px] font-medium text-[#0F172A]">
                              {zone.zoneName}
                            </span>
                            {zone.secured && (
                              <Chip bg="#F5F3FF" fg="#7C3AED">
                                SECURE CAGE
                              </Chip>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-0.5">
                            {s.receptacleCount} receptacle(s) · {formatKg(s.weightKg)} · zone{" "}
                            <span className="font-mono">{s.zoneCode}</span> · capacity{" "}
                            {zone.capacityReceptacles}
                          </p>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {s.storedAt ? `${formatDateTime(s.storedAt)} · ${s.storedBy}` : "Not stored"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-[#E2E8F0]">
                <Link
                  href="/airmail/segregation"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Zone board across all dispatches <ArrowUpRight size={12} />
                </Link>
              </div>
            </Card>
          )}

          {/* ---------------- §07–08 ---------------- */}
          {tab === "onward" && (
            <Card
              title={`§07 · Onward leg required? — ${d.onwardLegRequired ? "Yes" : "No"}`}
              icon={<Send size={15} />}
              subtitle={
                d.onwardLegRequired
                  ? "Yes leads to §08, the transfer manifest to the receiving carrier or station. This is airmail's own transfer path — it does not reuse the FC-09 bonded transhipment register."
                  : "No — the dispatch terminates at this station and goes to §09, then to handover against the delivery bill."
              }
              right={
                d.onwardLegRequired ? (
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={
                      gate.canTransfer
                        ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                        : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                    }
                  >
                    {gate.canTransfer ? "CAN TRANSFER" : `${gate.blockedBy.length} BLOCKING`}
                  </span>
                ) : undefined
              }
            >
              {d.onwardLegRequired ? (
                <>
                  <div className="divide-y divide-[#F1F5F9]">
                    {gate.conditions.map((c) => (
                      <div key={c.code} className="px-5 py-3 flex items-start gap-2.5">
                        <span className="flex-shrink-0 mt-0.5">
                          {!c.applicable ? (
                            <span className="h-[15px] w-[15px] rounded-full bg-[#F1F5F9] inline-flex items-center justify-center text-[9px] font-bold text-[#94A3B8]">
                              –
                            </span>
                          ) : c.pass ? (
                            <CheckCircle2 size={15} className="text-[#16A34A]" />
                          ) : (
                            <XCircle size={15} className="text-[#DC2626]" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-medium"
                            style={{ color: c.applicable ? "#0F172A" : "#94A3B8" }}
                          >
                            {c.label}
                          </p>
                          <p
                            className="text-[11px] mt-0.5"
                            style={{
                              color: !c.applicable ? "#94A3B8" : c.pass ? "#64748B" : "#991B1B",
                            }}
                          >
                            {c.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-[#E2E8F0]">
                    <Link
                      href="/airmail/transfer-manifest"
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                    >
                      {d.transfer
                        ? `Transfer manifest ${d.transfer.TRANSFERNO} — all 19 columns`
                        : "Transfer register"}{" "}
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="px-5 py-5 flex flex-col gap-4">
                  <p className="text-[12px] text-[#475569] leading-relaxed">
                    No transfer manifest is raised. <span className="font-mono">TRANSFERSTATUS</span>{" "}
                    stays 0 and <span className="font-mono">TRANSFERNO</span> stays null, which is
                    exactly the case in which CMTS holds no AV7 number for the dispatch at all.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
                    <Field
                      label="§11 · Handed over"
                      value={d.handedOverAt ? formatDateTime(d.handedOverAt) : null}
                    />
                    <Field label="Signed for by" cmts="Deliverdto" value={d.bill.Deliverdto} />
                    <Field label="§12 · Closed" value={d.closedAt ? formatDateTime(d.closedAt) : null} />
                  </div>
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                    <Signature size={15} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#92400E] leading-relaxed">
                      §11 is the airmail equivalent of FC-08&apos;s proof of delivery. Whether it
                      reuses the digital POD pack — signature, CNIC, geo-stamp, photo — is a decision
                      for SAPS, not an assumption, so the handover here records a name and a time and
                      stops there.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ---------------- §09 ---------------- */}
          {tab === "customs" && (
            <Card
              title="§09 · Dutiable postal items presented to customs"
              icon={<Landmark size={15} />}
              subtitle="An open branch in FC-18, and deliberately not FC-06."
              footer="Postal items travel on a CN-22 or CN-23 declaration attached to the item, never on a Single Declaration, so the PSW / WeBOC gateway does not apply and no SD number is ever issued. In the model, singleDeclarationNo is typed as the literal null — an edit that tries to put an SD number on a postal dispatch fails to compile rather than quietly pretending FC-06 covers this."
            >
              {d.customs ? (
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                  <Field label="CN-22 declarations" value={String(d.customs.cn22Count)} mono />
                  <Field label="CN-23 declarations" value={String(d.customs.cn23Count)} mono />
                  <Field
                    label="Outcome"
                    value={DUTIABLE_OUTCOME_LABEL[d.customs.outcome]}
                    tone={
                      d.customs.outcome === "detained"
                        ? "bad"
                        : d.customs.outcome === "released"
                          ? "ok"
                          : "warn"
                    }
                  />
                  <Field
                    label="Presented"
                    value={
                      d.customs.presentedAt
                        ? `${formatDateTime(d.customs.presentedAt)} · ${d.customs.presentedBy}`
                        : null
                    }
                  />
                  <Field label="Customs officer" value={d.customs.customsOfficer} />
                  {/* Typed as the literal `null` in the model — see the footer. */}
                  <Field
                    label="Single Declaration"
                    value={d.customs.singleDeclarationNo}
                    tone="muted"
                    mono
                  />
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                      Receptacles held for presentation
                    </p>
                    {d.customs.receptaclesHeld.length === 0 ? (
                      <p className="text-[12px] text-[#94A3B8]">None held back.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {d.customs.receptaclesHeld.map((n) => (
                          <span
                            key={n}
                            className="font-mono text-[11px] px-2 py-1 rounded"
                            style={
                              d.customs?.outcome === "detained"
                                ? { backgroundColor: "#FEF2F2", color: "#991B1B" }
                                : { backgroundColor: "#F1F5F9", color: "#475569" }
                            }
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.customs.outcome === "detained" && (
                      <p className="text-[11px] text-[#991B1B] mt-1.5 leading-relaxed">
                        Detained receptacles are why this dispatch cannot leave complete — the onward
                        gate reads customs, not just weights.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-5 py-6">
                  <p className="text-[12px] text-[#64748B]">
                    Nothing dutiable in this dispatch — no CN-22 or CN-23 items, so §09 does not run.
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
