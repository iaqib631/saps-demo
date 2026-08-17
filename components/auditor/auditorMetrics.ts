/**
 * Every figure the /auditor home is allowed to print, derived in one place.
 *
 * WHY THIS FILE EXISTS. The six tiles above this dashboard were string
 * literals — 2,847 transactions, 31 waivers, 156 holds, 89 OOC issuances, 412
 * invoices, 24 user-access changes — each with an invented arrow beside it and
 * each subtitled "Last 30 days". Nothing fed any of them. The four summary
 * cards below them were sixteen more literals of the same kind ("2,341 AWBs
 * moved", "PKR 48.2M collected", "0 failed logins flagged"), and the ten-row
 * audit table under those named ten people, ten entity references and ten
 * evidence filenames that exist nowhere in this repo.
 *
 * The six questions were the right six. This module answers all six from real
 * functions over real fixtures, which is the point: nothing here is a smaller,
 * more cautious version of the old screen — it is the same screen with the
 * numbers connected.
 *
 * ESTATE-WIDE, NOT SITE-SCOPED — the one thing that differs from
 * components/admin/dashboard/siteAdminMetrics.ts. That module takes the active
 * `SiteScope` from components/site/SiteContext.tsx because /admin configures
 * ONE node (FC-12 §01). Audit & Oversight is the HQ tier's read side: §16
 * cargo trace, §17 financial trace, §17a evidence pack, §06 RBAC snapshot and
 * §18 reports all read ACROSS nodes, and an auditor who can only see the node
 * whose scope happens to be selected cannot do the job. So every query below
 * passes "HQ" explicitly and the per-node split is shown as a breakdown inside
 * the tile rather than as a filter over it. The site switcher in the shell is
 * deliberately not consulted here.
 *
 * NO TRENDS, BY CONSTRUCTION. Nothing in this file returns a delta and nothing
 * should. `AuditorStat` has no prop for one. Every fixture in this repo is a
 * single snapshot at DEMO_NOW, so "-12% vs prev" had no previous period to be
 * measured against — it was not merely unfed, it was unmeasurable. Where a
 * time dimension IS real it is stated as an age against DEMO_NOW, never as a
 * direction: `recordTrail()` returns the span of the dated records it found.
 */

import {
  DEMO_NOW,
  SITES,
  daysBetween,
  formatPkr,
  listCdrs,
  listClearances,
  listDeliveryOrders,
  listDivergedLocations,
  listDocuments,
  listExceptionQueue,
  listGatePasses,
  listHandoffs,
  listHolds,
  listIataMessages,
  listInvoices,
  listLongStay,
  listMishandled,
  listNotifications,
  listPayments,
  listPieces,
  listPods,
  listReExport,
  listWaivers,
  portalKpis,
  type SiteCode,
} from "@/lib/domain";
import { ROLE_SLUGS, listDelegations, siteAdminCoverage } from "@/lib/domain/access";
import type { Severity } from "@/components/hq/HqUi";

/* ================================================================== *
 * Shared shapes
 * ================================================================== */

export interface EstateFigure {
  key: string;
  label: string;
  value: string;
  /** The per-node split, or what the headline number is made of. */
  detail: string;
  /** The lib/domain call this came from, verbatim. */
  source: string;
  severity: Severity;
  status?: string;
  href?: string;
}

export interface EstatePanelItem {
  label: string;
  value: string;
  note?: string;
}

export interface EstatePanel {
  key: string;
  title: string;
  source: string;
  intro: string;
  items: EstatePanelItem[];
  action?: { label: string; href: string };
}

/** "KHI 20 · LHE 6 · PEW 3" — the split, never a total dressed as one. */
function perSite(pick: (site: SiteCode) => number): string {
  return SITES.map((s) => `${s.code} ${pick(s.code).toLocaleString("en-PK")}`).join(" · ");
}

/* ================================================================== *
 * The six headline tiles — the same six questions the old row asked
 * ================================================================== */

