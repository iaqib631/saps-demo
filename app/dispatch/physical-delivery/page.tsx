"use client";

/**
 * Physical Delivery Record — CMTS `PHYSICALDELIVERY` (22) + `DELIVERYINFO` (20).
 *
 * WHICH STEP THIS SERVES
 * ----------------------
 * **FC-08 §14, "AWB marked delivered."** Not §11 and not §12.
 *
 *   §11  gate-out verification   /dispatch/gate-out   the boundary — may it leave
 *   §12  POD captured            /dispatch/gate-out   the evidence — it did leave
 *   §14  AWB marked delivered    **here**             the ledger — the terminal's book entry
 *   §16  file closed             /dispatch/closure
 *
 * The gate event, the receiver's signed evidence and the book entry are written
 * by three different people at three different moments, and CMTS lets all three
 * disagree — which is exactly why `PHYSICALDELIVERY` survives as its own table
 * instead of three more columns on `GATEPASS`. This screen is the only place in
 * the product where the disagreement is visible.
 *
 * WHAT THE SCREEN IS FOR
 * ----------------------
 * One question per section, in the order a reviewer asks them:
 *
 *   1. which voucher am I looking at     — identity, and the DELIVERED bit
 *   2. when did it happen                — three date/time columns doing three jobs
 *   3. did it happen at all              — four sources asserting one bit
 *   4. who took it                       — three parallel contact blocks
 *   5. do the two tables agree           — four shared keys, no foreign key
 *   6. what was it settled against       — three receipt numbers and no amount
 *   7. what is still unknown             — DFLAG, and what the record cannot say
 *
 * THE CONTACT BLOCKS ARE THE POINT OF THE TICKET
 * ----------------------------------------------
 * Eight `DELIVERYINFO` columns render nowhere else in AirVault — `ShipName`,
 * `ShipAdd`, `ShipPhone`, `ShipEid`, `ConsigneeEid`, `ConsgneePhone`,
 * `AgentPhone`, `AgentEid`. This screen is their first home. `DevId` is the
 * ninth on the ticket's list and stays off: it is a surrogate key with nothing
 * to key in a prototype with no backend.
 *
 * `ConsgneePhone` is missing its "i" in CMTS. It is reproduced exactly and
 * flagged `[sic]` — parity is checked by column name, so "correcting" it here
 * would make a mapped column read as unmapped.
 *
 * Every derivation, fixture and check lives in `lib/domain/physicaldelivery.ts`
 * and is imported directly rather than through the barrel — several tickets are
 * landing domain files in the same window and `lib/domain/index.ts` is a
 * shared-conflict file.
 *
 * DETERMINISM NOTE
 * ----------------
 * The domain module builds every timestamp in PKT with an explicit `+05:00`
 * offset so a fixture does not render a different day for a reviewer in another
 * timezone. Feeding those strings back through `formatDate` would undo that —
 * `new Date(...).toLocaleDateString()` reads the runner's zone. So the day and
 * clock values on this screen are rendered from the string itself by `pktDay`
 * and `pktClock` below, never re-parsed.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  Clock,
  Database,
  FileText,
  GitCompare,
  HelpCircle,
  Link2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Receipt,
  ShieldAlert,
  Truck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import { formatPkr } from "@/lib/domain";
import {
  DFLAG_QUESTION,
  DFLAG_STATUS,
  contactBlocks,
  contactFaults,
  deliveredVerdict,
  deliveryClassName,
  deliveryClock,
  deliveryInfoFor,
  listDeliveryInfos,
  listPhysicalDeliveries,
  observedDflags,
  physicalDeliveryByVoucher,
  reconcileTables,
  settlementFor,
  type ClockNote,
  type ContactBlock,
  type ContactField,
  type ContactRole,
  type DeliveredVerdict,
  type DeliveryAssertion,
  type DeliveryClock,
  type DeliverySettlement,
  type DflagObservation,
  type KeyCheck,
  type ReceiptRef,
  type TableReconciliation,
} from "@/lib/domain/physicaldelivery";

/* ================================================================== *
 * Local presentation primitives
 *
 * The parity marker, the labelled value and the card frame are the three
 * shapes this screen repeats. They are the same three `/export/billing` and
 * `/billing/charge-working-set` use — a CMTS column name has to read the same
 * everywhere in the product or a reviewer cannot scan for it.
 * ================================================================== */

/**
 * A CMTS column marker: 9px mono grey, the token the sibling parity screens use.
 *
 * `name: null` is not the same as omitting the marker. It means the value beside
 * it is real and neither legacy table has a column for it — the resolved rent
 * figure and the POD are both in that position — and saying so is the finding.
 * A blank would read as "not yet mapped", which is a different thing entirely.
 */
function CmtsCol({ name, table }: { name: string | null; table?: string }) {
  return (
    <span
      className={`text-[9px] font-mono ${
        name === null ? "text-[#B45309] italic" : "text-[#CBD5E1]"
      } normal-case tracking-normal font-normal`}
      title={
        name === null
          ? "No column on PHYSICALDELIVERY or DELIVERYINFO"
          : `CMTS column: ${table ? `${table}.` : ""}${name}`
      }
    >
      {name ?? "no column"}
    </span>
  );
}

/** The `[sic]` badge. Used only where CMTS itself misspells the column. */
function Sic({ title }: { title: string }) {
  return (
    <span
      className="h-[15px] px-1 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono"
      title={title}
    >
      [sic]
    </span>
  );
}

