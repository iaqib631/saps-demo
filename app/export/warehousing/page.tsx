"use client";

/**
 * FC-11 §15–17 · Classification, the §16a / §16b branch, and export
 * warehousing.
 *
 * The gap this closes: the demo went from screening straight to build-up.
 * FC-11 puts a decision in between — "§16. Special cargo?" — and the two
 * edges are not the same work:
 *
 *   Yes → §16a. Special Handling Verification (DGR / PER / AVI / VAL)
 *   No  → §16b. General Export Storage
 *
 * §16a is a verification with a named verifier and a document behind each
 * check. Treating it as a label on the consignment — which is what having
 * no screen amounts to — is how a DG shipment reaches a ULD with nobody
 * having confirmed the shipper's declaration exists.
 *
 * So classification gates warehousing here: special cargo with an
 * unverified handling check cannot be put away, and the zone it goes to is
 * decided by the codes rather than chosen freely.
 *
 * **Ported in from the retired `/export-cargo/acceptance`** (see
 * PORTAL_AND_DEDUP_PLAN.md §2.1): the storage-allocation control — suggested
 * zone, override with a reason, and the bin action. The legacy screen drew it
 * on the acceptance form; FC-11 puts the put-away at §17, which is here.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  MapPin,
  PackageCheck,
  Snowflake,
  SplitSquareHorizontal,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXPORT_STAGE_LABEL,
  SPECIAL_HANDLING_LABEL,
  classificationCleared,
  formatDateTime,
  listExports,
  type ExportConsignment,
  type ExportWarehousing,
} from "@/lib/domain";

const ZONE_LABEL = {
  general: "General export store",
  dgr: "DGR store",
  "cool-chain": "Cool chain",
  strongroom: "Strongroom",
  avi: "Live animals",
} as const;

type ExportZone = ExportWarehousing["zone"];

const ZONE_OPTIONS: ExportZone[] = ["general", "dgr", "cool-chain", "strongroom", "avi"];

/* ================================================================== *
 * Suggested zone, and the override that costs a reason
 *
 * Ported from the retired export-cargo acceptance counter, where allocation
 * was two fields on the acceptance form: a suggested zone and an "Override
 * (with reason)" box.
 *
 * What carried over is the shape of the control rather than its position.
 * The canonical screen shows `locationCode` and `zone` as facts with nothing
 * behind them, which cannot express *"the engine said DGR store and the
 * supervisor sent it to general anyway"* — the exact sentence anyone
 * investigating a DG incident is trying to reconstruct. A suggestion the
 * operator may overrule, at the price of saying why, is the smallest control
 * that records both halves.
 *
 * The general default keeps the legacy screen's `EXP-A1` so the two read as
 * the same shed rather than two inventions.
 * ================================================================== */

/** The bay each zone allocates into. `EXP-A1` is the legacy screen's own default. */
const ZONE_BIN: Record<ExportZone, string> = {
  general: "EXP-A1",
  dgr: "EXP-DGR-01",
  "cool-chain": "EXP-COOL-01",
  strongroom: "EXP-VAL-01",
  avi: "EXP-AVI-01",
};

interface ZoneSuggestion {
  zone: ExportZone;
  locationCode: string;
  why: string;
}

function suggestZone(c: ExportConsignment): ZoneSuggestion {
  const codes: string[] = c.classification?.codes ?? [];
  // Order matters: a consignment carrying both DGR and COL is segregated as
  // dangerous goods first. Cool chain is a service; segregation is a rule.
  const zone: ExportZone = codes.includes("DGR")
    ? "dgr"
    : codes.includes("AVI")
      ? "avi"
      : codes.includes("VAL")
        ? "strongroom"
        : codes.includes("PER") || codes.includes("COL")
          ? "cool-chain"
          : "general";

  const why: Record<ExportZone, string> = {
    dgr: "DGR on the classification — segregated store, no co-location with general cargo.",
    avi: "Live animals — ventilated bay, held away from the DGR store.",
    strongroom: "Valuable cargo — strongroom, dual custody on entry and exit.",
    "cool-chain":
      "Perishable / cool chain — temperature-controlled bay; a break in the chain re-opens 08a.",
    general: "No special-handling code — general export store.",
  };

  return { zone, locationCode: ZONE_BIN[zone], why: why[zone] };
}