export function estateFigures(): EstateFigure[] {
  const kpis = portalKpis("HQ");

  const invoices = listInvoices("HQ");
  const outstanding = invoices.reduce((n, i) => n + i.outstanding, 0);
  const unpaid = invoices.filter((i) => i.outstanding > 0).length;

  const waivers = listWaivers("HQ");
  const pendingWaivers = listWaivers("HQ", true).length;
  const creditNotes = waivers.filter((w) => w.creditNoteNo !== null).length;

  const holds = listHolds("HQ");
  const liveHolds = listHolds("HQ", true);

  const clearances = listClearances("HQ");
  const oocIssued = clearances.filter((c) => c.ooc !== null);
  const oocVerified = oocIssued.filter((c) => c.ooc?.verifiedAt);

  const active = listDelegations("HQ", true);
  const withdrawn = listDelegations("HQ").filter((d) => !d.IsActive);
  const coverage = siteAdminCoverage();
  const unadministered = coverage.filter((c) => c.unadministered).map((c) => c.site);

  return [
    {
      /* Was "Transactions · 2,847 · +8.2%". There is no transaction table in
         this repo and never was; the register that carries every consignment
         is the AWB one, and it has 29 rows, not 2,847. */
      key: "awbs",
      label: "AWBs on file",
      value: kpis.awbsTotal.toLocaleString("en-PK"),
      detail: `${perSite((s) => portalKpis(s).awbsTotal)} · ${kpis.awbsInWarehouse} in the warehouse, ${kpis.awbsDelivered} delivered`,
      source: "portalKpis('HQ').awbsTotal · lib/domain/index.ts",
      severity: "neutral",
    },
    {
      key: "waivers",
      label: "Waivers",
      value: waivers.length.toLocaleString("en-PK"),
      detail:
        waivers.length === 0
          ? "No waiver has been requested at any node."
          : `${pendingWaivers} awaiting a decision · ${creditNotes} carrying a credit note · ${perSite((s) => listWaivers(s).length)}`,
      source: "listWaivers('HQ') · listWaivers('HQ', true) · lib/domain/index.ts",
      severity: pendingWaivers > 0 ? "warning" : "neutral",
      status: pendingWaivers > 0 ? `${pendingWaivers} pending` : undefined,
      href: "/finance-manager/waiver-workflow",
    },
    {
      key: "holds",
      label: "Holds",
      value: holds.length.toLocaleString("en-PK"),
      detail: `${liveHolds.length} still live, ${holds.length - liveHolds.length} released · ${perSite((s) => listHolds(s).length)}`,
      source: "listHolds('HQ') · listHolds('HQ', true) · lib/domain/index.ts",
      severity: liveHolds.length > 0 ? "warning" : "good",
      status: liveHolds.length > 0 ? `${liveHolds.length} live` : "none live",
      href: "/exceptions/holds",
    },
    {
      key: "ooc",
      label: "OOC issued",
      value: oocIssued.length.toLocaleString("en-PK"),
      detail: `Of ${clearances.length} clearances on file · ${oocVerified.length} verified field-by-field against the SD · ${perSite((s) => listClearances(s).filter((c) => c.ooc !== null).length)}`,
      source: "listClearances('HQ') · CustomsClearance.ooc · lib/domain/index.ts",
      severity: "neutral",
      href: "/customs/channels",
    },
    {
      key: "invoices",
      label: "Invoices",
      value: invoices.length.toLocaleString("en-PK"),
      detail: `${unpaid} carrying a balance · ${formatPkr(outstanding)} outstanding · ${perSite((s) => listInvoices(s).length)}`,
      source: "listInvoices('HQ') · Invoice.outstanding · lib/domain/index.ts",
      severity: outstanding > 0 ? "warning" : "good",
      status: outstanding > 0 ? `${formatPkr(outstanding)} open` : "settled",
      href: "/billing/invoice",
    },
    {
      /* Was "User Access Changes · 24 · -3 vs prev". The count is real now:
         lib/domain/access.ts models the grant as a revocable record, so
         "authority issued" and "authority withdrawn" are rows rather than an
         estimate. The "-3" is not replaced by a smaller arrow — the two
         states are simply counted. */
      key: "access",
      label: "Administration rights",
      value: active.length.toLocaleString("en-PK"),
      detail: `${active.length} delegations in force, ${withdrawn.length} withdrawn · ${
        unadministered.length === 0
          ? "every node has an administrator"
          : `${unadministered.join(", ")} ${unadministered.length === 1 ? "has" : "have"} none`
      }`,
      source: "listDelegations('HQ', true) · siteAdminCoverage() · lib/domain/access.ts",
      severity: unadministered.length > 0 ? "critical" : "good",
      status: unadministered.length > 0 ? `${unadministered.join("/")} uncovered` : "all covered",
      href: "/hq/site-admins",
    },
  ];
}

