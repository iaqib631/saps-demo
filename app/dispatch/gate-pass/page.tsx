"use client";

/**
 * P6-1 / P6-2 · Gate Pass + picking with RFID piece-count verification.
 *
 * `GATEPASS` is 43 columns in CMTS and the demo rendered almost none of
 * them — vehicle, driver, transporter, escort and the seal fields had no
 * home at all.
 *
 * Seven of those columns are document numbers and seven more are the dates
 * those documents were issued. They are rendered as seven pairs in a card
 * of their own rather than as fourteen cells in the record grid, because
 * that is what a gate pass is: not a document in its own right but a
 * receipt for a set of other documents, each one proven to have been
 * current by the date printed beside its number.
 *
 * The FC-08 amendment is what makes the pick list interesting: the tag
 * bound at putaway (FC-03) is **read again at retrieval**, so the piece
 * count verifies itself rather than being typed. That turns "Piece Count
 * Matched?" from a question an operator answers into one the scan answers —
 * and when it comes back short, FC-08 routes it to a CDR rather than
 * letting the shortfall leave the building.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, PackageCheck, Radio, Truck, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AuditStrip, DocNumber } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  awbByNo,
  formatDate,
  formatDateTime,
  listGatePasses,
  pickSessionFor,
  storageLocation,
} from "@/lib/domain";

const OUTCOME_TONE: Record<string, { bg: string; fg: string }> = {
  retrieved: { bg: "#DCFCE7", fg: "#16A34A" },
  pending: { bg: "#F1F5F9", fg: "#64748B" },
  unavailable: { bg: "#FEE2E2", fg: "#DC2626" },
  short: { bg: "#FEE2E2", fg: "#DC2626" },
  damaged: { bg: "#FEF3C7", fg: "#D97706" },
};

/**
 * One CMTS column. The tiny mono caption above the value is this screen's
 * parity marker: it names the legacy column the value was read out of, so a
 * migration reviewer can check the form against the schema without opening
 * the code. Extracted from the record grid so the paired document block
 * below renders a value in exactly the same visual language — a pair has to
 * look like two of the screen's own fields wearing one label, not like a
 * different widget bolted on.
 */
function Cell({ cmts, value, mono }: { cmts: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
        {cmts}
      </span>
      <span
        className={`text-[13px] font-medium break-words ${mono ? "font-mono" : ""}`}
        style={{ color: value ? "#0F172A" : "#CBD5E1" }}
      >
        {value ?? "null"}
      </span>
    </div>
  );
}

/**
 * Null and empty string both mean "the clerk wrote nothing here". CMTS is
 * inconsistent about which one a blank column carries — it depends on what
 * the originating table defaulted to — so every presence test on this
 * screen has to accept both, or a pass with `DONo: ""` would render as
 * though it had a delivery order behind it.
 */
const filled = (v: string | null) => v !== null && v.trim() !== "";

/**
 * One document the gate pass was issued against, number and date together.
 *
 * These are not fourteen fields, they are seven. "26 Jul 2026" identifies
 * nothing on its own, and "GR-2026-04420" with no date does not say the
 * voucher was still current when the vehicle was let out — a gate pass is
 * only as good as the paperwork it names, so the pair is the unit of proof
 * and is rendered as one labelled box. Both CMTS columns stay visible in
 * every state, including the empty ones, because parity is checked against
 * the columns a screen shows and a field that disappears when it is null
 * cannot be checked at all.
 *
 * The two halves are null together or set together. Where both are empty
 * that is usually legitimate (no house waybill on a straight master, no
 * bank draft when the charges went through the cash window) and `absent`
 * says which case this is, so the reader does not go hunting for missing
 * data that was never supposed to exist. Where exactly one half is set the
 * record is a migration fault rather than a partial one: neither half can
 * be trusted, because a date without its number cannot be traced back to a
 * filing and a number without its date cannot be shown to have been valid.
 * That is called out in amber instead of being drawn as an ordinary blank,
 * which is precisely the class of defect this screen exists to surface.
 */
