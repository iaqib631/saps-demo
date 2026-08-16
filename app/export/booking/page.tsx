"use client";

/**
 * FC-11 §01 · Booking from the airline / GSA — allotment vs what turned up.
 *
 * The gap this closes: FC-11's start node is "01. Booking Information from
 * Airline" and the demo had no screen for it. CMTS has none either — the
 * legacy system picks the export story up at acceptance, so the allotment
 * the airline actually sold is invisible to the terminal until cargo is
 * already on the floor.
 *
 * That omission is why the flow's most expensive edge could not be
 * answered: §23 "Payload compatibility with Flight" decides on the payload
 * available at the ULD position, and to know whether a consignment is
 * running over you need the number the airline sold in the first place.
 * This screen is where that number lives, and it shows it next to what was
 * actually accepted so the drift is visible before build-up rather than at
 * the aircraft.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Plane, TrendingUp, Users } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  EXPORT_STAGE_LABEL,
  formatDate,
  formatDateTime,
  formatKg,
  formatPkr,
  listExports,
  round2,
} from "@/lib/domain";

const CHANNEL_LABEL = {
  "airline-direct": "Airline direct",
  gsa: "GSA",
  forwarder: "Forwarder",
} as const;

const CHANNEL_TONE = {
  "airline-direct": { bg: "#EBF0F7", fg: "#0B2545" },
  gsa: { bg: "#F5F3FF", fg: "#7C3AED" },
  forwarder: { bg: "#FEF3C7", fg: "#D97706" },
} as const;

export default function ExportBookingPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExports(scope).filter((c) => c.booking), [scope]);

  const [selected, setSelected] = useState<number | null>(null);
  const c = rows.find((x) => x.id === selected) ?? rows[0] ?? null;

  /** Allotment vs accepted — the drift the terminal needs before build-up. */
  const drift = useMemo(() => {
    if (!c?.booking) return null;
    const acceptedKg = c.acceptance.WEIGHTAWB || c.lines.reduce((s, l) => s + l.WEIGHT, 0);
    const acceptedPcs = c.acceptance.PCSAWB;
    const kgOver = round2(acceptedKg - c.booking.allottedWeightKg);
    const pcsOver = acceptedPcs - c.booking.allottedPieces;
    return { acceptedKg, acceptedPcs, kgOver, pcsOver, over: kgOver > 0 || pcsOver > 0 };
  }, [c]);

  const overBooked = rows.filter((x) => {
    if (!x.booking) return false;
    const kg = x.acceptance.WEIGHTAWB || x.lines.reduce((s, l) => s + l.WEIGHT, 0);
    return kg > x.booking.allottedWeightKg;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Booking & Allotment" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M16
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §01
</span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              GREENFIELD
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Booking &amp; Allotment
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            What the airline sold, held against what actually arrived at the counter.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#DDD6FE] bg-[#F5F3FF] px-5 py-4 flex items-start gap-3">
        <TrendingUp size={17} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-[#7C3AED]">Why the allotment is kept</p>
          <p className="text-[12px] text-[#4C1D95] mt-1 leading-relaxed">
            FC-11 ends at <strong>&ldquo;Payload compatibility with Flight&rdquo;</strong>, whose No
            edge sends cargo back to warehousing — annotated &ldquo;can be offloaded depending upon
            weight provision&rdquo;. That decision is made against payload available at the ULD
            position, and a consignment already running over its allotment here is the one most
            likely to come off there. CMTS holds no booking record, so this is greenfield.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Bookings", value: String(rows.length), tone: "#0F172A" },
          { label: "Over allotment", value: String(overBooked.length), tone: overBooked.length ? "#D97706" : "#16A34A" },
          {
            label: "Via GSA",
            value: String(rows.filter((x) => x.booking?.channel === "gsa").length),
            tone: "#7C3AED",
          },
          {
            label: "Allotted weight",
            value: formatKg(round2(rows.reduce((s, x) => s + (x.booking?.allottedWeightKg ?? 0), 0))),
            tone: "#0F172A",
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

      {rows.length === 0 ? (
        <EmptyState
          title="No export bookings at this site"
          description="FC-11 starts at §01 — booking information received from the airline or its GSA."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <CalendarClock size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Bookings</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {rows.map((x) => {
                const b = x.booking!;
                const tone = CHANNEL_TONE[b.channel];
                return (
                  <button
                    key={x.id}
                    onClick={() => setSelected(x.id)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.id === x.id ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {b.bookingRef}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center flex-shrink-0"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                      >
                        {CHANNEL_LABEL[b.channel]}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.awbNo} · {b.bookedFlightNo} · {x.acceptance.DESTINATION}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{b.commodity}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {c?.booking && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      {c.booking.bookingRef}
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {EXPORT_STAGE_LABEL[c.stage]}
                    </p>
                  </div>
                  <Link
                    href="/export/acceptance"
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[12px] font-semibold text-[#1B4F8B] no-underline transition-colors"
                  >
                    Acceptance (E02)
                    <ArrowUpRight size={12} />
                  </Link>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                  {(
                    [
                      ["AWB", c.awbNo],
                      ["Channel", CHANNEL_LABEL[c.booking.channel]],
                      ["GSA", c.booking.gsaName ?? "—"],
                      ["Booked", formatDateTime(c.booking.bookedAt)],
                      ["Flight", c.booking.bookedFlightNo],
                      ["Departure", formatDate(c.booking.bookedDeparture)],
                      ["Shipper", c.booking.shipperName],
                      ["Commodity", c.booking.commodity],
                      ["Agreed rate", `${formatPkr(c.booking.agreedRatePerKg)} / kg`],
                      ["Destination", c.acceptance.DESTINATION],
                      ["Carrier", c.acceptance.AIRLINEABB],
                      ["Site", c.site],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        {k}
                      </span>
                      <span className="text-[13px] font-medium text-[#0F172A] break-words">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allotment vs accepted */}
              {drift && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Plane size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Allotment vs accepted
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        Drift here is what shows up as an offload risk at E12.
                      </p>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: drift.over ? "#FDE68A" : "#BBF7D0",
                        backgroundColor: drift.over ? "#FFFBEB" : "#F0FDF4",
                      }}
                    >
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: drift.over ? "#D97706" : "#16A34A" }}
                      >
                        {drift.over
                          ? `Running over the allotment by ${formatKg(Math.max(0, drift.kgOver))}${
                              drift.pcsOver > 0 ? ` and ${drift.pcsOver} pieces` : ""
                            }`
                          : "Within the allotment the airline sold"}
                      </p>
                      <p className="text-[12px] text-[#64748B] mt-1">
                        {drift.over
                          ? "Flag to load control before build-up — this is the profile that gets offloaded for payload."
                          : "No payload exposure from the booking side."}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">
                            <th className="text-left px-3 py-2">Measure</th>
                            <th className="text-right px-3 py-2">Allotted (E01)</th>
                            <th className="text-right px-3 py-2">Accepted (E02)</th>
                            <th className="text-right px-3 py-2">Drift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              k: "Pieces",
                              a: String(c.booking.allottedPieces),
                              b: String(drift.acceptedPcs),
                              d: drift.pcsOver,
                              fmt: (n: number) => `${n > 0 ? "+" : ""}${n}`,
                            },
                            {
                              k: "Weight",
                              a: formatKg(c.booking.allottedWeightKg),
                              b: formatKg(drift.acceptedKg),
                              d: drift.kgOver,
                              fmt: (n: number) => `${n > 0 ? "+" : ""}${formatKg(n)}`,
                            },
                          ].map((r) => (
                            <tr key={r.k} className="border-b border-[#F1F5F9]">
                              <td className="px-3 py-2.5 font-medium text-[#0F172A]">{r.k}</td>
                              <td className="px-3 py-2.5 text-right text-[#64748B]">{r.a}</td>
                              <td className="px-3 py-2.5 text-right text-[#0F172A]">{r.b}</td>
                              <td
                                className="px-3 py-2.5 text-right font-semibold"
                                style={{ color: r.d > 0 ? "#D97706" : "#16A34A" }}
                              >
                                {r.fmt(r.d)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {c.uplift && (
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex items-start gap-3">
                        <Users size={15} className="text-[#64748B] flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[#0F172A]">
                            What happened at the aircraft
                          </p>
                          <p className="text-[12px] text-[#64748B] mt-0.5">
                            {c.uplift.outcome === "onboarded"
                              ? `Onboarded — ${formatKg(c.uplift.availablePayloadKg)} payload available against ${formatKg(c.uplift.offeredWeightKg)} offered.`
                              : `Offloaded — ${formatKg(c.uplift.availablePayloadKg)} payload available against ${formatKg(c.uplift.offeredWeightKg)} offered. ${c.uplift.offloadReason ?? ""}`}
                          </p>
                          <Link
                            href="/export/uplift"
                            className="text-[12px] font-semibold text-[#1B4F8B] hover:underline no-underline inline-flex items-center gap-1 mt-1"
                          >
                            Uplift &amp; closure (E12–E13)
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    )}
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
