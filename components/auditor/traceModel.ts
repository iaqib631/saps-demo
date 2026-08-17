/**
 * The two traces, derived from the registers rather than typed out.
 *
 * WHAT WAS HERE BEFORE. /auditor/cargo-trace opened on AWB 117-23456123 — a
 * number that appears in no fixture — with a 23-step timeline of invented
 * states, users and evidence filenames, a header that read "23 events" as a
 * literal beside a 23-row array, eight invented pieces on invented EPCs, and
 * four exception branches all asserting "Not triggered" without consulting
 * anything. /auditor/financial-trace did the same for INV-2026-0042 with a
 * ten-step timeline, a fourteen-field invoice panel and two approval rows.
 *
 * Both screens were the right SHAPE. A trace is exactly what an auditor needs
 * — one entity, every dated record about it, each naming where it came from —
 * and this repo can feed one properly: `getAwb()` already assembles twenty-six
 * linked collections for a real AWB, and every one of them carries timestamps,
 * and most carry an actor column. So the timelines below are the same
 * timelines, built by walking that bundle.
 *
 * THE RULE ON ACTORS. `actor` is `string | null`, never a plausible name. Where
 * a record genuinely has no actor column — `Invoice` has none, and a
 * notification is auto-dispatched — the field prints the absence and names the
 * record, rather than borrowing a username from a neighbouring row. Six of the
 * old cargo timeline's twenty-three steps were attributed to "system"; the
 * difference is that these are attributed to system BECAUSE the fixture says
 * so, and it is checkable from the source string beside each one.
 *
 * SEARCH IS REAL. All five lookups on each screen resolve against fixtures:
 * AWB and IGM numbers through `listAwbs({ q })`, an RFID EPC through
 * `listPieces()`, a gate pass through `listGatePasses()`, a delivery order
 * through `listDeliveryOrders()`, and on the finance side an invoice number,
 * a GR voucher, a credit note and a payment gateway reference. A search that
 * cannot match now says the reference is not on file at any node, which is a
 * fact, instead of re-rendering the same fabricated shipment whatever is typed.
 *
 * ESTATE-WIDE. Every query passes "HQ": FC-12 §16 and §17 are cross-site reads,
 * and a trace that stopped at the node the site switcher happens to be on would
 * lose exactly the cargo that moved between nodes.
 */

import {
  DEMO_NOW,
  LONGSTAY_STAGE_LABEL,
  MISHANDLED_STAGE_LABEL,
  REEXPORT_STAGE_LABEL,
  awbByNo,
  cargoClass,
  chargesFor,
  clearanceFor,
  closureFor,
  daysBetween,
  formatKg,
  formatPkr,
  getAwb,
  listAwbs,
  listDeliveryOrders,
  listGatePasses,
  listGodownRents,
  listInvoices,
  listPieces,
  listWaivers,
  paymentsFor,
  retenderGateFor,
  storageLocation,
  type AWB,
  type AwbBundle,
  type ChargeCalculation,
  type GodownRent,
  type Invoice,
  type PaymentRecord,
  type WaiverRequest,
} from "@/lib/domain";
import type { Severity } from "@/components/hq/HqUi";

/* ================================================================== *
 * Shared event shape
 * ================================================================== */

export interface TraceEvent {
  key: string;
  at: string;
  label: string;
  /** Null where the record has no actor column. Never inferred. */
  actor: string | null;
  /** The field the actor came from, or the reason there is none. */
  actorField: string;
  lane: string;
  detail: string | null;
  /** The fixture path this event was read from, verbatim. */
  source: string;
  /** A real DOCUMENTS row where the event produced one. */
  documentId: string | null;
  href: string | null;
  severity: Severity;
}

function byTime(a: TraceEvent, b: TraceEvent): number {
  const delta = Date.parse(a.at) - Date.parse(b.at);
  return delta !== 0 ? delta : a.key.localeCompare(b.key);
}

/* ================================================================== *
 * Cargo trace — FC-12 §16
 * ================================================================== */

export type CargoLookupKind = "awb" | "igm" | "rfid" | "gatepass" | "do";

export const CARGO_LOOKUPS: Array<{ kind: CargoLookupKind; label: string; source: string }> = [
  { kind: "awb", label: "AWB #", source: "listAwbs({ scope: 'HQ', q }) · AWBNO" },
  { kind: "igm", label: "IGM #", source: "listAwbs({ scope: 'HQ', q }) · IGMNO" },
  { kind: "rfid", label: "RFID EPC", source: "listPieces('HQ') · Piece.rfidEpc" },
  { kind: "gatepass", label: "Gate pass #", source: "listGatePasses('HQ') · GATEPASSNO" },
  { kind: "do", label: "DO #", source: "listDeliveryOrders('HQ') · DONO" },
];

/** Resolves a typed reference to a real AWB id, or null when nothing matches. */
export function resolveCargoRef(kind: CargoLookupKind, raw: string): number | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;

  if (kind === "awb" || kind === "igm") {
    const hit = listAwbs({ scope: "HQ", q }).at(0);
    return hit?.AWBId ?? null;
  }
  if (kind === "rfid") {
    /* An unbound piece has no EPC yet — `rfidEpc` is nullable — so the search
       runs over the tagged ones and misses rather than throwing. */
    return (
      listPieces("HQ").find((p) => (p.rfidEpc ?? "").toLowerCase().includes(q))?.awbId ?? null
    );
  }
  if (kind === "gatepass") {
    const gp = listGatePasses("HQ").find(
      (g) =>
        String(g.GATEPASSNO).includes(q) || g.docNumber.value.toLowerCase().includes(q),
    );
    return gp ? (awbByNo(gp.AWBNO)?.AWBId ?? null) : null;
  }
  const doRow = listDeliveryOrders("HQ").find((x) => x.DONO.toLowerCase().includes(q));
  return doRow ? (awbByNo(doRow.AWBNO)?.AWBId ?? null) : null;
}