function DocPair({
  label,
  numberCmts,
  dateCmts,
  number,
  date,
  absent,
}: {
  label: string;
  numberCmts: string;
  dateCmts: string;
  number: string | null;
  date: string | null;
  /** Why an empty pair is legitimate here — shown only when both are blank. */
  absent: string;
}) {
  const hasNumber = filled(number);
  const hasDate = filled(date);

  const note =
    hasNumber && hasDate
      ? null
      : hasNumber || hasDate
        ? {
            colour: "#D97706",
            text: `Unpaired in the source — ${hasNumber ? dateCmts : numberCmts} is blank against a ${
              hasNumber ? numberCmts : dateCmts
            } that is set. Treat the document as unproven.`,
          }
        : { colour: "#94A3B8", text: absent };

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-x-4 mt-2">
        <Cell cmts={numberCmts} value={hasNumber ? number : null} mono />
        <Cell cmts={dateCmts} value={date && hasDate ? formatDate(date) : null} />
      </div>
      {note && (
        <p className="text-[11px] mt-2 leading-snug" style={{ color: note.colour }}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/**
 * CASHNO and BDNo are the two ways the charges can have been settled before
 * the gate lets the vehicle go, and CMTS treats them as alternatives — one
 * pair filled, the other left blank. Saying which route this pass took is
 * what stops the empty pair reading as missing data: a reader who sees four
 * blank settlement columns and no explanation assumes the migration dropped
 * them. Both filled at once is the one case worth flagging, since it means
 * the consignment was receipted twice or a route was carried over in error.
 *
 * `grNo` is read only to tell the two empty cases apart. A pass with no
 * receipt but a rent voucher is ordinary — the money is accounted for on
 * the voucher — whereas a pass with neither has nothing on it anywhere that
 * says the charges were cleared, and that is worth an amber line.
 */
function settlementNote(cashNo: string | null, bdNo: string | null, grNo: string | null) {
  const cash = filled(cashNo);
  const draft = filled(bdNo);

  if (cash && draft) {
    return {
      colour: "#D97706",
      text: "Both settlement pairs are filled. CMTS treats cash and bank draft as alternatives, so one of the two was receipted twice or carried over in error — reconcile before the pass is honoured.",
    };
  }
  if (cash) {
    return {
      colour: "#64748B",
      text: "Settled at the cash window, so CASHNO / CASHNODate carry the receipt and the bank-draft pair is blank by design — the two routes are alternatives, never both.",
    };
  }
  if (draft) {
    return {
      colour: "#64748B",
      text: "Settled by bank draft, so BDNo / BDDate carry the instrument and the cash pair is blank by design — the two routes are alternatives, never both.",
    };
  }
  if (filled(grNo)) {
    return {
      colour: "#64748B",
      text: "Neither settlement pair is filled, so the pass carries no receipt of its own — the godown rent voucher beside it is the only money reference on the document.",
    };
  }
  return {
    colour: "#D97706",
    text: "No settlement reference at all: no cash receipt, no bank draft and no rent voucher. Nothing on this pass shows the charges were cleared before the vehicle was loaded.",
  };
}

export default function GatePassPage() {
  const { scope, isHq } = useSite();
  const passes = useMemo(() => listGatePasses(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(passes[0]?.GATEPASSNO ?? null);
  const gp = passes.find((p) => p.GATEPASSNO === selected) ?? passes[0] ?? null;
  const session = gp ? pickSessionFor(gp.GATEPASSNO) : null;
  const awb = gp ? awbByNo(gp.AWBNO) : null;
  const settlement = settlementNote(gp?.CASHNO ?? null, gp?.BDNo ?? null, gp?.GRNo ?? null);

  const [tab, setTab] = useState<"pass" | "pick">("pass");

  const shortSessions = passes.filter((p) => {
    const s = pickSessionFor(p.GATEPASSNO);
    return s && !s.countMatched;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Dispatch" }, { label: "Gate Pass & Picking" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M13
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              GATEPASS 43 cols · FC-08 §04–09
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Gate Pass &amp; Picking
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The vehicle and driver record, and a pick list the RFID scan verifies for you.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Gate passes", value: String(passes.length), tone: "#0F172A" },
          { label: "Short picks", value: String(shortSessions.length), tone: "#DC2626" },
          {
            label: "Pieces scanned",
            value: String(
              passes.reduce((n, p) => n + (pickSessionFor(p.GATEPASSNO)?.scannedPieces ?? 0), 0),
            ),
            tone: "#16A34A",
          },
          {
            label: "Sessions open",
            value: String(
              passes.filter((p) => !pickSessionFor(p.GATEPASSNO)?.completedAt).length,
            ),
            tone: "#D97706",
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

      {passes.length === 0 ? (
        <EmptyState
          title="No gate passes at this site"
          description="A gate pass issues once the DO is verified against CNIC and authority letter — FC-08 §02–04."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Truck size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Gate passes</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {passes.map((p) => {
                const s = pickSessionFor(p.GATEPASSNO);
                return (
                  <button
                    key={p.GATEPASSNO}
                    onClick={() => setSelected(p.GATEPASSNO)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: gp?.GATEPASSNO === p.GATEPASSNO ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        GP-{p.GATEPASSNO}
                      </span>
                      {s && (
                        <span
                          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                          style={
                            s.countMatched
                              ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          }
                        >
                          {s.scannedPieces}/{s.expectedPieces}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{p.AWBNO}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {p.VehicleNo} · {formatDate(p.GATEPASSDATE)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {gp && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DocNumber doc={gp.docNumber} />
                      {awb && <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} />}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      Issued {formatDate(gp.GATEPASSDATE)} · {gp.PIECES} pcs · {gp.CONSIGNEE}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["pass", "Gate pass record (43 cols)"],
                    ["pick", `Pick session${session ? ` (${session.scannedPieces}/${session.expectedPieces})` : ""}`],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: tab === v ? "#0B2545" : "#FFFFFF",
                      color: tab === v ? "#FFFFFF" : "#475569",
                      borderColor: tab === v ? "#0B2545" : "#E2E8F0",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "pass" && (
                <>
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Gate pass record
                      </h3>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        CMTS GATEPASS — the pass itself, the consignment on it and the people
                        it was handed to. The documents it was issued against are below.
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                      {(
                        [
                          ["GATEPASSNO", String(gp.GATEPASSNO)],
                          ["GATEPASSDATE", formatDate(gp.GATEPASSDATE)],
                          ["SerialNo", String(gp.SerialNo)],
                          ["SerialNoWithYear", gp.SerialNoWithYear],
                          ["ARRIVALDATE", formatDate(gp.ARRIVALDATE)],
                          ["INDEXNO", gp.INDEXNO === null ? null : String(gp.INDEXNO)],
                          ["PIECES", String(gp.PIECES)],
                          ["WEIGHT", String(gp.WEIGHT)],
                          ["MarksNumber", gp.MarksNumber],
                          ["CONSIGNEE", gp.CONSIGNEE],
                          ["Agent", gp.Agent],
                          ["RecivingPerson", gp.RecivingPerson],
                          ["NICNO", gp.NICNO],
                          ["CPNO", gp.CPNO],
                          ["RcvngPersonPic", gp.RcvngPersonPic],
                          ["VehicleNo", gp.VehicleNo],
                          ["ClearingTime", gp.ClearingTime],
                          ["DeliveryDate", gp.DeliveryDate ? formatDate(gp.DeliveryDate) : null],
                          ["NAMEOFCUSTODIANSHED", gp.NAMEOFCUSTODIANSHED],
                          ["DetendIdentification", gp.DetendIdentification],
                        ] as const
                      ).map(([k, v]) => (
                        <Cell key={k} cmts={k} value={v} />
                      ))}

                      {/*
                       * SerialNo sits beside SerialNoWithYear above rather than at the end
                       * of the grid because the two are only meaningful together, and a
                       * reader who meets the bare number first will assume it is the key.
                       * It is not — hence this line.
                       */}
                      <div className="col-span-2 md:col-span-3 border-t border-[#F1F5F9] pt-3.5">
                        <p className="text-[11px] text-[#64748B] leading-snug">
                          <span className="font-mono text-[#94A3B8]">SerialNo</span> is the gate
                          register sequence the clerk reads aloud and writes in the book. It
                          restarts, which is why{" "}
                          <span className="font-mono text-[#94A3B8]">SerialNoWithYear</span>{" "}
                          qualifies it —{" "}
                          <span className="font-mono text-[#94A3B8]">GATEPASSNO</span> stays the
                          identity nothing else can stand in for.
                        </p>
                      </div>
                    </div>
                    <AuditStrip record={gp} />
                  </div>

                  {/*
                   * The document block. A gate pass is not a document in its own right so
                   * much as a receipt for a set of other documents, which is why these get
                   * a card of their own rather than another twenty cells in the grid above:
                   * on the printed pass they are the block the officer at the barrier reads,
                   * and a reviewer checking a pass checks this block and nothing else.
                   */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-2">
                      <FileText size={15} className="text-[#64748B] flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">
                          Documents the pass was issued against
                        </h3>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          Each number carries the date its document was issued — together they
                          prove the paperwork was current when the vehicle was let out.
                        </p>
                      </div>
                    </div>

                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(
                        [
                          {
                            label: "Import general manifest",
                            numberCmts: "IGMNO",
                            dateCmts: "IGMNODate",
                            number: gp.IGMNO,
                            date: gp.IGMNODate,
                            absent:
                              "No IGM on the pass. Every import is manifested before it lands, so an issued pass without one is a gap to chase, not a blank.",
                          },
                          {
                            label: "Master air waybill",
                            numberCmts: "AWBNO",
                            dateCmts: "AWBNODate",
                            number: gp.AWBNO,
                            date: gp.AWBNODate,
                            absent:
                              "No master waybill. It is the consignment's identity — nothing can legitimately leave the shed without it.",
                          },
                          {
                            label: "House air waybill",
                            numberCmts: "HWBNO",
                            dateCmts: "HWBNODate",
                            number: gp.HWBNO,
                            date: gp.HWBNODate,
                            absent:
                              "Not a consolidation. The pass covers the master waybill directly, so CMTS leaves the house pair empty.",
                          },
                          {
                            label: "Delivery order",
                            numberCmts: "DONo",
                            dateCmts: "DoDate",
                            number: gp.DONo,
                            date: gp.DoDate,
                            absent:
                              "No delivery order. FC-08 §02 holds the cargo at the barrier until one is produced and verified against CNIC.",
                          },
                          {
                            /*
                             * Labelled for what the value actually is. `GRNo` carries the
                             * GODOWNRENT voucher number — the same string /billing/godown-rent
                             * shows as VOUCHERNO — so calling it a goods receipt here would
                             * send an operator looking for a document that does not exist.
                             */
                            label: "Godown rent voucher",
                            numberCmts: "GRNo",
                            dateCmts: "GRDate",
                            number: gp.GRNo,
                            date: gp.GRDate,
                            absent:
                              "No godown rent voucher — storage has not been billed against this consignment.",
                          },
                        ] as const
                      ).map((p) => (
                        <DocPair key={p.numberCmts} {...p} />
                      ))}

                      {/*
                       * ChallanNo breaks the pattern and is drawn broken on purpose: CMTS
                       * has no ChallanNoDate column, so a dashed box says "this one really
                       * is half a pair" rather than leaving a reader to wonder which screen
                       * dropped the date.
                       */}
                      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                          Challan
                        </span>
                        <div className="grid grid-cols-2 gap-x-4 mt-2">
                          <Cell cmts="ChallanNo" value={gp.ChallanNo} mono />
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-2 leading-snug">
                          Unpaired at source — CMTS carries no ChallanNoDate, so the number is
                          the only half there has ever been.
                        </p>
                      </div>

                      {/*
                       * Cash and draft are laid out last and adjacent because they are one
                       * decision seen twice, and the note under them explains the blank half.
                       */}
                      {(
                        [
                          {
                            label: "Cash receipt",
                            numberCmts: "CASHNO",
                            dateCmts: "CASHNODate",
                            number: gp.CASHNO,
                            date: gp.CASHNODate,
                            absent: "Charges were not receipted at the cash window.",
                          },
                          {
                            label: "Bank draft",
                            numberCmts: "BDNo",
                            dateCmts: "BDDate",
                            number: gp.BDNo,
                            date: gp.BDDate,
                            absent: "No bank draft lodged against this pass.",
                          },
                        ] as const
                      ).map((p) => (
                        <DocPair key={p.numberCmts} {...p} />
                      ))}
                    </div>

                    <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                      <p className="text-[11px] leading-snug" style={{ color: settlement.colour }}>
                        {settlement.text}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {tab === "pick" && session && (
                <>
                  <div
                    className="rounded-[16px] border px-5 py-4 flex items-start gap-3"
                    style={
                      session.countMatched
                        ? { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }
                        : { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }
                    }
                  >
                    {session.countMatched ? (
                      <PackageCheck size={17} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={17} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: session.countMatched ? "#16A34A" : "#DC2626" }}
                      >
                        {session.countMatched
                          ? `Piece count matched — ${session.scannedPieces} of ${session.expectedPieces} read`
                          : `Short pick — ${session.scannedPieces} of ${session.expectedPieces} read`}
                      </p>
                      <p
                        className="text-[12px] mt-0.5"
                        style={{ color: session.countMatched ? "#15803D" : "#991B1B" }}
                      >
                        {session.countMatched
                          ? "The count is verified by the tags bound at putaway, not typed by the operator."
                          : "FC-08 routes a short pick to a CDR rather than letting the shortfall leave the building."}
                      </p>
                      {session.cdrRef && (
                        <Link
                          href="/exceptions/cdr"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#DC2626] no-underline hover:underline mt-2"
                        >
                          {session.cdrRef} <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                      <Radio size={15} className="text-[#64748B]" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#0F172A]">Pick list</h3>
                        <p className="text-[11px] text-[#94A3B8]">
                          Expected tag vs tag actually read at retrieval
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            {["Piece", "Location", "Expected tag", "Scanned tag", "Outcome", "Scanned"].map((h) => (
                              <th
                                key={h}
                                className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {session.lines.map((l) => {
                            const tone = OUTCOME_TONE[l.outcome];
                            const mismatch = l.expectedRfid !== l.scannedRfid;
                            return (
                              <tr
                                key={l.id}
                                className="border-b border-[#F1F5F9] last:border-0"
                                style={{ backgroundColor: mismatch ? "#FEF2F2" : undefined }}
                              >
                                <td className="px-4 py-2.5 font-mono text-[11px] text-[#0F172A]">
                                  {l.pieceId}
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                                  {storageLocation(l.locationId)?.ABBREVATION ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[10px] text-[#64748B]">
                                  {l.expectedRfid ?? "—"}
                                </td>
                                <td
                                  className="px-4 py-2.5 font-mono text-[10px]"
                                  style={{ color: l.scannedRfid ? "#64748B" : "#DC2626" }}
                                >
                                  {l.scannedRfid ?? "not read"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center uppercase"
                                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                                  >
                                    {l.outcome}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-[#94A3B8] whitespace-nowrap">
                                  {l.scannedAt ? formatDateTime(l.scannedAt) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {session.lines.some((l) => l.note) && (
                      <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                        {session.lines
                          .filter((l) => l.note)
                          .map((l) => (
                            <p key={l.id} className="text-[11px] text-[#991B1B]">
                              <span className="font-mono">{l.pieceId}</span> — {l.note}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/dispatch/gate-out"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Gate-out verification &amp; POD <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/billing/delivery-order"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Delivery order <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