/* ================================================================== *
 * The four activity panels
 *
 * Same four headings the screen has always carried — Cargo, Financial,
 * Compliance, Security & Access — and sixteen literals replaced by counts
 * from the registers each heading is actually about. "Last 30 days" is gone
 * from all four: there is no rolling window over a single snapshot.
 * ================================================================== */

export function estatePanels(): EstatePanel[] {
  const kpis = portalKpis("HQ");
  const pieces = listPieces("HQ");
  const cdrs = listCdrs("HQ");
  const openCdrs = listCdrs("HQ", true);
  const diverged = listDivergedLocations("HQ");

  const invoices = listInvoices("HQ");
  const payments = listPayments("HQ");
  const unreconciled = listPayments("HQ", true);
  const waivers = listWaivers("HQ");

  const clearances = listClearances("HQ");
  const byChannel = (ch: "red" | "yellow" | "green") =>
    clearances.filter((c) => c.channel === ch).length;
  const queue = listExceptionQueue("HQ");

  const active = listDelegations("HQ", true);
  const crossSite = active.filter((d) => d.scope === "HQ");
  const withdrawn = listDelegations("HQ").filter((d) => !d.IsActive);
  const grantedRoles = ROLE_SLUGS.filter((slug) => active.some((d) => d.roles.includes(slug)));

  return [
    {
      key: "cargo",
      title: "Cargo",
      source: "portalKpis('HQ') · listPieces · listCdrs · listDivergedLocations",
      intro: "What the consignment registers hold across the three nodes right now.",
      items: [
        {
          label: "AWBs on file",
          value: kpis.awbsTotal.toLocaleString("en-PK"),
          note: perSite((s) => portalKpis(s).awbsTotal),
        },
        {
          label: "Pieces bound to a location",
          value: `${kpis.piecesStored} of ${pieces.length}`,
          note: "Piece.scanState === 'bound' — the physical count behind the AWB count",
        },
        {
          label: "Discrepancy reports",
          value: `${openCdrs.length} open of ${cdrs.length}`,
          note: "listCdrs('HQ', true) — status not 'closed'",
        },
        {
          label: "Storage divergences",
          value: diverged.length.toLocaleString("en-PK"),
          note: "Logical location ≠ physical location on the AWB",
        },
      ],
      action: { label: "Cargo trace", href: "/auditor/cargo-trace" },
    },
    {
      key: "financial",
      title: "Financial",
      source: "listInvoices · listPayments · listWaivers · lib/domain/index.ts",
      intro: "Amounts, not rates. One node holds a single invoice, and a percentage off n=1 reads as a finding when it is a sample size.",
      items: [
        {
          label: "Invoices issued",
          value: invoices.length.toLocaleString("en-PK"),
          note: perSite((s) => listInvoices(s).length),
        },
        {
          label: "Collected",
          value: formatPkr(invoices.reduce((n, i) => n + i.paid, 0)),
          note: `Across ${payments.length} payment ${payments.length === 1 ? "record" : "records"}`,
        },
        {
          label: "Outstanding",
          value: formatPkr(invoices.reduce((n, i) => n + i.outstanding, 0)),
          note: perSite((s) => listInvoices(s).reduce((n, i) => n + i.outstanding, 0)),
        },
        {
          label: "Payments not yet reconciled",
          value: `${unreconciled.length} of ${payments.length}`,
          note: unreconciled.length
            ? `Modes: ${[...new Set(unreconciled.map((p) => p.mode))].join(", ")}`
            : "Every payment is matched to an invoice",
        },
        {
          label: "Waivers",
          value: waivers.length.toLocaleString("en-PK"),
          note: waivers
            .map((w) => `${w.voucherNo} ${w.status}${w.creditNoteNo ? ` → ${w.creditNoteNo}` : ""}`)
            .join(" · ") || "None on file",
        },
      ],
      action: { label: "Financial trace", href: "/auditor/financial-trace" },
    },
    {
      key: "compliance",
      title: "Compliance",
      source: "listClearances · listHolds · listExceptionQueue · listLongStay · listReExport · listMishandled",
      intro: "The customs and exception registers, estate-wide.",
      items: [
        {
          label: "Clearances on file",
          value: clearances.length.toLocaleString("en-PK"),
          note: `Red ${byChannel("red")} · Yellow ${byChannel("yellow")} · Green ${byChannel("green")}`,
        },
        {
          label: "Live holds",
          value: `${listHolds("HQ", true).length} of ${listHolds("HQ").length}`,
          note: listHolds("HQ", true)
            .map((h) => `${h.AWBNo} — ${h.type}`)
            .join(" · ") || "No hold is live",
        },
        {
          label: "Open exceptions",
          value: queue.length.toLocaleString("en-PK"),
          note: `${queue.filter((q) => q.overThreshold).length} past their own escalation threshold · ${perSite((s) => listExceptionQueue(s).length)}`,
        },
        {
          label: "Long-stay, re-export, mishandled",
          value: `${listLongStay("HQ").length} · ${listReExport("HQ").length} · ${listMishandled("HQ").length}`,
          note: "Cases on file in the three FC-10 branch registers",
        },
      ],
      action: { label: "Exception queue", href: "/exceptions/queue" },
    },
    {
      key: "access",
      title: "Security & access",
      source: "listDelegations · siteAdminCoverage · ROLE_SLUGS · lib/domain/access.ts",
      intro: "Who may administer which node. This is the register the RBAC snapshot reads — not a session or login store, of which there is none.",
      items: [
        {
          label: "Delegations in force",
          value: active.length.toLocaleString("en-PK"),
          note: `${crossSite.length} cross-site (in force at every node) · ${active.length - crossSite.length} issued for one node`,
        },
        {
          label: "Authority withdrawn",
          value: withdrawn.length.toLocaleString("en-PK"),
          note: "IsActive false with the reason recorded on the row — revoked, not deleted",
        },
        {
          label: "Nodes without an administrator",
          value: siteAdminCoverage().filter((c) => c.unadministered).length.toLocaleString("en-PK"),
          note:
            siteAdminCoverage()
              .filter((c) => c.unadministered)
              .map((c) => c.site)
              .join(", ") || "None — every node is covered",
        },
        {
          label: "Role slugs actually granted",
          value: `${grantedRoles.length} of ${ROLE_SLUGS.length}`,
          note: grantedRoles.join(", "),
        },
      ],
      action: { label: "RBAC snapshot", href: "/auditor/rbac-snapshot" },
    },
  ];
}