export default function ExportWarehousingPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExports(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(null);
  const c = rows.find((x) => x.id === selected) ?? rows[0] ?? null;

  /*
   * Allocation state, keyed by consignment so one row's override does not
   * follow the operator onto the next. `binned` records the committed
   * location — there is no domain field for an allocation decision distinct
   * from the put-away that follows it, so it is held at screen level.
   */
  const [zonePick, setZonePick] = useState<Record<number, ExportZone>>({});
  const [overrideReason, setOverrideReason] = useState<Record<number, string>>({});
  const [binned, setBinned] = useState<Record<number, string>>({});

  const classified = rows.filter((x) => x.classification);
  const special = classified.filter((x) => x.classification!.isSpecial);
  const blocked = classified.filter((x) => !classificationCleared(x.classification!));
  const returned = rows.filter((x) => x.warehousing?.returnedFromOffload);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Classification & Warehousing" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M16
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §15–17 · §16a / §16b
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              GREENFIELD
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Classification &amp; Export Warehousing
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The special-cargo branch, its verifications, and where cargo waits for build-up.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Classified", value: `${classified.length} / ${rows.length}`, tone: "#0F172A" },
          { label: "Special (08a)", value: String(special.length), tone: "#7C3AED" },
          { label: "Blocked — unverified", value: String(blocked.length), tone: blocked.length ? "#DC2626" : "#16A34A" },
          { label: "Back from offload", value: String(returned.length), tone: returned.length ? "#D97706" : "#16A34A" },
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

      {rows.length === 0 ? (
        <EmptyState
          title="No export consignments at this site"
          description="Classification runs at E07, after security screening."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Boxes size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Consignments</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {rows.map((x) => {
                const cls = x.classification;
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
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center flex-shrink-0"
                        style={{
                          backgroundColor: !cls ? "#F1F5F9" : cls.isSpecial ? "#F5F3FF" : "#EBF0F7",
                          color: !cls ? "#94A3B8" : cls.isSpecial ? "#7C3AED" : "#0B2545",
                        }}
                      >
                        {!cls ? "UNCLASSIFIED" : cls.isSpecial ? "08a SPECIAL" : "08b NORMAL"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.warehousing ? x.warehousing.locationCode : "Not put away"} ·{" "}
                      {x.acceptance.DESTINATION}
                    </p>
                    {x.warehousing?.returnedFromOffload && (
                      <p className="text-[11px] text-[#D97706] mt-0.5">Returned from offload</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* The 08 branch */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <SplitSquareHorizontal size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      08. Special cargo?
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">{EXPORT_STAGE_LABEL[c.stage]}</p>
                  </div>
                </div>

                {!c.classification ? (
                  <p className="p-5 text-[12px] text-[#94A3B8]">
                    Not yet classified — E07 runs after security screening, and this consignment
                    has not cleared E06.
                  </p>
                ) : (
                  <>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 border-b border-[#F1F5F9]">
                      {(
                        [
                          ["Route taken", c.classification.route === "08a-special-handling" ? "08a — special handling" : "08b — normal storage"],
                          ["Special cargo code", c.classification.scc ?? "None"],
                          ["Classified by", c.classification.classifiedBy],
                          ["Classified at", formatDateTime(c.classification.classifiedAt)],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            {k}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] break-words">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>

                    {c.classification.isSpecial ? (
                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.classification.codes.map((code) => (
                            <span
                              key={code}
                              className="h-[22px] px-2 rounded bg-[#F5F3FF] text-[#7C3AED] text-[11px] font-bold inline-flex items-center"
                            >
                              {code} — {SPECIAL_HANDLING_LABEL[code]}
                            </span>
                          ))}
                        </div>
                        {c.classification.checks.map((chk) => (
                          <div
                            key={chk.code}
                            className="rounded-xl border px-4 py-3"
                            style={{
                              borderColor: chk.pass ? "#BBF7D0" : "#FCA5A5",
                              backgroundColor: chk.pass ? "#F0FDF4" : "#FEF2F2",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#0F172A]">
                                  {chk.code} · {chk.label}
                                </p>
                                <p className="text-[11px] text-[#64748B] mt-0.5">
                                  Requires: {chk.requiredDocument}
                                </p>
                                {chk.note && (
                                  <p className="text-[11px] text-[#64748B] mt-0.5">{chk.note}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[12px] font-mono text-[#0F172A]">
                                  {chk.documentRef ?? "No document"}
                                </p>
                                <p className="text-[11px] text-[#94A3B8]">
                                  {chk.verifiedBy
                                    ? `${chk.verifiedBy} · ${formatDateTime(chk.verifiedAt!)}`
                                    : "Unverified"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="p-5 text-[12px] text-[#64748B]">
                        No special handling codes — routed to 08b normal export storage. No
                        verification is required, and none is recorded rather than being recorded
                        vacuously.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Ported from /export-cargo/acceptance — suggest, override, bin. */}
              {(() => {
                const sug = suggestZone(c);
                const chosen = zonePick[c.id] ?? sug.zone;
                const isOverride = chosen !== sug.zone;
                const reason = overrideReason[c.id] ?? "";
                const blocked = isOverride && reason.trim() === "";
                const committed = binned[c.id];

                return (
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <MapPin size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Storage allocation — suggested, overridable, binned
                        </h3>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          The engine proposes a zone off the classification. An operator may
                          overrule it, and an override costs a reason.
                        </p>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col gap-4">
                      <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex items-start gap-3">
                        <Warehouse size={16} className="text-[#1B4F8B] flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1E3A8A]">
                            Suggested — {ZONE_LABEL[sug.zone]}{" "}
                            <span className="font-mono">({sug.locationCode})</span>
                          </p>
                          <p className="text-[12px] text-[#1E3A8A] mt-0.5">{sug.why}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          Zone
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ZONE_OPTIONS.map((z) => {
                            const active = chosen === z;
                            return (
                              <button
                                key={z}
                                onClick={() => setZonePick((prev) => ({ ...prev, [c.id]: z }))}
                                className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                                style={{
                                  backgroundColor: active ? "#0B2545" : "#FFFFFF",
                                  color: active ? "#FFFFFF" : "#475569",
                                  borderColor: active
                                    ? "#0B2545"
                                    : z === sug.zone
                                      ? "#93C5FD"
                                      : "#E2E8F0",
                                }}
                              >
                                {ZONE_LABEL[z]}
                                {z === sug.zone && !active ? " · suggested" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          Override (with reason)
                          {isOverride && <span className="text-[#DC2626]"> *</span>}
                        </label>
                        <input
                          value={reason}
                          onChange={(e) =>
                            setOverrideReason((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          disabled={!isOverride}
                          placeholder={
                            isOverride
                              ? "Why this consignment is not going where the engine sent it"
                              : "Not required — the suggested zone is selected"
                          }
                          className="h-9 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
                          style={{ borderColor: blocked ? "#FCA5A5" : "#E2E8F0" }}
                        />
                        {blocked && (
                          <span className="text-[11px] text-[#DC2626]">
                            An override without a reason is the record nobody can audit. Say why.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() =>
                            setBinned((prev) => ({ ...prev, [c.id]: ZONE_BIN[chosen] }))
                          }
                          disabled={blocked}
                          className="h-9 px-4 rounded-lg text-[13px] font-bold text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                          style={{ backgroundColor: blocked ? "#CBD5E1" : "#16A34A" }}
                        >
                          Accept &amp; bin
                        </button>
                        {committed && (
                          <span className="text-[12px] text-[#16A34A] font-semibold">
                            Binned to <span className="font-mono">{committed}</span> ·{" "}
                            {ZONE_LABEL[chosen]}
                            {isOverride ? " — override reason recorded" : ""}
                          </span>
                        )}
                      </div>

                      {c.warehousing && (
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                          This consignment is already put away at{" "}
                          <span className="font-mono">{c.warehousing.locationCode}</span>. Binning
                          again is a re-allocation, not a first placement — the E08 record below is
                          what it moves from.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* E08 warehousing */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <PackageCheck size={15} className="text-[#64748B]" />
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    E08 — export warehousing
                  </h3>
                </div>
                {!c.warehousing ? (
                  <p className="p-5 text-[12px] text-[#94A3B8]">
                    Not put away — cargo cannot enter the export store before it is classified.
                  </p>
                ) : (
                  <>
                    {c.warehousing.returnedFromOffload && (
                      <div className="mx-5 mt-5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-3">
                        <TriangleAlert size={16} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[12px] font-semibold text-[#D97706]">
                            Returned here after an offload
                          </p>
                          <p className="text-[12px] text-[#92400E] mt-0.5">
                            FC-11&rsquo;s payload decision sends cargo back to §17 rather than out
                            of the flow — it is rebooked from here, not re-accepted.{" "}
                            <Link
                              href="/export/uplift"
                              className="font-semibold text-[#1B4F8B] hover:underline no-underline"
                            >
                              See the uplift record
                            </Link>
                            .
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                      {(
                        [
                          ["Location", c.warehousing.locationCode],
                          ["Zone", ZONE_LABEL[c.warehousing.zone]],
                          ["Put away", formatDateTime(c.warehousing.putawayAt)],
                          ["By", c.warehousing.putawayBy],
                          [
                            "Temperature control",
                            c.warehousing.temperatureControlled
                              ? `Yes · ${c.warehousing.temperatureC} °C`
                              : "Not required",
                          ],
                          ["Flight", c.flightNo ?? "—"],
                          ["Destination", c.acceptance.DESTINATION],
                          ["Site", c.site],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            {k}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] break-words">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                    {c.warehousing.temperatureControlled && (
                      <div className="mx-5 mb-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex items-start gap-3">
                        <Snowflake size={16} className="text-[#1B4F8B] flex-shrink-0 mt-0.5" />
                        <p className="text-[12px] text-[#1E3A8A]">
                          Temperature-controlled ULDs are labelled as such — FC-11 carries this as
                          an explicit annotation, and it is what the cool-chain handover log at
                          08a is checked against.
                        </p>
                      </div>
                    )}
                    <div className="px-5 pb-5">
                      <Link
                        href="/export/buildup"
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[12px] font-semibold text-[#1B4F8B] no-underline transition-colors"
                      >
                        Build-up &amp; ramp handover (E09–E11)
                        <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </>
                )}
              </div>

              <AuditStrip record={c} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
