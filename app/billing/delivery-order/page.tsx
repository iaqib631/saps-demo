"use client";

/**
 * P5-7 · Delivery Order issuance + the five-condition release gate.
 *
 * Two gaps closed here.
 *
 * **Issuance.** The demo has `/cha/do-collection` and `/consignee/pay-do` —
 * both collection-side. Nothing issues a DO, so `AWBDELEIVERYORDER` (39
 * cols) was never rendered: the authorised-agent block (name, CNIC, phone,
 * email, letter no, photo), NTN/STN, CHALLANNO and the free-DO cause all
 * had zero coverage.
 *
 * **The gate.** FC-07 draws godown-rent verification as a five-way fan-out,
 * but the business intent is plainly an AND — all five must pass. Drawing
 * it as a fan-out is what lets a reader think any one of them releases the
 * cargo. It is built here as an explicit AND with per-condition pass/fail,
 * which is also what makes the "DO release auto-gated" amendment visible.
 *
 * BLK-10: `special-clearance` is **conditional** on the cargo class rather
 * than universal — it renders N/A instead of blocking, because the FC-07
 * amendment lists only four conditions and the fifth appears on the chart.
 *
 * **Parity pass.** The last eight `AWBDELEIVERYORDER` columns land here, in
 * the three places they belong rather than as a strip at the foot of the page:
 * `IGMNO` / `HWBNO` / `SHIFT` into a consignment-reference card, `TAX` into
 * the money block it modifies, and `ISLOCK` / `DUPLICATEREASON` / `REASON` /
 * `FIRDATE` into a record-state card, because those four describe the state of
 * the *order* and not of the cargo it releases.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, FileText, IdCard, ShieldCheck, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import DoExceptionCard from "@/components/billing/delivery-order/DoExceptionCard";
import DoField from "@/components/billing/delivery-order/DoField";
import { AuditStrip, DocNumber } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  TAX_TYPES,
  awbByNo,
  cargoClass,
  formatDate,
  formatPkr,
  listDeliveryOrders,
  releaseGateFor,
  round2,
} from "@/lib/domain";

/**
 * The DO charge is taxed through the one `TaxType` row flagged `IsDo`, and the
 * godown-rent voucher next door bills through the rows that are not. Resolving
 * the row rather than printing the stored percentage on its own is the whole
 * point: both families currently read the same rate, so an unlabelled "15%"
 * here is read as the rent tax carried forward rather than a second charge.
 */
const DO_TAX_TYPE = TAX_TYPES.find((t) => t.IsDo) ?? null;
const NON_DO_TAX_LABEL = TAX_TYPES.filter((t) => !t.IsDo)
  .map((t) => `${t.Description} ${t.Amount}%`)
  .join(", ");