/* ================================================================== *
 * Cross-site facts only this tier can see
 * ================================================================== */

export interface CrossSiteFact {
  label: string;
  value: string;
  detail: string;
  source: string;
  severity: Severity;
  href: string;
}

export function crossSiteFacts(): CrossSiteFact[] {
  const legs = listHandoffs("HQ");
  const unverified = legs.filter((c) => !c.handoff.bondContinuityVerified);
  const failedIata = listIataMessages("HQ").filter((m) => m.status === "failed");
  const failedNotifications = listNotifications("HQ").filter((n) => n.status === "failed");
  const documents = listDocuments("HQ");

  return [
    {
      label: "Cargo between nodes",
      value: legs.length.toLocaleString("en-PK"),
      detail: legs.length
        ? legs
            .map(
              (c) =>
                `${c.AWBNO} ${c.handoff.fromSite} → ${c.handoff.toSite}${
                  c.handoff.bondContinuityVerified ? "" : " (bond continuity NOT verified)"
                }`,
            )
            .join(" · ")
        : "No consignment is moving between nodes.",
      source: "listHandoffs('HQ') · InterStationHandoff · lib/domain/transhipment.ts",
      severity: unverified.length > 0 ? "critical" : "neutral",
      href: "/transhipment/handoff",
    },
    {
      label: "Failed messages",
      value: (failedIata.length + failedNotifications.length).toLocaleString("en-PK"),
      detail: `${failedIata.length} of ${listIataMessages("HQ").length} IATA messages · ${failedNotifications.length} of ${listNotifications("HQ").length} customer notifications. Both stores carry a site column; the gateway register does not, so connector health is not split per node here.`,
      source: "listIataMessages('HQ') · listNotifications('HQ') · lib/domain/index.ts",
      severity: failedIata.length + failedNotifications.length > 0 ? "warning" : "good",
      href: "/integration-status",
    },
    {
      label: "Documents available to an evidence pack",
      value: documents.length.toLocaleString("en-PK"),
      detail: `${perSite((s) => listDocuments(s).length)} · ${documents.filter((d) => d.versions.length > 1).length} carry more than one version, superseded rather than deleted`,
      source: "listDocuments('HQ') · StoredDocument · lib/domain/documents.ts",
      severity: "neutral",
      href: "/auditor/export-centre",
    },
  ];
}

