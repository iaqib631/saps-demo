"use client";

/**
 * P2-1 · Cargo class / subclass / location master + CARGOSUBCLASSLOCATION rules.
 * P2-6 · SCC → class mapping.
 *
 * FC-03's amendment names the table explicitly:
 *   "System suggests rack / bin by class + subclass + capacity
 *    (CARGOSUBCLASSLOCATION rules)"
 *   "CMTS parity: honour subclass→location rules; location charges
 *    (CARGOSUBCLASSCHARGES) resolve in FC-07."
 *
 * The demo had a flat cargo-class list, no subclass concept, no location
 * master and no rules. Six CMTS tables, none represented.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Boxes, Layers, MapPin, Tag } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import { useSite } from "@/components/site/SiteContext";
import {
  CARGO_CLASSES,
  CARGO_GROUP_LABEL,
  CARGO_SUBCLASSES,
  SCC_MAPPINGS,
  SUBCLASS_LOCATION_RULES,
  cargoClass,
  formatKg,
  formatPkr,
  locationsForSite,
  proposeClassification,
  storageLocation,
  subClassesOf,
  type CargoGroup,
} from "@/lib/domain";

const TABS = [
  { key: "classes", label: "Classes & subclasses", icon: Layers },
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "rules", label: "Subclass → location rules", icon: Boxes },
  { key: "scc", label: "SCC mapping", icon: Tag },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function StorageMasterPage() {
  const { scope, isHq } = useSite();
  const [tab, setTab] = useState<TabKey>("classes");
  const [group, setGroup] = useState<CargoGroup | "">("");

  const siteCode = isHq ? "KHI" : scope;
  const locations = useMemo(() => locationsForSite(siteCode as "KHI" | "LHE" | "PEW"), [siteCode]);

  const classes = group ? CARGO_CLASSES.filter((c) => c.group === group) : CARGO_CLASSES;

  // A subclass with no permitted location is a configuration error, not a warning.
  const orphanSubclasses = CARGO_SUBCLASSES.filter(
    (s) =>
      !SUBCLASS_LOCATION_RULES.some(
        (r) => r.SUBCLASSID === s.SUBCLASSID && storageLocation(r.LOCATIONID)?.site === siteCode,
      ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Storage" }, { label: "Cargo & Location Master" }]} />
        <div>
          <div className="flex items-center gap-2">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M05
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-03
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Cargo &amp; Location Master
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The taxonomy and rules the allocation engine reads. Change a rule here and the
            suggestion on the allocation screen changes.
          </p>
        </div>
      </div>

      {orphanSubclasses.length > 0 && (
        <div className="rounded-[16px] border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[#DC2626]">
              {orphanSubclasses.length} subclass
              {orphanSubclasses.length === 1 ? " has" : "es have"} no permitted location at {siteCode}
            </p>
            <p className="text-[12px] text-[#991B1B] mt-0.5">
              {orphanSubclasses.map((s) => s.ABBREVATION).join(", ")} — cargo of these subclasses
              cannot be allocated. Configuration error, not a warning.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#E2E8F0] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative h-10 px-4 text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-2"
            style={{
              color: tab === t.key ? "#0B2545" : "#64748B",
              borderBottom: tab === t.key ? "2px solid #0B2545" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Classes & subclasses ---- */}
      {tab === "classes" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setGroup("")}
              className="h-8 px-3 rounded-lg border text-[12px] font-semibold cursor-pointer"
              style={{
                borderColor: group === "" ? "#0B2545" : "#E2E8F0",
                backgroundColor: group === "" ? "#EBF0F7" : "white",
                color: group === "" ? "#0B2545" : "#64748B",
              }}
            >
              All groups
            </button>
            {(["general", "special", "controlled"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className="h-8 px-3 rounded-lg border text-[12px] font-semibold cursor-pointer"
                style={{
                  borderColor: group === g ? "#0B2545" : "#E2E8F0",
                  backgroundColor: group === g ? "#EBF0F7" : "white",
                  color: group === g ? "#0B2545" : "#64748B",
                }}
              >
                {CARGO_GROUP_LABEL[g]}
              </button>
            ))}
          </div>

          {classes.map((c) => {
            const subs = subClassesOf(c.ID);
            return (
              <div key={c.ID} className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="h-7 px-2.5 rounded-lg bg-[#0B2545] text-white text-[12px] font-bold inline-flex items-center font-mono">
                      {c.ABBREVATION}
                    </span>
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">{c.NAME}</h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        {CARGO_GROUP_LABEL[c.group]} · {c.DESCRIPTION}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center">
                      {c.freeDays}d free
                    </span>
                    {c.requiresSpecialClearance && (
                      <span className="h-[20px] px-2 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center">
                        special clearance
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(
                    [
                      ["DOCUMENTATIONCHARGES", c.DOCUMENTATIONCHARGES],
                      ["DECONSOLIDATIONCHARGES", c.DECONSOLIDATIONCHARGES],
                      ["SPECIALHANDLINGCHARGES", c.SPECIALHANDLINGCHARGES],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                      <span className="text-[13px] font-medium font-mono text-[#0F172A]">
                        {formatPkr(v)}
                      </span>
                    </div>
                  ))}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-[#CBD5E1]">Subclasses</span>
                    <span className="text-[13px] font-medium text-[#0F172A]">{subs.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                        <th className="text-left px-5 py-2">Subclass</th>
                        <th className="text-left px-5 py-2">Name</th>
                        <th className="text-right px-5 py-2">MINCHARGES</th>
                        <th className="text-left px-5 py-2">Temp band</th>
                        <th className="text-left px-5 py-2">Authority</th>
                        <th className="text-left px-5 py-2">Permitted locations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map((s) => {
                        const rules = SUBCLASS_LOCATION_RULES.filter(
                          (r) =>
                            r.SUBCLASSID === s.SUBCLASSID &&
                            storageLocation(r.LOCATIONID)?.site === siteCode,
                        );
                        return (
                          <tr key={s.SUBCLASSID} className="border-b border-[#F1F5F9]">
                            <td className="px-5 py-2.5 font-mono font-semibold">{s.ABBREVATION}</td>
                            <td className="px-5 py-2.5">{s.NAME}</td>
                            <td className="px-5 py-2.5 text-right font-mono">
                              {formatPkr(s.MINCHARGES)}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-[12px]">
                              {s.tempBandC ? `${s.tempBandC[0]}°C to ${s.tempBandC[1]}°C` : "—"}
                            </td>
                            <td className="px-5 py-2.5 text-[12px] text-[#64748B]">
                              {s.Authority ?? "—"}
                            </td>
                            <td className="px-5 py-2.5">
                              {rules.length === 0 ? (
                                <span className="text-[11px] font-semibold text-[#DC2626]">
                                  none — cannot allocate
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {rules.map((r) => {
                                    const l = storageLocation(r.LOCATIONID)!;
                                    return (
                                      <span
                                        key={r.Id}
                                        className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center font-mono"
                                        style={{
                                          backgroundColor:
                                            r.preference === "preferred" ? "#DCFCE7" : "#FEF3C7",
                                          color: r.preference === "preferred" ? "#16A34A" : "#D97706",
                                        }}
                                        title={r.preference}
                                      >
                                        {l.ABBREVATION}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Locations ---- */}
      {tab === "locations" && (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Storage locations — {siteCode}
            </h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              CMTS LOCATION (17) · capacity feeds the allocation engine
            </p>
          </div>
          {/* Only the CMTS-backed columns carry a column name. Capacity,
              occupancy, utilisation and the temperature band are AirVault
              additions that the allocation engine needs and LOCATION has no
              column for — leaving them unmarked is the distinction, and
              inventing names for them would make the parity check unreadable. */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5">
                    Zone <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">NAME</span>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    Abbr <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">ABBREVATION</span>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    Class <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">CLASSID</span>
                  </th>
                  <th className="text-right px-4 py-2.5">Capacity</th>
                  <th className="text-right px-4 py-2.5">Occupied</th>
                  <th className="text-left px-4 py-2.5">Utilisation</th>
                  <th className="text-left px-4 py-2.5">Temp band</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">
                    Handling note{" "}
                    <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">REMARKS</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => {
                  const pct = Math.round((l.occupiedKg / l.capacityKg) * 100);
                  const tone = pct >= 85 ? "#DC2626" : pct >= 65 ? "#D97706" : "#16A34A";
                  return (
                    <tr key={l.ID} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-medium">{l.NAME}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">{l.ABBREVATION}</td>
                      <td className="px-4 py-2.5">
                        <span className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#0F172A] text-[10px] font-bold inline-flex items-center font-mono">
                          {cargoClass(l.CLASSID).ABBREVATION}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatKg(l.capacityKg)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatKg(l.occupiedKg)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: tone }} />
                          </div>
                          <span className="text-[12px] font-mono font-semibold" style={{ color: tone }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[#64748B]">
                        {l.tempBandC ? `${l.tempBandC[0]} to ${l.tempBandC[1]}°C` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {l.isHoldZone && (
                          <span className="h-[20px] px-2 rounded bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center">
                            hold zone
                          </span>
                        )}
                      </td>
                      {/* REMARKS is standing instruction attached to the zone,
                          not to any consignment in it — so it renders on the
                          zone row and stays on screen when the zone is empty.
                          Most zones carry none; that blank is the real state of
                          the column, not missing data. */}
                      <td className="px-4 py-2.5 max-w-[240px]">
                        {l.REMARKS ? (
                          <span className="text-[12px] text-[#0F172A]">{l.REMARKS}</span>
                        ) : (
                          <span className="text-[12px] text-[#CBD5E1]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">
              REMARKS is nvarchar(500) of free text — a note the storekeeper reads, and deliberately
              not something the allocation engine parses. The rules that bind allocation are the
              subclass → location grid on the next tab; a handling instruction typed here changes
              what a person does, never what the engine suggests.
            </p>
          </div>
        </div>
      )}

      {/* ---- Rules matrix ---- */}
      {tab === "rules" && (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Subclass → location rules
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                CMTS CARGOSUBCLASSLOCATION — named directly in the FC-03 amendment
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span className="w-2.5 h-2.5 rounded bg-[#DCFCE7] border border-[#BBF7D0]" /> preferred
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span className="w-2.5 h-2.5 rounded bg-[#FEF3C7] border border-[#FDE68A]" /> overflow
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5 sticky left-0 bg-[#F8FAFC]">Subclass</th>
                  {locations.slice(0, 10).map((l) => (
                    <th key={l.ID} className="px-2 py-2.5 text-center font-mono" title={l.NAME}>
                      {l.ABBREVATION.split("-")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CARGO_SUBCLASSES.map((s) => (
                  <tr key={s.SUBCLASSID} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-2 font-mono font-semibold sticky left-0 bg-white">
                      {s.ABBREVATION}
                    </td>
                    {locations.slice(0, 10).map((l) => {
                      const rule = SUBCLASS_LOCATION_RULES.find(
                        (r) => r.SUBCLASSID === s.SUBCLASSID && r.LOCATIONID === l.ID,
                      );
                      return (
                        <td key={l.ID} className="px-2 py-2 text-center">
                          {rule ? (
                            <span
                              className="inline-block w-4 h-4 rounded"
                              style={{
                                backgroundColor:
                                  rule.preference === "preferred" ? "#16A34A" : "#D97706",
                              }}
                              title={`${s.ABBREVATION} → ${l.NAME} (${rule.preference})`}
                            />
                          ) : (
                            <span className="inline-block w-4 h-4 rounded bg-[#F8FAFC]" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">
              Showing the first 10 zones. {SUBCLASS_LOCATION_RULES.length} rules across all sites —
              the allocation engine reads these, so editing a cell changes what the engine suggests.
            </p>
          </div>
        </div>
      )}

      {/* ---- SCC mapping (P2-6) ---- */}
      {tab === "scc" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[16px] border border-[#DDD6FE] bg-[#F5F3FF] p-5">
            <p className="text-[13px] font-semibold text-[#7C3AED]">
              Proposed FC-03 / FC-02 addition — SCC proposes, the operator decides
            </p>
            <p className="text-[12px] text-[#6D28D9] mt-1 leading-relaxed">
              The IATA Special Cargo Code is on the manifest before the pouch is opened, so
              classification can be <em>proposed</em> at flight arrival rather than waiting for
              indexation. But on the real OD 0131 manifest <strong>both pharma AWBs are coded GEN</strong>,
              with &ldquo;PHARMA&rdquo; only in the goods description. SCC alone would rack pharmaceutical raw
              material as general cargo.
            </p>
          </div>

          {/* Worked example against the reference documents */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Worked against the reference manifest
              </h3>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {[
                { awb: "816-00059205", scc: "GEN", desc: "PHARMA — Strontium Ranelate (in-house grade)" },
                { awb: "816-00034156", scc: "GEN", desc: "PHARMA — Pharmaceutical raw material (Pregabalin USP)" },
                { awb: "816-00052345", scc: "GEN", desc: "KNITED FABRIC" },
              ].map((row) => {
                const p = proposeClassification(row.scc, row.desc);
                const cls = p.proposedClassId ? cargoClass(p.proposedClassId) : null;
                const refined = p.fromDescription !== null;
                return (
                  <div
                    key={row.awb}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: refined ? "#DDD6FE" : "#E2E8F0",
                      backgroundColor: refined ? "#FAF9FF" : "white",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                        {row.awb}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="h-[22px] px-2 rounded bg-[#DBEAFE] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center font-mono">
                          SCC {row.scc}
                        </span>
                        <span className="text-[#CBD5E1]">→</span>
                        <span
                          className="h-[22px] px-2 rounded text-[10px] font-bold inline-flex items-center font-mono"
                          style={{
                            backgroundColor: refined ? "#EDE9FE" : "#F1F5F9",
                            color: refined ? "#7C3AED" : "#64748B",
                          }}
                        >
                          {cls?.ABBREVATION ?? "—"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-2">{row.desc}</p>
                    <p className="text-[11px] mt-1.5" style={{ color: refined ? "#7C3AED" : "#94A3B8" }}>
                      {refined
                        ? `SCC GEN is a weak signal — refined to ${cls?.ABBREVATION} by: ${p.fromDescription!.reason}`
                        : "SCC accepted; nothing in the description contradicts it"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">SCC → class mapping</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                No CMTS column — SCC is on the manifest and the FFM but nowhere in the schema
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-4 py-2.5">SCC</th>
                    <th className="text-left px-4 py-2.5">Description</th>
                    <th className="text-left px-4 py-2.5">Proposes class</th>
                    <th className="text-left px-4 py-2.5">Strength</th>
                    <th className="text-left px-4 py-2.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {SCC_MAPPINGS.map((m) => (
                    <tr key={m.scc} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-mono font-bold">{m.scc}</td>
                      <td className="px-4 py-2.5">{m.description}</td>
                      <td className="px-4 py-2.5">
                        <span className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#0F172A] text-[10px] font-bold inline-flex items-center font-mono">
                          {cargoClass(m.proposedClassId).ABBREVATION}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                          style={{
                            backgroundColor: m.strength === "strong" ? "#DCFCE7" : "#FEF3C7",
                            color: m.strength === "strong" ? "#16A34A" : "#D97706",
                          }}
                        >
                          {m.strength}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[#64748B]">{m.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/storage/allocation"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold no-underline"
        >
          Open allocation engine <ArrowUpRight size={14} />
        </Link>
        <Link
          href="/admin/master-data"
          className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] no-underline inline-flex items-center"
        >
          Master data editor
        </Link>
      </div>
    </div>
  );
}