export default function DeliveryOrderPage() {
  const { scope, isHq } = useSite();
  const dos = useMemo(() => listDeliveryOrders(scope), [scope]);

  const [selected, setSelected] = useState<string | null>(dos[0]?.DONO ?? null);
  const d = dos.find((x) => x.DONO === selected) ?? dos[0] ?? null;
  const awb = d ? awbByNo(d.AWBNO) : null;
  const gate = awb ? releaseGateFor(awb.AWBId) : null;

  /**
   * `AMOUNT` is the airline's flat `AIRLINE.DOAMOUNT` and is net of tax, so the
   * gross is derived here rather than stored. It is derived and not seeded on
   * purpose: a stored gross would go stale the moment the `TaxType` rate moves
   * and would then disagree with the rate printed beside it.
   */
  const doTaxAmount = d ? round2((d.AMOUNT * d.Tax) / 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Delivery Order" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M12
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              AWBDELEIVERYORDER · 39 cols
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center font-mono">
              BLK-10
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Delivery Order &amp; Release Gate
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Issuance, the authorised-agent record, and the five conditions that gate release.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {dos.length === 0 ? (
        <EmptyState
          title="No delivery orders at this site"
          description="A DO issues once charges are settled and all five release conditions pass — FC-07 §13."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <BadgeCheck size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Delivery orders</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {dos.map((x) => {
                const a = awbByNo(x.AWBNO);
                const g = a ? releaseGateFor(a.AWBId) : null;
                return (
                  <button
                    key={x.DONO}
                    onClick={() => setSelected(x.DONO)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: d?.DONO === x.DONO ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {x.DONO}
                      </span>
                      {g && (
                        <span
                          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                          style={
                            g.canRelease
                              ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          }
                        >
                          {g.canRelease ? "RELEASABLE" : `${g.blockedBy.length} BLOCK`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.AWBNO} · {formatPkr(x.AMOUNT)}
                    </p>
                    {/* 22a vs 22b. A requested DO has no issue date yet, so show
                        the request rather than a blank where a date should be. */}
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {x.DODATE
                        ? `Issued ${formatDate(x.DODATE)}`
                        : `Requested ${formatDate(x.requestedAt)} — awaiting issue`}
                      {" · "}
                      {x.RECIEVEDBY}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {d && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DocNumber doc={d.docNumber} />
                      <span className="h-[22px] px-2.5 rounded-full bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center">
                        {d.DOTYPE}
                      </span>
                      {d.FREE && (
                        <span className="h-[22px] px-2.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold inline-flex items-center">
                          FREE DO
                        </span>
                      )}
                      {d.IsDuplicate && (
                        <span className="h-[22px] px-2.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center">
                          DUPLICATE
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      {awb && <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} />}
                      {" · "}
                      {cargoClass(d.DOCARGOCLASSID).ABBREVATION}
                      {" · "}
                      {d.DODATE
                        ? `issued ${formatDate(d.DODATE)}`
                        : `requested ${formatDate(d.requestedAt)}, awaiting issue`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      DO amount
                    </p>
                    <p className="text-[20px] font-bold text-[#0B2545] font-mono">
                      {formatPkr(d.AMOUNT)}
                    </p>
                  </div>
                </div>
                {/* DO tax. Given its own strip under the amount rather than a
                    figure tucked beside it, because the one conclusion a reader
                    must not reach is that this is the tax they already saw on
                    the godown-rent voucher. It is a separate master row, and
                    naming the row on screen is what makes that visible while
                    the two percentages happen to coincide. */}
                <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-end justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-[#CBD5E1]" title="CMTS column: TAX">
                        TAX
                      </span>
                      <span className="h-[16px] px-1.5 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[9px] font-bold inline-flex items-center font-mono">
                        TaxType.IsDo = 1
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">
                      {d.Tax}% · {DO_TAX_TYPE?.Description ?? "DO tax"}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-1 max-w-[52ch]">
                      Not the godown-rent tax. Rent bills through the{" "}
                      <span className="font-mono">IsDo = 0</span> rows ({NON_DO_TAX_LABEL}); the DO
                      charge bills through the single row flagged for delivery orders. The rates
                      read alike today, which is exactly why the row is named — moving one does not
                      move the other.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      {d.FREE ? "Would be payable" : "Payable with DO tax"}
                    </p>
                    <p
                      className="text-[16px] font-bold font-mono"
                      style={{ color: d.FREE ? "#94A3B8" : "#0B2545" }}
                    >
                      {formatPkr(round2(d.AMOUNT + doTaxAmount))}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {formatPkr(d.AMOUNT)} + {formatPkr(doTaxAmount)} tax
                    </p>
                  </div>
                </div>
                {d.FREE && d.FREECAUSE && (
                  <p className="text-[12px] text-[#15803D] mt-3 pt-3 border-t border-[#F1F5F9]">
                    Free cause: {d.FREECAUSE} — neither the charge nor the tax is collected; the
                    figures above stand as the rate on file.
                  </p>
                )}
              </div>

              {/* Consignment reference — the numbers AWBDELEIVERYORDER is keyed
                  on. IGMNO and HWBNO say nothing apart from the AWBNO that sits
                  between them, so the master waybill is repeated here even
                  though the header already links it: read as a triple they
                  answer "which manifest, which master, which house" in one
                  line, and splitting them across two cards is what makes an
                  operator go hunting in the header for the middle term. */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <FileText size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Consignment reference &amp; shift
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Which manifest, which master, which house — and the shift that issued the
                      order
                    </p>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                  <DoField cmts="IGMNO" value={d.IGMNO} />
                  <DoField
                    cmts="AWBNO"
                    value={
                      awb ? <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} /> : d.AWBNO
                    }
                  />
                  <DoField cmts="HWBNO" value={d.HWBNO} />
                  <DoField cmts="SHIFT" value={d.SHIFT} />
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <p className="text-[11px] text-[#64748B]">
                    <span className="font-mono">HWBNO</span> is null on a straight master waybill
                    and fills only where the master was consolidated — a DO raised against a house
                    releases that house alone, which is why the column sits on the order rather
                    than being read off the AWB.{" "}
                    <span className="font-mono">SHIFT</span> is the operating shift the counter
                    issued on, carried so a disputed collection can be put to the crew that was on
                    duty. It is not a second issue date.
                  </p>
                </div>
              </div>

              {/* The five-condition gate */}
              {gate && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Release gate — FC-07 godown-rent verification
                        </h3>
                        <p className="text-[11px] text-[#94A3B8]">
                          Drawn as a 5-way fan-out; implemented as an AND
                        </p>
                      </div>
                    </div>
                    <span
                      className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                      style={
                        gate.canRelease
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {gate.canRelease ? "RELEASE PERMITTED" : "RELEASE BLOCKED"}
                    </span>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {gate.conditions.map((c) => (
                      <div key={c.code} className="px-5 py-3.5 flex items-start gap-3">
                        <span
                          className="h-[18px] w-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor: !c.applicable
                              ? "#F1F5F9"
                              : c.pass
                                ? "#DCFCE7"
                                : "#FEE2E2",
                          }}
                        >
                          {!c.applicable ? (
                            <span className="text-[9px] font-bold text-[#94A3B8]">–</span>
                          ) : c.pass ? (
                            <BadgeCheck size={12} className="text-[#16A34A]" />
                          ) : (
                            <XCircle size={12} className="text-[#DC2626]" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-[13px] font-medium"
                              style={{ color: c.applicable ? "#0F172A" : "#94A3B8" }}
                            >
                              {c.label}
                            </p>
                            {!c.applicable && (
                              <span className="h-[16px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-bold inline-flex items-center">
                                N/A
                              </span>
                            )}
                          </div>
                          <p
                            className="text-[11px] mt-0.5"
                            style={{
                              color: !c.applicable
                                ? "#94A3B8"
                                : c.pass
                                  ? "#64748B"
                                  : "#991B1B",
                            }}
                          >
                            {c.detail}
                          </p>
                        </div>
                        {c.href && !c.pass && c.applicable && (
                          <Link
                            href={c.href}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline flex-shrink-0"
                          >
                            Resolve <ArrowUpRight size={11} />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B]">
                      <strong>BLK-10.</strong> The FC-07 amendment names four conditions; the
                      chart draws five. <span className="font-mono">special-clearance</span> is
                      treated as conditional on the cargo class — it shows N/A rather than blocking,
                      so a general-cargo AWB is not held for a clearance that does not apply to it.
                      Pending SAPS confirmation.
                    </p>
                  </div>
                </div>
              )}

              {/* Authorised agent — the block CMTS carries and the demo never showed */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <IdCard size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Collection &amp; authorised agent
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      FC-08 §02–03 verifies CNIC and authority letter against this record
                    </p>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                  {(
                    [
                      ["RECIEVEDBY", d.RECIEVEDBY],
                      ["NIC", d.NIC],
                      ["PASSPORT", d.PASSPORT],
                      ["AuthAgentName", d.AuthAgentName],
                      ["AuthAgentCNIC", d.AuthAgentCNIC],
                      ["AuthAgentPhone", d.AuthAgentPhone],
                      ["AuthAgentEmail", d.AuthAgentEmail],
                      ["AuthLetterNo", d.AuthLetterNo],
                      ["AuthAgentPic", d.AuthAgentPic],
                      ["CHALLANNO", d.CHALLANNO],
                      ["NTN", d.NTN],
                      ["STN", d.STN],
                    ] as const
                  ).map(([k, v]) => (
                    <DoField key={k} cmts={k} value={v} />
                  ))}
                </div>
                {d.DetendIdentification && (
                  <div className="px-5 py-3 bg-[#FEF2F2] border-t border-[#FECACA]">
                    <p className="text-[11px] text-[#991B1B]">
                      This DO is keyed to a detained sub-identity (
                      <span className="font-mono">{d.DetendIdentification}</span>) — it releases the
                      detained portion only, not the parent AWB.
                    </p>
                  </div>
                )}
              </div>

              {/* Record state and the exception columns — placed after the
                  routine blocks because that is the order the counter reads
                  in: identity, gate, who is collecting, and only then whether
                  anything is wrong with the order itself. */}
              <DoExceptionCard order={d} />

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/billing/godown-rent"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Godown rent voucher <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/customs/channels"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  FC-06 clearance gate <ArrowUpRight size={12} />
                </Link>
              </div>

              <AuditStrip record={d} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
