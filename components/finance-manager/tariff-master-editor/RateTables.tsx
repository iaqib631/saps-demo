"use client";

/**
 * The six empty CMTS rate tables, as the illustrative card fills them.
 *
 * One tab per source table, and each tab renders the SOURCE COLUMN NAMES in
 * the header — `WEIGHTFROM`, `DAYTO`, `FLATERATE`, `CHARGESTYPE` — not friendly
 * labels. This is a migration-parity screen before it is a pricing screen: the
 * question it has to answer is "which CMTS column would this row land in", and
 * a header that says "From (kg)" cannot answer it.
 *
 * Every tab carries its own ILLUSTRATIVE strip. That is deliberate repetition:
 * a reader who lands on the tax tab from a deep link, or who scrolled past the
 * page banner, still cannot mistake the number for an extract.
 */

import { useMemo, useState } from "react";
import {
  CARGO_CLASS_CHARGES,
  CARGO_SUBCLASS_CHARGES,
  CHARGE_UNIT_LABEL,
  HANDLING_CHARGES,
  ILLUSTRATIVE_CATEGORY_SURCHARGES,
  ILLUSTRATIVE_TAX_TYPES,
  LOCATION_CHARGE_BANDS,
  RATE_CARD_LOOKUPS,
  RATE_PROFILES,
  SECTION_82_DAYS_ROW,
  SUBCLASS_RATE_ASSIGNMENTS,
  chargesForSubClass,
  freeDaysFromZeroBand,
  type ChargeUnitCode,
} from "@/lib/domain/tariff";
import { formatPkr } from "@/lib/domain";
import { CmtsCol, IllustrativeTableNote } from "@/components/finance-manager/IllustrativeRateCardBanner";

type TabKey =
  | "storage"
  | "class"
  | "location"
  | "handling"
  | "tax"
  | "section82"
  | "lookup";

const TABS: Array<{ key: TabKey; label: string; table: string }> = [
  { key: "storage", label: "Storage rates", table: "CARGOSUBCLASSCHARGES" },
  { key: "class", label: "Class charges", table: "CargoClassCharges" },
  { key: "location", label: "Zone charges", table: "LOCATIONCHARGES" },
  { key: "handling", label: "Handling & surcharges", table: "grCharges" },
  { key: "tax", label: "Tax", table: "TaxType" },
  { key: "section82", label: "Section 82", table: "Section82Days" },
  { key: "lookup", label: "Lookup", table: "Lookup" },
];

const TH = "text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom";
const TD = "px-4 py-3 text-[13px] text-[#475569] whitespace-nowrap";
const TD_NUM = "px-4 py-3 text-[13px] font-mono text-[#0F172A] whitespace-nowrap";

/** A null renders as the word `null`, muted — "open-ended" is data, not a blank. */
function Nullable({ value }: { value: string | number | null }) {
  if (value === null) return <span className="text-[#CBD5E1] font-mono">null</span>;
  return <>{value}</>;
}