/**
 * One labelled value carrying its CMTS column.
 *
 * Three states, not two. `null` renders as the word `null`; an empty or
 * whitespace-only string renders as `empty string`. On a parity screen those
 * are different findings — a NOT NULL column satisfied with `""` is not the
 * same record as a nullable column left unset — and one blank cell cannot tell
 * them apart.
 */
function Field({
  label,
  cmts,
  table,
  value,
  mono,
  tone,
  hint,
  sic,
}: {
  label: string;
  cmts: string | null;
  table?: string;
  value: string | null;
  mono?: boolean;
  tone?: string;
  hint?: string;
  sic?: string;
}) {
  const blank = value === null ? "null" : value.trim() === "" ? "empty string" : null;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        <CmtsCol name={cmts} table={table} />
        {sic && <Sic title={sic} />}
      </div>
      <span
        className={`text-[13px] font-medium break-words ${mono ? "font-mono" : ""} ${
          blank ? "italic" : ""
        }`}
        style={{ color: blank ? "#CBD5E1" : (tone ?? "#0F172A") }}
      >
        {blank ?? value}
      </span>
      {hint && <span className="text-[10px] text-[#94A3B8] leading-snug">{hint}</span>}
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  right,
  children,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[#64748B] mt-0.5 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug max-w-[760px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">{footer}</div>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`${right ? "text-right" : "text-left"} px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap align-bottom`}
    >
      {children}
    </th>
  );
}

function Chip({
  bg,
  fg,
  children,
  title,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap font-mono"
      style={{ backgroundColor: bg, color: fg }}
      title={title}
    >
      {children}
    </span>
  );
}

