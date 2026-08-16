"use client";

/**
 * P0-3 · AWB hub tab panels.
 *
 * Every panel reads from the `AwbBundle` assembled by `getAwb()` — no panel
 * fetches or declares its own data. Each links onward to the module that
 * owns the record it is showing, which is what makes FC-12's M03 → 8-module
 * wiring navigable.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import {
  AgingBadge,
  ApprovalStepper,
  AuditStrip,
  DocNumber,
  EvidencePack,
  OcrConfidenceField,
} from "@/components/primitives";
import {
  BRANCH_LABEL,
  CDR_FINAL_ACTION_LABEL,
  cdrEscalations,
  cdrFirstDisAt,
  DISCREPANCY_LABEL,
  HOLD_TYPE_LABEL,
  IATA_MESSAGE_LABEL,
  LONGSTAY_STAGE_LABEL,
  MISHANDLED_STAGE_LABEL,
  REEXPORT_STAGE_LABEL,
  WAIVER_REASON_LABEL,
  cargoSubClass,
  formatDate,
  formatDateTime,
  formatKg,
  formatPkr,
  isDiverged,
  storageLocation,
  type AwbBundle,
} from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  cmts,
  mono,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  /** The CMTS column this maps to — parity is checkable on screen. */
  cmts?: string;
  mono?: boolean;
  tone?: "default" | "muted" | "warn" | "ok";
}) {
  const colour =
    tone === "muted" ? "#94A3B8" : tone === "warn" ? "#D97706" : tone === "ok" ? "#16A34A" : "#0F172A";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        {cmts && (
          <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
            {cmts}
          </span>
        )}
      </div>
      <div
        className={`min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center text-[13px] font-medium ${
          mono ? "font-mono" : ""
        }`}
        style={{ color: colour }}
      >
        {value === null || value === undefined || value === "" ? (
          <span className="text-[#CBD5E1]">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] hover:text-[#0B2545] no-underline flex-shrink-0"
          >
            {action.label}
            <ArrowUpRight size={13} />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overview — IMPORTAWB parity view
 * ------------------------------------------------------------------ */

export function OverviewPanel({ b }: { b: AwbBundle }) {
  const { awb, manifest, cargoClass } = b;
  const sub = cargoSubClass(awb.cargoSubClassId);

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Identity & keys"
        subtitle="The CMTS composite key — IGMNO + AWBNO + SEQUENCE — carried on ~25 tables"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="AWB Number" value={awb.AWBNO} cmts="AWBNO" mono />
          <Field label="IGM Number" value={awb.IGMNO} cmts="IGMNO" mono />
          <Field label="Sequence" value={awb.SEQUENCE} cmts="SEQUENCE" mono />
          <Field label="Page No" value={awb.PAGENO} cmts="PAGENO" mono />
          <Field label="Cargo Date" value={formatDate(awb.CARGODATE)} cmts="CARGODATE" />
          <Field label="Shipment Type" value={awb.SHIPMENTTYPE} cmts="SHIPMENTTYPE" />
          <Field label="Challan No" value={awb.CHALLANNO} cmts="CHALLANNO" mono />
          <Field label="Physical Status" value={awb.PHYSICALSTATUS} cmts="PHYSICALSTATUS" />
        </div>
      </SectionCard>

      <SectionCard title="Flight" action={{ label: "Manifest", href: "/import/manifest" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="Flight" value={awb.FLIGHT} cmts="FLIGHT" mono />
          <Field label="Airline" value={`${awb.AIRLINECODE} — ${awb.AIRLINENAME}`} cmts="AIRLINENAME" />
          <Field label="Origin" value={awb.ORIGIN} cmts="ORIGIN" mono />
          <Field label="Destination" value={awb.DESTINATION} cmts="DESTINATION" mono />
          <Field label="Registration" value={manifest?.REGNO} cmts="IMPORTMANIFIEST.REGNO" mono />
          <Field label="Shift" value={awb.SHIFT} cmts="SHIFT" />
        </div>
      </SectionCard>

      <SectionCard title="Cargo & weights" subtitle="Chargeable weight = max(actual, volumetric) — FC-07 §06">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="Pieces" value={awb.TOTALPCS} cmts="TOTALPCS" mono />
          <Field label="Actual Weight" value={formatKg(awb.TOTALWEIGHT)} cmts="TOTALWEIGHT" mono />
          <Field label="Chargeable Weight" value={formatKg(awb.TOTALCHRGWEIGHT)} cmts="TOTALCHRGWEIGHT" mono />
          <Field
            label="Cargo Class"
            value={`${cargoClass.ABBREVATION} — ${cargoClass.NAME}`}
            cmts="CARGOCLASSID"
          />
          <Field label="Cargo Subclass" value={`${sub.ABBREVATION} — ${sub.NAME}`} cmts="CARGOSUBCLASS" />
          <Field label="Free Days" value={`${cargoClass.freeDays} days`} cmts="—" />
          {sub.tempBandC && (
            <Field label="Temperature band" value={`${sub.tempBandC[0]}°C to ${sub.tempBandC[1]}°C`} />
          )}
          {sub.Authority && <Field label="Handling authority" value={sub.Authority} cmts="Authority" />}
        </div>
      </SectionCard>

      <SectionCard title="Parties" subtitle="CMTS stores each party as four flat lines">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {(
            [
              ["Shipper", [awb.SHIPPER1, awb.SHIPPER2, awb.SHIPPER3, awb.SHIPPER4], "SHIPPER1-4"],
              ["Consignee", [awb.CONSIGNEE1, awb.CONSIGNEE2, awb.CONSIGNEE3, awb.CONSIGNEE4], "CONSIGNEE1-4"],
              ["Agent", [awb.AGENT1, awb.AGENT2, awb.AGENT3, awb.AGENT4], "AGENT1-4"],
            ] as const
          ).map(([label, lines, cmts]) => (
            <div key={label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[9px] font-mono text-[#CBD5E1]">{cmts}</span>
              </div>
              {lines.filter(Boolean).map((l, i) => (
                <p
                  key={i}
                  className={`text-[13px] ${i === 0 ? "font-semibold text-[#0F172A]" : "text-[#64748B]"}`}
                >
                  {l}
                </p>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Identity documents & state flags">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="NIC" value={awb.NIC} cmts="NIC" mono />
          <Field label="Passport" value={awb.PASSPORT} cmts="PASSPORT" mono />
          <Field
            label="Holding Status"
            value={awb.HOLDINGSTATUS ? "On hold" : "None"}
            cmts="HOLDINGSTATUS"
            tone={awb.HOLDINGSTATUS ? "warn" : "ok"}
          />
          <Field label="Locked" value={awb.Lock ? "Yes" : "No"} cmts="Lock" tone={awb.Lock ? "warn" : "default"} />
          <Field label="Delivered" value={awb.DELIVERED ? "Yes" : "No"} cmts="DELIVERED" />
          <Field label="Is Consolidation" value={awb.IsHwb ? "Yes" : "No"} cmts="IsHwb" />
          <Field label="Is Detained" value={awb.IsDetend ? "Yes" : "No"} cmts="IsDetend" tone={awb.IsDetend ? "warn" : "default"} />
          <Field label="Detend ID" value={awb.DetendUniqueIdentification} cmts="DetendUniqueIdentification" mono />
          <Field label="Is Special" value={awb.isSpecial ? "Yes" : "No"} cmts="isSpecial" />
          <Field label="Special Remarks" value={awb.isSpecialRemarks} cmts="isSpecialRemarks" />
          <Field label="Process" value={awb.Process} cmts="Process" />
          <Field label="Status" value={awb.Status} cmts="Status" mono />
          <Field label="Transfer Airline" value={awb.TRAIRLINEID} cmts="TRAIRLINEID" mono />
          <Field label="DFLAG" value={awb.DFLAG ? "Y" : "N"} cmts="DFLAG" mono tone="muted" />
        </div>
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

export function PiecesPanel({ b }: { b: AwbBundle }) {
  if (b.pieces.length === 0) {
    return (
      <EmptyState
        title="No pieces tagged yet"
        description="Piece-level tagging happens at FC-01 step 10, after indexation."
      />
    );
  }

  const columns = [
    { key: "pieceId", header: "Piece ID", sortable: true },
    { key: "rfid", header: "RFID EPC", sortable: true },
    { key: "dimensions", header: "Dimensions", sortable: false },
    { key: "actual", header: "Actual", sortable: true },
    { key: "volumetric", header: "Volumetric", sortable: true },
    { key: "chargeable", header: "Chargeable", sortable: true },
    { key: "location", header: "Location", sortable: true },
    { key: "scanStatus", header: "Scan", sortable: true },
  ];

  const rows = b.pieces.map((p) => {
    const loc = p.locationId ? storageLocation(p.locationId) : null;
    return {
      pieceId: p.pieceId,
      rfid: p.rfidEpc ?? (
        <span className="text-[#DC2626] text-[11px] font-semibold">unreadable — barcode fallback</span>
      ),
      dimensions: `${p.dimensions.lengthCm} × ${p.dimensions.widthCm} × ${p.dimensions.heightCm} cm`,
      actual: formatKg(p.weights.actualKg),
      volumetric: formatKg(p.weights.volumetricKg),
      chargeable: (
        <span className="font-semibold">{formatKg(p.weights.chargeableKg)}</span>
      ),
      location: loc?.ABBREVATION ?? "—",
      scanStatus: <StatusBadge status={p.scanState === "bound" ? "Stored" : p.scanState === "picked" ? "Picked" : p.scanState === "dispatched" ? "Dispatched" : "Awaiting Putaway"} />,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-[#64748B]">
        Showing {b.pieces.length} of {b.awb.TOTALPCS} pieces. The RFID tag bound at putaway (FC-03)
        is the same identity read at retrieval and gate-out (FC-08).
      </p>
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Storage — logical vs physical (BLK-08)
 * ------------------------------------------------------------------ */

export function StoragePanel({ b }: { b: AwbBundle }) {
  const loc = b.location;
  if (!loc) {
    return (
      <EmptyState
        title="Not yet allocated"
        description="Storage allocation happens at FC-01 step 15 / FC-03."
        actionLabel="Open storage map"
        onAction={() => (window.location.href = "/warehouse-manager/storage-map")}
      />
    );
  }

  const logical = storageLocation(loc.LOGICALLOCATIONID);
  const physical = storageLocation(loc.PHYSICALLOCATIONID);
  const diverged = isDiverged(loc);

  return (
    <div className="flex flex-col gap-5">
      {diverged && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#D97706]">
            Logical and physical location differ
          </p>
          <p className="text-[12px] text-[#92400E] mt-0.5">
            {loc.divergenceReason} · diverged {loc.divergedAt ? formatDateTime(loc.divergedAt) : ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Logical — booked to" subtitle="CMTS LOGICALLOCATIONID / LOGICALCARGOSUBCLASSID">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Zone" value={logical?.NAME} cmts="LOGICALLOCATIONID" />
            <Field label="Abbreviation" value={logical?.ABBREVATION} mono />
            <Field label="Subclass" value={cargoSubClass(loc.LOGICALCARGOSUBCLASSID).ABBREVATION} cmts="LOGICALCARGOSUBCLASSID" />
            <Field label="Authority" value={logical?.Authority} />
          </div>
        </SectionCard>

        <SectionCard title="Physical — actually in" subtitle="CMTS PHYSICALLOCATIONID / PHYSICALCARGOSUBCLASSID">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Zone" value={physical?.NAME} cmts="PHYSICALLOCATIONID" tone={diverged ? "warn" : "default"} />
            <Field label="Abbreviation" value={physical?.ABBREVATION} mono />
            <Field label="Subclass" value={cargoSubClass(loc.PHYSICALCARGOSUBCLASSID).ABBREVATION} cmts="PHYSICALCARGOSUBCLASSID" />
            <Field label="Authority" value={physical?.Authority} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Allocation record" action={{ label: "Storage map", href: "/warehouse-manager/storage-map" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="Pieces" value={loc.PCS} cmts="PCS" mono />
          <Field label="Weight" value={formatKg(loc.WEIGHT)} cmts="WEIGHT" mono />
          <Field label="Consol ID" value={loc.ConsolId} cmts="ConsolId" mono />
          <Field label="Split Class" value={loc.SplitClassId} cmts="SplitClassId" mono />
          <Field label="Detend ID" value={loc.DetendUniqueIdentification} cmts="DetendUniqueIdentification" mono />
          <Field label="Unique ID" value={loc.UniqueIdentification} cmts="UniqueIdentification" mono />
        </div>
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Customs
 * ------------------------------------------------------------------ */

export function CustomsPanel({ b }: { b: AwbBundle }) {
  const gate = b.releaseGate;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Release gate — FC-07 Godown Rent Verification"
        subtitle="All applicable conditions must pass before a DO can issue (see BLK-10)"
        action={{ label: "Customs queue", href: "/customs/queue" }}
      >
        <div className="flex flex-col gap-2">
          {gate?.conditions.map((c) => {
            const state = !c.applicable ? "na" : c.pass ? "pass" : "fail";
            const style = {
              pass: { bg: "#F0FDF4", border: "#BBF7D0", dot: "#16A34A", fg: "#16A34A", label: "Pass" },
              fail: { bg: "#FEF2F2", border: "#FECACA", dot: "#DC2626", fg: "#DC2626", label: "Blocked" },
              na: { bg: "#F8FAFC", border: "#E2E8F0", dot: "#CBD5E1", fg: "#94A3B8", label: "N/A" },
            }[state];
            return (
              <div
                key={c.code}
                className="flex items-start gap-3 rounded-xl border px-4 py-3"
                style={{ backgroundColor: style.bg, borderColor: style.border }}
              >
                <span
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: style.dot }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#0F172A]">{c.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#64748B] mt-0.5">{c.detail}</p>
                </div>
                {c.href && !c.pass && c.applicable && (
                  <Link
                    href={c.href}
                    className="text-[12px] font-semibold text-[#1B4F8B] hover:underline no-underline flex-shrink-0"
                  >
                    Resolve
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <div
          className="mt-4 rounded-xl px-4 py-3 text-[13px] font-semibold"
          style={{
            backgroundColor: gate?.canRelease ? "#DCFCE7" : "#FEE2E2",
            color: gate?.canRelease ? "#16A34A" : "#DC2626",
          }}
        >
          {gate?.canRelease
            ? "All conditions satisfied — DO can issue"
            : `DO release blocked by ${gate?.blockedBy.length} condition${gate?.blockedBy.length === 1 ? "" : "s"}`}
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-2">
          Note per FC-06: OOC permits release, but physical delivery still requires DO, payment and
          gate pass.
        </p>
      </SectionCard>

      {b.detends.length > 0 && (
        <SectionCard
          title="Detained portion (Detend)"
          subtitle="A detained part of an AWB carries its own identity across 12 CMTS tables"
        >
          {b.detends.map((d) => (
            <div key={d.DetendId} className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Detend ID" value={d.UniqueIdentification} cmts="UniqueIdentification" mono />
              <Field label="Pieces" value={d.TotalPieces} cmts="TotalPieces" mono />
              <Field label="Weight" value={formatKg(d.TotalWeight)} cmts="TotalWeight" mono />
              <Field label="Chargeable" value={formatKg(d.TotalChargeWeight)} cmts="TotalChargeWeight" mono />
              <Field label="Goods" value={d.GOODS} cmts="GOODS" />
              <Field label="Detained" value={formatDateTime(d.detainedAt)} />
              <Field label="By" value={d.detainedBy} />
              <Field label="Reason" value={d.reason} tone="warn" />
            </div>
          ))}
        </SectionCard>
      )}

      {b.holds.length > 0 && (
        <SectionCard title="Holds" action={{ label: "Hold register", href: "/exceptions/holds" }}>
          <div className="flex flex-col gap-3">
            {b.holds.map((h) => (
              <div key={h.SEQUENCE} className="rounded-xl border border-[#E2E8F0] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-semibold text-[#0F172A]">
                    {HOLD_TYPE_LABEL[h.type]}
                  </span>
                  <span
                    className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center"
                    style={{
                      backgroundColor: h.Release ? "#DCFCE7" : "#FEE2E2",
                      color: h.Release ? "#16A34A" : "#DC2626",
                    }}
                  >
                    {h.Release ? "Released" : "Live"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3">
                  <Field label="Held by" value={h.HeldBy} cmts="HeldBy" />
                  <Field label="Person" value={h.NameOfPerson} cmts="NameOfPerson" />
                  <Field label="Designation" value={h.Designation} cmts="Designation" />
                  <Field label="NIC" value={h.NIC} cmts="NIC" mono />
                  <Field label="Date" value={formatDateTime(h.Date)} cmts="Date" />
                  <div className="md:col-span-3">
                    <Field label="Remarks" value={h.REMARKS} cmts="REMARKS" />
                  </div>
                  {h.Release && (
                    <>
                      <Field label="Released by" value={h.ReleaseBy} cmts="ReleaseBy" tone="ok" />
                      <Field label="Release person" value={h.ReleasePersonName} cmts="ReleasePersonName" />
                      <Field label="Release NIC" value={h.ReleasePersonNic} cmts="ReleasePersonNic" mono />
                      <Field
                        label="Released at"
                        value={h.ReleaseDateTime ? formatDateTime(h.ReleaseDateTime) : null}
                        cmts="ReleaseDateTime"
                      />
                      <div className="md:col-span-4">
                        <Field label="Release remarks" value={h.ReleaseRemarks} cmts="ReleaseRemarks" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Charges — FC-07 §01–08 shown step by step
 * ------------------------------------------------------------------ */

export function ChargesPanel({ b }: { b: AwbBundle }) {
  const c = b.charges;
  const gr = b.godownRent;

  if (!c) {
    return (
      <EmptyState
        title="Not yet charged"
        description="Charges are calculated at FC-01 step 20 / FC-07, once the cargo is stored."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AgingBadge
          totalDays={b.dwell.totalDays}
          freeDays={b.dwell.freeDays}
          section82Days={b.dwell.section82Days}
        />

        <div className="lg:col-span-2">
          <SectionCard
            title="Chargeable weight — FC-07 §04–06"
            subtitle="Volumetric = L × W × H / 6000, then chargeable = max(actual, volumetric)"
          >
            <div className="grid grid-cols-3 gap-x-5">
              <Field label="Actual" value={formatKg(c.actualKg)} mono />
              <Field label="Volumetric" value={formatKg(c.volumetricKg)} mono />
              <Field
                label="Chargeable"
                value={formatKg(c.chargeableKg)}
                mono
                tone={c.chargeableKg === c.volumetricKg ? "warn" : "default"}
              />
            </div>
            {c.chargeableKg === c.volumetricKg && c.volumetricKg > c.actualKg && (
              <p className="text-[11px] text-[#D97706] mt-2">
                Volumetric exceeds actual — billed on volume.
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Tariff slabs — FC-07 §08" subtitle={`Tariff version ${c.tariffVersion}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                <th className="text-left px-3 py-2">Band</th>
                <th className="text-right px-3 py-2">Days</th>
                <th className="text-right px-3 py-2">Rate /kg/day</th>
                <th className="text-right px-3 py-2">Chargeable kg</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {c.slabLines.map((l) => (
                <tr key={l.label} className="border-b border-[#F1F5F9]">
                  <td className="px-3 py-2.5 font-medium text-[#0F172A]">{l.label}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{l.daysInBand}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {l.ratePerKgPerDay === 0 ? "free" : formatPkr(l.ratePerKgPerDay)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{l.chargeableKg}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">
                    {formatPkr(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {c.surcharges.length > 0 && (
        <SectionCard title="Category surcharges — FC-07 §07">
          <div className="flex flex-wrap gap-2">
            {c.surcharges.map((s) => (
              <span
                key={s.code}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#FEF3C7] text-[#D97706] text-[12px] font-semibold"
              >
                {s.code} +{s.percent}%
                <span className="font-mono">{formatPkr(s.amount)}</span>
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Components & total"
        action={gr ? { label: "Godown rent", href: "/billing/godown-rent" } : undefined}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="Storage / demurrage" value={formatPkr(c.storageAmount)} cmts="DEMURRAGE" mono />
          <Field label="Handling" value={formatPkr(c.handlingAmount)} cmts="HANDLING" mono />
          <Field label="Location charges" value={formatPkr(c.locationChargesAmount)} cmts="LOCATIONCHARGES" mono />
          <Field label="Documentation" value={formatPkr(c.documentationCharges)} cmts="DOCUMENTATION" mono />
          <Field label="Deconsolidation" value={formatPkr(c.deconsolidationCharges)} cmts="DECONSOLIDATION" mono />
          <Field label="Special handling" value={formatPkr(c.specialHandlingCharges)} cmts="SPECIALHANDLING" mono />
          <Field label="Minimum charges" value={formatPkr(c.minimumCharges)} cmts="MINCHARGES" mono />
          <Field label="Miscellaneous" value={formatPkr(c.miscellaneousCharges)} cmts="MISCELLANEOUS" mono />
        </div>
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 grid grid-cols-3 gap-5">
            <Field label="Sub-total" value={formatPkr(c.subTotal)} mono />
            <Field label={`Tax (${c.taxPercent}%)`} value={formatPkr(c.taxAmount)} mono />
            <Field label="Total" value={<span className="font-bold">{formatPkr(c.total)}</span>} mono />
          </div>
        </div>
      </SectionCard>

      {gr && (
        <SectionCard title="Godown rent voucher" subtitle="CMTS GODOWNRENT — 75 columns">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <div className="col-span-2 md:col-span-1">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Voucher No
                </span>
                <div className="min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center">
                  <DocNumber doc={gr.docNumber} />
                </div>
              </div>
            </div>
            <Field label="GR Date" value={formatDate(gr.GRDATE)} cmts="GRDATE" />
            <Field label="Bill type" value={gr.BILLTYPE} cmts="BILLTYPE" />
            <Field label="Days" value={gr.DAYS} cmts="DAYS" mono />
            <Field label="Supplement days" value={gr.SUPPLIMENTDAYS} cmts="SUPPLIMENTDAYS" mono />
            <Field label="Net payable" value={formatPkr(gr.NETPAYABLE)} cmts="NETPAYABLE" mono />
            <Field label="Paid" value={gr.PAID ? "Yes" : "No"} cmts="PAID" tone={gr.PAID ? "ok" : "warn"} />
            <Field label="Pay mode" value={gr.Paymode} cmts="Paymode" />
            <Field label="Challan No" value={gr.CHALLANNO} cmts="CHALLANNO" mono />
            <Field label="Pay order No" value={gr.PAYORDERNO} cmts="PAYORDERNO" mono />
            <Field label="Bank" value={gr.BANKNAME} cmts="BANKNAME" />
            <Field label="Received by" value={gr.RECIEVEDBY} cmts="RECIEVEDBY" />
            <Field label="NTN" value={gr.NTN} cmts="NTN" mono />
            <Field label="STN" value={gr.STN} cmts="STN" mono />
            <Field label="Duplicate count" value={gr.DUPLICATECOUNT} cmts="DUPLICATECOUNT" mono />
            <Field label="Clearing agent" value={gr.clearingAgent} cmts="clearingAgent" />
          </div>

          {gr.WAIVEOFF && (
            <div className="mt-4 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#7C3AED]">
                Waiver applied — {gr.WAIVEOFFPERCENT}% on {gr.WaivOfStorageOrAmount?.toLowerCase()}
              </p>
              <p className="text-[12px] text-[#6D28D9] mt-0.5">{gr.WAIVEOFFREASON}</p>
              <p className="text-[12px] font-mono text-[#6D28D9] mt-1">
                {formatPkr(gr.WAIVEOFFAMOUNT)} waived
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {b.waivers.map((w) => (
        <ApprovalStepper
          key={w.id}
          levels={w.levels}
          title={`Waiver approval — ${WAIVER_REASON_LABEL[w.reason]}`}
          note={`${formatPkr(w.originalTotal)} → ${formatPkr(w.revisedTotal)} · credit note ${w.creditNoteNo ?? "pending"}`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Dispatch — DO, gate pass, POD
 * ------------------------------------------------------------------ */

export function DispatchPanel({ b }: { b: AwbBundle }) {
  const { deliveryOrder: doRec, gatePass, pod } = b;

  if (!doRec && !gatePass && !pod) {
    return (
      <EmptyState
        title="Nothing dispatched yet"
        description="The DO issues at FC-01 step 22, once the FC-07 release gate passes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {doRec && (
        <SectionCard
          title="Delivery Order"
          subtitle="CMTS AWBDELEIVERYORDER — 39 columns"
          action={{ label: "DO collection", href: "/cha/do-collection" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <div className="col-span-2 md:col-span-1">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  DO No
                </span>
                <div className="min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center">
                  <DocNumber doc={doRec.docNumber} />
                </div>
              </div>
            </div>
            {/* FC-01 §22 is two events, so it renders as two fields. The second of
                them is §22a, the CHA's collection, and it lives on the DO collection
                screen linked above rather than in this block. What renders here
                beside the issue date is `requestedAt` — when the record was raised.
                That is a record state and not a numbered step: FC-01 numbers no
                request, so it has no ref of its own, and no CMTS column either — it
                is an AirVault addition. `DODATE` is the §22 issue date and stays
                null until the release gate passes. */}
            <Field label="DO Requested" value={formatDate(doRec.requestedAt)} />
            <Field
              label="DO Issued"
              value={doRec.DODATE ? formatDate(doRec.DODATE) : "Not yet issued"}
              cmts="DODATE"
            />
            <Field label="DO Type" value={doRec.DOTYPE} cmts="DOTYPE" />
            <Field label="Amount" value={formatPkr(doRec.AMOUNT)} cmts="AMOUNT" mono />
            <Field label="Tax %" value={doRec.Tax} cmts="Tax" mono />
            <Field label="Free" value={doRec.FREE ? "Yes" : "No"} cmts="FREE" />
            <Field label="Free cause" value={doRec.FREECAUSE} cmts="FREECAUSE" />
            <Field label="Received by" value={doRec.RECIEVEDBY} cmts="RECIEVEDBY" />
            <Field label="NIC" value={doRec.NIC} cmts="NIC" mono />
            <Field label="Passport" value={doRec.PASSPORT} cmts="PASSPORT" mono />
            <Field label="Challan No" value={doRec.CHALLANNO} cmts="CHALLANNO" mono />
            <Field label="NTN / STN" value={`${doRec.NTN ?? "—"} / ${doRec.STN ?? "—"}`} cmts="NTN / STN" mono />
          </div>

          <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
              Authorised agent
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Name" value={doRec.AuthAgentName} cmts="AuthAgentName" />
              <Field label="CNIC" value={doRec.AuthAgentCNIC} cmts="AuthAgentCNIC" mono />
              <Field label="Phone" value={doRec.AuthAgentPhone} cmts="AuthAgentPhone" mono />
              <Field label="Email" value={doRec.AuthAgentEmail} cmts="AuthAgentEmail" />
              <Field label="Authority letter" value={doRec.AuthLetterNo} cmts="AuthLetterNo" mono />
              <Field label="Photo" value={doRec.AuthAgentPic} cmts="AuthAgentPic" tone="muted" />
            </div>
          </div>
        </SectionCard>
      )}

      {gatePass && (
        <SectionCard
          title="Gate pass"
          subtitle="CMTS GATEPASS — 43 columns, the release cross-reference hub"
          action={{ label: "Gate entry", href: "/gate-entry/live-vehicle-board" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <div className="col-span-2 md:col-span-1">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Gate pass
                </span>
                <div className="min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center">
                  <DocNumber doc={gatePass.docNumber} />
                </div>
              </div>
            </div>
            <Field label="Serial (with year)" value={gatePass.SerialNoWithYear} cmts="SerialNoWithYear" mono />
            <Field label="Date" value={formatDate(gatePass.GATEPASSDATE)} cmts="GATEPASSDATE" />
            <Field label="Status" value={gatePass.status} />
            <Field label="Pieces" value={gatePass.PIECES} cmts="PIECES" mono />
            <Field label="Weight" value={formatKg(gatePass.WEIGHT)} cmts="WEIGHT" mono />
            <Field label="Vehicle" value={gatePass.VehicleNo} cmts="VehicleNo" mono />
            <Field label="Receiving person" value={gatePass.RecivingPerson} cmts="RecivingPerson" />
            <Field label="NIC" value={gatePass.NICNO} cmts="NICNO" mono />
            <Field label="CP No" value={gatePass.CPNO} cmts="CPNO" mono />
            <Field label="Custodian shed" value={gatePass.NAMEOFCUSTODIANSHED} cmts="NAMEOFCUSTODIANSHED" />
            <Field label="Marks / numbers" value={gatePass.MarksNumber} cmts="MarksNumber" mono />
          </div>

          <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
              Cross-references
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="DO" value={`${gatePass.DONo} · ${formatDate(gatePass.DoDate)}`} cmts="DONo / DoDate" mono />
              <Field label="GR" value={`${gatePass.GRNo} · ${formatDate(gatePass.GRDate)}`} cmts="GRNo / GRDate" mono />
              <Field label="IGM" value={`${gatePass.IGMNO} · ${formatDate(gatePass.IGMNODate)}`} cmts="IGMNO / IGMNODate" mono />
              <Field label="Challan" value={gatePass.ChallanNo} cmts="ChallanNo" mono />
            </div>
          </div>
        </SectionCard>
      )}

      {pod && (
        <SectionCard title="Proof of delivery" subtitle="FC-08 §14 — digital POD">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <Field label="Receiver" value={pod.receiverName} />
            <Field label="CNIC" value={pod.receiverCnic} mono tone={pod.cnicMatchesDo ? "ok" : "warn"} />
            <Field label="Pieces delivered" value={`${pod.piecesDelivered} of ${pod.piecesOnDo}`} mono />
            <Field label="Captured" value={formatDateTime(pod.capturedAt)} />
            <Field label="Signature" value={pod.receiverSignature ? "Captured" : null} tone="ok" />
            <Field label="Photos" value={`${pod.photos.length} attached`} />
            <Field
              label="Geo"
              value={pod.geo ? `${pod.geo.lat.toFixed(4)}, ${pod.geo.lng.toFixed(4)} ±${pod.geo.accuracyM}m` : null}
              mono
            />
            <Field label="DLV sent" value={pod.dlvSentAt ? formatDateTime(pod.dlvSentAt) : null} tone="ok" />
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

export function MessagingPanel({ b }: { b: AwbBundle }) {
  if (b.messages.length === 0 && b.notifications.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="IATA and customer messages fire from the FC-05 trigger map as the cargo moves."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="IATA Cargo-IMP"
        subtitle="Auto-dispatched via SITA — every message names its triggering event"
        action={{ label: "Message console", href: "/messaging/customs" }}
      >
        {b.messages.length === 0 ? (
          <p className="text-[13px] text-[#64748B]">None sent for this AWB yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {b.messages.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-4 py-2.5"
              >
                <span className="w-14 text-[12px] font-bold font-mono text-[#0F172A]">{m.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#0F172A] truncate">{IATA_MESSAGE_LABEL[m.type]}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {formatDateTime(m.timestamp)}
                    {m.trigger ? ` · trigger: ${m.trigger}` : ""}
                  </p>
                </div>
                <span
                  className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center flex-shrink-0"
                  style={{
                    backgroundColor: m.status === "failed" ? "#FEE2E2" : "#DCFCE7",
                    color: m.status === "failed" ? "#DC2626" : "#16A34A",
                  }}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Customer & CHA notifications"
        subtitle="Multi-channel Email / SMS / WhatsApp with delivery and read receipts"
        action={{ label: "Notifications", href: "/messaging/notifications" }}
      >
        {b.notifications.length === 0 ? (
          <p className="text-[13px] text-[#64748B]">None sent for this AWB yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {b.notifications.map((n) => (
              <div
                key={n.Id}
                className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-4 py-2.5"
              >
                <span className="w-20 text-[11px] font-semibold text-[#64748B] capitalize">
                  {n.channel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#0F172A] truncate">
                    {n.notification} → {n.recipientName}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {n.destination} · {formatDateTime(n.queuedAt)}
                    {n.readAt ? ` · read ${formatDateTime(n.readAt)}` : ""}
                  </p>
                </div>
                <span
                  className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      n.status === "failed" ? "#FEE2E2" : n.status === "read" ? "#DBEAFE" : "#DCFCE7",
                    color: n.status === "failed" ? "#DC2626" : n.status === "read" ? "#1B4F8B" : "#16A34A",
                  }}
                >
                  {n.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Exceptions
 * ------------------------------------------------------------------ */

export function ExceptionsPanel({ b }: { b: AwbBundle }) {
  const any =
    b.cdrs.length + b.mishandled.length + b.reExport.length + b.longStay.length > 0;

  if (!any) {
    return (
      <EmptyState
        title="No exceptions on this AWB"
        description="Discrepancies, holds and the FC-10 branches would appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {b.cdrs.map((c) => (
        <div key={c.id} className="flex flex-col gap-4">
          <SectionCard
            title={`CDR — ${DISCREPANCY_LABEL[c.type]}`}
            subtitle={c.autoRaised ? "Auto-raised from declared-vs-physical variance (FC-04 amendment)" : "Raised manually"}
            action={{ label: "CDR workbench", href: "/exceptions/cdr" }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <div className="col-span-2 md:col-span-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    CDR reference
                  </span>
                  <div className="min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center">
                    <DocNumber doc={c.docNumber} />
                  </div>
                </div>
              </div>
              <Field label="Status" value={c.status} tone="warn" />
              <Field label="Raised" value={formatDateTime(c.raisedAt)} />
              <Field label="Raised by" value={c.raisedBy} />
              {c.variance && (
                <>
                  <Field label="Declared" value={c.variance.declared} mono />
                  <Field label="Physical" value={c.variance.physical} mono />
                  <Field label="Delta" value={c.variance.delta} mono tone="warn" />
                  <Field
                    label="Variance"
                    value={`${(c.variance.ratio * 100).toFixed(1)}%`}
                    mono
                    tone={c.variance.overTolerance ? "warn" : "ok"}
                  />
                </>
              )}
              <Field label="Airline notified" value={c.airlineNotifiedAt ? formatDateTime(c.airlineNotifiedAt) : null} />
              <Field
                label="DIS sent"
                value={cdrFirstDisAt(c) ? formatDateTime(cdrFirstDisAt(c)!) : null}
              />
              <Field label="Escalations" value={cdrEscalations(c)} mono />
              <Field
                label="Final action"
                value={c.finalAction ? CDR_FINAL_ACTION_LABEL[c.finalAction] : "Awaiting instruction"}
                tone={c.finalAction ? "default" : "warn"}
              />
            </div>
          </SectionCard>
          <EvidencePack items={c.evidence} />
        </div>
      ))}

      {b.mishandled.map((m) => (
        <SectionCard key={m.id} title="Mishandled / misrouted — FC-10-A" subtitle={MISHANDLED_STAGE_LABEL[m.stage]}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <Field label="Identified" value={formatDateTime(m.identifiedAt)} />
            <Field label="CDR ref" value={m.cdrRef} mono />
            <Field label="Airline notified" value={m.airlineNotifiedAt ? formatDateTime(m.airlineNotifiedAt) : null} />
            <Field label="Age" value={`${m.ageDays} days`} tone="warn" />
            <Field label="Instruction ref" value={m.instructionRef} mono />
            <Field label="Instruction at" value={m.instructionAt ? formatDateTime(m.instructionAt) : null} />
            <div className="col-span-2">
              <Field label="Instruction" value={m.instructionText} />
            </div>
          </div>
        </SectionCard>
      ))}

      {b.reExport.map((r) => (
        <SectionCard key={r.id} title="Re-export — FC-10-B" subtitle={REEXPORT_STAGE_LABEL[r.stage]}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <Field label="Cause" value={r.cause} />
            <Field label="Raised" value={formatDateTime(r.raisedAt)} />
            <Field label="SD ref (PSW)" value={r.sdRef} mono />
            <Field label="SD lodged" value={r.sdLodgedAt ? formatDate(r.sdLodgedAt) : null} />
            <Field label="Permission ref" value={r.permissionRef} mono />
            <Field label="Permission granted" value={r.permissionGrantedAt ? formatDate(r.permissionGrantedAt) : null} />
            <Field label="Outstanding" value={formatPkr(r.outstandingCharges)} mono tone={r.outstandingCharges > 0 ? "warn" : "ok"} />
            <Field label="Age" value={`${r.ageDays} days`} tone="warn" />
          </div>
        </SectionCard>
      ))}

      {b.longStay.map((l) => (
        <SectionCard key={l.id} title="Long-stay / Section 82 — FC-10-C" subtitle={LONGSTAY_STAGE_LABEL[l.stage]}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <Field label="Age" value={`${l.ageDays} days`} tone="warn" />
            <Field label="Statutory period" value={`${l.section82Days} days`} cmts="Section82Days" />
            <Field
              label="Past deadline"
              value={l.daysToDeadline < 0 ? `${Math.abs(l.daysToDeadline)} days` : "Not yet"}
              tone={l.daysToDeadline < 0 ? "warn" : "default"}
            />
            <Field label="DC Number" value={l.DCNumber} cmts="DCNumber" mono />
            <Field label="Examiner" value={l.Examiner} cmts="Examiner" />
            <Field label="Escalated to customs" value={l.escalatedToCustomsAt ? formatDate(l.escalatedToCustomsAt) : null} />
          </div>

          <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
              Statutory notice schedule
            </p>
            <div className="flex flex-col gap-2">
              {l.notices.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-4 py-2.5"
                >
                  <DocNumber doc={n.docNumber} showIcon={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#64748B]">
                      Due {formatDate(n.dueAt)} · {n.recipients.join(", ")}
                    </p>
                  </div>
                  <span
                    className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center flex-shrink-0"
                    style={{
                      backgroundColor: n.status === "sent" ? "#DCFCE7" : n.status === "overdue" ? "#FEE2E2" : "#F1F5F9",
                      color: n.status === "sent" ? "#16A34A" : n.status === "overdue" ? "#DC2626" : "#64748B",
                    }}
                  >
                    {n.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Intake — the OCR record (FC-01 05a–05f)
 * ------------------------------------------------------------------ */

export function IntakePanel({ b }: { b: AwbBundle }) {
  const withOcr = b.details.filter((d) => d.ocr);
  const v = b.awb.intakeVariance;

  if (withOcr.length === 0) {
    return (
      <EmptyState
        title="Not yet through document intake"
        description="OCR-assisted intake runs at FC-01 steps 05a–05f."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="OCR extraction — FC-01 05b"
        subtitle="Per-item confidence; items below threshold need operator confirmation"
      >
        <div className="flex flex-col gap-4">
          {withOcr.map((d) => (
            <div key={d.DetailId} className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
              <OcrConfidenceField label={`Line ${d.SEQUENCE} — goods`} value={d.ocr!.goods} />
              <OcrConfidenceField label="Pieces" value={d.ocr!.pcs} />
              <OcrConfidenceField label="Weight" value={d.ocr!.weightKg} suffix="kg" />
            </div>
          ))}
        </div>
      </SectionCard>

      {v && (
        <SectionCard
          title="Declared vs physical — FC-01 05e"
          subtitle="Variance over tolerance auto-raises a CDR (FC-04 amendment)"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="text-left px-3 py-2">Measure</th>
                  <th className="text-right px-3 py-2">Declared (OCR)</th>
                  <th className="text-right px-3 py-2">Physical</th>
                  <th className="text-right px-3 py-2">Delta</th>
                  <th className="text-right px-3 py-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Pieces", v.pieces],
                    ["Weight (kg)", v.weightKg],
                    ["Volume (m³)", v.volumeM3],
                  ] as const
                ).map(([label, x]) => (
                  <tr key={label} className="border-b border-[#F1F5F9]">
                    <td className="px-3 py-2.5 font-medium text-[#0F172A]">{label}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{x.declared}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{x.physical}</td>
                    <td
                      className="px-3 py-2.5 text-right font-mono font-semibold"
                      style={{ color: x.delta === 0 ? "#16A34A" : "#DC2626" }}
                    >
                      {x.delta > 0 ? "+" : ""}
                      {x.delta}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right font-mono"
                      style={{ color: x.overTolerance ? "#DC2626" : "#64748B" }}
                    >
                      {(x.ratio * 100).toFixed(1)}%{x.overTolerance ? " ⚠" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.awb.cdrRaised && (
            <p className="text-[12px] text-[#DC2626] mt-3">
              Variance exceeded tolerance — a CDR was raised automatically. See the Exceptions tab.
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

export function AuditPanel({ b }: { b: AwbBundle }) {
  return (
    <div className="flex flex-col gap-4">
      <AuditStrip
        record={b.awb}
        defaultOpen
        extra={[
          { label: "Branch", value: b.awb.branch ? BRANCH_LABEL[b.awb.branch] : "Main flow" },
          { label: "Lifecycle stage", value: b.awb.stage },
        ]}
      />
      {b.godownRent && (
        <>
          <p className="text-[12px] font-semibold text-[#64748B] mt-2">Godown rent voucher</p>
          <AuditStrip record={b.godownRent} />
        </>
      )}
      {b.deliveryOrder && (
        <>
          <p className="text-[12px] font-semibold text-[#64748B] mt-2">Delivery order</p>
          <AuditStrip record={b.deliveryOrder} />
        </>
      )}
      {b.gatePass && (
        <>
          <p className="text-[12px] font-semibold text-[#64748B] mt-2">Gate pass</p>
          <AuditStrip record={b.gatePass} />
        </>
      )}
    </div>
  );
}
