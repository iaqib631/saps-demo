"use client";

/**
 * P4-3 · Risk-channel workflows + OOC capture and verification.
 *
 * FC-06 splits after the channel is assigned, and the three paths are not
 * variations on a theme — they are different work:
 *   Green  → auto-cleared, straight to assessment
 *   Yellow → document scrutiny with a **query loop** back to the CHA
 *   Red    → physical examination and sampling
 *
 * BLK-03: FC-06 labels the red edge "Normal" (Green / Yellow / Normal).
 * We render Red and keep the flow's own word visible rather than quietly
 * resolving the discrepancy — it needs SAPS confirmation.
 *
 * The OOC amendment is the other half: OOC arrives by one of **three**
 * routes — fetched from PSW, imaged at the counter scanner, or keyed from
 * the print with both unavailable — and is then **verified field-by-field
 * against the SD**. The capture is not the control; the reconciliation is.
 * A mismatch blocks release. The badge below names the route it actually
 * took (BC-1): it used to name two routes for three, which put "scanner
 * capture" over records nobody had scanned.
 *
 * The keying path itself lives at /customs/ooc-capture — this screen reads
 * and reconciles, it does not produce.
 *
 * Drawn as an OCR step; converted once SAPS confirmed OCR runs only at
 * the two scan points (inbound MAWB/HAWB, receiver docs at collection).
 * The verification below is deliberately independent of how the value
 * arrived, which is why the conversion left it untouched.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  MessageSquareWarning,
  FileCheck2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AuditStrip, FormField } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  RISK_CHANNEL_FLOW_LABEL,
  RISK_CHANNEL_LABEL,
  RISK_CHANNEL_TREATMENT,
  SD_STATUS_LABEL,
  clearanceGateFor,
  formatDate,
  formatDateTime,
  formatPkr,
  listClearances,
  oocMismatches,
  oocVerified,
  type OutOfCharge,
  type RiskChannel,
} from "@/lib/domain";

const CHANNEL_TONE: Record<RiskChannel, { bg: string; fg: string; border: string }> = {
  green: { bg: "#DCFCE7", fg: "#16A34A", border: "#BBF7D0" },
  yellow: { bg: "#FEF3C7", fg: "#D97706", border: "#FDE68A" },
  red: { bg: "#FEE2E2", fg: "#DC2626", border: "#FCA5A5" },
};

const ALL_CHANNELS: RiskChannel[] = ["green", "yellow", "red"];

/**
 * BC-1 — three capture routes, three badges.
 *
 * `OutOfCharge.source` has been a three-member union since the OOC
 * amendment, but this badge was a two-way ternary: anything that was not a
 * PSW fetch printed "SCANNER CAPTURE", so a record keyed off the counter
 * copy with the gateway down claimed on screen to have been imaged at the
 * scanner. customs.ts is blunt about why that matters — "a badge that says
 * 'scanner capture' over a keyed record is a lie about provenance" — and it
 * is the kind of lie an auditor catches, because the record's `scannedAt` is
 * null underneath it.
 *
 * Keyed as a Record over the union rather than a chain of ternaries so a
 * fourth capture route cannot be added without the compiler asking for its
 * badge here.
 */
const OOC_SOURCE_BADGE: Record<
  OutOfCharge["source"],
  { label: string; bg: string; fg: string }
> = {
  "psw-fetch": { label: "FETCHED FROM PSW", bg: "#DBEAFE", fg: "#1B4F8B" },
  scanner: { label: "SCANNER CAPTURE", bg: "#F5F3FF", fg: "#7C3AED" },
  keyed: { label: "KEYED FROM PRINT", bg: "#FEF3C7", fg: "#D97706" },
};