/* ================================================================== *
 * The record trail
 *
 * WHAT THIS IS NOT. It is not an audit log. There is no audit-event store
 * anywhere in lib/domain — components/admin/dashboard/NotShownOnDashboard.tsx
 * states the same thing for the site tier — so "who VIEWED what" and "who
 * EXPORTED what" cannot be answered, and the ten rows that used to sit here
 * claiming exactly that (ahmed.shaikh Viewed INV-2026-0042 → inv_42_detail.pdf)
 * were invented end to end, filenames included.
 *
 * WHAT IT IS. Every WRITE in this demo that carries both a timestamp and an
 * actor column, gathered from the registers named in TRAIL_REGISTERS and
 * sorted by time. That is a real trail with real provenance — each row prints the
 * fixture field its actor came from — and it is the honest half of what the
 * old table pretended to be. Reads are absent because reads are not recorded;
 * components/auditor/dashboard/NotShownOnAuditorHome.tsx says so on the screen
 * rather than leaving the gap to be discovered.
 * ================================================================== */

export interface TrailRow {
  key: string;
  at: string;
  /** Null where the record genuinely has no actor column — never a guess. */
  actor: string | null;
  /** The field the actor was read from, verbatim: "CreatedBy", "uploadedBy". */
  actorField: string;
  module: string;
  entity: string;
  entityHref: string | null;
  action: string;
  site: SiteCode | "HQ";
  source: string;
  /** A real DOCUMENTS row, where the event produced one. */
  documentId: string | null;
}

/**
 * The registers the trail is assembled from, named so the count printed on
 * screen cannot drift from the loops in `recordTrail()`. Every one of these is
 * a fixture with both a timestamp column and an actor column; the stores left
 * out — AWBS, PIECES, MANIFESTS, INVOICES — either have no actor or no event.
 */
export const TRAIL_REGISTERS = [
  "DOCUMENTS",
  "IATA_MESSAGES",
  "NOTIFICATION_DISPATCHES",
  "CUSTOMS_CLEARANCES",
  "PAYMENTS",
  "WAIVER_REQUESTS",
  "DELIVERY_ORDERS",
  "GATE_PASSES",
  "PODS",
  "CDRS",
  "HOLDS",
  "SITE_ADMIN_DELEGATIONS",
] as const;

export const TRAIL_MODULES = [
  "Documents",
  "IATA messaging",
  "Notifications",
  "Customs",
  "Finance",
  "Dispatch",
  "Exceptions",
  "Site administration",
] as const;

export type TrailModule = (typeof TRAIL_MODULES)[number];