/** Every AWB an auditor can open, for the picker beside the search box. */
export function traceableAwbs(): Array<{ awbId: number; AWBNO: string; site: string; stage: string }> {
  return listAwbs({ scope: "HQ" }).map((a) => ({
    awbId: a.AWBId,
    AWBNO: a.AWBNO,
    site: a.site,
    stage: a.stage,
  }));
}

export interface ExceptionBranch {
  label: string;
  /** "raised" — a record exists; "clear" — the check ran and found nothing;
   *  "n/a" — the branch cannot apply to this consignment. */
  state: "raised" | "clear" | "n/a";
  detail: string;
  source: string;
  href: string | null;
}

export interface CargoTrace {
  bundle: AwbBundle;
  events: TraceEvent[];
  branches: ExceptionBranch[];
  /** The FC-08 closure checklist for this AWB, as it actually evaluates. */
  closure: ReturnType<typeof closureFor>;
}

export function cargoTrace(awbId: number): CargoTrace | null {
  const bundle = getAwb(awbId);
  if (!bundle) return null;

  const { awb } = bundle;
  const events: TraceEvent[] = [];
  const push = (e: TraceEvent) => events.push(e);

  /* --- Pre-arrival messaging, off the manifest ------------------------ */
  if (bundle.manifest) {
    const m = bundle.manifest;
    push({
      key: "manifest",
      at: m.MANIFESTDATE,
      label: `Manifest ${m.IGMNO} closed`,
      actor: m.USERID,
      actorField: "Manifest.USERID",
      lane: "Pre-arrival",
      detail: `${m.AIRLINENAME} ${m.FLIGHT}, ${m.ORIGIN} → ${m.DESTINATION} · status ${m.MANIFESTSTATUS}`,
      source: "getAwb().manifest.MANIFESTDATE / USERID",
      documentId: null,
      href: "/import/manifest",
      severity: "neutral",
    });
    for (const [type, receipt] of Object.entries(m.messages)) {
      /* `received: false` rows carry a receivedAt that never happened — NOTOC
         on the first manifest is exactly that — so the flag is what decides,
         not the presence of a timestamp. */
      if (!receipt.received || !receipt.receivedAt) continue;
      push({
        key: `pre-${type}`,
        at: receipt.receivedAt,
        label: `${type} received`,
        actor: null,
        actorField: "no actor column — inbound gateway receipt",
        lane: "Pre-arrival",
        detail: `Pre-arrival message on ${m.FLIGHT}`,
        source: "getAwb().manifest.messages[type].receivedAt",
        documentId: null,
        href: "/messaging/iata",
        severity: "neutral",
      });
    }
  }

  /* --- The AWB record itself ------------------------------------------ */
  push({
    key: "arrived",
    at: awb.arrivedAt,
    label: "Cargo arrived",
    actor: null,
    actorField: "no actor column on AWB.arrivedAt",
    lane: "Warehouse",
    detail: `${awb.TOTALPCS} pieces, ${formatKg(awb.TOTALWEIGHT)} declared · ${cargoClass(awb.CARGOCLASSID).NAME}`,
    source: "getAwb().awb.arrivedAt",
    documentId: null,
    href: null,
    severity: "neutral",
  });
  push({
    key: "indexed",
    at: awb.CreatedDate,
    label: "AWB indexed",
    actor: awb.CreatedBy,
    actorField: "AWB.CreatedBy",
    lane: "Warehouse",
    detail: `Cargo class ${cargoClass(awb.CARGOCLASSID).ABBREVATION} · ${awb.SHIPMENTTYPE} · ${awb.AIRLINENAME} ${awb.FLIGHT}`,
    source: "getAwb().awb.CreatedDate / CreatedBy",
    documentId: null,
    href: `/awb/${awb.AWBId}`,
    severity: "neutral",
  });

  /* `intakeVariance` is null on a consignment that has not been counted in
     yet — the screen has not run, which is a different fact from "it ran and
     found nothing", and FC-04's whole point is that the two are distinguished.
     Both are drawn; neither is guessed. */
  const v = awb.intakeVariance;
  const overTolerance = v
    ? v.pieces.overTolerance || v.weightKg.overTolerance || v.volumeM3.overTolerance
    : false;
  push({
    key: "intake",
    at: awb.intakeAt,
    label: v ? "Intake variance screened" : "Intake recorded — not yet counted in",
    actor: null,
    actorField: "no actor column on AWB.intakeAt",
    lane: "Warehouse",
    detail: v
      ? `Pieces ${v.pieces.declared} declared / ${v.pieces.physical} physical · weight ${formatKg(v.weightKg.declared)} / ${formatKg(v.weightKg.physical)} · ${
          overTolerance ? "over tolerance" : "inside tolerance on all three measures"
        }`
      : "AWB.intakeVariance is null — the piece and weight count has not been taken, so no CDR decision has been made either way.",
    source: "getAwb().awb.intakeAt / intakeVariance",
    documentId: null,
    href: "/exceptions/cdr",
    severity: !v ? "neutral" : overTolerance ? "warning" : "good",
  });

  /* --- Documents (M02) ------------------------------------------------- */
  for (const doc of bundle.documents) {
    push({
      key: `doc-${doc.id}`,
      at: doc.uploadedAt,
      label: `${doc.type} on file`,
      actor: doc.uploadedBy,
      actorField: "StoredDocument.uploadedBy",
      lane: "Documents",
      detail: `${doc.title} · ${doc.pages} ${doc.pages === 1 ? "page" : "pages"}, ${doc.sizeKb} KB${
        doc.ocrProcessed && doc.ocrMeanConfidence !== null
          ? ` · OCR mean confidence ${(doc.ocrMeanConfidence * 100).toFixed(0)}%`
          : ""
      }${doc.versions.length > 1 ? ` · v${doc.versions.length}, earlier versions superseded` : ""}`,
      source: "getAwb().documents[].uploadedAt / uploadedBy",
      documentId: doc.id,
      href: `/awb/${awb.AWBId}?tab=audit`,
      severity: "neutral",
    });
  }

  /* --- Storage ---------------------------------------------------------
     One event, not one per piece: the piece table under the timeline is the
     per-piece record, and 48 identical timeline nodes would bury the rest of
     the trace. */
  if (bundle.pieces.length > 0) {
    const moved = bundle.pieces.filter((p) => p.lastMovementAt);
    if (moved.length > 0) {
      const latest = moved.reduce((a, b) =>
        Date.parse(a.lastMovementAt) >= Date.parse(b.lastMovementAt) ? a : b,
      );
      const actors = [...new Set(moved.map((p) => p.lastMovementBy))];
      const states = [...new Set(bundle.pieces.map((p) => p.scanState))];
      push({
        key: "pieces",
        at: latest.lastMovementAt,
        label: "Piece movements recorded",
        actor: actors.length === 1 ? actors[0] : `${actors.length} operators`,
        actorField: "Piece.lastMovementBy",
        lane: "Warehouse",
        detail: `${bundle.pieces.length} pieces · scan states: ${states.join(", ")}${
          bundle.location
            ? ` · location ${storageLocation(bundle.location.PHYSICALLOCATIONID)?.NAME ?? bundle.location.PHYSICALLOCATIONID}`
            : ""
        }`,
        source: "getAwb().pieces[].lastMovementAt / lastMovementBy",
        documentId: null,
        href: `/awb/${awb.AWBId}?tab=pieces`,
        severity: bundle.location && bundle.location.LOGICALLOCATIONID !== bundle.location.PHYSICALLOCATIONID ? "warning" : "neutral",
      });
    }
  }

  /* --- Notice of arrival ----------------------------------------------- */
  if (bundle.arrivalAdvice) {
    const aa = bundle.arrivalAdvice;
    push({
      key: "noa",
      at: aa.ADVICEDATE,
      label: `Arrival advice ${aa.docNumber.value} raised`,
      actor: null,
      actorField: "no actor column on ArrivalAdvice",
      lane: "Documents",
      detail: `To ${aa.ConsigneeName} · dispatched to ${aa.dispatchedTo.length} ${aa.dispatchedTo.length === 1 ? "party" : "parties"}`,
      source: "getAwb().arrivalAdvice.ADVICEDATE",
      documentId: null,
      href: "/import/arrival-advice",
      severity: "neutral",
    });
  }

  /* --- Messaging (FC-12 §09) ------------------------------------------- */
  for (const m of bundle.messages) {
    push({
      key: `msg-${m.id}`,
      at: m.timestamp,
      label: `${m.type} ${m.direction}`,
      actor: m.manualSendBy,
      actorField: "IataMessage.manualSendBy — null where auto-triggered",
      lane: "Messaging",
      detail: `${m.status}${m.trigger ? ` · trigger ${m.trigger}` : ""}${m.failureReason ? ` · ${m.failureReason}` : ""}`,
      source: "getAwb().messages[].timestamp / manualSendBy",
      documentId: null,
      href: "/messaging/iata",
      severity: m.status === "failed" ? "critical" : "neutral",
    });
  }
  for (const n of bundle.notifications) {
    push({
      key: `ntf-${n.Id}`,
      at: n.queuedAt,
      label: `${n.notification} → ${n.recipientName}`,
      actor: null,
      actorField: "no actor column — auto-dispatched off a trigger",
      lane: "Messaging",
      detail: `${n.channel} to ${n.destination} · ${n.status}${n.readAt ? ", read" : ""}${n.failureReason ? ` · ${n.failureReason}` : ""}`,
      source: "getAwb().notifications[].queuedAt / trigger",
      documentId: null,
      href: "/messaging/notifications",
      severity: n.status === "failed" ? "warning" : "neutral",
    });
  }

  /* --- Customs (FC-12 §08) --------------------------------------------- */
  const clearance = clearanceFor(awb.AWBId) ?? null;
  if (clearance) {
    if (clearance.filedAt) {
      push({
        key: "sd",
        at: clearance.filedAt,
        label: `Single declaration ${clearance.sdRef ?? "— reference pending"} filed`,
        actor: clearance.cha,
        actorField: "CustomsClearance.cha",
        lane: "Customs",
        detail: clearance.submissions
          .map((s) => `${s.provider.toUpperCase()} ${s.state}`)
          .join(" · "),
        source: "clearanceFor(awbId).filedAt / cha",
        documentId: null,
        href: `/customs/channel-detail/${awb.AWBId}`,
        severity: "neutral",
      });
    }
    if (clearance.channelAssignedAt) {
      push({
        key: "channel",
        at: clearance.channelAssignedAt,
        label: `Risk channel ${clearance.channel}`,
        actor: null,
        actorField: `no actor column — fetched from ${clearance.channelFetchedFrom}`,
        lane: "Customs",
        detail: `Assigned by the customs gateway, not by the terminal`,
        source: "clearanceFor(awbId).channelAssignedAt / channelFetchedFrom",
        documentId: null,
        href: "/customs/channels",
        severity: clearance.channel === "red" ? "warning" : "neutral",
      });
    }
    const ex = clearance.examination;
    if (ex?.examinedAt) {
      push({
        key: "exam",
        at: ex.examinedAt,
        label: "Examination completed",
        actor: ex.examiningOfficer,
        actorField: "ExaminationRecord.examiningOfficer",
        lane: "Customs",
        detail: `${ex.packagesOpened} of ${ex.packagesTotal} packages opened${ex.sampleDrawn ? `, sample ${ex.sampleRef}` : ""} · ${ex.discrepancyFound ? "discrepancy found" : "no discrepancy"}`,
        source: "clearanceFor(awbId).examination.examinedAt / examiningOfficer",
        documentId: null,
        href: "/customs/queue",
        severity: ex.discrepancyFound ? "warning" : "good",
      });
    }
    const duty = clearance.duty;
    if (duty?.assessedAt) {
      push({
        key: "duty",
        at: duty.assessedAt,
        label: "Duty assessed",
        actor: duty.assessingOfficer,
        actorField: "DutyAssessment.assessingOfficer",
        lane: "Customs",
        detail: `${formatPkr(duty.total)} total on an assessed value of ${formatPkr(duty.assessedValue)}`,
        source: "clearanceFor(awbId).duty.assessedAt / assessingOfficer",
        documentId: null,
        href: "/customs/queue",
        severity: "neutral",
      });
    }
    if (duty?.paidAt) {
      push({
        key: "duty-paid",
        at: duty.paidAt,
        label: "Duty paid",
        actor: null,
        actorField: "no actor column — PSID reference only",
        lane: "Customs",
        detail: `${formatPkr(duty.total)} against ${duty.paymentRef ?? "no reference"}`,
        source: "clearanceFor(awbId).duty.paidAt / paymentRef",
        documentId: null,
        href: "/customs/queue",
        severity: "neutral",
      });
    }
    for (const ag of clearance.agencies) {
      if (!ag.clearedAt) continue;
      push({
        key: `agency-${ag.agency}`,
        at: ag.clearedAt,
        label: `${ag.agency} clearance`,
        actor: ag.officer,
        actorField: "AgencyClearance.officer",
        lane: "Customs",
        detail: ag.clearanceRef,
        source: "clearanceFor(awbId).agencies[].clearedAt / officer",
        documentId: null,
        href: "/customs/queue",
        severity: "good",
      });
    }
    const ooc = clearance.ooc;
    if (ooc) {
      push({
        key: "ooc",
        at: ooc.issuedAt,
        label: `Out-of-charge ${ooc.oocNo} issued`,
        actor: ooc.issuingOfficer,
        actorField: "OutOfCharge.issuingOfficer",
        lane: "Customs",
        detail: `Captured by ${ooc.source}`,
        source: "clearanceFor(awbId).ooc.issuedAt / issuingOfficer",
        documentId: ooc.documentId,
        href: "/customs/channels",
        severity: "good",
      });
      if (ooc.verifiedAt) {
        const mismatched = ooc.checks.filter((c) => !c.matches).length;
        push({
          key: "ooc-verified",
          at: ooc.verifiedAt,
          label: "OOC verified against the SD",
          actor: ooc.verifiedBy,
          actorField: "OutOfCharge.verifiedBy",
          lane: "Customs",
          detail: `${ooc.checks.length - mismatched} of ${ooc.checks.length} fields matched${mismatched ? ` · ${mismatched} MISMATCHED` : ""}`,
          source: "clearanceFor(awbId).ooc.verifiedAt / verifiedBy",
          documentId: ooc.documentId,
          href: "/customs/channels",
          severity: mismatched ? "critical" : "good",
        });
      }
    }
  }

  for (const dt of bundle.detends) {
    push({
      key: `detend-${dt.DetendId}`,
      at: dt.detainedAt,
      label: `Detained — ${dt.UniqueIdentification}`,
      actor: dt.detainedBy,
      actorField: "DetendDetail.detainedBy",
      lane: "Customs",
      detail: `${dt.TotalPieces} pieces, ${formatKg(dt.TotalWeight)} · ${dt.reason}`,
      source: "getAwb().detends[].detainedAt / detainedBy",
      documentId: null,
      href: "/customs/queue",
      severity: "warning",
    });
    if (dt.releasedAt) {
      push({
        key: `detend-rel-${dt.DetendId}`,
        at: dt.releasedAt,
        label: "Detention released",
        actor: null,
        actorField: "no release-actor column on DetendDetail",
        lane: "Customs",
        detail: dt.UniqueIdentification,
        source: "getAwb().detends[].releasedAt",
        documentId: null,
        href: "/customs/queue",
        severity: "good",
      });
    }
  }

  /* --- Holds and discrepancies ----------------------------------------- */
  for (const h of bundle.holds) {
    push({
      key: `hold-${h.SEQUENCE}`,
      at: h.Date,
      label: `Hold placed — ${h.type}`,
      actor: h.CreatedBy,
      actorField: "HoldRecord.CreatedBy",
      lane: "Exceptions",
      detail: `${h.HeldBy}${h.REMARKS ? ` · ${h.REMARKS}` : ""}`,
      source: "getAwb().holds[].Date / CreatedBy",
      documentId: null,
      href: "/exceptions/holds",
      severity: h.Release ? "neutral" : "critical",
    });
    if (h.ReleaseDateTime) {
      push({
        key: `hold-rel-${h.SEQUENCE}`,
        at: h.ReleaseDateTime,
        label: "Hold released",
        actor: h.ReleaseBy,
        actorField: "HoldRecord.ReleaseBy",
        lane: "Exceptions",
        detail: h.ReleaseRemarks,
        source: "getAwb().holds[].ReleaseDateTime / ReleaseBy",
        documentId: null,
        href: "/exceptions/holds",
        severity: "good",
      });
    }
  }
  for (const c of bundle.cdrs) {
    push({
      key: `cdr-${c.id}`,
      at: c.raisedAt,
      label: `${c.cdrRef} raised — ${c.type}`,
      actor: c.raisedBy,
      actorField: "CDR.raisedBy",
      lane: "Exceptions",
      detail: `${c.autoRaised ? "Auto-raised" : "Raised manually"} from ${c.origin} · status ${c.status} · ${c.evidence.length} evidence items`,
      source: "getAwb().cdrs[].raisedAt / raisedBy",
      documentId: c.evidence.find((e) => e.documentId)?.documentId ?? null,
      href: "/exceptions/cdr",
      severity: c.status === "closed" ? "neutral" : "warning",
    });
  }

  /* --- Charges, invoice, waiver, payment (FC-12 §17) ------------------- */
  if (bundle.godownRent) {
    const gr = bundle.godownRent;
    push({
      key: "gr",
      at: gr.CreatedDate,
      label: `GR voucher ${gr.VOUCHERNO} raised`,
      actor: gr.CreatedBy,
      actorField: "GodownRent.CreatedBy",
      lane: "Finance",
      detail: `${gr.DAYS} days · ${formatKg(gr.CHARGEABLEWEIGHT)} chargeable · ${formatPkr(gr.NETPAYABLE)} net payable`,
      source: "getAwb().godownRent.CreatedDate / CreatedBy",
      documentId: null,
      href: "/billing/invoice",
      severity: "neutral",
    });
  }
  if (bundle.invoice) {
    push({
      key: "inv",
      at: bundle.invoice.issuedAt,
      label: `Invoice ${bundle.invoice.invoiceNo} issued`,
      actor: null,
      actorField: "no actor column on Invoice",
      lane: "Finance",
      detail: `${formatPkr(bundle.invoice.total)} · ${formatPkr(bundle.invoice.outstanding)} outstanding · ${bundle.invoice.status}`,
      source: "getAwb().invoice.issuedAt",
      documentId: null,
      href: "/auditor/financial-trace",
      severity: bundle.invoice.outstanding > 0 ? "warning" : "good",
    });
    for (const p of paymentsFor(bundle.invoice.invoiceNo)) {
      push({
        key: `pay-${p.id}`,
        at: p.paidAt,
        label: `Payment received — ${p.mode}`,
        actor: p.receivedBy,
        actorField: "PaymentRecord.receivedBy",
        lane: "Finance",
        detail: `${formatPkr(p.amount)}${p.gatewayRef ? ` · ${p.gatewayRef}` : ""} · ${p.reconciled ? "reconciled" : "NOT reconciled"}`,
        source: "paymentsFor(invoiceNo).paidAt / receivedBy",
        documentId: null,
        href: "/finance-manager/payment-reconciliation",
        severity: p.reconciled ? "good" : "warning",
      });
    }
  }
  for (const w of bundle.waivers) {
    push({
      key: `wvr-${w.id}`,
      at: w.requestedAt,
      label: `Waiver requested on ${w.voucherNo}`,
      actor: w.requestedBy,
      actorField: "WaiverRequest.requestedBy",
      lane: "Finance",
      detail: `${w.reason} · ${w.mode === "percent" ? `${w.percent}%` : formatPkr(w.amount)} on ${w.scope}`,
      source: "getAwb().waivers[].requestedAt / requestedBy",
      documentId: null,
      href: "/finance-manager/waiver-workflow",
      severity: "neutral",
    });
    for (const lvl of w.levels) {
      if (!lvl.decidedAt) continue;
      push({
        key: `wvr-${w.id}-l${lvl.level}`,
        at: lvl.decidedAt,
        label: `Waiver ${lvl.decision} — level ${lvl.level}`,
        actor: lvl.approver,
        actorField: "ApprovalLevel.approver",
        lane: "Finance",
        detail: `${lvl.role}${lvl.comment ? ` · ${lvl.comment}` : ""}`,
        source: "getAwb().waivers[].levels[].decidedAt / approver",
        documentId: null,
        href: "/finance-manager/waiver-workflow",
        severity: lvl.decision === "rejected" ? "critical" : "good",
      });
    }
  }

  /* --- Release and dispatch (FC-08) ------------------------------------ */
  if (bundle.deliveryOrder) {
    const doRow = bundle.deliveryOrder;
    if (doRow.requestedAt) {
      push({
        key: "do-req",
        at: doRow.requestedAt,
        label: "Delivery order requested",
        actor: doRow.requestedBy,
        actorField: "DeliveryOrder.requestedBy",
        lane: "Dispatch",
        detail: doRow.requestedAgainstNoaAt
          ? `Against the arrival advice issued ${doRow.requestedAgainstNoaAt.slice(0, 10)}`
          : null,
        source: "getAwb().deliveryOrder.requestedAt / requestedBy",
        documentId: null,
        href: "/dispatch/gate-out",
        severity: "neutral",
      });
    }
    if (doRow.issuedAt) {
      const applicable = (doRow.gateSnapshot ?? []).filter((g) => g.applicable);
      push({
        key: "do-iss",
        at: doRow.issuedAt,
        label: `Delivery order ${doRow.DONO} issued`,
        actor: doRow.issuedBy,
        actorField: "DeliveryOrder.issuedBy",
        lane: "Dispatch",
        detail: applicable.length
          ? `${applicable.filter((g) => g.pass).length} of ${applicable.length} release conditions passed at issue`
          : "No gate snapshot was recorded against this delivery order.",
        source: "getAwb().deliveryOrder.issuedAt / issuedBy / gateSnapshot",
        documentId: null,
        href: "/dispatch/gate-out",
        severity: applicable.every((g) => g.pass) ? "good" : "critical",
      });
    }
  }
  if (bundle.gatePass) {
    const gp = bundle.gatePass;
    push({
      key: "gp",
      at: gp.GATEPASSDATE,
      label: `Gate pass ${gp.docNumber.value} — ${gp.status}`,
      actor: gp.CreatedBy,
      actorField: "GatePass.CreatedBy",
      lane: "Dispatch",
      detail: `Vehicle ${gp.VehicleNo} · ${gp.PIECES} pieces to ${gp.RecivingPerson}`,
      source: "getAwb().gatePass.GATEPASSDATE / CreatedBy",
      documentId: null,
      href: "/dispatch/gate-out",
      severity: "neutral",
    });
  }
  if (bundle.pod) {
    const pod = bundle.pod;
    push({
      key: "pod",
      at: pod.capturedAt,
      label: "Proof of delivery captured",
      actor: pod.capturedBy,
      actorField: "ProofOfDelivery.capturedBy",
      lane: "Dispatch",
      detail: `${pod.piecesDelivered} of ${pod.piecesOnDo} pieces · CNIC ${pod.cnicMatchesDo ? "matched the DO" : "DID NOT match the DO"} · ${pod.photos.length} photos · ${
        pod.geo ? `geo ±${pod.geo.accuracyM}m` : "no geo fix recorded"
      }`,
      source: "getAwb().pod.capturedAt / capturedBy",
      documentId: null,
      href: "/dispatch/gate-out",
      severity: pod.cnicMatchesDo && pod.complete ? "good" : "warning",
    });
    if (pod.dlvSentAt) {
      push({
        key: "dlv",
        at: pod.dlvSentAt,
        label: "DLV sent to the carrier",
        actor: null,
        actorField: "no actor column — auto-sent on POD capture",
        lane: "Messaging",
        detail: null,
        source: "getAwb().pod.dlvSentAt",
        documentId: null,
        href: "/messaging/iata",
        severity: "neutral",
      });
    }
  }

  /* --- Branches -------------------------------------------------------- */
  const teCase = retenderGateFor(awb.AWBId);
  const branches: ExceptionBranch[] = [
    {
      label: "Discrepancy CDR",
      state: bundle.cdrs.length > 0 ? "raised" : v ? "clear" : "n/a",
      detail:
        bundle.cdrs.length > 0
          ? bundle.cdrs.map((c) => `${c.cdrRef} — ${c.type}, ${c.status}`).join(" · ")
          : v
            ? "Intake variance was screened and stayed inside tolerance on all three measures, so no CDR exists. This is the auto-raise having run, not the auto-raise being absent — the distinction FC-04 exists to make."
            : "No variance screen has run against this consignment yet, so the absence of a CDR says nothing either way.",
      source: "getAwb().cdrs · AWB.intakeVariance",
      href: "/exceptions/cdr",
    },
    {
      label: "Damage",
      state: bundle.damage.length > 0 ? "raised" : "clear",
      detail:
        bundle.damage.length > 0
          ? `${bundle.damage.length} damage ${bundle.damage.length === 1 ? "record" : "records"} on file`
          : "No damage record against this AWB.",
      source: "getAwb().damage",
      href: "/exceptions/cdr",
    },
    {
      label: "Transhipment",
      state: teCase ? "raised" : "n/a",
      detail: teCase
        ? `${teCase.case.stage}${teCase.case.handoff.state !== "not-applicable" ? ` · handoff ${teCase.case.handoff.fromSite} → ${teCase.case.handoff.toSite}, ${teCase.case.handoff.state}` : ""}`
        : "This consignment is not on a transhipment case — no TRANSHIPMENT_CASES row references it.",
      source: "retenderGateFor(awbId) · lib/domain/index.ts",
      href: "/transhipment/handoff",
    },
    {
      label: "Re-export",
      state: bundle.reExport.length > 0 ? "raised" : "clear",
      detail:
        bundle.reExport.length > 0
          ? bundle.reExport.map((r) => `Case ${r.id} — ${REEXPORT_STAGE_LABEL[r.stage]}`).join(" · ")
          : "No re-export case raised.",
      source: "getAwb().reExport",
      href: "/exceptions/re-export",
    },
    {
      label: "Long-stay (Section 82)",
      state: bundle.longStay.length > 0 ? "raised" : bundle.dwell.longStay ? "raised" : "clear",
      detail:
        bundle.longStay.length > 0
          ? bundle.longStay.map((l) => `Case ${l.id} — ${LONGSTAY_STAGE_LABEL[l.stage]}`).join(" · ")
          : `Day ${bundle.dwell.totalDays} of the ${bundle.dwell.section82Days}-day statutory period — ${bundle.dwell.daysToSection82} days remain.`,
      source: "getAwb().longStay · getAwb().dwell",
      href: "/exceptions/long-stay",
    },
    {
      label: "Mishandled",
      state: bundle.mishandled.length > 0 ? "raised" : "clear",
      detail:
        bundle.mishandled.length > 0
          ? bundle.mishandled.map((m) => `Case ${m.id} — ${MISHANDLED_STAGE_LABEL[m.stage]}`).join(" · ")
          : "No mishandling case raised.",
      source: "getAwb().mishandled",
      href: "/exceptions/mishandled",
    },
  ];

  return { bundle, events: events.sort(byTime), branches, closure: closureFor(awb.AWBId) };
}

