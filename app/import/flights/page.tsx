"use client";

/**
 * P1-1 · M01 Flight & Airline Data console.
 *
 * FC-02's Airline / Carrier swimlane:
 *   Flight arrival notification → FFM / FWB / FHL received
 *   → Cargo + flight pouch (Concertina) handed over to terminal
 *
 * FC-12 puts M01 in Tier 1 feeding the M03 indexing hub. The demo had no
 * operational flight board — Planner's demand forecast is a planning view,
 * not this record.
 *
 * A flight missing its pre-arrival messages is flagged here, because that
 * is what fires AWD ("awaiting documentation") in FC-05.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Plane, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { useSite } from "@/components/site/SiteContext";
import {
  AIRLINES,
  PRE_ARRIVAL_MESSAGES,
  formatDate,
  formatDateTime,
  formatKg,
  formatPkr,
  listAwbs,
  listManifests,
  type Manifest,
} from "@/lib/domain";

function messageCompleteness(m: Manifest) {
  const missing = PRE_ARRIVAL_MESSAGES.filter((t) => !m.messages[t].received);
  return { missing, complete: missing.length === 0 };
}

export default function FlightBoardPage() {
  const { scope, isHq } = useSite();
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const manifests = useMemo(() => {
    let rows = listManifests(scope);
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (m) =>
          m.FLIGHT.toLowerCase().includes(s) ||
          m.IGMNO.toLowerCase().includes(s) ||
          m.AIRLINENAME.toLowerCase().includes(s) ||
          m.REGNO.toLowerCase().includes(s),
      );
    }
    if (onlyIncomplete) rows = rows.filter((m) => !messageCompleteness(m).complete);
    return rows.sort((a, b) => Date.parse(b.CARGODATE) - Date.parse(a.CARGODATE));
  }, [scope, q, onlyIncomplete]);

  const incompleteCount = listManifests(scope).filter((m) => !messageCompleteness(m).complete).length;
  const sel = selected ? manifests.find((m) => m.ManifiestId === selected) : null;
  const selAwbs = sel ? listAwbs({ scope }).filter((a) => a.ManifiestId === sel.ManifiestId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "Flight & Airline Data" }]} />
        <div>
          <div className="flex items-center gap-2">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M01
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-02
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Flight &amp; Airline Data
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Inbound flights with pre-arrival message completeness and pouch handover.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Inbound flights", value: listManifests(scope).length, tone: "#0F172A" },
          { label: "Missing pre-arrival msgs", value: incompleteCount, tone: incompleteCount ? "#D97706" : "#16A34A" },
          { label: "Open IGMs", value: listManifests(scope).filter((m) => !m.IsCloseIGM).length, tone: "#1B4F8B" },
          { label: "AWBs on manifest", value: listAwbs({ scope }).length, tone: "#0F172A" },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[26px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-[380px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Flight, IGM, airline or registration…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none focus:border-[#2E75B6] transition-colors"
          />
        </div>
        <button
          onClick={() => setOnlyIncomplete((v) => !v)}
          className="h-9 px-3 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors"
          style={{
            borderColor: onlyIncomplete ? "#D97706" : "#E2E8F0",
            backgroundColor: onlyIncomplete ? "#FEF3C7" : "white",
            color: onlyIncomplete ? "#D97706" : "#64748B",
          }}
        >
          Missing pre-arrival messages only
        </button>
      </div>

      {manifests.length === 0 ? (
        <EmptyState title="No flights match" description="Try clearing the filters or switching site." />
      ) : (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5">Flight</th>
                  <th className="text-left px-4 py-2.5">Airline</th>
                  <th className="text-left px-4 py-2.5">Reg</th>
                  <th className="text-left px-4 py-2.5">Route</th>
                  <th className="text-left px-4 py-2.5">Cargo date</th>
                  <th className="text-left px-4 py-2.5">IGM</th>
                  <th className="text-right px-4 py-2.5">Weight</th>
                  <th className="text-left px-4 py-2.5">Pre-arrival messages</th>
                  <th className="text-left px-4 py-2.5">IGM state</th>
                </tr>
              </thead>
              <tbody>
                {manifests.map((m) => {
                  const c = messageCompleteness(m);
                  return (
                    <tr
                      key={m.ManifiestId}
                      onClick={() => setSelected(m.ManifiestId === selected ? null : m.ManifiestId)}
                      className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      style={{ backgroundColor: selected === m.ManifiestId ? "#EBF0F7" : undefined }}
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold">{m.FLIGHT}</td>
                      <td className="px-4 py-2.5">{m.AIRLINENAME}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[#64748B]">{m.REGNO}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">
                        {m.ORIGIN} → {m.DESTINATION}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(m.CARGODATE)}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[#64748B]">{m.IGMNO}</td>
                      <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap">
                        {formatKg(m.TOTALWEIGHT)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {PRE_ARRIVAL_MESSAGES.map((t) => (
                            <span
                              key={t}
                              title={
                                m.messages[t].received
                                  ? `${t} received ${formatDateTime(m.messages[t].receivedAt!)}`
                                  : `${t} not received — fires AWD`
                              }
                              className="h-[20px] px-1.5 rounded text-[10px] font-bold inline-flex items-center font-mono"
                              style={{
                                backgroundColor: m.messages[t].received ? "#DCFCE7" : "#FEE2E2",
                                color: m.messages[t].received ? "#16A34A" : "#DC2626",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                          style={{
                            backgroundColor: m.IsCloseIGM ? "#F1F5F9" : "#DBEAFE",
                            color: m.IsCloseIGM ? "#64748B" : "#1B4F8B",
                          }}
                        >
                          {m.IsCloseIGM ? "Closed" : "Open"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected flight detail */}
      {sel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Plane size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Pre-arrival messages</h3>
            </div>
            <div className="flex flex-col gap-2">
              {PRE_ARRIVAL_MESSAGES.map((t) => {
                const r = sel.messages[t];
                return (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2.5"
                  >
                    {r.received ? (
                      <CheckCircle2 size={15} className="text-[#16A34A] flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={15} className="text-[#DC2626] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] font-mono">{t}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {r.received ? formatDateTime(r.receivedAt!) : "Not received — AWD trigger"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
              FC-05 group A. A missing message fires AWD (Awaiting Documentation) through the
              notification engine.
            </p>
          </div>

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">Pouch / concertina handover</h3>
            <div className="flex flex-col gap-3">
              {[
                ["Received by", sel.USERID],
                ["Cargo date", formatDateTime(sel.CARGODATE)],
                ["Manifest date", formatDateTime(sel.MANIFESTDATE)],
                ["Posting date", sel.POSTINGDATE ? formatDateTime(sel.POSTINGDATE) : "—"],
                ["Manifest status", sel.MANIFESTSTATUS],
              ].map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {l}
                  </span>
                  <span className="text-[13px] font-medium text-[#0F172A] text-right">{v}</span>
                </div>
              ))}
            </div>
            <Link
              href="/import/manifest"
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              Open manifest reconciliation <ArrowUpRight size={12} />
            </Link>
          </div>

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">
              AWBs on this flight ({selAwbs.length})
            </h3>
            {selAwbs.length === 0 ? (
              <p className="text-[13px] text-[#64748B]">None indexed yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto">
                {selAwbs.map((a) => (
                  <Link
                    key={a.AWBId}
                    href={`/awb/${a.AWBId}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 hover:bg-[#F8FAFC] no-underline transition-colors"
                  >
                    <span className="font-mono text-[12px] font-semibold text-[#1B4F8B]">
                      {a.AWBNO}
                    </span>
                    <span className="text-[11px] text-[#64748B] truncate max-w-[120px]">
                      {a.CONSIGNEE1}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Airline reference — DOBYSAPS / DOAMOUNT drive DO charging in Phase 5.
       *
       * Every column in this table is a real CMTS AIRLINE column, so each one
       * is labelled with its column name: the card is the parity view for the
       * table and a reader has to be able to check it against the schema
       * without opening the domain file. */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">Airline reference</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            CMTS AIRLINE — DOBYSAPS and DOAMOUNT drive DO charging at P5-7
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-2.5">
                  Code <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">AIRLINEID</span>
                </th>
                {/* ABBREVATION is varchar(15) and AIRLINEID is the IATA code —
                    legacy allows a house abbreviation that is not the code, so
                    the two are shown side by side rather than one standing in
                    for the other. They match on today's data; that is a
                    property of the data, not of the schema. */}
                <th className="text-left px-4 py-2.5">
                  Abbr <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">ABBREVATION</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  Airline <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">DESCRIPTION</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  Country <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">COUNTRY</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  Logo <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">LOGO</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  DO by SAPS <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">DOBYSAPS</span>
                </th>
                <th className="text-right px-4 py-2.5">
                  DO amount <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">DOAMOUNT</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  Scheduled <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">SCHEDULED</span>
                </th>
                <th className="text-left px-4 py-2.5">
                  IATA <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">APPROVEDBYIATA</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {AIRLINES.map((a) => (
                <tr key={a.ID} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-semibold">{a.AIRLINEID}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[#64748B]">{a.ABBREVATION}</td>
                  <td className="px-4 py-2.5">{a.DESCRIPTION}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{a.COUNTRY}</td>
                  {/* LOGO is a path into the legacy CMTS image share, not a URL
                      and not the artwork. AirVault has no asset pipeline, so
                      pointing an <img> at it would give every carrier a broken
                      image icon. The tile below is a text stand-in built from
                      ABBREVATION, and the migration value itself is rendered
                      verbatim beside it — that string, not a picture, is what
                      has to survive the migration and be checkable here. */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded flex-shrink-0 inline-flex items-center justify-center font-mono text-[9px] font-bold"
                        style={{
                          backgroundColor: a.LOGO ? "#F1F5F9" : "transparent",
                          color: a.LOGO ? "#64748B" : "#CBD5E1",
                          border: a.LOGO ? "1px solid #E2E8F0" : "1px dashed #E2E8F0",
                        }}
                        title={a.LOGO ? `Logo on file — ${a.LOGO}` : "No logo on file"}
                      >
                        {a.ABBREVATION}
                      </span>
                      {a.LOGO ? (
                        <span
                          className="font-mono text-[11px] text-[#94A3B8] truncate max-w-[190px]"
                          title={a.LOGO}
                        >
                          {a.LOGO}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#CBD5E1]">No logo on file</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                      style={{
                        backgroundColor: a.DOBYSAPS ? "#DCFCE7" : "#F1F5F9",
                        color: a.DOBYSAPS ? "#16A34A" : "#64748B",
                      }}
                    >
                      {a.DOBYSAPS ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatPkr(a.DOAMOUNT)}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{a.SCHEDULED ? "Scheduled" : "Charter"}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{a.APPROVEDBYIATA ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#64748B]">
            LOGO is a server-relative path into the legacy CMTS image share, carried across as an
            opaque string — the artwork itself does not migrate with it, and NULL is a normal value
            because legacy never required a logo on file.
          </p>
        </div>
      </div>
    </div>
  );
}