export function recordTrail(): TrailRow[] {
  const rows: TrailRow[] = [];

  /* --- Documents (M02) ------------------------------------------------ */
  for (const doc of listDocuments("HQ")) {
    rows.push({
      key: `doc-${doc.id}`,
      at: doc.uploadedAt,
      actor: doc.uploadedBy,
      actorField: "uploadedBy",
      module: "Documents",
      entity: doc.AWBNO ?? doc.id,
      entityHref: doc.awbId ? `/awb/${doc.awbId}?tab=audit` : null,
      action:
        doc.versions.length > 1
          ? `${doc.type} — v${doc.versions.length}`
          : `${doc.type} filed`,
      site: doc.site,
      source: "listDocuments('HQ') · StoredDocument.uploadedAt / uploadedBy",
      documentId: doc.id,
    });
  }

  /* --- IATA messaging (FC-12 §09) ------------------------------------- */
  for (const m of listIataMessages("HQ")) {
    rows.push({
      key: `iata-${m.id}`,
      at: m.timestamp,
      actor: m.manualSendBy,
      actorField: "manualSendBy",
      module: "IATA messaging",
      /* FFM and the other flight-level types carry no AWB — the two tracks
         join on the flight, never on the AWB — so the flight is the entity
         where AWBNO is null rather than a blank cell. */
      entity: m.AWBNO ?? m.FLIGHT ?? `message ${m.id}`,
      entityHref: m.awbId ? `/awb/${m.awbId}?tab=messaging` : "/messaging/iata",
      action: `${m.type} ${m.direction} — ${m.status}`,
      site: m.site,
      source: "listIataMessages('HQ') · IataMessage.timestamp / manualSendBy",
      documentId: null,
    });
  }

  /* --- Customer notifications ----------------------------------------- */
  for (const n of listNotifications("HQ")) {
    rows.push({
      key: `ntf-${n.Id}`,
      at: n.queuedAt,
      actor: null,
      actorField: "no actor column — auto-dispatched",
      module: "Notifications",
      entity: n.AWBNO ?? n.recipientName,
      entityHref: n.awbId ? `/awb/${n.awbId}?tab=messaging` : "/messaging/notifications",
      action: `${n.notification} via ${n.channel} — ${n.status}`,
      site: n.site,
      source: "listNotifications('HQ') · NotificationDispatch.queuedAt / trigger",
      documentId: null,
    });
  }

  /* --- Customs (FC-12 §08) -------------------------------------------- */
  for (const c of listClearances("HQ")) {
    /* `filedAt` and `sdRef` are null until the declaration is lodged — a
       clearance row exists from the moment the AWB reaches customs. A row with
       no filing date has no event to put on a trail, so it is skipped rather
       than dated to now. */
    if (c.filedAt) {
      rows.push({
        key: `sd-${c.id}`,
        at: c.filedAt,
        actor: c.cha,
        actorField: "cha",
        module: "Customs",
        entity: c.AWBNO,
        entityHref: `/awb/${c.awbId}?tab=customs`,
        action: `SD ${c.sdRef ?? "reference pending"} filed — channel ${c.channel ?? "not yet assigned"}`,
        site: c.site,
        source: "listClearances('HQ') · CustomsClearance.filedAt / cha",
        documentId: null,
      });
    }
    if (c.ooc?.verifiedAt && c.ooc.verifiedBy) {
      rows.push({
        key: `ooc-${c.id}`,
        at: c.ooc.verifiedAt,
        actor: c.ooc.verifiedBy,
        actorField: "ooc.verifiedBy",
        module: "Customs",
        entity: c.ooc.oocNo,
        entityHref: `/awb/${c.awbId}?tab=customs`,
        action: `OOC verified against the SD — ${c.ooc.checks.length} fields`,
        site: c.site,
        source: "listClearances('HQ') · CustomsClearance.ooc.verifiedAt / verifiedBy",
        documentId: c.ooc.documentId,
      });
    }
  }

  /* --- Finance (FC-12 §11-P) ------------------------------------------ */
  for (const p of listPayments("HQ")) {
    rows.push({
      key: `pay-${p.id}`,
      at: p.paidAt,
      actor: p.receivedBy,
      actorField: "receivedBy",
      module: "Finance",
      entity: p.invoiceNo,
      entityHref: "/finance-manager/payment-reconciliation",
      action: `Payment ${p.mode} — ${formatPkr(p.amount)}${p.reconciled ? "" : ", not reconciled"}`,
      site: p.site,
      source: "listPayments('HQ') · PaymentRecord.paidAt / receivedBy",
      documentId: null,
    });
  }
  for (const w of listWaivers("HQ")) {
    rows.push({
      key: `wvr-${w.id}`,
      at: w.requestedAt,
      actor: w.requestedBy,
      actorField: "requestedBy",
      module: "Finance",
      entity: w.voucherNo,
      entityHref: "/finance-manager/waiver-workflow",
      action: `Waiver requested — ${w.reason}`,
      site: w.site,
      source: "listWaivers('HQ') · WaiverRequest.requestedAt / requestedBy",
      documentId: null,
    });
    for (const lvl of w.levels) {
      if (!lvl.decidedAt) continue;
      rows.push({
        key: `wvr-${w.id}-l${lvl.level}`,
        at: lvl.decidedAt,
        actor: lvl.approver,
        actorField: "levels[].approver",
        module: "Finance",
        entity: w.voucherNo,
        entityHref: "/finance-manager/waiver-workflow",
        action: `Waiver ${lvl.decision} at level ${lvl.level} (${lvl.role})`,
        site: w.site,
        source: "listWaivers('HQ') · WaiverRequest.levels[].decidedAt / approver",
        documentId: null,
      });
    }
  }

  /* --- Dispatch (FC-08) ------------------------------------------------ */
  for (const doRow of listDeliveryOrders("HQ")) {
    if (!doRow.issuedAt) continue;
    const gate = (doRow.gateSnapshot ?? []).filter((g) => g.applicable);
    rows.push({
      key: `do-${doRow.DoId}`,
      at: doRow.issuedAt,
      actor: doRow.issuedBy,
      actorField: "issuedBy",
      module: "Dispatch",
      entity: doRow.DONO,
      entityHref: "/dispatch/gate-out",
      action: gate.length
        ? `Delivery order issued — ${gate.filter((g) => g.pass).length} of ${gate.length} release conditions passed`
        : "Delivery order issued — no gate snapshot recorded on the row",
      site: doRow.site,
      source: "listDeliveryOrders('HQ') · DeliveryOrder.issuedAt / issuedBy",
      documentId: null,
    });
  }
  for (const gp of listGatePasses("HQ")) {
    rows.push({
      key: `gp-${gp.GATEPASSNO}`,
      at: gp.GATEPASSDATE,
      actor: gp.CreatedBy,
      actorField: "CreatedBy",
      module: "Dispatch",
      entity: gp.docNumber.value,
      entityHref: "/dispatch/gate-out",
      action: `Gate pass ${gp.status} — vehicle ${gp.VehicleNo}`,
      site: gp.site,
      source: "listGatePasses('HQ') · GatePass.GATEPASSDATE / CreatedBy",
      documentId: null,
    });
  }
  for (const pod of listPods("HQ")) {
    rows.push({
      key: `pod-${pod.id}`,
      at: pod.capturedAt,
      actor: pod.capturedBy,
      actorField: "capturedBy",
      module: "Dispatch",
      entity: pod.AWBNO,
      entityHref: `/awb/${pod.awbId}?tab=dispatch`,
      action: `POD captured — ${pod.piecesDelivered} of ${pod.piecesOnDo} pieces, CNIC ${pod.cnicMatchesDo ? "matched" : "MISMATCHED"}`,
      site: pod.site,
      source: "listPods('HQ') · ProofOfDelivery.capturedAt / capturedBy",
      documentId: null,
    });
  }

  /* --- Exceptions (FC-04, FC-10) -------------------------------------- */
  for (const c of listCdrs("HQ")) {
    rows.push({
      key: `cdr-${c.id}`,
      at: c.raisedAt,
      actor: c.raisedBy,
      actorField: "raisedBy",
      module: "Exceptions",
      entity: c.cdrRef,
      entityHref: "/exceptions/cdr",
      action: `CDR raised — ${c.type}, ${c.status}`,
      site: c.site,
      source: "listCdrs('HQ') · CDR.raisedAt / raisedBy",
      documentId: c.evidence.find((e) => e.documentId)?.documentId ?? null,
    });
  }
  for (const h of listHolds("HQ")) {
    rows.push({
      key: `hold-${h.site}-${h.SEQUENCE}`,
      at: h.Date,
      actor: h.CreatedBy,
      actorField: "CreatedBy",
      module: "Exceptions",
      entity: h.AWBNo,
      entityHref: "/exceptions/holds",
      action: `Hold placed — ${h.type}, by ${h.HeldBy}`,
      site: h.site,
      source: "listHolds('HQ') · HoldRecord.Date / CreatedBy",
      documentId: null,
    });
    if (h.ReleaseDateTime && h.ReleaseBy) {
      rows.push({
        key: `hold-rel-${h.site}-${h.SEQUENCE}`,
        at: h.ReleaseDateTime,
        actor: h.ReleaseBy,
        actorField: "ReleaseBy",
        module: "Exceptions",
        entity: h.AWBNo,
        entityHref: "/exceptions/holds",
        action: "Hold released",
        site: h.site,
        source: "listHolds('HQ') · HoldRecord.ReleaseDateTime / ReleaseBy",
        documentId: null,
      });
    }
  }

  /* --- Site administration (FC-12 §05) -------------------------------- */
  for (const d of listDelegations("HQ")) {
    rows.push({
      key: `dlg-${d.delegationId}`,
      at: d.CreatedDate,
      actor: d.CreatedBy,
      actorField: "CreatedBy",
      module: "Site administration",
      entity: d.delegationId,
      entityHref: "/hq/site-admins",
      action: `Delegation issued to ${d.username} over ${d.scope}`,
      site: d.scope,
      source: "listDelegations('HQ') · SiteAdminDelegation.CreatedDate / CreatedBy",
      documentId: null,
    });
    if (d.UpdatedDate && d.UpdatedBy) {
      rows.push({
        key: `dlg-upd-${d.delegationId}`,
        at: d.UpdatedDate,
        actor: d.UpdatedBy,
        actorField: "UpdatedBy",
        module: "Site administration",
        entity: d.delegationId,
        entityHref: "/hq/site-admins",
        action: d.IsActive
          ? `Delegation amended for ${d.username}`
          : `Authority withdrawn from ${d.username}`,
        site: d.scope,
        source: "listDelegations('HQ') · SiteAdminDelegation.UpdatedDate / UpdatedBy",
        documentId: null,
      });
    }
  }

  /* Newest first. The tie-break on `key` keeps the order deterministic when
     two records share a timestamp — several fixtures are generated on the
     same minute, and a sort that depends on input order is a diff waiting to
     happen. */
  return rows.sort((a, b) => {
    const delta = Date.parse(b.at) - Date.parse(a.at);
    return delta !== 0 ? delta : a.key.localeCompare(b.key);
  });
}