/* ================================================================== *
 * Financial trace — FC-12 §17
 * ================================================================== */

export type FinanceLookupKind = "invoice" | "awb" | "voucher" | "creditnote" | "payment";

export const FINANCE_LOOKUPS: Array<{ kind: FinanceLookupKind; label: string; source: string }> = [
  { kind: "invoice", label: "Invoice #", source: "listInvoices('HQ') · Invoice.invoiceNo" },
  { kind: "awb", label: "AWB #", source: "listInvoices('HQ') · Invoice.AWBNO" },
  { kind: "voucher", label: "GR voucher #", source: "listGodownRents('HQ') · VOUCHERNO" },
  { kind: "creditnote", label: "Credit note #", source: "listWaivers('HQ') · WaiverRequest.creditNoteNo" },
  { kind: "payment", label: "Payment reference", source: "paymentsFor(invoiceNo) · gatewayRef / challanNo / payOrderNo / chequeNo" },
];

export function resolveFinanceRef(kind: FinanceLookupKind, raw: string): string | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const invoices = listInvoices("HQ");

  if (kind === "invoice") {
    return invoices.find((i) => i.invoiceNo.toLowerCase().includes(q))?.invoiceNo ?? null;
  }
  if (kind === "awb") {
    return invoices.find((i) => i.AWBNO.toLowerCase().includes(q))?.invoiceNo ?? null;
  }
  if (kind === "voucher") {
    const gr = listGodownRents("HQ").find((g) => g.VOUCHERNO.toLowerCase().includes(q));
    return gr ? (invoices.find((i) => i.awbId === grAwbId(gr))?.invoiceNo ?? null) : null;
  }
  if (kind === "creditnote") {
    const w = listWaivers("HQ").find((x) => (x.creditNoteNo ?? "").toLowerCase().includes(q));
    return w ? (invoices.find((i) => i.awbId === w.awbId)?.invoiceNo ?? null) : null;
  }
  for (const inv of invoices) {
    const refs = paymentsFor(inv.invoiceNo).flatMap((p) =>
      [p.gatewayRef, p.challanNo, p.payOrderNo, p.chequeNo].filter(Boolean),
    ) as string[];
    if (refs.some((r) => r.toLowerCase().includes(q))) return inv.invoiceNo;
  }
  return null;
}

