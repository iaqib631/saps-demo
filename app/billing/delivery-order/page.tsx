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
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, IdCard, ShieldCheck, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AuditStrip, DocNumber } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  awbByNo,
  cargoClass,
  formatDate,
  formatPkr,
  listDeliveryOrders,
  releaseGateFor,
} from "@/lib/domain";

export default function DeliveryOrderPage() {
  const { scope, isHq } = useSite();
  const dos = useMemo(() => listDeliveryOrders(scope), [scope]);

  const [selected, setSelected] = useState<string | null>(dos[0]?.DONO ?? null);
  const d = dos.find((x) => x.DONO === selected) ?? dos[0] ?? null;
  const awb = d ? awbByNo(d.AWBNO) : null;
  const gate = awb ? releaseGateFor(awb.AWBId) : null;

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
                {d.FREE && d.FREECAUSE && (
                  <p className="text-[12px] text-[#15803D] mt-3 pt-3 border-t border-[#F1F5F9]">
                    Free cause: {d.FREECAUSE}
                  </p>
                )}
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
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                      <span
                        className="text-[13px] font-medium break-words"
                        style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                      >
                        {v ?? "null"}
                      </span>
                    </div>
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