export default function CustomsChannelsPage() {
  const { scope, isHq } = useSite();
  const all = useMemo(() => listClearances(scope), [scope]);

  const [channel, setChannel] = useState<RiskChannel | "all">("all");
  const rows = channel === "all" ? all : all.filter((c) => c.channel === channel);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const c = rows.find((x) => x.id === selectedId) ?? rows[0] ?? null;

  const gate = c ? clearanceGateFor(c.awbId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Customs" }, { label: "Channels & OOC" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M09
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-06 · risk channel → OOC
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center font-mono">
              BLK-03
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Channel Workflows &amp; OOC
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Three different treatments, then out-of-charge verified against the declaration.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* BLK-03 — the naming discrepancy, kept on screen */}
      <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 flex items-start gap-3">
        <MessageSquareWarning size={17} className="text-[#D97706] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-[#D97706]">
            BLK-03 — FC-06 calls the red edge &ldquo;Normal&rdquo;
          </p>
          <p className="text-[12px] text-[#92400E] mt-1">
            The flowchart labels the three channels Green / Yellow /{" "}
            <strong>Normal</strong>, where Normal leads to physical examination. We render it as{" "}
            <strong>Red</strong> because that is the Pakistan Customs term operators use, and treat
            &ldquo;Normal&rdquo; as its synonym. Awaiting SAPS confirmation — until then both words
            appear on the channel cards below.
          </p>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALL_CHANNELS.map((ch) => {
          const tone = CHANNEL_TONE[ch];
          const n = all.filter((x) => x.channel === ch).length;
          const active = channel === ch;
          return (
            <button
              key={ch}
              onClick={() => {
                setChannel(active ? "all" : ch);
                setSelectedId(null);
              }}
              className="rounded-[16px] border p-5 text-left transition-all cursor-pointer hover:border-[#94A3B8]"
              style={{
                borderColor: active ? tone.fg : tone.border,
                backgroundColor: active ? tone.bg : "#FFFFFF",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold" style={{ color: tone.fg }}>
                  {RISK_CHANNEL_LABEL[ch]}
                </span>
                <span className="text-[22px] font-bold text-[#0F172A]">{n}</span>
              </div>
              {RISK_CHANNEL_FLOW_LABEL[ch] !== RISK_CHANNEL_LABEL[ch] && (
                <p className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                  FC-06 calls this &ldquo;{RISK_CHANNEL_FLOW_LABEL[ch]}&rdquo;
                </p>
              )}
              <p className="text-[12px] text-[#64748B] mt-2 leading-snug">
                {RISK_CHANNEL_TREATMENT[ch]}
              </p>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No declarations on this channel"
          description="Channels are assigned by customs and fetched electronically — they are not set here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                {channel === "all" ? "All channels" : `${RISK_CHANNEL_LABEL[channel]} channel`}
              </h3>
              {channel !== "all" && (
                <button
                  onClick={() => setChannel("all")}
                  className="text-[11px] font-semibold text-[#1B4F8B] cursor-pointer hover:underline"
                >
                  clear
                </button>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {rows.map((x) => {
                const tone = x.channel ? CHANNEL_TONE[x.channel] : null;
                const openQ = x.queries.filter((q) => !q.closedAt).length;
                return (
                  <button
                    key={x.id}
                    onClick={() => setSelectedId(x.id)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.id === x.id ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {x.AWBNO}
                      </span>
                      {tone && x.channel && (
                        <span
                          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                          style={{ backgroundColor: tone.bg, color: tone.fg }}
                        >
                          {RISK_CHANNEL_LABEL[x.channel].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
                      {SD_STATUS_LABEL[x.status]}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {openQ > 0 && (
                        <span className="h-[16px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold inline-flex items-center">
                          {openQ} OPEN QUERY
                        </span>
                      )}
                      {x.examination?.discrepancyFound && (
                        <span className="h-[16px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                          EXAM DISCREPANCY
                        </span>
                      )}
                      {x.ooc && !oocVerified(x.ooc) && (
                        <span className="h-[16px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                          OOC MISMATCH
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {c && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AwbLink awbNo={c.AWBNO} awbId={c.awbId} />
                      {c.channel && (
                        <span
                          className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                          style={{
                            backgroundColor: CHANNEL_TONE[c.channel].bg,
                            color: CHANNEL_TONE[c.channel].fg,
                          }}
                        >
                          {RISK_CHANNEL_LABEL[c.channel]}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-[#64748B] mt-1.5">{c.sdRef}</p>
                  </div>
                  <Link
                    href="/customs/filing"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                  >
                    Declaration <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Channel-specific treatment */}
              {c.channel === "yellow" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#FFFBEB] flex items-center gap-2">
                    <MessageSquareWarning size={15} className="text-[#D97706]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Document scrutiny — query loop
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        Yellow returns to the CHA until every query is closed
                      </p>
                    </div>
                  </div>
                  {c.queries.length === 0 ? (
                    <p className="p-5 text-[12px] text-[#94A3B8]">
                      Scrutiny raised no queries.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F1F5F9]">
                      {c.queries.map((q) => (
                        <div key={q.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <p className="text-[13px] font-semibold text-[#0F172A]">{q.subject}</p>
                            <span
                              className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                              style={
                                q.closedAt
                                  ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                                  : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                              }
                            >
                              {q.closedAt ? "CLOSED" : "OPEN"}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#475569] mt-1">{q.detail}</p>
                          <p className="text-[11px] text-[#94A3B8] mt-1">
                            Raised {formatDateTime(q.raisedAt)} by {q.raisedBy}
                          </p>
                          {q.responseText ? (
                            <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                              <p className="text-[12px] text-[#0F172A]">{q.responseText}</p>
                              <p className="text-[11px] text-[#94A3B8] mt-1">
                                {q.responseBy} · {q.respondedAt ? formatDateTime(q.respondedAt) : ""}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[12px] text-[#D97706] mt-2">
                              Awaiting CHA response — the declaration cannot progress to assessment
                              while this is open.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {c.channel === "red" && c.examination && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#FEF2F2] flex items-center gap-2">
                    <FlaskConical size={15} className="text-[#DC2626]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Physical examination &amp; sampling
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        Red channel — packages opened and a sample drawn
                      </p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                    {(
                      [
                        [
                          "Scheduled",
                          c.examination.scheduledAt ? formatDateTime(c.examination.scheduledAt) : null,
                        ],
                        [
                          "Examined",
                          c.examination.examinedAt ? formatDateTime(c.examination.examinedAt) : null,
                        ],
                        ["Officer", c.examination.examiningOfficer],
                        [
                          "Packages opened",
                          `${c.examination.packagesOpened} of ${c.examination.packagesTotal}`,
                        ],
                        ["Sample ref", c.examination.sampleRef],
                        ["Lab report", c.examination.labReportRef],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          {k}
                        </span>
                        <span
                          className="text-[13px] font-medium break-words"
                          style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                        >
                          {v ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="px-5 py-3 border-t"
                    style={{
                      backgroundColor: c.examination.discrepancyFound ? "#FEF2F2" : "#F0FDF4",
                      borderColor: c.examination.discrepancyFound ? "#FECACA" : "#BBF7D0",
                    }}
                  >
                    <p
                      className="text-[12px] font-semibold"
                      style={{ color: c.examination.discrepancyFound ? "#DC2626" : "#16A34A" }}
                    >
                      {c.examination.discrepancyFound
                        ? "Discrepancy found on examination"
                        : "No discrepancy — contents conform to declaration"}
                    </p>
                    <p
                      className="text-[12px] mt-0.5"
                      style={{ color: c.examination.discrepancyFound ? "#991B1B" : "#15803D" }}
                    >
                      {c.examination.findings}
                    </p>
                    {c.examination.discrepancyFound && (
                      <Link
                        href="/customs/detained"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#DC2626] no-underline hover:underline mt-2"
                      >
                        Detend register <ArrowUpRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {c.channel === "green" && (
                <div className="rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#16A34A]">
                      Green channel — auto-cleared
                    </p>
                    <p className="text-[12px] text-[#15803D] mt-0.5">
                      No scrutiny and no examination. The declaration goes straight to assessment,
                      which is exactly why green-channel filings are the ones a post-clearance audit
                      samples.
                    </p>
                  </div>
                </div>
              )}

              {/* Duty & agencies */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">Duty &amp; taxes</h3>
                    <p className="text-[11px] text-[#94A3B8]">The four heads FC-06 names</p>
                  </div>
                  {c.duty ? (
                    <div className="p-5">
                      <div className="flex flex-col gap-2">
                        {(
                          [
                            ["Assessed value", c.duty.assessedValue],
                            ["Customs duty", c.duty.customsDuty],
                            ["Sales tax", c.duty.salesTax],
                            ["FED", c.duty.fed],
                            ["WHT", c.duty.wht],
                          ] as const
                        ).map(([l, v]) => (
                          <div key={l} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-[#64748B]">{l}</span>
                            <span className="text-[13px] font-medium text-[#0F172A]">
                              {formatPkr(v)}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-[#E2E8F0]">
                          <span className="text-[13px] font-semibold text-[#0F172A]">Total</span>
                          <span className="text-[16px] font-bold text-[#1B4F8B]">
                            {formatPkr(c.duty.total)}
                          </span>
                        </div>
                      </div>
                      <div
                        className="mt-4 rounded-xl px-4 py-3 border"
                        style={
                          c.duty.paidAt
                            ? { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
                            : { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }
                        }
                      >
                        <p
                          className="text-[12px] font-semibold"
                          style={{ color: c.duty.paidAt ? "#16A34A" : "#D97706" }}
                        >
                          {c.duty.paidAt ? "Paid" : "Assessed, unpaid"}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                          {c.duty.paymentRef ?? "no PSID"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="p-5 text-[12px] text-[#94A3B8]">
                      Not assessed — the channel treatment is not complete.
                    </p>
                  )}
                </div>

                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">ANF / ASF clearance</h3>
                    <p className="text-[11px] text-[#94A3B8]">Required before OOC can issue</p>
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {c.agencies.map((a) => (
                      <div
                        key={a.agency}
                        className="rounded-xl border border-[#E2E8F0] px-4 py-3"
                        style={{ backgroundColor: a.required ? "#FFFFFF" : "#F8FAFC" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[#0F172A]">
                            {a.agency}
                          </span>
                          <span
                            className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                            style={
                              !a.required
                                ? { backgroundColor: "#F1F5F9", color: "#64748B" }
                                : a.clearedAt
                                  ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                                  : { backgroundColor: "#FEF3C7", color: "#D97706" }
                            }
                          >
                            {!a.required ? "N/A" : a.clearedAt ? "CLEARED" : "PENDING"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1">
                          {!a.required
                            ? "Not required for this cargo class"
                            : a.clearedAt
                              ? `${a.clearanceRef} · ${a.officer} · ${formatDate(a.clearedAt)}`
                              : "Awaiting clearance"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* OOC — the amendment's centrepiece */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Out-of-charge — captured and verified vs SD
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        FC-06 amendment — the reconciliation is the control, not the capture
                      </p>
                    </div>
                  </div>
                  {c.ooc && (
                    <span
                      className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                      style={{
                        backgroundColor: OOC_SOURCE_BADGE[c.ooc.source].bg,
                        color: OOC_SOURCE_BADGE[c.ooc.source].fg,
                      }}
                    >
                      {OOC_SOURCE_BADGE[c.ooc.source].label}
                    </span>
                  )}
                </div>

                {!c.ooc ? (
                  <p className="p-5 text-[12px] text-[#94A3B8]">
                    No OOC yet — it issues once duty is paid and agency clearance is complete.
                  </p>
                ) : (
                  <>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 border-b border-[#F1F5F9]">
                      {(
                        [
                          ["OOC no.", c.ooc.oocNo],
                          ["Issued", formatDate(c.ooc.issuedAt)],
                          ["Issuing officer", c.ooc.issuingOfficer],
                          [
                            "Captured",
                            // Same BC-1 blind spot as the badge above: the
                            // scanner timestamp had no branch, so a scanned
                            // OOC read "—" for when it was captured. Each
                            // route stamps its own field, so read the one the
                            // source names rather than guessing by fallback.
                            c.ooc.source === "psw-fetch"
                              ? c.ooc.fetchedAt
                                ? `PSW fetch ${formatDateTime(c.ooc.fetchedAt)}`
                                : "—"
                              : c.ooc.source === "scanner"
                                ? c.ooc.scannedAt
                                  ? `Scanned ${formatDateTime(c.ooc.scannedAt)}`
                                  : "—"
                                : c.ooc.keyedAt
                                  ? `Keyed ${formatDateTime(c.ooc.keyedAt)}`
                                  : "—",
                          ],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            {k}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] break-words">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-5">
                      <h4 className="text-[13px] font-semibold text-[#0F172A] mb-3">
                        Field-by-field verification against the SD
                      </h4>
                      <div className="flex flex-col gap-3">
                        {c.ooc.checks.map((chk) => (
                          <div
                            key={chk.field}
                            className="rounded-xl border px-4 py-3"
                            style={{
                              borderColor: chk.matches ? "#E2E8F0" : "#FCA5A5",
                              backgroundColor: chk.matches ? "#FFFFFF" : "#FEF2F2",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <FormField label={chk.label} value={chk.captured} />
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                    SD says
                                  </p>
                                  <p className="text-[13px] font-medium text-[#0F172A]">
                                    {chk.expected}
                                  </p>
                                </div>
                                {chk.matches ? (
                                  <CheckCircle2 size={18} className="text-[#16A34A]" />
                                ) : (
                                  <XCircle size={18} className="text-[#DC2626]" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        className="mt-4 rounded-xl px-4 py-3 border"
                        style={
                          oocVerified(c.ooc)
                            ? { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
                            : { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }
                        }
                      >
                        <p
                          className="text-[13px] font-semibold"
                          style={{ color: oocVerified(c.ooc) ? "#16A34A" : "#DC2626" }}
                        >
                          {oocVerified(c.ooc)
                            ? `Verified by ${c.ooc.verifiedBy} on ${formatDateTime(c.ooc.verifiedAt!)}`
                            : `${oocMismatches(c.ooc).length} field does not match the SD — not verified`}
                        </p>
                        <p
                          className="text-[12px] mt-0.5"
                          style={{ color: oocVerified(c.ooc) ? "#15803D" : "#991B1B" }}
                        >
                          {oocVerified(c.ooc)
                            ? "The OOC and the declaration agree on every checked field."
                            : `Mismatch on ${oocMismatches(c.ooc)
                                .map((m) => m.label.toLowerCase())
                                .join(", ")}. Release stays blocked until the OOC is reconciled or reissued — a document nobody reconciled is not a control, however it was captured.`}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Release gate */}
              {gate && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-[#64748B]" />
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Eligible for release — FC-06 exit gate
                      </h3>
                    </div>
                    <span
                      className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                      style={
                        gate.eligible
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {gate.eligible ? "ELIGIBLE" : "BLOCKED"}
                    </span>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {gate.conditions.map((cond) => (
                      <div
                        key={cond.key}
                        className="px-5 py-3 flex items-start justify-between gap-3 flex-wrap"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {cond.pass ? (
                            <CheckCircle2 size={15} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle size={15} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#0F172A]">{cond.label}</p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">{cond.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B]">
                      This gate feeds FC-07&apos;s godown-rent verification, whose first condition is
                      &ldquo;OOC available&rdquo;. Two gates, one source of truth.
                    </p>
                  </div>
                </div>
              )}

              <AuditStrip record={c} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
