"use client";

/**
 * P9-2 / P9-3 · Export acceptance, weighment, screening & chain of custody.
 *
 * CMTS gives `CARGOACCEPTANCE` (31), `ACCEPTENCEDETAIL` (10) and
 * `CARGOACCEPTANCEHWB` (7) — and stops. It has LOADEDWEIGHT / UNLOADEDWEIGHT /
 * LEASHINGWEIGHT / PALLETWEIGHT but nothing saying where the numbers came
 * from, and **no field anywhere** for screening, seals or custody.
 *
 * All three legacy tables are now *rendered* and not merely named: the header
 * in the capture cards, the item lines and house rows in
 * `AcceptanceDetailTables`. The consignment carried typed `lines` and `hwb`
 * from the start while this screen read neither — a table a screen claims but
 * never shows is how a column goes missing at migration unnoticed.
 *
 * Two amendments do the work here:
 *
 *   • **Weighing-scale integration.** A weight that was auto-captured has a
 *     provenance and a tolerance. A weight that was typed has neither, and
 *     the declared-vs-actual variance is exactly the number a shipper has an
 *     incentive to get wrong.
 *
 *   • **Tamper-evident record + chain of custody (ACC3 / known-consignor).**
 *     Screening is a regulated act attributable to a named screener, and the
 *     seal applied after it has to survive every handover. A broken seal at
 *     any handover sends the consignment back to screening — it does not
 *     merely get noted.
 *
 * **Ported in from the retired `/export-cargo/acceptance`** (see
 * PORTAL_AND_DEDUP_PLAN.md §2.1): the named six-document checklist, the cargo
 * class the counter picks, and the `Held` screening state. That screen's
 * storage-allocation control went to `/export/warehousing` instead, because
 * FC-11 puts the put-away at §17 rather than on the acceptance form.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  Layers,
  ListChecks,
  Scale,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Truck,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import ExportCrossStageStrip from "@/components/export/ExportCrossStageStrip";
import AcceptanceCaptureCards, {
  AcceptanceOtherColumns,
} from "@/components/export/acceptance/AcceptanceCaptureCards";
import AcceptanceDetailTables from "@/components/export/acceptance/AcceptanceDetailTables";
import { AuditStrip, FormField, FormCompletenessGate } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXPORT_STAGE_LABEL,
  SCREENING_METHOD_LABEL,
  VARIANCE_TOLERANCE,
  formatDate,
  formatDateTime,
  formatKg,
  listExports,
  type ExportConsignment,
} from "@/lib/domain";

/* ================================================================== *
 * The counter's named document set — ported from /export-cargo/acceptance
 *
 * The canonical card below renders `capturedDocs` generically, which is
 * right for provenance: what paper the value came off, who keyed it, who
 * countersigned. It is wrong for the counter. A clerk does not ask "are the
 * captured documents complete", she asks "have I got the certificate of
 * origin" — and the answer to that is a name, not a count. The retired
 * screen enumerated the six by name, and that enumeration is the half worth
 * keeping.
 *
 * Each row derives its default tick off the record rather than starting
 * checked, because an unticked box is a real state here rather than a
 * styling choice. Two of the six are conditional, and a row that does not
 * apply is shown as not-applicable rather than hidden — so the clerk can see
 * the branch was considered instead of guessing it was forgotten.
 * ================================================================== */

type DocTickState = "captured" | "outstanding" | "not-applicable";

interface CounterDocument {
  code: string;
  label: string;
  /** The paper the clerk reads it off. */
  source: string;
  derive: (c: ExportConsignment) => DocTickState;
}

function hasCapturedDoc(c: ExportConsignment, label: string): boolean {
  return c.capturedDocs.some((d) => d.label.toLowerCase() === label.toLowerCase());
}

/**
 * DGR Declaration and NOTOC ride on one fact: is this consignment classified
 * as dangerous goods. Before E07 that is not yet known, so the row reads
 * outstanding rather than not-applicable — "nobody has checked" and "it does
 * not apply" are different states, and collapsing them is how a DG shipment
 * reaches a ULD with a tidy-looking checklist behind it.
 */
