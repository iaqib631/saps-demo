"use client";

/**
 * /auditor/cargo-trace — FC-12 §16.
 *
 * WHAT THIS SCREEN WAS. AWB 117-23456123, which appears in no fixture, with a
 * 23-step timeline of invented states ("Pouch Opened", "Manifest Reconciled",
 * "Segregated") attributed to invented people and evidenced by invented
 * filenames; a header reading "23 events" as a literal beside the 23-row array;
 * eight invented pieces on invented EPCs, all at "Dispatched" or "Stored"; and
 * four exception branches every one of which asserted "Not triggered" without
 * consulting anything. The five search modes all re-rendered the same shipment
 * whatever was typed into them.
 *
 * WHAT IT IS NOW. The same screen against real consignments. All five lookups
 * resolve — AWB, IGM, RFID EPC, gate pass and delivery order — the timeline is
 * assembled by walking the twenty-six collections `getAwb()` already links, the
 * piece table is the AWB's real pieces, and the six branches consult the six
 * registers they name. The event count is the length of the array beside it.
 *
 * THE MOST IMPORTANT CHANGE IS THE BRANCHES. "Not triggered" was asserted; it
 * is now derived, and it distinguishes three states where the old screen had
 * one: a branch with a case on file, a branch whose check RAN and found nothing
 * (the variance screen inside tolerance — FC-04's own distinction), and a
 * branch that cannot apply to this consignment at all. An auditor being told
 * "no discrepancy" cannot act on it without knowing which of those three it is.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, GitBranch, Route, Search, ShieldQuestion } from "lucide-react";
import DataTable from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { HqCard, NotAvailable, SeverityPill } from "@/components/hq/HqUi";
import { DEMO_NOW, formatDateTime, formatKg, storageLocation } from "@/lib/domain";
import { AuditorStat } from "../AuditorUi";
import TraceTimeline from "../TraceTimeline";
import {
  CARGO_LOOKUPS,
  cargoTrace,
  resolveCargoRef,
  traceableAwbs,
  type CargoLookupKind,
} from "../traceModel";

export default function CargoTraceContent() {
  const awbs = useMemo(() => traceableAwbs(), []);

  const [kind, setKind] = useState<CargoLookupKind>("awb");
  const [value, setValue] = useState(awbs[0]?.AWBNO ?? "");
  const [awbId, setAwbId] = useState<number | null>(awbs[0]?.awbId ?? null);
  const [miss, setMiss] = useState<string | null>(null);

  const trace = useMemo(() => (awbId === null ? null : cargoTrace(awbId)), [awbId]);

  const runSearch = () => {
    const hit = resolveCargoRef(kind, value);
    if (hit === null) {
      setMiss(value.trim());
      setAwbId(null);
      return;
    }
    setMiss(null);
    setAwbId(hit);
  };

  const activeLookup = CARGO_LOOKUPS.find((l) => l.kind === kind);

  return (
    <div className="space-y-6">
      {/* ---- Search ---------------------------------------------------- */}
      <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[#E2E8F0]">
            {CARGO_LOOKUPS.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => setKind(opt.kind)}
                className="h-9 cursor-pointer whitespace-nowrap px-3 text-[12px] font-medium transition-colors"
                style={{
                  backgroundColor: kind === opt.kind ? "#0B2545" : "white",
                  color: kind === opt.kind ? "white" : "#64748B",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder={`Enter ${activeLookup?.label ?? "reference"}…`}
              className="h-9 w-full rounded-lg border border-[#E2E8F0] pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2E75B6]"
            />
          </div>
          <button
            onClick={runSearch}
            className="h-9 cursor-pointer whitespace-nowrap rounded-lg px-5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            Trace
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            On file
          </span>
          <select
            value={awbId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setAwbId(id);
              setValue(awbs.find((a) => a.awbId === id)?.AWBNO ?? "");
              setMiss(null);
            }}
            className="h-8 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[12px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            {awbs.map((a) => (
              <option key={a.awbId} value={a.awbId}>
                {a.AWBNO} — {a.site} · {a.stage}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[#64748B]">
            {awbs.length} consignments across all three nodes — every one traceable.
          </span>
        </div>

        <p className="mt-2 font-mono text-[10px] text-[#94A3B8]">
          {activeLookup?.source}
        </p>
      </div>

      {/* ---- Miss ------------------------------------------------------ */}
      {miss !== null && (
        <EmptyState
          title={`No consignment matches “${miss}”`}
          description="The reference is not on file at KHI, LHE or PEW. A search that cannot match now says so — the previous version of this screen re-rendered one fabricated shipment whatever was typed."
        />
      )}

      {/* ---- Trace ----------------------------------------------------- */}
      {trace && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AuditorStat
              label="Dated records on this consignment"
              value={trace.events.length.toLocaleString("en-PK")}
              detail={`From ${formatDateTime(trace.events[0]?.at ?? DEMO_NOW)} to ${formatDateTime(
                trace.events[trace.events.length - 1]?.at ?? DEMO_NOW,
              )}`}
              source="cargoTrace(awbId).events.length"
            />
            <AuditorStat
              label="Lifecycle stage"
              value={trace.bundle.awb.stage}
              detail={`${trace.bundle.awb.site} · ${trace.bundle.cargoClass.NAME} · ${trace.bundle.awb.AIRLINENAME} ${trace.bundle.awb.FLIGHT}`}
              source="getAwb(awbId).awb.stage"
              href={`/awb/${trace.bundle.awb.AWBId}`}
            />
            <AuditorStat
              label="Dwell"
              value={`${trace.bundle.dwell.totalDays} days`}
              detail={`${trace.bundle.dwell.freeDays} free, ${trace.bundle.dwell.chargeableDays} chargeable · ${trace.bundle.dwell.daysToSection82} days to the Section 82 deadline`}
              source="getAwb(awbId).dwell"
              severity={trace.bundle.dwell.longStay ? "critical" : "neutral"}
              status={trace.bundle.dwell.longStay ? "long-stay" : undefined}
            />
            <AuditorStat
              label="Pieces"
              value={`${trace.bundle.pieces.length}`}
              detail={`${trace.bundle.awb.TOTALPCS} declared on the AWB · ${formatKg(
                trace.bundle.awb.TOTALWEIGHT,
              )} · ${trace.bundle.documents.length} documents on file`}
              source="getAwb(awbId).pieces · awb.TOTALPCS"
              severity={
                trace.bundle.pieces.length === trace.bundle.awb.TOTALPCS ? "good" : "warning"
              }
              status={
                trace.bundle.pieces.length === trace.bundle.awb.TOTALPCS
                  ? "matches"
                  : "differs from the AWB"
              }
            />
          </div>

          <HqCard
            title={`End-to-end trail — AWB ${trace.bundle.awb.AWBNO}`}
            icon={Route}
            source="cargoTrace(awbId) · components/auditor/traceModel.ts"
            intro={`${trace.events.length} dated records, oldest first. Each node names the fixture field it was read from; where a record has no actor column, the node says which record rather than naming a person.`}
            action={{ label: "Open the AWB hub", href: `/awb/${trace.bundle.awb.AWBId}` }}
          >
            <TraceTimeline events={trace.events} />
          </HqCard>

          {/* ---- Pieces -------------------------------------------------- */}
          <HqCard
            title="Piece trace"
            icon={Boxes}
            source="getAwb(awbId).pieces · lib/domain/cargo.ts"
            intro="The AWB's real pieces. `lastMovementAt` and `lastMovementBy` are the only movement columns a piece carries — one movement, not a history — so this is where the piece is and who last touched it, not a per-scan log."
          >
            {trace.bundle.pieces.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">
                No pieces have been booked in against this AWB yet.
              </p>
            ) : (
              <DataTable
                columns={[
                  { key: "pieceId", header: "Piece", width: "110px" },
                  { key: "rfid", header: "RFID EPC", width: "230px" },
                  { key: "scanState", header: "Scan state", width: "110px" },
                  { key: "location", header: "Location", width: "180px" },
                  { key: "weight", header: "Chargeable", width: "110px" },
                  { key: "movedAt", header: "Last movement", width: "150px" },
                  { key: "movedBy", header: "By", width: "110px" },
                ]}
                rows={trace.bundle.pieces.map((p) => ({
                  pieceId: (
                    <span className="font-mono text-[12px] font-medium text-[#0F172A]">
                      {p.pieceId}
                    </span>
                  ),
                  rfid: p.rfidEpc ? (
                    <span className="font-mono text-[11px] text-[#334155]">{p.rfidEpc}</span>
                  ) : (
                    <span className="text-[11px] italic text-[#94A3B8]">not yet tagged</span>
                  ),
                  scanState: (
                    <span className="inline-flex h-6 items-center rounded-full bg-[#F1F5F9] px-2 text-[11px] font-semibold text-[#334155]">
                      {p.scanState}
                    </span>
                  ),
                  location: (
                    <span className="text-[12px] text-[#334155]">
                      {p.locationId === null
                        ? "—"
                        : (storageLocation(p.locationId)?.NAME ?? `Location ${p.locationId}`)}
                    </span>
                  ),
                  weight: (
                    <span className="text-[12px] tabular-nums text-[#334155]">
                      {formatKg(p.weights.chargeableKg)}
                    </span>
                  ),
                  movedAt: (
                    <span className="font-mono text-[11px] text-[#64748B]">
                      {p.lastMovementAt ? formatDateTime(p.lastMovementAt) : "—"}
                    </span>
                  ),
                  movedBy: (
                    <span className="text-[12px] text-[#0F172A]">{p.lastMovementBy ?? "—"}</span>
                  ),
                }))}
                headerStyle="navy"
              />
            )}
          </HqCard>

          {/* ---- Branches ------------------------------------------------ */}
          <HqCard
            title="Exception branches"
            icon={GitBranch}
            source="getAwb(awbId).cdrs / damage / reExport / longStay / mishandled · retenderGateFor(awbId)"
            intro="Three states, not one. “Raised” means a case exists; “clear” means the check ran and found nothing; “not applicable” means the branch cannot apply to this consignment. The screen this replaces printed “Not triggered” on all four without consulting anything."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {trace.branches.map((b) => (
                <div
                  key={b.label}
                  className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#0F172A]">{b.label}</span>
                    <SeverityPill
                      severity={
                        b.state === "raised" ? "warning" : b.state === "clear" ? "good" : "neutral"
                      }
                      label={
                        b.state === "raised"
                          ? "Case on file"
                          : b.state === "clear"
                            ? "Checked — clear"
                            : "Not applicable"
                      }
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#475569]">{b.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-[10px] text-[#94A3B8]">{b.source}</p>
                    {b.href && (
                      <Link
                        href={b.href}
                        className="text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                      >
                        Register
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </HqCard>

          {/* ---- Closure ------------------------------------------------- */}
          {trace.closure && (
            <HqCard
              title="Closure checklist"
              icon={ShieldQuestion}
              source="closureFor(awbId) · lib/domain/fixtures.ts"
              intro="FC-08's file-closure gate as it actually evaluates for this consignment — the conditions, and which of them pass."
            >
              <div className="flex flex-col gap-2">
                {trace.closure.items.map((item) => (
                  <div
                    key={item.code}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#F1F5F9] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold text-[#0F172A]">{item.label}</span>
                      <p className="text-[11px] text-[#64748B]">{item.detail}</p>
                    </div>
                    <SeverityPill
                      severity={item.pass ? "good" : "warning"}
                      label={item.pass ? "Pass" : "Not yet"}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">
                {trace.closure.closedAt
                  ? `Closed ${formatDateTime(trace.closure.closedAt)} by ${trace.closure.closedBy ?? "an unrecorded actor"}.`
                  : trace.closure.canClose
                    ? "Every applicable condition passes; the file has not been closed."
                    : "The file cannot be closed yet."}
              </p>
            </HqCard>
          )}

          {/* ---- Gaps ---------------------------------------------------- */}
          <HqCard
            title="What this trace cannot show, and why"
            icon={ShieldQuestion}
            source="no fixture — stated rather than estimated"
            intro="Four things the previous version of this screen displayed that no record in this build supports."
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <NotAvailable
                title="A per-state transition history"
                reason="An AWB carries one `stage` and one `Process` — where it is now — and no log of how it got there. The twenty-three named states the old timeline drew (Awaited, Received, Pouch Opened, Manifest Reconciled, Indexed, Tagged RFID, Segregated, Accepted, Weighed & Inspected, Storage Allocated, Stored…) are FC-01 steps, not columns: nothing timestamps the move between them."
                nearest="The dated records each stage LEAVES BEHIND — a document filed, a message sent, a clearance lodged, a voucher raised — which is what the timeline above is built from and is checkable per row."
              />
              <NotAvailable
                title="A per-scan RFID read log"
                reason="`Piece` carries `lastMovementAt` and `lastMovementBy`: the most recent movement, overwritten each time. There is no scan-event table, so a piece read at putaway, at retrieval and at gate-out shows one row, not three, and the eight-row 'Piece Trace' that used to claim a scan event per piece was showing the same one movement eight times over."
                nearest="The piece table above, with the scan state and the single movement each piece genuinely records."
              />
              <NotAvailable
                title="Evidence files"
                reason="Document rows are metadata — id, type, title, pages, size, uploader, version chain — and there are no files behind them. The old timeline hung a filename on every one of its twenty-three steps (ffm_23456123.xml, rfid_tag_12pcs.txt, pod_V1356_56123.pdf); none of those existed either, which made the fabrication harder to spot rather than easier."
                nearest="The document id on each node, which resolves to a real StoredDocument row with its own version history."
              />
              <NotAvailable
                title="Who has looked at this consignment"
                reason="No store records reads at any tier. A trace can show every write against this AWB and nothing at all about who examined it — including this session."
                nearest="The write trail on the auditor home, and the actor column on each node above."
              />
            </div>
          </HqCard>
        </>
      )}
    </div>
  );
}
