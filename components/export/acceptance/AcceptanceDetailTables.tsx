"use client";

/**
 * The other two tables of the acceptance trio — `ACCEPTENCEDETAIL` (10) and
 * `CARGOACCEPTANCEHWB` (7).
 *
 * The export acceptance screen's parity badge has always claimed
 * `ACCEPTENCEDETAIL`, and `ExportConsignment` has always carried the typed
 * rows (`lines`, and later `hwb`) — but nothing on the screen read them. The
 * per-line nature of goods, pieces, weight and dimensions, and the house
 * breakdown of a consolidation, were modelled and fixture-backed on the side
 * of the terminal that never showed them, while `/import/acceptance` showed
 * both from rows it had to fabricate for itself. This is the render that was
 * missing, not a new capture step.
 *
 * Why the full ten columns here and only two on the import screen: import has
 * a receipt worksheet (`IMPORTAWBDETAIL` at §13–14) that already renders
 * pieces, weight and the measured dimensions, so repeating them there would
 * show one fact twice. The export counter has no such worksheet — its detail
 * lines are the only place those columns exist on screen, so dropping them
 * would leave `PCS` / `WEIGHT` / `WIDTH` / `HEIGHT` / `LENGTH` / `UNIT` with
 * no representation anywhere on the export side.
 */

import { Layers, Table2 } from "lucide-react";
import {
  formatDateTime,
  formatKg,
  type AcceptanceHwb,
  type AcceptanceLine,
  type CargoAcceptance,
} from "@/lib/domain";

/** One column heading — the bare CMTS column name, as the hand-built tables do it. */
function Col({ children }: { children: string }) {
  return <span className="text-[9px] font-mono text-[#CBD5E1]">{children}</span>;
}

/**
 * The line grid, shared by the header row and the body rows so the two cannot
 * drift apart. Eight columns is wider than a phone, hence the scroll container
 * and the min-width below — the alternative is a wrapped dimension triple,
 * which reads as three unrelated numbers.
 */
const LINE_GRID =
  "grid grid-cols-[64px_minmax(150px,1fr)_60px_92px_66px_66px_66px_54px] gap-3 px-4";

/**
 * Declared header totals against the sum of the detail lines.
 *
 * `PCSAWB` / `WEIGHTAWB` sit on `CARGOACCEPTANCE` and the per-line `PCS` /
 * `WEIGHT` sit on `ACCEPTENCEDETAIL`; CMTS enforces no relationship between
 * them, and a consignment whose lines do not add up to its own header is a
 * real state at a counter rather than a data error to hide. Both numbers are
 * shown and the difference is named — neither is recomputed into the other.
 */
function LineReconciliation({
  lines,
  acceptance,
}: {
  lines: AcceptanceLine[];
  acceptance: CargoAcceptance;
}) {
  const linePcs = lines.reduce((n, l) => n + l.PCS, 0);
  const lineKg = Math.round(lines.reduce((n, l) => n + l.WEIGHT, 0) * 100) / 100;
  const pcsAgrees = linePcs === acceptance.PCSAWB;
  const kgAgrees = Math.abs(lineKg - acceptance.WEIGHTAWB) < 0.01;

  return (
    <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-x-8 gap-y-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">PCS (lines)</span>
          <span className="text-[13px] font-mono font-semibold text-[#0F172A]">{linePcs}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">PCSAWB (header)</span>
          <span
            className="text-[13px] font-mono font-semibold"
            style={{ color: pcsAgrees ? "#0F172A" : "#D97706" }}
          >
            {acceptance.PCSAWB}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">WEIGHT (lines)</span>
          <span className="text-[13px] font-mono font-semibold text-[#0F172A]">
            {formatKg(lineKg)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">WEIGHTAWB (header)</span>
          <span
            className="text-[13px] font-mono font-semibold"
            style={{ color: kgAgrees ? "#0F172A" : "#D97706" }}
          >
            {formatKg(acceptance.WEIGHTAWB)}
          </span>
        </div>
      </div>
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: pcsAgrees && kgAgrees ? "#94A3B8" : "#92400E" }}
      >
        {pcsAgrees && kgAgrees
          ? "The detail lines add up to the acceptance header. CMTS enforces nothing between the two tables, so agreement is a fact worth stating rather than one that can be assumed."
          : "The detail lines do not add up to the acceptance header. Neither figure is recomputed from the other — CMTS stores them on separate tables with no constraint between them, and which one is wrong is a question for the counter."}
      </p>
    </div>
  );
}