function dgrState(c: ExportConsignment): DocTickState {
  if (!c.classification) return "outstanding";
  if (!c.classification.codes.includes("DGR")) return "not-applicable";
  return c.classification.checks.some((k) => k.code === "DGR" && k.pass) ? "captured" : "outstanding";
}

const COUNTER_DOCUMENTS: CounterDocument[] = [
  {
    code: "INV",
    label: "Commercial Invoice",
    source: "Shipper pack",
    derive: (c) => (hasCapturedDoc(c, "Commercial invoice") ? "captured" : "outstanding"),
  },
  {
    code: "PL",
    label: "Packing List",
    source: "Shipper pack",
    derive: (c) => (hasCapturedDoc(c, "Packing list") ? "captured" : "outstanding"),
  },
  {
    code: "GD",
    label: "Export GD (PSW)",
    source: "PSW single declaration",
    // The export GD is the Single Declaration lodged with PSW. `sdRef` is
    // where the canonical model carries it — it is not a `capturedDocs` row,
    // which is why this one reads off the declaration instead.
    derive: (c) => (c.declaration.sdRef ? "captured" : "outstanding"),
  },
  {
    code: "COO",
    label: "Certificate of Origin",
    source: "Chamber of commerce",
    // Nothing in the domain models a CoO yet, so this starts outstanding on
    // every consignment. Kept visible rather than dropped: most export
    // destinations require one, and a gap that shows is worth more than a
    // checklist that quietly omits the field nobody has built.
    derive: () => "outstanding",
  },
  {
    code: "DGD",
    label: "DGR Declaration",
    source: "Shipper's declaration for dangerous goods",
    derive: dgrState,
  },
  {
    code: "NOTOC",
    label: "NOTOC",
    source: "Notification to captain",
    derive: dgrState,
  },
];

/* ================================================================== *
 * Cargo class at the counter — ported from /export-cargo/acceptance
 *
 * `SpecialHandlingCode` covers the six classes that carry a verification at
 * E07 (DGR / PER / AVI / VAL / HUM / COL). The counter's list is not that
 * list. It needs **GCR** for the general case, which is most consignments and
 * has no special-handling code by definition, and **AOG** for an
 * aircraft-on-ground spare, which is a handling priority rather than a
 * regulated verification. Both are counter vocabulary with no canonical
 * enum member, so the picker is a screen-level list — and CMTS is no help
 * either: `CARGOGROUP` carries GENERAL and `CARGOTYPE` carries EXPORT, and
 * that is the whole legacy classification.
 * ================================================================== */

const COUNTER_CARGO_CLASSES = ["GCR", "DGR", "PER", "VAL", "HUM", "AOG", "AVI"] as const;
type CounterCargoClass = (typeof COUNTER_CARGO_CLASSES)[number];

/** What the record already implies, before the clerk touches the picker. */
function derivedCargoClass(c: ExportConsignment): CounterCargoClass {
  const codes: string[] = c.classification?.codes ?? [];
  return COUNTER_CARGO_CLASSES.find((k) => codes.includes(k)) ?? "GCR";
}