export interface TrailSpan {
  rows: number;
  newestDaysAgo: number | null;
  oldestDaysAgo: number | null;
  /**
   * Records whose timestamp is LATER than DEMO_NOW. Counted rather than
   * clipped: three OOC verification stamps in CUSTOMS_CLEARANCES are dated
   * three days after the demo instant, which is a fixture inconsistency and
   * exactly the sort of thing an audit screen should be the one to notice.
   * Silently filtering them would make this trail tidier and less true.
   */
  futureDated: number;
}

/**
 * The age of the trail, measured against DEMO_NOW. This is the honest
 * replacement for the "Last 30 days" subtitle the six tiles carried: a span is
 * computable from one snapshot, a trend is not.
 */
export function trailSpan(rows: TrailRow[]): TrailSpan {
  if (rows.length === 0) {
    return { rows: 0, newestDaysAgo: null, oldestDaysAgo: null, futureDated: 0 };
  }
  const now = Date.parse(DEMO_NOW);
  const ages = rows.map((r) => daysBetween(r.at, DEMO_NOW));
  return {
    rows: rows.length,
    newestDaysAgo: Math.min(...ages),
    oldestDaysAgo: Math.max(...ages),
    futureDated: rows.filter((r) => Date.parse(r.at) > now).length,
  };
}