/** GR vouchers key on AWBNO, not awbId — resolve through the AWB register. */
function grAwbId(gr: GodownRent): number | null {
  return awbByNo(gr.AWBNO)?.AWBId ?? null;
}

export interface FinanceLine {
  label: string;
  value: string;
  /** The verbatim field this line is, so a total can be checked against it. */
  field: string;
  emphasis?: boolean;
}

export interface FinancialTrace {
  invoice: Invoice;
  awb: AWB | null;
  charges: ChargeCalculation | null;
  godownRent: GodownRent | null;
  payments: PaymentRecord[];
  waivers: WaiverRequest[];
  events: TraceEvent[];
  lines: FinanceLine[];
}

export function financialTrace(invoiceNo: string): FinancialTrace | null {
  const invoice = listInvoices("HQ").find((i) => i.invoiceNo === invoiceNo);
  if (!invoice) return null;

  const awb = listAwbs({ scope: "HQ" }).find((a) => a.AWBId === invoice.awbId) ?? null;
  const charges = chargesFor(invoice.awbId) ?? null;
  const godownRent = listGodownRents("HQ").find((g) => g.AWBNO === invoice.AWBNO) ?? null;
  const payments = paymentsFor(invoice.invoiceNo);
  const waivers = listWaivers("HQ").filter((w) => w.awbId === invoice.awbId);

  const events: TraceEvent[] = [];

  if (godownRent) {
    events.push({
      key: "gr",
      at: godownRent.CreatedDate,
      label: `GR voucher ${godownRent.VOUCHERNO} raised`,
      actor: godownRent.CreatedBy,
      actorField: "GodownRent.CreatedBy",
      lane: "Charges",
      detail: `${godownRent.DAYS} days from ${godownRent.FROMDATE.slice(0, 10)} · ${formatKg(godownRent.CHARGEABLEWEIGHT)} chargeable`,
      source: "listGodownRents('HQ') · GodownRent.CreatedDate / CreatedBy",
      documentId: null,
      href: "/billing/invoice",
      severity: "neutral",
    });
  }
  if (charges) {
    events.push({
      key: "calc",
      at: charges.calculatedAt,
      label: `Charges calculated on ${charges.tariffVersion}`,
      actor: null,
      actorField: "no actor column — the dwell clock is evaluated on read",
      lane: "Charges",
      detail: `${charges.chargeableDays} chargeable days after ${charges.freeDays} free · ${charges.slabLines.length} tariff bands · subtotal ${formatPkr(charges.subTotal)}`,
      source: "chargesFor(awbId).calculatedAt / tariffVersion",
      documentId: null,
      href: "/billing/invoice",
      severity: "neutral",
    });
  }
  events.push({
    key: "inv",
    at: invoice.issuedAt,
    label: `Invoice ${invoice.invoiceNo} issued`,
    actor: null,
    actorField: "no actor column on Invoice",
    lane: "Invoice",
    detail: `${formatPkr(invoice.total)} · due ${invoice.dueAt.slice(0, 10)}`,
    source: "listInvoices('HQ') · Invoice.issuedAt",
    documentId: null,
    href: "/billing/invoice",
    severity: "neutral",
  });

  for (const w of waivers) {
    events.push({
      key: `wvr-${w.id}`,
      at: w.requestedAt,
      label: "Waiver requested",
      actor: w.requestedBy,
      actorField: "WaiverRequest.requestedBy",
      lane: "Waiver",
      detail: `${w.reason} — ${w.mode === "percent" ? `${w.percent}% of ${w.scope}` : formatPkr(w.amount)} · ${w.note}`,
      source: "listWaivers('HQ') · WaiverRequest.requestedAt / requestedBy",
      documentId: null,
      href: "/finance-manager/waiver-workflow",
      severity: "neutral",
    });
    for (const lvl of w.levels) {
      if (!lvl.decidedAt) continue;
      events.push({
        key: `wvr-${w.id}-l${lvl.level}`,
        at: lvl.decidedAt,
        label: `Level ${lvl.level} ${lvl.decision} — ${lvl.role}`,
        actor: lvl.approver,
        actorField: "ApprovalLevel.approver",
        lane: "Waiver",
        detail: lvl.comment,
        source: "listWaivers('HQ') · WaiverRequest.levels[].decidedAt / approver",
        documentId: null,
        href: "/finance-manager/waiver-workflow",
        severity: lvl.decision === "rejected" ? "critical" : "good",
      });
    }
  }

  for (const p of payments) {
    events.push({
      key: `pay-${p.id}`,
      at: p.paidAt,
      label: `Payment received — ${p.mode}`,
      actor: p.receivedBy,
      actorField: "PaymentRecord.receivedBy",
      lane: "Payment",
      detail: `${formatPkr(p.amount)}${p.gatewayRef ? ` · ${p.gatewayRef}` : ""}${p.challanNo ? ` · challan ${p.challanNo}` : ""} · ${p.reconciled ? "reconciled" : "NOT reconciled"}`,
      source: "paymentsFor(invoiceNo) · PaymentRecord.paidAt / receivedBy",
      documentId: null,
      href: "/finance-manager/payment-reconciliation",
      severity: p.reconciled ? "good" : "warning",
    });
  }

  /* The panel beside the timeline. Every line names the field it is, because
     an invoice panel a client cannot reconcile to the charge calculation is
     the same problem as a KPI they cannot drill into. */
  const lines: FinanceLine[] = [
    { label: "Invoice", value: invoice.invoiceNo, field: "Invoice.invoiceNo" },
    { label: "AWB", value: invoice.AWBNO, field: "Invoice.AWBNO" },
    { label: "Node", value: invoice.site, field: "Invoice.site" },
    ...(awb
      ? [
          { label: "Consignee", value: awb.CONSIGNEE1, field: "AWB.CONSIGNEE1" },
          { label: "Pieces", value: String(awb.TOTALPCS), field: "AWB.TOTALPCS" },
        ]
      : []),
    ...(charges
      ? [
          { label: "Tariff version", value: charges.tariffVersion, field: "ChargeCalculation.tariffVersion" },
          {
            label: "Chargeable weight",
            value: formatKg(charges.chargeableKg),
            field: "ChargeCalculation.chargeableKg",
          },
          {
            label: "Dwell",
            value: `${charges.totalDays} days, ${charges.freeDays} free, ${charges.chargeableDays} charged`,
            field: "ChargeCalculation.totalDays / freeDays / chargeableDays",
          },
          { label: "Storage", value: formatPkr(charges.storageAmount), field: "ChargeCalculation.storageAmount" },
          { label: "Handling", value: formatPkr(charges.handlingAmount), field: "ChargeCalculation.handlingAmount" },
          {
            label: "Documentation",
            value: formatPkr(charges.documentationCharges),
            field: "ChargeCalculation.documentationCharges",
          },
          {
            label: "Deconsolidation",
            value: formatPkr(charges.deconsolidationCharges),
            field: "ChargeCalculation.deconsolidationCharges",
          },
          {
            label: "Special handling",
            value: formatPkr(charges.specialHandlingCharges),
            field: "ChargeCalculation.specialHandlingCharges",
          },
          { label: "Sub-total", value: formatPkr(charges.subTotal), field: "ChargeCalculation.subTotal" },
          {
            label: `Tax (${charges.taxPercent}%)`,
            value: formatPkr(charges.taxAmount),
            field: "ChargeCalculation.taxAmount",
          },
        ]
      : []),
    ...(godownRent && godownRent.WAIVEOFF
      ? [
          {
            label: "Waived",
            value: `-${formatPkr(godownRent.WAIVEOFFAMOUNT)}`,
            field: "GodownRent.WAIVEOFFAMOUNT",
          },
        ]
      : []),
    { label: "Invoice total", value: formatPkr(invoice.total), field: "Invoice.total", emphasis: true },
    { label: "Paid", value: formatPkr(invoice.paid), field: "Invoice.paid" },
    {
      label: "Outstanding",
      value: formatPkr(invoice.outstanding),
      field: "Invoice.outstanding",
      emphasis: true,
    },
    { label: "Status", value: invoice.status, field: "Invoice.status" },
    {
      label: "Age",
      value: `${daysBetween(invoice.issuedAt, DEMO_NOW)} days since issue`,
      field: "daysBetween(Invoice.issuedAt, DEMO_NOW)",
    },
  ];

  return { invoice, awb, charges, godownRent, payments, waivers, events: events.sort(byTime), lines };
}

/** Every invoice an auditor can open, for the picker beside the search box. */
export function traceableInvoices(): Invoice[] {
  return listInvoices("HQ");
}