export default function AcceptanceDetailTables({
  lines,
  hwb,
  acceptance,
}: {
  lines: AcceptanceLine[];
  hwb: AcceptanceHwb[];
  /** The header, for the key strip and the line/header reconciliation. */
  acceptance: CargoAcceptance;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-2">
        <Table2 size={15} className="text-[#64748B] mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Acceptance detail — what the event writes beneath the header
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
            The cards above are CARGOACCEPTANCE, one row per consignment. These are the two tables
            hanging off it: a line per item tendered, and a row per house when the master is a
            consolidation.
          </p>
        </div>
      </div>

      {/*
       * The key strip. CARGOID and CARGODATE are already on the identity card
       * above — as CARGOACCEPTANCE's copies of them. These are the detail
       * table's own columns of the same name, which is the whole of its
       * relation back to the header, so they are stated once here rather than
       * repeated down every row of both tables below.
       */}
      <div className="px-5 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-start gap-x-8 gap-y-4 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">CARGOID</span>
          <span className="text-[15px] font-mono font-bold text-[#0F172A]">
            {acceptance.CARGOID}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-mono text-[#CBD5E1]">CARGODATE</span>
          <span className="text-[15px] font-semibold text-[#0F172A]">
            {formatDateTime(acceptance.CARGODATE)}
          </span>
        </div>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed flex-1 min-w-[260px]">
          Both columns repeat on every detail and house row in CMTS — the pair is the entire
          relation, and there is no join column beyond the two the operator already reads off the
          consignment. Stated once here because every row below carries the same value.
        </p>
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* ACCEPTENCEDETAIL — the item lines */}
        <div>
          <div className="flex items-baseline gap-2 mb-2.5">
            <h4 className="text-[13px] font-semibold text-[#0F172A]">Item lines</h4>
            <span className="font-mono text-[10px] font-semibold text-[#1B4F8B]">
              ACCEPTENCEDETAIL
            </span>
          </div>
          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
              <p className="text-[12px] font-semibold text-[#64748B]">No detail lines</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed">
                An accepted consignment with no ACCEPTENCEDETAIL row has been booked in at the
                header and not yet itemised at the counter.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#E2E8F0] overflow-x-auto">
                <div className="min-w-[660px]">
                  <div className={`${LINE_GRID} py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]`}>
                    <Col>SEQUENCE</Col>
                    <Col>NATUREOFGOODS</Col>
                    <Col>PCS</Col>
                    <Col>WEIGHT</Col>
                    <Col>WIDTH</Col>
                    <Col>HEIGHT</Col>
                    <Col>LENGTH</Col>
                    <Col>UNIT</Col>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {lines.map((l) => (
                      <div key={l.SEQUENCE} className={`${LINE_GRID} py-2.5 items-center`}>
                        <span className="text-[13px] font-mono font-semibold text-[#64748B]">
                          {l.SEQUENCE}
                        </span>
                        <span className="text-[13px] font-medium text-[#0F172A]">
                          {l.NATUREOFGOODS}
                        </span>
                        <span className="text-[13px] font-mono text-[#0F172A]">{l.PCS}</span>
                        <span className="text-[13px] font-mono text-[#0F172A]">
                          {formatKg(l.WEIGHT)}
                        </span>
                        <span className="text-[13px] font-mono text-[#0F172A]">{l.WIDTH}</span>
                        <span className="text-[13px] font-mono text-[#0F172A]">{l.HEIGHT}</span>
                        <span className="text-[13px] font-mono text-[#0F172A]">{l.LENGTH}</span>
                        <span className="text-[13px] font-mono text-[#64748B]">{l.UNIT}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 leading-relaxed">
                <span className="font-mono">NATUREOFGOODS</span> is free text as the shipper
                declared it, not a classified subclass. The three dimension columns are bare numbers
                in CMTS with <span className="font-mono">UNIT</span> carrying their scale on the same
                row — so the unit is rendered per line rather than assumed centimetres for the
                consignment.
              </p>
              <LineReconciliation lines={lines} acceptance={acceptance} />
            </>
          )}
        </div>

        {/* CARGOACCEPTANCEHWB — house breakdown, consolidations only */}
        <div>
          <div className="flex items-baseline gap-2 mb-2.5">
            <Layers size={13} className="text-[#64748B] self-center" />
            <h4 className="text-[13px] font-semibold text-[#0F172A]">House breakdown</h4>
            <span className="font-mono text-[10px] font-semibold text-[#1B4F8B]">
              CARGOACCEPTANCEHWB
            </span>
          </div>
          {hwb.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
              <p className="text-[12px] font-semibold text-[#64748B]">
                Straight master — no house rows
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed">
                CMTS writes CARGOACCEPTANCEHWB only when one accepted master covers several houses.
                No rows is the answer for this consignment, not missing data.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#E2E8F0] overflow-x-auto">
                <div className="min-w-[420px]">
                  <div className="grid grid-cols-[minmax(200px,1fr)_110px_1fr] gap-4 px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <Col>HWBNO</Col>
                    <Col>CARGOGROUP</Col>
                    <Col>CARGODATE</Col>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {hwb.map((h) => (
                      <div
                        key={h.HWBNO}
                        className="grid grid-cols-[minmax(200px,1fr)_110px_1fr] gap-4 px-4 py-2.5"
                      >
                        <span className="text-[13px] font-mono font-semibold text-[#0F172A] truncate">
                          {h.HWBNO}
                        </span>
                        <span
                          className="text-[13px] font-mono"
                          style={{ color: h.CARGOGROUP === null ? "#94A3B8" : "#0F172A" }}
                        >
                          {h.CARGOGROUP === null ? "—" : h.CARGOGROUP}
                        </span>
                        <span className="text-[13px] text-[#64748B] truncate">
                          {formatDateTime(h.CARGODATE)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 leading-relaxed">
                <span className="font-mono">CARGOGROUP</span> is an int on the house rows and a
                varchar on the acceptance header — CMTS disagrees with itself across the two tables,
                so neither is coerced into the other here. A dash is an ungrouped house, which is
                normal; it is not a zero.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
