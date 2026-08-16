"use client";

/**
 * P5-7 · The four `AWBDELEIVERYORDER` columns that describe the state of the
 * *order* rather than the consignment: `ISLOCK`, `DUPLICATEREASON`, `REASON`
 * and `FIRDATE`.
 *
 * They are grouped into one card instead of being folded into the collection
 * grid because three of the four share a property nothing else on this screen
 * has: on almost every delivery order they are empty, and empty is the
 * *correct* reading — nothing went wrong. Dropped into the routine grid beside
 * NIC and CHALLANNO they would read as missing data and send someone looking
 * for the value that "should" be there.
 *
 * The two exception slots borrow the release gate's applicable / N-A idiom
 * from the same screen rather than inventing a second convention: a live
 * exception renders its columns as fields, a dormant one renders the N/A chip
 * and names the flag that would fill it. Naming the dormant column in the note
 * is deliberate — hiding the slot outright would leave `DUPLICATEREASON` and
 * `FIRDATE` with no on-screen representation at all on every DO in the
 * fixtures, and migration parity can only be checked against something a
 * reader can actually see.
 */

import { AlertTriangle, Copy, FileWarning, Lock, Unlock } from "lucide-react";
import { formatDate, type DeliveryOrder } from "@/lib/domain";
import DoField from "./DoField";

/**
 * One exception slot. `live` decides between the two states; it is passed in
 * rather than derived here because each slot is gated on a different flag and
 * burying that test inside a generic component is how the gate on this screen
 * would stop being readable.
 */
function ExceptionSlot({
  icon,
  title,
  live,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  live: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <span
        className="h-[18px] w-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: live ? "#FEE2E2" : "#F1F5F9" }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className="text-[13px] font-medium"
            style={{ color: live ? "#0F172A" : "#94A3B8" }}
          >
            {title}
          </p>
          {!live && (
            <span className="h-[16px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-bold inline-flex items-center">
              N/A
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DoExceptionCard({ order }: { order: DeliveryOrder }) {
  const duplicateRaised = order.IsDuplicate;

  /**
   * A loss case is live if EITHER column is set, not both. CMTS lets the two
   * fill at different moments — the narrative is written at the counter the
   * hour the shortage is found, the FIR date only lands once the police
   * actually register it — so requiring both would hide the case for exactly
   * the days it is most open.
   */
  const lossRaised = Boolean(order.Reason || order.FIRdate);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileWarning size={15} className="text-[#64748B]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Record state &amp; exceptions
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              Every DO carries a lock state; the reissue and loss columns fill only when
              something has gone wrong with the order itself
            </p>
          </div>
        </div>
        <span
          className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
          style={
            order.IsLock
              ? { backgroundColor: "#F1F5F9", color: "#475569" }
              : { backgroundColor: "#DCFCE7", color: "#16A34A" }
          }
        >
          {order.IsLock ? <Lock size={10} /> : <Unlock size={10} />}
          {order.IsLock ? "LOCKED" : "OPEN"}
        </span>
      </div>

      <div className="divide-y divide-[#F1F5F9]">
        {/* ISLOCK — the one column here that is `bit NOT NULL`, so it always
            has a value and always renders as a field. It is the record's
            editability, not an exception, which is why it leads the card
            rather than sitting among the two that stay null. */}
        <div className="px-5 py-3.5 flex items-start gap-3">
          <span
            className="h-[18px] w-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: order.IsLock ? "#F1F5F9" : "#DCFCE7" }}
          >
            {order.IsLock ? (
              <Lock size={11} className="text-[#475569]" />
            ) : (
              <Unlock size={11} className="text-[#16A34A]" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0F172A]">Record lock</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {order.IsLock
                ? "Frozen at AWB closure. The order stands as issued — a correction from here is a fresh duplicate DO, not an edit to this one."
                : "Open. The order can still be amended at the counter without raising a duplicate."}
            </p>
          </div>
          <div className="flex-shrink-0">
            <DoField
              cmts="ISLOCK"
              value={order.IsLock ? "Yes" : "No"}
              tone={order.IsLock ? "muted" : "ok"}
            />
          </div>
        </div>

        {/* DUPLICATEREASON — gated on IsDuplicate, per the ticket. The flag is
            already a badge in the header; what CMTS never showed anywhere is
            WHY the reissue happened, which is the whole point of the column. */}
        <ExceptionSlot
          icon={
            <Copy size={11} className={duplicateRaised ? "text-[#DC2626]" : "text-[#94A3B8]"} />
          }
          title="Reissued as a duplicate"
          live={duplicateRaised}
        >
          {duplicateRaised ? (
            order.DuplicateReason ? (
              <div className="mt-2">
                <DoField cmts="DUPLICATEREASON" value={order.DuplicateReason} />
              </div>
            ) : (
              <p className="text-[11px] text-[#B45309] mt-0.5">
                Flagged <span className="font-mono">IsDuplicate</span> with{" "}
                <span className="font-mono">DUPLICATEREASON</span> still null — precisely
                the gap this column closes. The record says it is a reissue and cannot say
                what the original was replaced for.
              </p>
            )
          ) : (
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              <span className="font-mono">IsDuplicate</span> is false — this is the original
              order, so CMTS leaves <span className="font-mono">DUPLICATEREASON</span> null.
              The reason is written only against a reissue.
            </p>
          )}
        </ExceptionSlot>

        {/* FIRDATE + REASON — an exception context, not a routine date field.
            A FIR date on a delivery order means the cargo it releases was lost
            or stolen, and rendering that as another grey field beside the
            shift is how a screen manages to print a police case and have it
            read as paperwork. */}
        <ExceptionSlot
          icon={
            <AlertTriangle size={11} className={lossRaised ? "text-[#DC2626]" : "text-[#94A3B8]"} />
          }
          title="Loss or theft — police report"
          live={lossRaised}
        >
          {lossRaised ? (
            <>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                <DoField
                  cmts="FIRDATE"
                  value={order.FIRdate ? formatDate(order.FIRdate) : null}
                  tone="warn"
                />
                <DoField cmts="REASON" value={order.Reason} />
              </div>
              {order.Reason && !order.FIRdate && (
                <p className="text-[11px] text-[#B45309] mt-2">
                  A reason is on file with no <span className="font-mono">FIRDATE</span> —
                  the loss is recorded but the report has not been registered, or the date
                  never came back from the station.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              No loss recorded against this order, so <span className="font-mono">FIRDATE</span>{" "}
              and <span className="font-mono">REASON</span> are both null. They fill when the
              consignment this DO releases is reported lost or stolen and a First Information
              Report is registered.
            </p>
          )}
        </ExceptionSlot>
      </div>

      <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <p className="text-[11px] text-[#64748B]">
          <span className="font-mono">REASON</span> is <span className="font-mono">varchar(max)</span>{" "}
          in CMTS against <span className="font-mono">DUPLICATEREASON</span>&apos;s{" "}
          <span className="font-mono">varchar(500)</span>, and the legacy schema never names the
          event it describes. It is read here as the loss narrative that{" "}
          <span className="font-mono">FIRDATE</span> dates, on the strength of the two sitting
          together in the table — the restored database is schema-only, so no stored value exists
          to settle it. Pending SAPS confirmation.
        </p>
      </div>
    </div>
  );
}
