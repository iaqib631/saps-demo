"use client";

/**
 * P6-5 · AWB closure, finance reconciliation & archive — FC-08 §14–16.
 *
 * The last gate in the system, and the one CMTS cannot defend. CMTS has
 * `Lock`, which flips a record read-only, but nothing that records *why*
 * it was safe to flip. This checklist is that reason, and it is evaluated
 * rather than asserted: an AWB with an open CDR or a live hold cannot close
 * no matter that the cargo physically left the building.
 *
 * `Lock` propagates — to house AWBs, splits, detends, the DO and the gate
 * pass. Closing a parent while a detained sub-identity is still open would
 * strand that portion with no way to bill or release it, which is exactly
 * the failure the FC-06 Detend model exists to prevent.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArrowUpRight, CheckCircle2, Lock, LockOpen, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  awbById,
  cargoClass,
  formatDateTime,
  listClosures,
} from "@/lib/domain";

export default function ClosurePage() {
  const { scope, isHq } = useSite();
  const closures = useMemo(() => listClosures(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(closures[0]?.awbId ?? null);
  const c = closures.find((x) => x.awbId === selected) ?? closures[0] ?? null;
  const awb = c ? awbById(c.awbId) : null;

  const closed = closures.filter((x) => x.closedAt);
  const blocked = closures.filter((x) => !x.canClose);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Dispatch" }, { label: "AWB Closure" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M14 · M20
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-08 §14–16
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            AWB Closure &amp; Archive
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The last gate. CMTS records that a file was locked; this records why locking it was
            safe.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Candidates", value: String(closures.length), tone: "#0F172A" },
          { label: "Closed", value: String(closed.length), tone: "#16A34A" },
          { label: "Blocked", value: String(blocked.length), tone: "#DC2626" },
          {
            label: "Locked records",
            value: String(closures.filter((x) => x.locked).length),
            tone: "#1B4F8B",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[22px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {closures.length === 0 ? (
        <EmptyState
          title="Nothing ready to close at this site"
          description="An AWB becomes a closure candidate once it is delivered — FC-08 §14."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Archive size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Closure candidates</h3>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {closures.map((x) => {
                const a = awbById(x.awbId);
                return (
                  <button
                    key={x.awbId}
                    onClick={() => setSelected(x.awbId)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.awbId === x.awbId ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {a?.AWBNO}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                        style={
                          x.closedAt
                            ? { backgroundColor: "#F1F5F9", color: "#64748B" }
                            : x.canClose
                              ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {x.closedAt ? "CLOSED" : x.canClose ? "READY" : "BLOCKED"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {x.items.filter((i) => i.pass).length}/{x.items.length} checks pass
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {c && awb && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} />
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                        style={
                          c.locked
                            ? { backgroundColor: "#EBF0F7", color: "#1B4F8B" }
                            : { backgroundColor: "#F1F5F9", color: "#64748B" }
                        }
                      >
                        {c.locked ? <Lock size={10} /> : <LockOpen size={10} />}
                        {c.locked ? "LOCKED" : "UNLOCKED"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      {cargoClass(awb.CARGOCLASSID).NAME} · IGM {awb.IGMNO}
                      {c.closedAt ? ` · closed ${formatDateTime(c.closedAt)} by ${c.closedBy}` : ""}
                    </p>
                  </div>
                  {c.archiveBundleId && (
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        Archive bundle
                      </p>
                      <p className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {c.archiveBundleId}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">Closure checklist</h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      Evaluated, not asserted — each item links to where it is resolved
                    </p>
                  </div>
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={
                      c.canClose
                        ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                        : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                    }
                  >
                    {c.canClose ? "CAN CLOSE" : "CANNOT CLOSE"}
                  </span>
                </div>
                <div className="divide-y divide-[#F1F5F9]">
                  {c.items.map((i) => (
                    <div key={i.code} className="px-5 py-3.5 flex items-start gap-3">
                      {i.pass ? (
                        <CheckCircle2 size={15} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={15} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A]">{i.label}</p>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: i.pass ? "#64748B" : "#991B1B" }}
                        >
                          {i.detail}
                        </p>
                      </div>
                      {i.href && !i.pass && (
                        <Link
                          href={i.href}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline flex-shrink-0"
                        >
                          Resolve <ArrowUpRight size={11} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lock propagation */}
              <div className="rounded-[16px] border border-[#C7D7EC] bg-[#EBF0F7] px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={14} className="text-[#1B4F8B]" />
                  <p className="text-[13px] font-semibold text-[#1B4F8B]">
                    Lock propagation — what closing this AWB freezes
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "House AWBs (AWBCONSOLE)",
                    "Splits (AWBSPLIT)",
                    "Detends (AwbDetendDetail)",
                    "Delivery order",
                    "Gate pass",
                    "Godown rent voucher",
                  ].map((t) => (
                    <span
                      key={t}
                      className="h-[24px] px-2.5 rounded-full bg-white text-[#1B4F8B] text-[11px] font-semibold inline-flex items-center border border-[#C7D7EC]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#475569] mt-3">
                  Closing a parent while a detained sub-identity is still open would strand that
                  portion with no way to bill or release it — which is why the Detend register and
                  this gate have to agree before <span className="font-mono">Lock</span> is set.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/dispatch/gate-out"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Gate-out &amp; POD <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/customs/detained"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Detend register <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