function Bool({ value }: { value: boolean }) {
  return (
    <span className={`font-mono text-[12px] ${value ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
      {String(value)}
    </span>
  );
}

function Unit({ code }: { code: ChargeUnitCode }) {
  return (
    <span className="inline-flex items-center h-[20px] px-1.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-bold font-mono">
      {code} · {CHARGE_UNIT_LABEL[code]}
    </span>
  );
}

export default function RateTables() {
  const [tab, setTab] = useState<TabKey>("storage");
  const [subClassId, setSubClassId] = useState<number>(101);

  const active = TABS.find((t) => t.key === tab)!;
  const storageRows = useMemo(() => chargesForSubClass(subClassId), [subClassId]);
  const assignment = SUBCLASS_RATE_ASSIGNMENTS.find((a) => a.SUBCLASSID === subClassId)!;
  const declaredFree = CARGO_CLASS_CHARGES.find((c) => c.CLASSID === assignment.CLASSID)!.FREEDAYS;
  const derivedFree = freeDaysFromZeroBand(subClassId, 0);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      {/* Tab strip — the six requested tables plus the handling rows that hang
          off the same cascade. */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E2E8F0] flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="h-8 px-3 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
              style={{
                backgroundColor: on ? "#0B2545" : "#FFFFFF",
                color: on ? "#FFFFFF" : "#475569",
                borderColor: on ? "#0B2545" : "#E2E8F0",
              }}
              title={`CMTS ${t.table}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <IllustrativeTableNote
        table={active.table}
        what={
          tab === "storage"
            ? "Rates are PKR per chargeable kg per day. The zero-amount band IS the free period, which is how CMTS stores it."
            : tab === "section82"
              ? "The threshold is customs statute, not a terminal charge — nobody on the build team has verified it."
              : "Every amount is round on purpose so it cannot be mistaken for an extract."
        }
      />

      {/* ---------------- CARGOSUBCLASSCHARGES ---------------- */}
      {tab === "storage" && (
        <>
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                Subclass
                <CmtsCol name="SUBCLASSID" />
              </label>
              <select
                value={subClassId}
                onChange={(e) => setSubClassId(Number(e.target.value))}
                className="h-9 px-3 pr-8 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] focus:outline-none focus:border-[#1B4F8B]"
              >
                {SUBCLASS_RATE_ASSIGNMENTS.map((a) => (
                  <option key={a.SUBCLASSID} value={a.SUBCLASSID}>
                    {a.SUBCLASSID} · {a.ABBREVATION}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[12px] text-[#475569] leading-relaxed">
              <span className="font-semibold text-[#0F172A]">
                {RATE_PROFILES.find((p) => p.code === assignment.profile)!.label}
              </span>{" "}
              profile · zone <span className="font-mono">{assignment.zoneAbbr}</span>
              <span className="block text-[#64748B]">
                {RATE_PROFILES.find((p) => p.code === assignment.profile)!.description}
              </span>
            </div>

            {/* The consistency claim, stated where it can be checked rather than
                asserted in a comment nobody reads. */}
            <div
              className="ml-auto rounded-xl border px-3 py-2 text-[11px] leading-relaxed"
              style={{
                borderColor: declaredFree === derivedFree ? "#BBF7D0" : "#FECACA",
                backgroundColor: declaredFree === derivedFree ? "#F0FDF4" : "#FEF2F2",
                color: declaredFree === derivedFree ? "#15803D" : "#B91C1C",
              }}
            >
              Free days: <span className="font-mono font-bold">{declaredFree}</span> declared on{" "}
              <span className="font-mono">CargoClassCharges</span> ·{" "}
              <span className="font-mono font-bold">{derivedFree}</span> derived the CMTS way from
              the <span className="font-mono">AMOUNT = 0</span> band
              {declaredFree === derivedFree ? " — agree" : " — DISAGREE"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Id<CmtsCol name="CHARGESID" /></th>
                  <th className={TH}>Class<CmtsCol name="CLASSID" /></th>
                  <th className={TH}>Zone<CmtsCol name="LOCATIONID" /></th>
                  <th className={TH}>Weight from<CmtsCol name="WEIGHTFROM" /></th>
                  <th className={TH}>Weight to<CmtsCol name="WEIGHTTO" /></th>
                  <th className={TH}>Day from<CmtsCol name="DAYFROM" /></th>
                  <th className={TH}>Day to<CmtsCol name="DAYTO" /></th>
                  <th className={TH}>Rate /kg/day<CmtsCol name="AMOUNT" /></th>
                  <th className={TH}>Unit<CmtsCol name="UNIT" /></th>
                  <th className={TH}>Flat<CmtsCol name="FLATERATE" /></th>
                  <th className={TH}>Type<CmtsCol name="CHARGESTYPE" /></th>
                  <th className={TH}>Special<CmtsCol name="SPECIALCHARGES" /></th>
                </tr>
              </thead>
              <tbody>
                {storageRows.map((r) => {
                  const free = r.AMOUNT === 0;
                  return (
                    <tr
                      key={r.CHARGESID}
                      className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                      style={free ? { backgroundColor: "#F8FAFC" } : undefined}
                    >
                      <td className={TD_NUM}>{r.CHARGESID}</td>
                      <td className={TD}>{r.CLASSID}</td>
                      <td className={`${TD} font-mono text-[12px]`}>{r.LOCATIONABBR}</td>
                      <td className={TD_NUM}>{r.WEIGHTFROM}</td>
                      <td className={TD_NUM}><Nullable value={r.WEIGHTTO} /></td>
                      <td className={TD_NUM}>{r.DAYFROM}</td>
                      <td className={TD_NUM}><Nullable value={r.DAYTO} /></td>
                      <td className={TD_NUM}>
                        {free ? (
                          <span className="text-[#16A34A] font-semibold">0 · free period</span>
                        ) : (
                          formatPkr(r.AMOUNT)
                        )}
                      </td>
                      <td className={TD}><Unit code={r.UNIT} /></td>
                      <td className={TD}><Bool value={r.FLATERATE} /></td>
                      <td className={`${TD} font-mono text-[12px]`}>{r.CHARGESTYPE}</td>
                      <td className={TD_NUM}>{r.SPECIALCHARGES}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
            {CARGO_SUBCLASS_CHARGES.length} rows across all subclasses. CMTS keys this table on
            class AND subclass AND location AND weight band AND day band; the engine currently
            prices every consignment from the general-cargo light-weight band set
            (CMTS_SCHEMA_AUDIT §3.2/§3.3), which the resolution preview on the multi-tariff screen
            reports per consignment.
          </p>
        </>
      )}

      {/* ---------------- CargoClassCharges ---------------- */}
      {tab === "class" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className={TH}>Class<CmtsCol name="CLASSID" /></th>
                <th className={TH}>Abbr<CmtsCol name="ABBREVATION" /></th>
                <th className={TH}>Documentation<CmtsCol name="DOCUMENTATIONCHARGES" /></th>
                <th className={TH}>Deconsolidation<CmtsCol name="DECONSOLIDATIONCHARGES" /></th>
                <th className={TH}>Special handling<CmtsCol name="SPECIALHANDLINGCHARGES" /></th>
                <th className={TH}>Free days<CmtsCol name="derived from AMOUNT = 0" /></th>
              </tr>
            </thead>
            <tbody>
              {CARGO_CLASS_CHARGES.map((c) => (
                <tr key={c.CLASSID} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                  <td className={TD_NUM}>{c.CLASSID}</td>
                  <td className={`${TD} font-mono font-semibold text-[#0B2545]`}>{c.ABBREVATION}</td>
                  <td className={TD_NUM}>{formatPkr(c.DOCUMENTATIONCHARGES)}</td>
                  <td className={TD_NUM}>{formatPkr(c.DECONSOLIDATIONCHARGES)}</td>
                  <td className={TD_NUM}>{formatPkr(c.SPECIALHANDLINGCHARGES)}</td>
                  <td className={TD_NUM}>{c.FREEDAYS}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- LOCATIONCHARGES ---------------- */}
      {tab === "location" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Zone<CmtsCol name="LOCATIONID" /></th>
                  <th className={TH}>Weight from<CmtsCol name="WEIGHTFROM" /></th>
                  <th className={TH}>Weight to<CmtsCol name="WEIGHTTO" /></th>
                  <th className={TH}>Day from<CmtsCol name="DAYFROM" /></th>
                  <th className={TH}>Day to<CmtsCol name="DAYTO" /></th>
                  <th className={TH}>Unit<CmtsCol name="UNIT" /></th>
                  <th className={TH}>Flat<CmtsCol name="FLATERATE" /></th>
                  <th className={TH}>Amount / day<CmtsCol name="AMOUNT" /></th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {LOCATION_CHARGE_BANDS.map((b, i) => (
                  <tr key={`${b.zoneAbbr}-${i}`} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                    <td className={`${TD} font-mono font-semibold text-[#0B2545]`}>{b.zoneAbbr}</td>
                    <td className={TD_NUM}>{b.WEIGHTFROM}</td>
                    <td className={TD_NUM}><Nullable value={b.WEIGHTTO} /></td>
                    <td className={TD_NUM}>{b.DAYFROM}</td>
                    <td className={TD_NUM}><Nullable value={b.DAYTO} /></td>
                    <td className={TD}><Unit code={b.UNIT} /></td>
                    <td className={TD}><Bool value={b.FLATERATE} /></td>
                    <td className={TD_NUM}>
                      {b.AMOUNT === 0 ? (
                        <span className="text-[#94A3B8]">0 · no zone fee</span>
                      ) : (
                        formatPkr(b.AMOUNT)
                      )}
                    </td>
                    <td className={`${TD} whitespace-normal min-w-[220px]`}>{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
            Keyed on the zone abbreviation because the demo instantiates every zone once per site.
            <span className="font-mono"> lib/domain/masters.ts</span> fans these bands out across
            the three sites&apos; <span className="font-mono">LOCATIONID</span> values. A zero is a
            decision — &quot;no separate zone fee&quot; — not an unfinished row.
          </p>
        </>
      )}

      {/* ---------------- handling + surcharges ---------------- */}
      {tab === "handling" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Class<CmtsCol name="CLASSID" /></th>
                  <th className={TH}>Abbr<CmtsCol name="ABBREVATION" /></th>
                  <th className={TH}>Unit<CmtsCol name="HandlingchargesUnit" /></th>
                  <th className={TH}>Amount<CmtsCol name="Handlingchargesperkg" /></th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {HANDLING_CHARGES.map((h) => (
                  <tr key={h.ABBREVATION} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                    <td className={TD_NUM}><Nullable value={h.CLASSID} /></td>
                    <td className={`${TD} font-mono font-semibold text-[#0B2545]`}>{h.ABBREVATION}</td>
                    <td className={TD}><Unit code={h.UNIT} /></td>
                    <td className={TD_NUM}>{formatPkr(h.AMOUNT)}</td>
                    <td className={`${TD} whitespace-normal min-w-[240px]`}>{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <span className="text-[12px] font-bold text-[#0F172A]">Category surcharges</span>
            <span className="text-[11px] text-[#64748B] ml-2">
              FC-07 §07 — percentage uplift on the storage component
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Code</th>
                  <th className={TH}>Label</th>
                  <th className={TH}>Classes<CmtsCol name="CLASSID" /></th>
                  <th className={TH}>Uplift</th>
                </tr>
              </thead>
              <tbody>
                {ILLUSTRATIVE_CATEGORY_SURCHARGES.map((s) => (
                  <tr key={s.code} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                    <td className={`${TD} font-mono font-semibold text-[#0B2545]`}>{s.code}</td>
                    <td className={TD}>{s.label}</td>
                    <td className={`${TD} font-mono text-[12px]`}>{s.classIds.join(", ")}</td>
                    <td className={TD_NUM}>{s.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------------- TaxType ---------------- */}
      {tab === "tax" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Id<CmtsCol name="id" /></th>
                  <th className={TH}>Description<CmtsCol name="Description" /></th>
                  <th className={TH}>Charges type<CmtsCol name="ChargesType" /></th>
                  <th className={TH}>Percent<CmtsCol name="Amount" /></th>
                  <th className={TH}>DO tax<CmtsCol name="IsDo" /></th>
                  <th className={TH}>City<CmtsCol name="CityId" /></th>
                </tr>
              </thead>
              <tbody>
                {ILLUSTRATIVE_TAX_TYPES.map((t) => {
                  const selected = !t.IsDo && t.ChargesType.startsWith("GD");
                  return (
                    <tr key={t.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                      <td className={TD_NUM}>{t.id}</td>
                      <td className={TD}>
                        {t.Description}
                        {selected && (
                          <span className="ml-2 h-[18px] px-1.5 rounded bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold inline-flex items-center font-mono">
                            SELECTED BY THE RENT QUERY
                          </span>
                        )}
                      </td>
                      <td className={`${TD} font-mono text-[12px]`}>{t.ChargesType}</td>
                      <td className={TD_NUM}>{t.Amount}%</td>
                      <td className={TD}><Bool value={t.IsDo} /></td>
                      <td className={TD_NUM}><Nullable value={t.CityId} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
            CMTS picks the rent tax with{" "}
            <span className="font-mono">
              IsDo = 0 AND ChargesType LIKE &apos;GD%&apos;
            </span>{" "}
            and the delivery-order tax with <span className="font-mono">IsDo = 1</span>. The card is
            written so that predicate matches exactly one row — a rate table where the production
            query returns two rows or none is an outage, not a tariff.
          </p>
        </>
      )}

      {/* ---------------- Section82Days ---------------- */}
      {tab === "section82" && (
        <div className="p-5">
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden max-w-md">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Id<CmtsCol name="Id" /></th>
                  <th className={TH}>Days<CmtsCol name="Days" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD_NUM}>{SECTION_82_DAYS_ROW.Id}</td>
                  <td className={TD_NUM}>{SECTION_82_DAYS_ROW.Days}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-[#475569] mt-3 leading-relaxed max-w-2xl">
            One row, one number — that is the whole table in CMTS. It is the threshold after which
            uncleared cargo enters the Section 82 disposal pipeline (FC-10 branch C), and the aging
            engine counts toward it on TOTAL dwell, not on the chargeable remainder: the statutory
            clock does not pause for the free period.
          </p>
          <p className="text-[12px] mt-2 leading-relaxed max-w-2xl" style={{ color: "#B91C1C" }}>
            Of everything on this card, this is the value most likely to be mistaken for law. It is
            set by customs statute rather than by the terminal, and nobody on the build team has
            verified it. 30 is a round placeholder.
          </p>
        </div>
      )}

      {/* ---------------- Lookup ---------------- */}
      {tab === "lookup" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={TH}>Key</th>
                  <th className={TH}>Value</th>
                  <th className={TH}>Group</th>
                  <th className={TH}>Origin</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {RATE_CARD_LOOKUPS.map((l) => (
                  <tr key={l.key} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                    <td className={`${TD} font-mono text-[12px] font-semibold text-[#0B2545]`}>{l.key}</td>
                    <td className={`${TD} font-mono text-[12px]`}>{l.value}</td>
                    <td className={`${TD} font-mono text-[12px]`}>{l.group}</td>
                    <td className={TD}>
                      <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold inline-flex items-center font-mono">
                        {l.migrated ? "MIGRATED" : "DEMO-SEEDED"}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-normal min-w-[240px]`}>{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
            Per decision Q6 the key/value editor is built KEY-AGNOSTIC: the keys CMTS actually uses
            cannot be recovered from an empty database, so nothing here claims to be the real key
            set. These are the keys this demo itself needs, each marked demo-seeded, and an import
            must tolerate keys it has never seen rather than rejecting them. The column NAMES are
            AirVault&apos;s, not CMTS&apos;s — inventing five uppercase names would fabricate parity
            nobody could check.
          </p>
        </>
      )}
    </div>
  );
}
