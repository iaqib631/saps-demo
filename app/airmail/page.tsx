"use client";

/**
 * P9-6 · Airmail dispatch register — M26, FC-18 §01–§04. **New module.**
 *
 * FC-18 was declared with twelve steps and every one carrying `href: null`:
 * a flow fully specified and entirely unbuilt. This is the first screen
 * behind it, and the entry point for the other four.
 *
 * WHY A REGISTER AND NOT A SINGLE CONSOLE
 * ---------------------------------------
 * Airmail's unit of work is the **dispatch**, and three of FC-18's later
 * steps — §05 irregularities, §06 segregation, §07/§08 transfer — are
 * cross-cutting views over the same set of dispatches rather than stages a
 * single record passes through in one place. A one-page console would make
 * every one of those cross-links a tab-state change: not linkable, not
 * bookmarkable, and impossible to point a flow step at. So the shape is a
 * register plus a real `/airmail/[dispatchId]` entity route, with the three
 * cross-cutting registers beside it. Each of the five screens owns steps
 * nothing else owns.
 *
 * WHAT THIS SCREEN ANSWERS
 * ------------------------
 * §01 mail received off the flight against the AV7 delivery bill, and §02 the
 * dispatch identified — PO of origin, PO of destination, mail type. Both are
 * register facts: the whole point of the register is the list of what came
 * off which flight and what it was identified as.
 *
 * It also carries §04's *answer* per row — the variance column — because a
 * register that cannot tell you which dispatch is in trouble is a filing
 * cabinet. The §04 working, tolerance and headroom, is on the detail.
 *
 * NOT AN AWB LIST. There is no AWB number, no consignee, no piece count and
 * no HAWB here, because a postal dispatch has none of those. It has a
 * dispatch number, a delivery bill and receptacles.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Mailbox,
  Scale,
  Send,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useSite } from "@/components/site/SiteContext";
import { formatDateTime, formatKg } from "@/lib/domain";
import {
  AIRMAIL_STAGE_LABEL,
  AIRMAIL_WEIGHT_TOLERANCE,
  airmailKpis,
  dispatchVariance,
  isIrregularityOpen,
  listAirmailDispatches,
  type AirmailDispatch,
} from "@/lib/domain/airmail";
import AirmailNav, { AirmailProvenanceNote } from "./AirmailNav";
import { Card, Chip, DispatchLink, Kpi } from "./ui";

type Filter = "all" | "open" | "irregular" | "unweighed" | "onward";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All dispatches" },
  { key: "open", label: "Open" },
  { key: "irregular", label: "In irregularity" },
  { key: "unweighed", label: "Awaiting the scale" },
  { key: "onward", label: "Onward leg" },
];

function matches(d: AirmailDispatch, f: Filter): boolean {
  switch (f) {
    case "open":
      return d.stage !== "AM11-closed";
    case "irregular":
      return d.irregularity !== null && isIrregularityOpen(d.irregularity);
    case "unweighed":
      return d.receptacles.some((r) => r.weighedKg === null);
    case "onward":
      return d.onwardLegRequired;
    default:
      return true;
  }
}

export default function AirmailRegisterPage() {
  const { scope, isHq } = useSite();
  const [filter, setFilter] = useState<Filter>("all");

  const all = useMemo(() => listAirmailDispatches(scope), [scope]);
  const kpis = useMemo(() => airmailKpis(scope), [scope]);
  const rows = useMemo(() => all.filter((d) => matches(d, filter)), [all, filter]);

  return (
    <div className="flex flex-col gap-6">
      <AirmailNav
        crumb="Dispatch register"
        title="Airmail dispatch register"
        subtitle={
          <>
            Postal cargo received off the flight against the AV7 delivery bill — counted in
            receptacles, not pieces, and moving on a dispatch, not an air waybill.
            {isHq ? " All sites." : ` ${scope} only.`}
          </>
        }
      />

      <AirmailProvenanceNote />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Dispatches" value={String(kpis.dispatches)} note={`${kpis.open} still open`} />
        <Kpi
          label="In irregularity"
          value={String(kpis.inIrregularity)}
          tone={kpis.inIrregularity > 0 ? "#DC2626" : "#16A34A"}
          note={kpis.shortKg > 0 ? `${formatKg(kpis.shortKg)} short of gross` : "No open shortage"}
        />
        <Kpi
          label="Awaiting the scale"
          value={String(kpis.awaitingWeigh)}
          tone={kpis.awaitingWeigh > 0 ? "#D97706" : "#0F172A"}
          note={`${kpis.receptacles} receptacles on the register`}
        />
        <Kpi
          label="Onward legs"
          value={String(kpis.onwardLegs)}
          note={`${kpis.dutiableItems} dutiable items · ${kpis.customsDetained} detained`}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count = all.filter((d) => matches(d, f.key)).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5"
              style={{
                backgroundColor: active ? "#0B2545" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#475569",
                borderColor: active ? "#0B2545" : "#E2E8F0",
              }}
            >
              {f.label}
              <span className="font-mono text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Mailbox size={28} className="text-[#94A3B8]" />}
          title="No dispatches match this filter"
          description="Airmail arrives against an AV7 delivery bill on a specific flight. Widen the filter, or switch site scope."
        />
      ) : (
        <Card
          title="Dispatches"
          icon={<Mailbox size={15} />}
          subtitle={
            <>
              §01 received against the AV7 · §02 identified by PO of origin, PO of destination and
              mail type · §04 answered in the variance column
            </>
          }
          footer={
            <>
              The variance column is §04&apos;s answer, not its working: it compares the AV7 gross
              against the scale and tests the difference against a{" "}
              {(AIRMAIL_WEIGHT_TOLERANCE * 100).toFixed(1)}% tolerance with a 1.5 kg floor. A
              dispatch still on its way to the scale reads <em>not weighed</em> rather than 100%
              short — otherwise every un-weighed dispatch would light up as an irregularity, which is
              the opposite of useful. Open a row for the working.
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="bg-white border-b border-[#E2E8F0]">
                  {[
                    "Dispatch / AV7",
                    "Exchange offices",
                    "Mail type",
                    "Flight",
                    "Receptacles",
                    "AV7 gross",
                    "Physical",
                    "§04 variance",
                    "Stage",
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
                {rows.map((d) => {
                  const v = dispatchVariance(d);
                  const open = d.irregularity !== null && isIrregularityOpen(d.irregularity);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                      style={{ backgroundColor: open ? "#FEF2F2" : undefined }}
                    >
                      <td className="px-4 py-3 align-top">
                        <DispatchLink id={d.id} dispatchNo={d.dispatchNo} />
                        <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">{d.av7No}</p>
                        {d.irregularity && (
                          <div className="mt-1">
                            <Chip
                              bg={open ? "#FEE2E2" : "#DCFCE7"}
                              fg={open ? "#DC2626" : "#16A34A"}
                            >
                              {d.irregularity.cn43Ref}
                            </Chip>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-[#0F172A] font-medium">
                          {d.poOrigin.code} → {d.poDestination.code}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] leading-snug">
                          {d.poOrigin.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                            {d.mailType.Abbreviation}
                          </span>
                          {d.mailType.priority && (
                            <Chip bg="#EEF2FF" fg="#4338CA">
                              PRIORITY
                            </Chip>
                          )}
                        </div>
                        <p className="text-[11px] text-[#94A3B8] leading-snug">
                          {d.bill.ShipmentType}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-[#0F172A] font-medium">{d.arrivedFlight}</p>
                        <p className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {formatDateTime(d.arrivedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-[#0F172A] font-medium">
                          {d.receptacles.length}
                        </p>
                        {d.receptacles.some((r) => r.weighedKg === null) && (
                          <Chip bg="#FEF3C7" fg="#D97706">
                            {d.receptacles.filter((r) => r.weighedKg === null).length} NOT PRESENTED
                          </Chip>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-[12px] text-[#0F172A] whitespace-nowrap">
                        {formatKg(d.weights.grossKg)}
                      </td>
                      <td className="px-4 py-3 align-top text-[12px] whitespace-nowrap">
                        {v.pending ? (
                          <span className="text-[#CBD5E1]">—</span>
                        ) : (
                          <span className="text-[#0F172A]">{formatKg(d.weights.physicalKg)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {v.pending ? (
                          <Chip bg="#F1F5F9" fg="#64748B">
                            NOT WEIGHED
                          </Chip>
                        ) : v.beyondTolerance ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-[#DC2626] whitespace-nowrap">
                              {v.measure.delta > 0 ? "+" : ""}
                              {v.measure.delta.toFixed(2)} kg
                            </span>
                            <span className="text-[11px] text-[#DC2626]">
                              {(v.measure.ratio * 100).toFixed(2)}% · beyond tolerance
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-medium text-[#16A34A] whitespace-nowrap">
                              {v.measure.delta > 0 ? "+" : ""}
                              {v.measure.delta.toFixed(2)} kg
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              {formatKg(v.headroomKg)} headroom
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[11px] text-[#475569] leading-snug max-w-[220px]">
                          {AIRMAIL_STAGE_LABEL[d.stage]}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          href="/airmail/irregularities"
          className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 no-underline hover:border-[#CBD5E1] transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#DC2626]" />
            <span className="text-[13px] font-semibold text-[#0F172A]">§05 · Irregularities</span>
            <ArrowUpRight size={13} className="text-[#94A3B8] ml-auto" />
          </div>
          <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
            The CN-43 verification notes raised when §04 says yes — a record with a lifecycle, not
            the 40 characters of free text CMTS reduced it to.
          </p>
        </Link>
        <Link
          href="/airmail/segregation"
          className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 no-underline hover:border-[#CBD5E1] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Boxes size={15} className="text-[#1B4F8B]" />
            <span className="text-[13px] font-semibold text-[#0F172A]">§06 · Segregation</span>
            <ArrowUpRight size={13} className="text-[#94A3B8] ml-auto" />
          </div>
          <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
            Mail stored by type across the postal zones. The mail-type → zone rule is AirVault&apos;s;
            CMTS has none, which is why FC-03 cannot allocate airmail.
          </p>
        </Link>
        <Link
          href="/airmail/transfer-manifest"
          className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 no-underline hover:border-[#CBD5E1] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Send size={15} className="text-[#7C3AED]" />
            <span className="text-[13px] font-semibold text-[#0F172A]">§07–08 · Onward leg</span>
            <ArrowUpRight size={13} className="text-[#94A3B8] ml-auto" />
          </div>
          <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
            The transfer manifest to the receiving carrier or station, behind a gate that an open
            irregularity holds shut.
          </p>
        </Link>
      </div>

      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2">
          <Scale size={15} className="text-[#64748B]" />
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Two FC-18 steps have no screen, deliberately
          </h3>
        </div>
        <ul className="mt-2.5 flex flex-col gap-2">
          <li className="text-[12px] text-[#475569] leading-relaxed">
            <span className="font-mono text-[11px] text-[#94A3B8]">§10</span> — chargeable under the
            tariff, or contract-billed to the Post Office? This is BLK-01: there is no airmail rate
            anywhere in the tariff master, so a screen here would have to invent one. Left unbuilt
            rather than answered by fixture.
          </li>
          <li className="text-[12px] text-[#475569] leading-relaxed">
            <span className="font-mono text-[11px] text-[#94A3B8]">§12</span> — dispatch closed and
            archived. Closure folds into M20 audit &amp; archive when that module exists; a closed
            dispatch is already visible here as a stage, so a dedicated screen would be a filter with
            a route.
          </li>
        </ul>
      </div>
    </div>
  );
}