export default function ExportAcceptancePage() {
  const { scope, isHq } = useSite();
  const consignments = useMemo(() => listExports(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(consignments[0]?.id ?? null);
  const c = consignments.find((x) => x.id === selected) ?? consignments[0] ?? null;
  const [tab, setTab] = useState<"acceptance" | "weighment" | "screening">("acceptance");

  /*
   * Three pieces of counter state that the domain has nowhere to put yet, all
   * keyed by consignment id so switching rows does not carry one consignment's
   * work onto the next. Each is an override on a derived default rather than a
   * replacement for it: absent a key, the record's own state stands.
   */
  const [docTicks, setDocTicks] = useState<Record<string, boolean>>({});
  const [cargoClassPick, setCargoClassPick] = useState<Record<number, CounterCargoClass>>({});
  const [heldAtScreening, setHeldAtScreening] = useState<Record<number, string>>({});

  function tickState(cons: ExportConsignment, doc: CounterDocument): DocTickState {
    const base = doc.derive(cons);
    // A row that does not apply cannot be ticked into applying.
    if (base === "not-applicable") return base;
    const key = `${cons.id}:${doc.code}`;
    if (!(key in docTicks)) return base;
    return docTicks[key] ? "captured" : "outstanding";
  }

  /**
   * Membership, not truthiness: the stored value is the *reason* for the
   * hold, and a hold nobody has justified yet is still a hold. Keying on the
   * presence of the entry keeps an empty reason from reading as released.
   */
  const isHeldAtScreening = (id: number) => id in heldAtScreening;

  const brokenCustody = consignments.filter((x) =>
    x.custodyChain.some((e) => e.sealIntact === false),
  );
  const outOfTolerance = consignments.filter((x) => x.weighment && !x.weighment.withinTolerance);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Acceptance & Screening" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §02–03 · §11–14
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              CARGOACCEPTANCE 31 · ACCEPTENCEDETAIL 10 · CARGOACCEPTANCEHWB 7
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              GREENFIELD
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Export Acceptance &amp; Screening
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Scale-captured weights, regulated screening, and a custody chain CMTS has no field for.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <ExportCrossStageStrip
        rows={consignments}
        scopeLabel={isHq ? "All sites" : `${scope} only`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Consignments", value: String(consignments.length), tone: "#0F172A" },
          { label: "Broken seals", value: String(brokenCustody.length), tone: "#DC2626" },
          { label: "Weight out of tolerance", value: String(outOfTolerance.length), tone: "#D97706" },
          {
            label: "Screened & sealed",
            value: String(consignments.filter((x) => x.screening.some((s) => s.sealNo)).length),
            tone: "#16A34A",
          },
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

      {consignments.length === 0 ? (
        <EmptyState
          title="No export consignments at this site"
          description="FC-11 starts at booking; acceptance is §12 at the export counter."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Truck size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Export consignments</h3>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {consignments.map((x) => {
                const broken = x.custodyChain.some((e) => e.sealIntact === false);
                return (
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
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {isHeldAtScreening(x.id) && (
                          <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold inline-flex items-center">
                            HELD
                          </span>
                        )}
                        {broken && (
                          <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                            SEAL BROKEN
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.acceptance.DESTINATION} · {x.acceptance.AIRLINEABB} ·{" "}
                      {x.acceptance.PCSAWB} pcs
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                      {EXPORT_STAGE_LABEL[x.stage]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-mono text-[15px] font-bold text-[#0F172A]">
                      {c.awbNo}
                    </span>
                    <p className="text-[12px] text-[#64748B] mt-1">
                      {c.acceptance.SHIPPERNAME} → {c.acceptance.CONSIGNEENAME} ·{" "}
                      {c.acceptance.ORIGIN} → {c.acceptance.DESTINATION}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-[22px] px-2.5 rounded-full bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center">
                      {c.custodyRegime}
                    </span>
                    <span className="h-[22px] px-2.5 rounded-full bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center">
                      {c.acceptance.PAYMENT}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["acceptance", "Acceptance (31 cols)"],
                    ["weighment", "Weighment"],
                    ["screening", `Screening & custody (${c.custodyChain.length})`],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: tab === v ? "#0B2545" : "#FFFFFF",
                      color: tab === v ? "#FFFFFF" : "#475569",
                      borderColor: tab === v ? "#0B2545" : "#E2E8F0",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "acceptance" && (
                <>
                  {/*
                   * The operator capture set — identity, the clock and scale,
                   * the parties. These lead the tab because they are the order
                   * the counter works in; the residual CARGOACCEPTANCE columns
                   * close it, since a status flag is something the clerk reads
                   * back rather than something she keys.
                   */}
                  <AcceptanceCaptureCards
                    acceptance={c.acceptance}
                    scaleNetKg={c.weighment?.netKg ?? null}
                  />

                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-2">
                      <ClipboardCheck size={15} className="text-[#64748B] mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Export documents — keyed at the counter
                        </h3>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          The shipper hands paper across the counter and the clerk types it. No
                          scanner in this loop — OCR is inbound MAWB/HAWB and receiver docs only.
                        </p>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                      <FormCompletenessGate
                        total={c.capturedDocs.length}
                        outstanding={c.capturedDocs.filter((d) => !d.value.verifiedBy).length}
                        context="Every document is countersigned by the acceptance supervisor before the consignment moves to weighment."
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {c.capturedDocs.map((d) => (
                          <div key={d.label} className="rounded-xl border border-[#E2E8F0] px-4 py-3">
                            <FormField label={d.label} value={d.value} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ported from /export-cargo/acceptance — the named six. */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <ListChecks size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Counter checklist — the six named documents
                        </h3>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          The card above carries provenance for what was keyed. This is the set
                          itself, by name, the way the clerk works through it.
                        </p>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                      {(() => {
                        const states = COUNTER_DOCUMENTS.map((d) => tickState(c, d));
                        const applicable = states.filter((s) => s !== "not-applicable").length;
                        const outstanding = states.filter((s) => s === "outstanding").length;
                        return (
                          <FormCompletenessGate
                            total={applicable}
                            outstanding={outstanding}
                            context="Cargo does not move to weighment on an incomplete set. A document that does not apply to this consignment is marked so rather than left blank."
                          />
                        );
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {COUNTER_DOCUMENTS.map((doc) => {
                          const st = tickState(c, doc);
                          const na = st === "not-applicable";
                          return (
                            <label
                              key={doc.code}
                              className="flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors"
                              style={{
                                borderColor:
                                  st === "captured" ? "#BBF7D0" : na ? "#E2E8F0" : "#FDE68A",
                                backgroundColor:
                                  st === "captured" ? "#F0FDF4" : na ? "#F8FAFC" : "#FFFBEB",
                                cursor: na ? "not-allowed" : "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={st === "captured"}
                                disabled={na}
                                onChange={(e) =>
                                  setDocTicks((prev) => ({
                                    ...prev,
                                    [`${c.id}:${doc.code}`]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-[#CBD5E1] accent-[#0B2545] flex-shrink-0"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold text-[#0F172A]">
                                  {doc.label}
                                </span>
                                <span className="block text-[11px] text-[#94A3B8] mt-0.5">
                                  {doc.source}
                                </span>
                              </span>
                              {na && (
                                <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[9px] font-bold inline-flex items-center flex-shrink-0">
                                  N/A
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Ported from /export-cargo/acceptance — the counter's class picker. */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <Layers size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Cargo class — picked at the counter
                        </h3>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          What the clerk classifies it as on presentation. It is what routes the
                          special-cargo branch (§16a / §16b) at E07.
                        </p>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {COUNTER_CARGO_CLASSES.map((k) => {
                          const active = (cargoClassPick[c.id] ?? derivedCargoClass(c)) === k;
                          return (
                            <button
                              key={k}
                              onClick={() =>
                                setCargoClassPick((prev) => ({ ...prev, [c.id]: k }))
                              }
                              className="h-8 px-3.5 rounded-lg text-[12px] font-bold font-mono border transition-colors cursor-pointer"
                              style={{
                                backgroundColor: active ? "#0B2545" : "#FFFFFF",
                                color: active ? "#FFFFFF" : "#475569",
                                borderColor: active ? "#0B2545" : "#E2E8F0",
                              }}
                            >
                              {k}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
                        {(
                          [
                            ["CARGOGROUP", c.acceptance.CARGOGROUP],
                            ["CARGOTYPE", c.acceptance.CARGOTYPE],
                            ["REVENUECODE", c.acceptance.REVENUECODE],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k} className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                            <span className="text-[12px] font-medium text-[#0F172A]">{v}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                        GCR and AOG have no <span className="font-mono">SpecialHandlingCode</span>{" "}
                        behind them — the first because a general consignment is defined by having
                        no special handling, the second because an aircraft-on-ground spare is a
                        priority rather than a regulated verification. Both are counter vocabulary,
                        and CMTS carries neither: the three legacy columns above are the whole of
                        its classification.
                      </p>
                    </div>
                  </div>

                  {/*
                   * The other two tables of the trio. The badge on this page
                   * has always claimed ACCEPTENCEDETAIL and the consignment has
                   * always carried the typed rows; nothing read them, so the
                   * per-line goods, pieces, weight and dimensions — and the
                   * house breakdown of a consolidation — had no representation
                   * on the export side at all. They sit after the class picker
                   * because the clerk classifies the consignment before working
                   * down its items, and before the residual column dump because
                   * that dump closes the tab.
                   */}
                  <AcceptanceDetailTables
                    lines={c.lines}
                    hwb={c.hwb}
                    acceptance={c.acceptance}
                  />

                  <AcceptanceOtherColumns acceptance={c.acceptance} />
                </>
              )}

              {tab === "weighment" && c.weighment && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Scale size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Weighment — scale {c.weighment.scaleId}
                        </h3>
                        <p className="text-[11px] text-[#94A3B8]">
                          {formatDateTime(c.weighment.weighedAt)} · {c.weighment.weighedBy}
                        </p>
                      </div>
                    </div>
                    <span
                      className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                      style={
                        c.weighment.autoCaptured
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEF3C7", color: "#D97706" }
                      }
                    >
                      {c.weighment.autoCaptured ? "AUTO-CAPTURED" : "MANUAL ENTRY"}
                    </span>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      ["Gross", formatKg(c.weighment.grossKg), "#0F172A"],
                      ["Tare", formatKg(c.weighment.tareKg), "#64748B"],
                      ["Net", formatKg(c.weighment.netKg), "#1B4F8B"],
                      ["Pallet", formatKg(c.weighment.palletKg), "#64748B"],
                      ["Lashing", formatKg(c.weighment.lashingKg), "#64748B"],
                      ["Declared", formatKg(c.weighment.declaredKg), "#7C3AED"],
                    ].map(([l, v, tone]) => (
                      <div key={l} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                        <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          {l}
                        </p>
                        <p className="text-[16px] font-bold mt-0.5 font-mono" style={{ color: tone }}>
                          {v}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className="px-5 py-3.5 border-t"
                    style={{
                      backgroundColor: c.weighment.withinTolerance ? "#F0FDF4" : "#FFFBEB",
                      borderColor: c.weighment.withinTolerance ? "#BBF7D0" : "#FDE68A",
                    }}
                  >
                    <p
                      className="text-[12px] font-semibold"
                      style={{ color: c.weighment.withinTolerance ? "#16A34A" : "#D97706" }}
                    >
                      Declared vs actual: {c.weighment.varianceKg > 0 ? "+" : ""}
                      {formatKg(c.weighment.varianceKg)} (
                      {(c.weighment.varianceRatio * 100).toFixed(2)}%) —{" "}
                      {c.weighment.withinTolerance
                        ? `within the ${(VARIANCE_TOLERANCE * 100).toFixed(0)}% tolerance`
                        : `outside the ${(VARIANCE_TOLERANCE * 100).toFixed(0)}% tolerance`}
                    </p>
                    {!c.weighment.withinTolerance && (
                      <p className="text-[11px] text-[#92400E] mt-1">
                        Chargeable weight is billed on the actual, not the declared. A variance this
                        size is worth querying with the shipper before the AWB is issued — it is the
                        number they have most incentive to understate.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === "screening" && (
                <>
                  {/*
                   * Ported from /export-cargo/acceptance — the `Held` state.
                   *
                   * `ScreeningResult` is pass / fail / re-screen / referred, and
                   * none of those is what happens most often at a screening
                   * point: the bag is pulled and put to one side while ANF is
                   * called, the shipper is phoned, or the operator waits for a
                   * second reading. That consignment has not failed and has not
                   * been referred — it is held, and the canonical enum has no
                   * member for it, so it is carried here at screen level until
                   * `ScreeningResult` gains one. Held is a place a consignment
                   * sits, not a result it was given, which is why it reads off a
                   * separate control rather than being squeezed into the enum.
                   */}
                  <div
                    className="rounded-[16px] border overflow-hidden"
                    style={{
                      borderColor: isHeldAtScreening(c.id) ? "#FDE68A" : "#E2E8F0",
                      backgroundColor:
                        isHeldAtScreening(c.id) ? "#FFFBEB" : "#FFFFFF",
                    }}
                  >
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ShieldAlert
                          size={15}
                          className={
                            isHeldAtScreening(c.id)
                              ? "text-[#D97706]"
                              : "text-[#64748B]"
                          }
                        />
                        <div>
                          <h3 className="text-[14px] font-semibold text-[#0F172A]">
                            Held at the screening point
                          </h3>
                          <p className="text-[11px] text-[#94A3B8]">
                            Not a screening result — a place the consignment is sitting
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setHeldAtScreening((prev) => {
                            const next = { ...prev };
                            if (c.id in next) delete next[c.id];
                            else next[c.id] = "";
                            return next;
                          })
                        }
                        className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                        style={
                          isHeldAtScreening(c.id)
                            ? { backgroundColor: "#D97706", color: "#FFFFFF", borderColor: "#D97706" }
                            : { backgroundColor: "#FFFFFF", color: "#475569", borderColor: "#E2E8F0" }
                        }
                      >
                        {isHeldAtScreening(c.id) ? "Release the hold" : "Hold here"}
                      </button>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      {isHeldAtScreening(c.id) ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                              Why it is held
                            </label>
                            <input
                              value={heldAtScreening[c.id] ?? ""}
                              onChange={(e) =>
                                setHeldAtScreening((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="e.g. ANF attendance requested — second X-ray reading inconclusive"
                              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B]"
                            />
                          </div>
                          <p className="text-[12px] text-[#92400E]">
                            While it is held, the consignment does not move to E07 and no seal is
                            applied. Releasing the hold does not create a pass — the screening
                            record below is still the regulated fact.
                          </p>
                        </>
                      ) : (
                        <p className="text-[12px] text-[#64748B]">
                          Nothing holding this consignment at screening. The four canonical results
                          — pass, fail, re-screen, referred — describe what the screener decided;
                          this describes whether the consignment is allowed to leave the point
                          while that decision is still open.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <ScanLine size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Security screening
                        </h3>
                        <p className="text-[11px] text-[#94A3B8]">
                          Attributable to a named screener — a regulated record, not a shift note
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-[#F1F5F9]">
                      {c.screening.map((s) => (
                        <div key={s.id} className="px-5 py-3.5">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {s.result === "pass" ? (
                                <ShieldCheck size={14} className="text-[#16A34A]" />
                              ) : (
                                <ShieldX size={14} className="text-[#DC2626]" />
                              )}
                              <span className="text-[13px] font-semibold text-[#0F172A]">
                                {SCREENING_METHOD_LABEL[s.method]}
                              </span>
                              <span
                                className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center uppercase"
                                style={
                                  s.result === "pass"
                                    ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                                    : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                                }
                              >
                                {s.result}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#94A3B8]">
                              {formatDateTime(s.screenedAt)}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#475569] mt-1">
                            {s.piecesScreened} pieces · screener {s.screenerName} ({s.screenerId})
                          </p>
                          {s.sealNo && (
                            <p className="text-[11px] text-[#15803D] mt-1 font-mono">
                              Seal {s.sealNo} applied {s.sealAppliedAt ? formatDate(s.sealAppliedAt) : ""}
                              {s.sealRfid ? ` · RFID ${s.sealRfid}` : ""}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Chain of custody — {c.custodyRegime}
                      </h3>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        Every handover verifies the seal. CMTS has no field for any of this.
                      </p>
                    </div>
                    <div className="divide-y divide-[#F1F5F9]">
                      {c.custodyChain.map((e) => (
                        <div
                          key={e.id}
                          className="px-5 py-3.5"
                          style={{ backgroundColor: e.sealIntact === false ? "#FEF2F2" : undefined }}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-[13px] font-medium text-[#0F172A]">
                                {e.fromParty} → {e.toParty}
                              </p>
                              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                                {e.location} · signed {e.signedBy}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {e.sealIntact !== null && (
                                <span
                                  className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                                  style={
                                    e.sealIntact
                                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                                      : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                                  }
                                >
                                  {e.sealIntact ? "SEAL INTACT" : "SEAL BROKEN"}
                                </span>
                              )}
                              <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                                {formatDateTime(e.at)}
                              </span>
                            </div>
                          </div>
                          {e.note && (
                            <p
                              className="text-[12px] mt-1"
                              style={{ color: e.sealIntact === false ? "#991B1B" : "#64748B" }}
                            >
                              {e.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {c.custodyChain.some((e) => e.sealIntact === false) && (
                      <div className="px-5 py-3 bg-[#FEF2F2] border-t border-[#FECACA]">
                        <p className="text-[12px] text-[#991B1B]">
                          A broken seal sends the consignment back to screening. It cannot go airside
                          on the strength of the earlier pass — the pass certified a state that no
                          longer holds.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/export/buildup"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Build-up, declaration &amp; ramp gate <ArrowUpRight size={12} />
                </Link>
              </div>

              <AuditStrip record={c} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