/** `fault` is amber-on-cream, `info` is slate. The module chooses the tone. */
function Note({ note }: { note: ClockNote }) {
  const fault = note.tone === "fault";
  return (
    <div
      className="rounded-xl border px-4 py-3 flex items-start gap-2.5"
      style={{
        borderColor: fault ? "#FDE68A" : "#E2E8F0",
        backgroundColor: fault ? "#FFFBEB" : "#F8FAFC",
      }}
    >
      {fault ? (
        <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
      ) : (
        <HelpCircle size={14} className="text-[#94A3B8] flex-shrink-0 mt-0.5" />
      )}
      <p
        className="text-[12px] leading-snug"
        style={{ color: fault ? "#92400E" : "#475569" }}
      >
        {note.text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * PKT-stable rendering
 *
 * The domain module writes every day as `YYYY-MM-DD` and every clock as
 * `HH:MM:SS`, both already in Pakistan Standard Time. Re-parsing them with
 * `new Date()` would re-interpret them in the runner's zone and slide the day.
 * These two format the string itself.
 * ------------------------------------------------------------------ */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pktDay(day: string): string {
  const [y, m, d] = day.split("-");
  const mi = Number(m) - 1;
  return mi >= 0 && mi < 12 ? `${d} ${MONTHS[mi]} ${y}` : day;
}

/** `HH:MM:SS` as stored. Seconds kept — `TIME` is a `time` column, not a label. */
function pktClock(t: string): string {
  return t;
}

/* ------------------------------------------------------------------ *
 * Contact block presentation
 * ------------------------------------------------------------------ */

const ROLE_ICON: Record<ContactRole, React.ReactNode> = {
  consignee: <User size={15} />,
  shipper: <Building2 size={15} />,
  agent: <Truck size={15} />,
};

/** Name / Address / Phone / Email, in that order on all three blocks. */
const FIELD_ICON: Record<string, React.ReactNode> = {
  Name: <User size={11} />,
  Address: <MapPin size={11} />,
  Phone: <Phone size={11} />,
  Email: <Mail size={11} />,
};

function ContactValue({ field }: { field: ContactField }) {
  const blank =
    field.value === null ? "null" : field.value.trim() === "" ? "empty string" : null;
  return (
    <span
      className={`text-[12.5px] font-medium break-words ${blank ? "italic font-mono" : ""}`}
      style={{ color: blank ? "#CBD5E1" : "#0F172A" }}
    >
      {blank ?? field.value}
    </span>
  );
}

function ContactCard({ block }: { block: ContactBlock }) {
  const state = block.empty
    ? block.optional
      ? { bg: "#F1F5F9", fg: "#64748B", label: "NOT RECORDED" }
      : { bg: "#FEE2E2", fg: "#DC2626", label: "EMPTY ON NOT NULL" }
    : block.partial
      ? { bg: "#FEF3C7", fg: "#B45309", label: "HALF-KEYED" }
      : { bg: "#DCFCE7", fg: "#16A34A", label: "COMPLETE" };

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-[#64748B] mt-0.5 flex-shrink-0">{ROLE_ICON[block.role]}</span>
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold text-[#0F172A]">{block.title}</h4>
              <p className="text-[10.5px] text-[#94A3B8] mt-0.5 leading-snug">{block.subtitle}</p>
            </div>
          </div>
          <Chip bg={state.bg} fg={state.fg}>
            {block.filled}/{block.fields.length}
          </Chip>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Chip bg={state.bg} fg={state.fg}>
            {state.label}
          </Chip>
          <Chip
            bg={block.optional ? "#F5F3FF" : "#EBF0F7"}
            fg={block.optional ? "#7C3AED" : "#1B4F8B"}
            title={
              block.optional
                ? "The agent's four columns are nullable in CMTS. A direct consignee shipment has no clearing agent, and an empty block is the correct record of that."
                : "NOT NULL in CMTS — which an empty string satisfies."
            }
          >
            {block.optional ? "NULLABLE" : "NOT NULL"}
          </Chip>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {block.fields.map((f) => (
          <div key={f.column} className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[#CBD5E1] flex-shrink-0 self-center">
                {FIELD_ICON[f.label]}
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                {f.label}
              </span>
              <CmtsCol name={f.column} table="DELIVERYINFO" />
              {f.sic && <Sic title={f.sic} />}
            </div>
            <ContactValue field={f} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function PhysicalDeliveryPage() {
  const { scope, isHq } = useSite();

  const rows = useMemo(() => listPhysicalDeliveries(scope), [scope]);
  /**
   * `DELIVERYINFO` has no `Comp_Code` / `Off_Code` and no site column at all —
   * only a `CityId`. Scoping runs through the parent AWB, the same way
   * `grCharges` scopes. Counted separately from `rows` so a contact sheet that
   * fails to resolve shows up as a difference rather than as a blank card.
   */
  const infos = useMemo(() => listDeliveryInfos(scope), [scope]);
  const dflags = useMemo(() => observedDflags(rows), [rows]);

  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(
    rows[0]?.VOUCHERNO ?? null,
  );

  /**
   * Resolved through the module's own voucher query, then checked against the
   * scoped list — switching site must not leave a KHI voucher open under LHE.
   */
  const found = selectedVoucher ? physicalDeliveryByVoucher(selectedVoucher) : undefined;
  const pd = found && rows.includes(found) ? found : (rows[0] ?? null);

  /** Everything the detail sections read, derived once per selected voucher. */
  const view = useMemo(() => {
    if (!pd) return null;
    const di = deliveryInfoFor(pd.AWBNO);
    const blocks = di ? contactBlocks(di) : [];
    return {
      di,
      clock: deliveryClock(pd) as DeliveryClock,
      verdict: deliveredVerdict(pd) as DeliveredVerdict,
      blocks,
      blockFaults: contactFaults(blocks),
      recon: reconcileTables(pd, di) as TableReconciliation,
      settlement: settlementFor(pd) as DeliverySettlement,
    };
  }, [pd]);

  /**
   * The scope headline. Computed across every voucher in scope rather than off
   * the selected one — "how often do the four sources disagree" is not a
   * per-consignment question, it is the reason the table needs a screen.
   */
  const summary = useMemo(() => {
    let delivered = 0;
    let conflicts = 0;
    let offBooked = 0;
    let sheetFaults = 0;
    for (const r of rows) {
      if (r.DELIVERED) delivered += 1;
      if (!deliveredVerdict(r).agreed) conflicts += 1;
      if (deliveryClock(r).bookedOffsetDays !== 0) offBooked += 1;
      const di = deliveryInfoFor(r.AWBNO);
      const faulted =
        !di || contactFaults(contactBlocks(di)).length > 0 || !reconcileTables(r, di).agrees;
      if (faulted) sheetFaults += 1;
    }
    return { delivered, conflicts, offBooked, sheetFaults };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Dispatch" }, { label: "Physical Delivery Record" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M14 · FC-08 §14
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              PHYSICALDELIVERY 22 · DELIVERYINFO 20
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              FIRST HOME — 8 CONTACT COLUMNS
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Physical Delivery Record
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-[900px]">
            Gate-out asks whether the vehicle may leave and the POD is the receiver&rsquo;s signed
            evidence that it did. This is neither — it is the terminal&rsquo;s own book entry that
            the consignment left, booked to a date, against a voucher, with the settlement receipts
            named. Three moments, three people, and CMTS lets all three disagree.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* ---------------- Scope strip ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Delivery vouchers",
            value: String(rows.length),
            tone: "#0F172A",
            hint: "PHYSICALDELIVERY rows — one per consignment collected",
          },
          {
            label: "Contact sheets",
            value: String(infos.length),
            tone: infos.length === rows.length ? "#0F172A" : "#DC2626",
            hint: "DELIVERYINFO — no site column, scoped through the parent AWB",
          },
          {
            label: "Marked delivered",
            value: `${summary.delivered} of ${rows.length}`,
            tone: "#1B4F8B",
            hint: "DELIVERED bit on this table only",
          },
          {
            label: "Sources disagreeing",
            value: String(summary.conflicts),
            tone: summary.conflicts > 0 ? "#DC2626" : "#16A34A",
            hint: "four assertions of one bit, nothing keeping them in step",
          },
          {
            label: "Not booked to write day",
            value: String(summary.offBooked),
            tone: summary.offBooked > 0 ? "#D97706" : "#64748B",
            hint: "DELIVERYDATE ≠ DATE — the storage clock moves with it",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[18px] font-bold mt-1 font-mono" style={{ color: k.tone }}>
              {k.value}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-1 leading-snug">{k.hint}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 || !pd || !view ? (
        <EmptyState
          title="No delivery vouchers at this site"
          description="The counter cuts a voucher when the consignee presents to collect, which needs the DO to exist. Nothing at this site has reached that point."
        />
      ) : (
        <>
          {/* ---------------- Voucher rail ---------------- */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center gap-2 flex-wrap">
              <Receipt size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Delivery vouchers</h3>
              <span className="text-[11px] text-[#94A3B8]">
                <span className="font-mono">VOUCHERNO</span> is this table&rsquo;s own series —
                not the godown-rent one that shares the column name
              </span>
            </div>
            <div className="flex gap-3 p-4 overflow-x-auto">
              {rows.map((r) => {
                const on = r.VOUCHERNO === pd.VOUCHERNO;
                const c = deliveryClock(r);
                return (
                  <button
                    key={r.VOUCHERNO}
                    onClick={() => setSelectedVoucher(r.VOUCHERNO)}
                    className="text-left rounded-xl border px-4 py-3 min-w-[228px] flex-shrink-0 transition-colors cursor-pointer hover:bg-[#F8FAFC]"
                    style={{
                      borderColor: on ? "#1B4F8B" : "#E2E8F0",
                      backgroundColor: on ? "#EBF0F7" : "#FFFFFF",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-[#0F172A] truncate">
                        {r.VOUCHERNO}
                      </span>
                      {r.DELIVERED ? (
                        <Chip bg="#DCFCE7" fg="#16A34A">
                          <Check size={9} strokeWidth={3} /> 1
                        </Chip>
                      ) : (
                        <Chip bg="#F1F5F9" fg="#64748B">
                          0
                        </Chip>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#1B4F8B] mt-1 font-mono">{r.AWBNO}</p>
                    <p className="text-[10.5px] text-[#94A3B8] mt-0.5 font-mono">
                      booked {pktDay(c.effectiveDay)}
                      {c.bookedOffsetDays !== 0 && (
                        <span className="text-[#D97706] font-bold">
                          {" "}
                          {c.bookedOffsetDays > 0 ? "+" : ""}
                          {c.bookedOffsetDays}d
                        </span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---------------- 1 · Voucher identity ---------------- */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Delivery voucher
                  </span>
                  <CmtsCol name="VOUCHERNO" table="PHYSICALDELIVERY" />
                </div>
                <p className="font-mono text-[20px] font-bold text-[#0F172A] mt-0.5 break-all">
                  {pd.VOUCHERNO}
                </p>
                <p className="text-[12px] text-[#64748B] mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                  <AwbLink awbNo={pd.AWBNO} tab="dispatch" />
                  <CmtsCol name="AWBNO" />
                  <span className="text-[#CBD5E1]">·</span>
                  <span>IGM</span>
                  <span className="font-mono text-[#0F172A]">{pd.IGMNO}</span>
                  <CmtsCol name="IGMNO" />
                  <span className="text-[#CBD5E1]">·</span>
                  <span>{deliveryClassName(pd)}</span>
                  <CmtsCol name="classId" />
                </p>
              </div>

              <div className="text-right">
                <div className="flex items-baseline gap-1.5 justify-end">
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Delivered
                  </span>
                  <CmtsCol name="DELIVERED" table="PHYSICALDELIVERY" />
                </div>
                <p
                  className="text-[22px] font-bold font-mono"
                  style={{ color: pd.DELIVERED ? "#16A34A" : "#64748B" }}
                >
                  bit = {pd.DELIVERED ? "1" : "0"}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1 max-w-[300px] leading-snug">
                  {view.verdict.agreed
                    ? `All four sources agree — ${view.verdict.sayingDelivered} of 4 say delivered.`
                    : `${view.verdict.sayingDelivered} of 4 sources say delivered. This bit is one of them.`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
              <Field
                label="House waybill"
                cmts="HWBNO"
                table="PHYSICALDELIVERY"
                value={pd.HWBNO}
                mono
                hint="no consolidation in this fixture set reaches collection — null is the record, not a gap"
              />
              <Field
                label="Detained sub-identity"
                cmts="DetendIdentification"
                table="PHYSICALDELIVERY"
                value={pd.DetendIdentification}
                mono
                hint="spelled DetendUniqueIdentification on the contact sheet — see the join below"
              />
              <Field
                label="Cargo class"
                cmts="classId"
                table="PHYSICALDELIVERY"
                value={deliveryClassName(pd)}
              />
              <Field
                label="Site"
                cmts="Comp_Code / Off_Code"
                table="PHYSICALDELIVERY"
                value={`${pd.site} · ${pd.Comp_Code}/${pd.Off_Code}`}
                mono
                hint="PHYSICALDELIVERY is site-scoped; DELIVERYINFO is not"
              />
            </div>

            <div className="mt-4 rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3 flex items-start gap-2.5">
              <PackageCheck size={14} className="text-[#1B4F8B] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#1B4F8B] leading-snug">
                <strong>Where this sits.</strong> FC-08 §11 gate-out decides whether the vehicle may
                leave. §12 captures the POD — the receiver&rsquo;s signed evidence that it did. This
                record is §14: the terminal&rsquo;s book entry that it happened, written at the
                counter, possibly on a different day, by a different person. §16 then closes the
                file.
              </p>
            </div>
          </div>

          {/* ---------------- 2 · The delivery clock ---------------- */}
          <Card
            icon={<CalendarClock size={15} />}
            title="Three date columns, three jobs"
            subtitle="DELIVERYDATE, DATE and TIME are not one timestamp split in three. Collapsing them destroys the only thing they can prove together — that a voucher was booked to a day other than the day it was written."
            right={
              view.clock.bookedOffsetDays === 0 && view.clock.timeAgreesWithDate ? (
                <Chip bg="#DCFCE7" fg="#16A34A">
                  <Check size={10} strokeWidth={3} /> Clocks agree
                </Chip>
              ) : (
                <Chip bg="#FEF3C7" fg="#B45309">
                  <AlertTriangle size={10} strokeWidth={2.5} />
                  {view.clock.bookedOffsetDays !== 0
                    ? `${view.clock.bookedOffsetDays > 0 ? "+" : ""}${view.clock.bookedOffsetDays}d offset`
                    : "Two clocks"}
                </Chip>
              )
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#1B4F8B] uppercase tracking-wider">
                    Booked to
                  </span>
                  <CmtsCol name="DELIVERYDATE" table="PHYSICALDELIVERY" />
                </div>
                <p className="font-mono text-[15px] font-bold text-[#0F172A] mt-1">
                  {pktDay(view.clock.effectiveDay)}
                </p>
                <p className="text-[11px] text-[#475569] mt-1.5 leading-snug">
                  The effective date the voucher carries — the day the storage clock is stopped at
                  and the day finance reconciles against.
                </p>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Written on
                  </span>
                  <CmtsCol name="DATE" table="PHYSICALDELIVERY" />
                </div>
                <p className="font-mono text-[15px] font-bold text-[#0F172A] mt-1">
                  {pktDay(view.clock.recordedDay)}
                </p>
                <p className="text-[11px] text-[#64748B] mt-1.5 leading-snug">
                  The day the record was keyed at the counter. Typed{" "}
                  <span className="font-mono">datetime</span>, and its time half reads{" "}
                  <span
                    className="font-mono font-semibold"
                    style={{ color: view.clock.dateIsDateOnly ? "#64748B" : "#DC2626" }}
                  >
                    {pktClock(view.clock.dateColumnTimeOfDay)}
                  </span>
                  {view.clock.dateIsDateOnly ? " — unused." : " — which TIME contradicts."}
                </p>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Keyed at
                  </span>
                  <CmtsCol name="TIME" table="PHYSICALDELIVERY" />
                </div>
                <p className="font-mono text-[15px] font-bold text-[#0F172A] mt-1">
                  {pktClock(view.clock.recordedTime)}
                </p>
                <p className="text-[11px] text-[#64748B] mt-1.5 leading-snug">
                  A separate <span className="font-mono">time</span> column, not part of{" "}
                  <span className="font-mono">DATE</span>. The legacy form had a date box and a time
                  box, keyed independently.
                </p>
              </div>
            </div>

            {/* The offset, drawn */}
            <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-[#94A3B8]" />
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Counter instant
                  </span>
                </div>
                <span className="font-mono text-[12.5px] font-semibold text-[#0F172A]">
                  {pktDay(view.clock.recordedDay)} {pktClock(view.clock.recordedTime)} PKT
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  DATE&rsquo;s day + TIME, composed by the application — CMTS stores no such column
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  DELIVERYDATE − DATE
                </span>
                <span
                  className="font-mono text-[13px] font-bold"
                  style={{ color: view.clock.bookedOffsetDays === 0 ? "#16A34A" : "#D97706" }}
                >
                  {view.clock.bookedOffsetDays > 0 ? "+" : ""}
                  {view.clock.bookedOffsetDays} day
                  {Math.abs(view.clock.bookedOffsetDays) === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] text-[#94A3B8]">
                  {view.clock.bookedOffsetDays === 0
                    ? "booked to the day it was written"
                    : view.clock.bookedOffsetDays < 0
                      ? "back-dated — the storage clock stops earlier than the record exists"
                      : "forward-booked — the voucher takes effect after it was cut"}
                </span>
              </div>
            </div>

            {view.clock.notes.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5">
                {view.clock.notes.map((n, i) => (
                  <Note key={i} note={n} />
                ))}
              </div>
            )}
          </Card>

          {/* ---------------- 3 · The delivered verdict ---------------- */}
          <Card
            icon={<GitCompare size={15} />}
            title="&ldquo;Delivered&rdquo; is asserted in four places"
            subtitle="The roll-up on this table is not a money total, it is a bit — and its parts are three other columns in two other tables plus the AirVault POD. No trigger, no view and no constraint keeps them in step, so no majority vote is taken here either."
            right={
              view.verdict.agreed ? (
                <Chip bg="#DCFCE7" fg="#16A34A">
                  <Check size={10} strokeWidth={3} /> 4 of 4 agree
                </Chip>
              ) : (
                <Chip bg="#FEE2E2" fg="#DC2626">
                  <AlertTriangle size={10} strokeWidth={2.5} /> {view.verdict.sayingDelivered} of 4
                </Chip>
              )
            }
            footer={
              <p className="text-[11px] text-[#64748B] leading-snug">
                Picking a winner on screen would manufacture a fact the data does not hold. Four
                sources that disagree are four sources that disagree — the bit is flipped by hand on
                whichever screen the clerk had open.
              </p>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <Th>Source</Th>
                    <Th>CMTS column</Th>
                    <Th>Says</Th>
                    <Th>As stored</Th>
                  </tr>
                </thead>
                <tbody>
                  {view.verdict.assertions.map((a: DeliveryAssertion) => (
                    <tr key={a.source} className="border-b border-[#F1F5F9] last:border-0 align-top">
                      <td className="px-3 py-3 text-[12.5px] font-medium text-[#0F172A] whitespace-nowrap">
                        {a.source}
                      </td>
                      <td className="px-3 py-3 min-w-[220px]">
                        {a.cmts === null ? (
                          <span
                            className="text-[11px] font-mono text-[#B45309] italic"
                            title="AirVault addition — CMTS has no POD table"
                          >
                            no column — AirVault addition
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-[#64748B]">{a.cmts}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {a.delivered ? (
                          <Chip bg="#DCFCE7" fg="#16A34A">
                            <Check size={10} strokeWidth={3} /> DELIVERED
                          </Chip>
                        ) : (
                          <Chip bg="#F1F5F9" fg="#64748B">
                            <XCircle size={10} strokeWidth={2.5} /> NOT
                          </Chip>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-[#64748B] font-mono">
                        {a.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {view.verdict.conflict && (
              <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                <ShieldAlert size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#991B1B] leading-snug">{view.verdict.conflict}</p>
              </div>
            )}
          </Card>

          {/* ---------------- 4 · The contact sheet ---------------- */}
          <Card
            icon={<Users size={15} />}
            title="Who took the cargo — the DELIVERYINFO contact sheet"
            subtitle="Three parties, four facts each, built from one shape so the blocks render in lockstep. They are parallel in shape and not in obligation — the agent's four columns are nullable and the other eight are NOT NULL, which is why an empty agent block is a correct record and an empty consignee block is a finding."
            right={
              view.blockFaults.length === 0 ? (
                <Chip bg="#DCFCE7" fg="#16A34A">
                  <Check size={10} strokeWidth={3} /> No block faults
                </Chip>
              ) : (
                <Chip bg="#FEF3C7" fg="#B45309">
                  <AlertTriangle size={10} strokeWidth={2.5} /> {view.blockFaults.length} fault
                  {view.blockFaults.length === 1 ? "" : "s"}
                </Chip>
              )
            }
            footer={
              <p className="text-[11px] text-[#64748B] leading-snug">
                Eight of these twelve columns render nowhere else in AirVault —{" "}
                <span className="font-mono">ShipName</span>,{" "}
                <span className="font-mono">ShipAdd</span>,{" "}
                <span className="font-mono">ShipPhone</span>,{" "}
                <span className="font-mono">ShipEid</span>,{" "}
                <span className="font-mono">ConsigneeEid</span>,{" "}
                <span className="font-mono">ConsgneePhone</span>,{" "}
                <span className="font-mono">AgentPhone</span>,{" "}
                <span className="font-mono">AgentEid</span>. This screen is their first home. A
                column-name scan scored <span className="font-mono">DELIVERYINFO</span> at 11/20
                rendered, but every one of those 11 was a collision with a different table&rsquo;s{" "}
                <span className="font-mono">AWBNO</span> /{" "}
                <span className="font-mono">CONSIGNEENAME</span> on a different screen — real
                coverage was 0/20. <span className="font-mono">Eid</span> is undocumented; the
                legacy values are e-mail addresses, so it is labelled Email and the column marker
                beside it is the authority, not the label.
              </p>
            }
          >
            {!view.di ? (
              <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                <ShieldAlert size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#991B1B] leading-snug">
                  No <span className="font-mono">DELIVERYINFO</span> row for this delivery. The
                  handover is booked and the contact sheet behind it does not exist — there is
                  nobody recorded as having taken the cargo.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {view.blocks.map((b) => (
                    <ContactCard key={b.role} block={b} />
                  ))}
                </div>

                {view.blockFaults.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2.5">
                    {view.blockFaults.map((f) => (
                      <div
                        key={f}
                        className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5"
                      >
                        <AlertTriangle
                          size={14}
                          className="text-[#D97706] flex-shrink-0 mt-0.5"
                        />
                        <p className="text-[12px] text-[#92400E] leading-snug">{f}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ---------------- 5 · The join that is not one ---------------- */}
          <Card
            icon={<Link2 size={15} />}
            title="The join that is not one"
            subtitle="The two tables describe one handover and share four keys, and there is no foreign key between them. DELIVERYINFO is matched to its delivery on AWBNO alone — which is not unique in CMTS, where the composite is IGMNO + AWBNO + SEQUENCE."
            right={
              view.recon.agrees ? (
                <Chip bg="#DCFCE7" fg="#16A34A">
                  <Check size={10} strokeWidth={3} /> Keys agree
                </Chip>
              ) : (
                <Chip bg="#FEE2E2" fg="#DC2626">
                  <AlertTriangle size={10} strokeWidth={2.5} /> {view.recon.faults.length} key fault
                  {view.recon.faults.length === 1 ? "" : "s"}
                </Chip>
              )
            }
            footer={
              <p className="text-[11px] text-[#64748B] leading-snug">
                The lookup is an inference the application makes, not a relationship the data
                enforces. That is why the other three keys are checked <em>after</em> the match has
                already succeeded — a mistyped <span className="font-mono">IGMNO</span> on the
                contact sheet is invisible to CMTS: the row still resolves, it just resolves to a
                consignment the contacts do not belong to.
              </p>
            }
          >
            {view.recon.checks.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8]">
                Nothing to reconcile — there is no contact sheet to compare against.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>Key</Th>
                      <Th>PHYSICALDELIVERY</Th>
                      <Th>DELIVERYINFO</Th>
                      <Th>Agrees</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.recon.checks.map((c: KeyCheck) => (
                      <tr key={c.label} className="border-b border-[#F1F5F9] last:border-0 align-top">
                        <td className="px-3 py-3 min-w-[170px]">
                          <p className="text-[12.5px] font-medium text-[#0F172A] leading-snug">
                            {c.label}
                          </p>
                          {c.nameMismatch && (
                            <p className="text-[10.5px] text-[#B45309] mt-1 leading-snug">
                              {c.nameMismatch}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 min-w-[190px]">
                          <CmtsCol name={c.pdColumn} table="PHYSICALDELIVERY" />
                          <p
                            className="text-[12px] font-mono font-medium mt-0.5"
                            style={{ color: c.pdValue === null ? "#CBD5E1" : "#0F172A" }}
                          >
                            {c.pdValue ?? "null"}
                          </p>
                        </td>
                        <td className="px-3 py-3 min-w-[190px]">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <CmtsCol name={c.diColumn} table="DELIVERYINFO" />
                            {c.nameMismatch && <Sic title={c.nameMismatch} />}
                          </div>
                          <p
                            className="text-[12px] font-mono font-medium mt-0.5"
                            style={{
                              color:
                                c.diValue === null
                                  ? "#CBD5E1"
                                  : c.agrees
                                    ? "#0F172A"
                                    : "#DC2626",
                            }}
                          >
                            {c.diValue ?? "null"}
                          </p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {c.agrees ? (
                            <Chip bg="#DCFCE7" fg="#16A34A">
                              <Check size={10} strokeWidth={3} /> MATCH
                            </Chip>
                          ) : (
                            <Chip bg="#FEE2E2" fg="#DC2626">
                              <XCircle size={10} strokeWidth={2.5} /> DIFFERS
                            </Chip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {view.recon.faults.length > 0 && (
              <div className="mt-4 flex flex-col gap-2.5">
                {view.recon.faults.map((f) => (
                  <div
                    key={f}
                    className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5"
                  >
                    <ShieldAlert size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#991B1B] leading-snug">{f}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ---------------- 6 · Settlement ---------------- */}
          <Card
            icon={<Receipt size={15} />}
            title="Three receipt numbers and no amount"
            subtitle="PHYSICALDELIVERY names the receipts a handover was settled against and carries no figure — CASHNO, BECASHNO and BLNO are all varchar(20) and there is no amount column on the table at all. The money below is resolved through GODOWNRENT and labelled as resolved."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {view.settlement.receipts.map((r: ReceiptRef) => (
                <div
                  key={r.column}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5"
                >
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      {r.label}
                    </span>
                    <CmtsCol name={r.column} table="PHYSICALDELIVERY" />
                  </div>
                  <p
                    className={`font-mono text-[13.5px] font-semibold mt-1 break-all ${
                      r.value === null ? "italic" : ""
                    }`}
                    style={{ color: r.value === null ? "#CBD5E1" : "#0F172A" }}
                  >
                    {r.value ?? "null"}
                  </p>
                  <p className="text-[10.5px] text-[#94A3B8] mt-1.5 leading-snug">{r.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3.5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={13} className="text-[#1B4F8B]" />
                <span className="text-[11px] font-semibold text-[#1B4F8B] uppercase tracking-wider">
                  Resolved through GODOWNRENT on AWBNO
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <Field
                  label="Rent voucher"
                  cmts="GODOWNRENT.VOUCHERNO"
                  value={view.settlement.rentVoucherNo}
                  mono
                  hint="a different series from the delivery voucher above"
                />
                <Field
                  label="Net payable"
                  cmts="GODOWNRENT.NETPAYABLE"
                  value={
                    view.settlement.rentNetPayable === null
                      ? null
                      : formatPkr(view.settlement.rentNetPayable)
                  }
                  mono
                  hint="the only figure behind this handover, and it is on another table"
                />
                <Field
                  label="Paid"
                  cmts="GODOWNRENT.PAID"
                  value={view.settlement.rentPaid ? "true" : "false"}
                  mono
                  tone={view.settlement.rentPaid ? "#16A34A" : "#D97706"}
                />
                <Field
                  label="Settled in cash"
                  cmts="GODOWNRENT.CASH"
                  value={view.settlement.rentCash ? "true" : "false"}
                  mono
                  hint="the only thing that populates CASHNO above"
                />
              </div>

              <div className="mt-3.5 pt-3.5 border-t border-[#C7D7EC] flex items-start gap-2.5">
                <AlertTriangle size={13} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-[#475569] leading-snug">
                  <strong>Column-name collision.</strong>{" "}
                  <span className="font-mono">GODOWNRENT.VOUCHERNO</span> and{" "}
                  <span className="font-mono">PHYSICALDELIVERY.VOUCHERNO</span> are the same column
                  name on two tables and are <em>not</em> the same series. The join between them
                  runs through <span className="font-mono">AWBNO</span>, never through the two
                  vouchers — a migration that pairs them on name produces nonsense.
                </p>
              </div>
            </div>
          </Card>

          {/* ---------------- 7 · DFLAG ---------------- */}
          <Card
            icon={<HelpCircle size={15} />}
            title="DFLAG — deliberately unresolved"
            subtitle="A varchar(1) with no data-dictionary entry, no CHECK constraint and no lookup table behind it. It is rendered as the raw character and interpreted nowhere: a guessed label on a release-side flag is worse than a blank one, because the next reader inherits the guess as fact."
            right={
              <Chip bg="#F5F3FF" fg="#7C3AED" title={DFLAG_QUESTION}>
                {DFLAG_STATUS.toUpperCase()} — BLOCKED ON SAPS
              </Chip>
            }
            footer={
              <p className="text-[11px] text-[#64748B] leading-snug">{DFLAG_QUESTION}</p>
            }
          >
            <div className="flex items-baseline gap-2 flex-wrap mb-4">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                On this voucher
              </span>
              <CmtsCol name="DFLAG" table="PHYSICALDELIVERY" />
              <span
                className="font-mono text-[15px] font-bold"
                style={{ color: pd.DFLAG === null ? "#CBD5E1" : "#0F172A" }}
              >
                {pd.DFLAG === null
                  ? "null"
                  : pd.DFLAG.trim() === ""
                    ? "' ' (single space)"
                    : pd.DFLAG}
              </span>
            </div>

            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Values observed across the {rows.length} voucher{rows.length === 1 ? "" : "s"} in
              scope
            </p>
            <div className="flex flex-wrap gap-2">
              {dflags.map((o: DflagObservation) => {
                const isCurrent = o.value === pd.DFLAG;
                return (
                  <div
                    key={o.display}
                    className="rounded-xl border px-3.5 py-2.5 min-w-[150px]"
                    style={{
                      borderColor: isCurrent ? "#1B4F8B" : "#E2E8F0",
                      backgroundColor: isCurrent ? "#EBF0F7" : "#F8FAFC",
                    }}
                    title={o.vouchers.join(", ")}
                  >
                    <p
                      className="font-mono text-[14px] font-bold"
                      style={{ color: o.value === null ? "#CBD5E1" : "#0F172A" }}
                    >
                      {o.display}
                    </p>
                    <p className="text-[10.5px] text-[#94A3B8] mt-0.5">
                      {o.count} voucher{o.count === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                <Database size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#92400E] leading-snug">
                  <span className="font-mono">IMPORTAWB.DFLAG</span> is a{" "}
                  <span className="font-mono">bit</span>. This one is{" "}
                  <span className="font-mono">varchar(1)</span>. Same name, two types, two tables —
                  they are not the same flag and must not be mapped onto one another during
                  migration.
                </p>
              </div>
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#92400E] leading-snug">
                  At least one legacy row holds a single <strong>space</strong> rather than{" "}
                  <span className="font-mono">NULL</span>, so any migration predicate written as{" "}
                  <span className="font-mono">DFLAG IS NULL</span> misses it. It is listed above as
                  its own observation for exactly that reason.
                </p>
              </div>
            </div>
          </Card>

          {/* ---------------- 8 · What the record cannot say ---------------- */}
          <Card
            icon={<ShieldAlert size={15} />}
            title="What these two tables cannot tell you"
            subtitle="Limits of the legacy record itself, not of this screen. Each one is a decision SAPS has to make before the pair is migrated, and none can be settled from a schema-only restore."
          >
            <div className="flex flex-col gap-3">
              {[
                {
                  columns: ["DELIVERYINFO — audit columns"],
                  finding:
                    "DELIVERYINFO carries none of the six audit columns. The contact block a delivery dispute would be argued from cannot say who keyed it or when. Not an omission in the interface — the legacy table genuinely has no CreatedBy, CreatedDate, UpdatedBy or UpdatedDate.",
                  ask: "Is the contact sheet's provenance recoverable from anywhere, or does a disputed handover have no audit trail at all?",
                },
                {
                  columns: ["DELIVERYINFO.CityId", "Comp_Code", "Off_Code"],
                  finding:
                    "DELIVERYINFO has no site keys — only a CityId. Every scoping decision on this screen therefore runs through the parent AWB rather than through the row itself, which is the same compromise grCharges makes.",
                  ask: "Should DELIVERYINFO gain the site keys on migration, or does city remain the only scope a contact sheet has?",
                },
                {
                  columns: ["CreatedOn", "UpdatedOn"],
                  finding:
                    "CMTS spells the audit columns CreatedOn / UpdatedOn on PHYSICALDELIVERY and CreatedDate / UpdatedDate on most other tables. AuditColumns standardises on the majority spelling and the strip below renders the shared six — adding a CreatedOn twin beside CreatedDate would split one column across two fields.",
                  ask: "Confirm the two spellings are one concept so the migration maps them onto the standard six.",
                },
                {
                  columns: ["PHYSICALDELIVERYID", "DevId", "AWBId", "CargoClassId", "CityId"],
                  finding:
                    "Surrogate keys. They are populated so the records type-check and join, and they are deliberately not rendered as parity fields: with no backend for them to key, a screen showing DevId: 3 shows nothing a reader can act on. DevId appears on the ticket's never-rendered list and stays out on that basis — eight contact columns get their first home here, not nine.",
                  ask: "None — flagged so the count is not read as a miss.",
                },
                {
                  columns: ["BLNO"],
                  finding:
                    "Sea-freight vocabulary on an air-cargo table. It is carried verbatim rather than dropped or renamed; whether it is dead weight or a genuine multimodal reference is not something to settle by naming it.",
                  ask: "Is BLNO a live multimodal reference, or dead weight that can be retired at cutover?",
                },
              ].map((a) => (
                <div key={a.columns.join("|")} className="rounded-xl border border-[#E2E8F0] px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {a.columns.map((c) => (
                      <span
                        key={c}
                        className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-bold inline-flex items-center font-mono"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#334155] mt-2 leading-snug">{a.finding}</p>
                  <p className="text-[11px] text-[#1B4F8B] mt-1.5 leading-snug">
                    <strong>Ask SAPS:</strong> {a.ask}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* ---------------- Audit strip ---------------- */}
          <AuditStrip
            record={pd}
            extra={[
              { label: "PHYSICALDELIVERYID", value: String(pd.PHYSICALDELIVERYID) },
              { label: "DevId (DELIVERYINFO)", value: view.di ? String(view.di.DevId) : "—" },
              { label: "Spelled in CMTS", value: "CreatedOn / UpdatedOn" },
            ]}
          />

          {/* ---------------- Cross-links ---------------- */}
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/dispatch/gate-pass"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              <FileText size={12} /> §04 — the gate pass this was booked against{" "}
              <ArrowUpRight size={12} />
            </Link>
            <Link
              href="/dispatch/gate-out"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              <Truck size={12} /> §11–12 — the gate event and the POD <ArrowUpRight size={12} />
            </Link>
            <Link
              href="/billing/godown-rent"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              <Receipt size={12} /> the rent voucher the money is resolved from{" "}
              <ArrowUpRight size={12} />
            </Link>
            <Link
              href="/dispatch/closure"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              <PackageCheck size={12} /> §16 — file closed <ArrowUpRight size={12} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
