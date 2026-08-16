/**
 * P0-5 · The FC-12 module map and the FC-01…FC-18 flow walkthroughs.
 *
 * The sidebar is organised by persona, which is right for daily use but
 * makes a flow-based walkthrough impossible — FC-01 alone crosses eight
 * portals. This file gives the other two views:
 *
 *   • Module view    — FC-12's tiers and spines, with honest coverage
 *   • Flow walkthrough — each flowchart as an ordered list of screens
 *
 * FLOWS order is authoritative for navigation order: if step A links onward
 * to step B, B sits below A here and must sit below A in Sidebar.tsx. The
 * old "NOTHING IS DELETED" policy (Sidebar.tsx:70) is revoked — superseded
 * routes are deleted, not hidden, so every href below must resolve.
 *
 * Coverage is deliberately honest. A module that does not exist shows as
 * "not-started" rather than being quietly omitted — M26 Airmail is the
 * live example, three CMTS tables with no flowchart and no screen behind
 * them. FC-09 transhipment and FC-10-A mishandled cargo are no longer in
 * that category: both are built, and the coverage below says so.
 */

export type Coverage = "built" | "partial" | "stub" | "not-started";

export const COVERAGE_LABEL: Record<Coverage, string> = {
  built: "Built",
  partial: "Partial",
  stub: "Stub",
  "not-started": "Not started",
};

export const COVERAGE_STYLE: Record<Coverage, { bg: string; fg: string }> = {
  built: { bg: "#DCFCE7", fg: "#16A34A" },
  partial: { bg: "#FEF3C7", fg: "#D97706" },
  stub: { bg: "#F1F5F9", fg: "#64748B" },
  "not-started": { bg: "#FEE2E2", fg: "#DC2626" },
};

export type Tier = "tier1" | "tier2" | "messaging" | "exception" | "tier3";

export const TIER_LABEL: Record<Tier, string> = {
  tier1: "Tier 1 — Input",
  tier2: "Tier 2 — Core Processing",
  messaging: "Messaging Spine",
  exception: "Exception Spine",
  tier3: "Tier 3 — Output / Closure",
};

export interface ModuleDef {
  code: string;
  name: string;
  tier: Tier;
  coverage: Coverage;
  /** Which build phase owns bringing this to "built". */
  phase: string;
  /** Flowcharts this module implements. */
  flows: string[];
  screens: Array<{ label: string; href: string }>;
  /** What is missing, when coverage is not "built". */
  gap?: string;
}

export const MODULES: ModuleDef[] = [
  // ---- Tier 1: Input ----
  {
    code: "M01",
    name: "Flight & Airline Data",
    tier: "tier1",
    coverage: "built",
    phase: "P1-1 ✓",
    flows: ["FC-02"],
    screens: [
      { label: "Flight board", href: "/import/flights" },
      { label: "Manifest & IGM", href: "/import/manifest" },
      { label: "Demand forecast (planning)", href: "/planner/demand-forecast" },
    ],
    gap: "Flight board with pre-arrival message completeness and airline reference is live. Real SITA feed is a backend concern.",
  },
  {
    code: "M02",
    name: "Document Management",
    tier: "tier1",
    coverage: "built",
    phase: "P1-2 ✓",
    flows: ["FC-04", "FC-08", "FC-11"],
    screens: [
      { label: "Document repository", href: "/import/documents" },
      { label: "OCR intake workbench (scan point 1)", href: "/import/ocr-intake" },
      { label: "Authority letter OCR (scan point 2)", href: "/gate-entry/authority-letter-digitisation" },
    ],
    gap: "Repository, viewer and version history are live. No CMTS table — flagged as an AirVault addition for sign-off.",
  },
  {
    code: "M03",
    name: "AWB / MAWB / HAWB Indexing — HUB",
    tier: "tier1",
    coverage: "built",
    phase: "P0-3, P1-4, P1-7, P1-8 ✓",
    flows: ["FC-01", "FC-02"],
    screens: [
      { label: "AWB hub", href: "/awb/1" },
      { label: "AWB register", href: "/warehouse-manager/awb-detail" },
      { label: "Indexing workbench", href: "/import/indexing" },
      { label: "Consolidation & split", href: "/import/consolidation" },
      { label: "Arrival advice / NOA", href: "/import/arrival-advice" },
    ],
    gap: "All 64 IMPORTAWB columns render, legacy-only fields marked. Hub wires to the eight FC-12 modules.",
  },
  /*
   * M21–M26 carry P11-* phase codes, which the build plan does not yet list.
   * Phase 11 is the phase that owns FC-13…FC-18 — the six flows accepted
   * into scope after the flow review. Five of the six are already standing
   * in the demo as portals with no owning flow and no module code, which is
   * exactly how they went unreviewed; giving them a phase is what stops the
   * next reader concluding they are decoration. M26 is the exception and
   * keeps the plan's own P9-6, because airmail was always in the plan — it
   * is the flowchart that was missing, not the intent.
   */
  {
    code: "M21",
    name: "Planning & Capacity",
    tier: "tier1",
    coverage: "built",
    phase: "P11-1 ✓",
    flows: ["FC-13"],
    screens: [
      { label: "Planner home — published shift plan", href: "/planner" },
      { label: "Demand forecast", href: "/planner/demand-forecast" },
      { label: "Capacity dashboard", href: "/planner/capacity-dashboard" },
      { label: "Slot planner", href: "/planner/slot-planner" },
      { label: "Resource roster (read-only)", href: "/planner/resource-roster" },
    ],
    gap: "Covered: the demand line assembled off the pre-arrival messages rather than keyed, zone capacity with forecast inbound and a risk level, the slot grid with conflict detection, and the read-only crew/asset roster. No CMTS table behind any of it — planning is an AirVault addition and is flagged for sign-off on that basis. Establishment stays in HR (CEmployee / SHIFT, gap G10), and the roster's asset battery figures disagree with M23's; the fleet's own screens are the source.",
  },

  // ---- Tier 2: Core ----
  {
    code: "M04",
    name: "Cargo Receipt & Acceptance",
    tier: "tier2",
    coverage: "built",
    phase: "P1-6 ✓",
    flows: ["FC-01", "FC-02"],
    screens: [
      { label: "Cargo acceptance", href: "/import/acceptance" },
      { label: "Putaway", href: "/warehouse-manager/putaway" },
    ],
    gap: "All 32 IMPORTAWBDETAIL columns present incl. short-landing, part-receipt and damage. Weighing computes chargeable weight live.",
  },
  {
    code: "M05",
    name: "Storage & Warehouse Management",
    tier: "tier2",
    coverage: "partial",
    phase: "P2-1 … P2-5",
    flows: ["FC-03"],
    screens: [
      { label: "Storage map", href: "/warehouse-manager/storage-map" },
      { label: "Putaway", href: "/warehouse-manager/putaway" },
      { label: "Picking", href: "/warehouse-manager/picking" },
      { label: "Cold chain console", href: "/warehouse-manager/cold-chain" },
    ],
    gap: "Allocation is decorative — no class→subclass→location rules, and the logical/physical dual model is not modelled on screen.",
  },
  {
    code: "M06",
    name: "CDR / Exception Management",
    tier: "tier2",
    coverage: "built",
    phase: "P3-1 … P3-3",
    flows: ["FC-04"],
    screens: [
      { label: "Aging dashboard", href: "/exceptions/queue" },
      { label: "CDR workbench", href: "/exceptions/cdr" },
      { label: "Damage register", href: "/exceptions/damage" },
      { label: "Hold register (29-col)", href: "/exceptions/holds" },
    ],
    gap: "Covered. The §11 final action and the release workflow are click-through only — no backend to persist a decision. The warehouse-scoped exceptions queue is gone from this list: it was a superseded duplicate of the aging dashboard above, and FC-03 §C — its only other consumer — now points at /exceptions/queue too.",
  },
  {
    code: "M09",
    name: "Customs Clearance Tracking",
    tier: "tier2",
    coverage: "built",
    phase: "P4-1 … P4-4",
    flows: ["FC-06"],
    screens: [
      { label: "Gateway (PSW / WeBOC)", href: "/customs/gateway" },
      { label: "SD / GD filing", href: "/customs/filing" },
      { label: "Channels & OOC", href: "/customs/channels" },
      { label: "Detained cargo", href: "/customs/detained" },
      { label: "Customs work queue", href: "/customs/queue" },
      { label: "GD filing workbench (legacy screen)", href: "/cha/gd-filing-workbench" },
    ],
    gap: "Covered. The five pre-P4 screens still carry their own hard-coded mock data and have not been re-pointed at the domain model — see P4-5.",
  },
  {
    code: "M10",
    name: "Tariff & Billing Engine",
    tier: "tier2",
    coverage: "partial",
    phase: "P5-1, P5-2",
    flows: ["FC-07"],
    screens: [
      { label: "Tariff master editor", href: "/finance-manager/tariff-master-editor" },
      { label: "Multi-tariff engine", href: "/finance-manager/multi-tariff-engine" },
      { label: "Charges calculator (FC-07 §01–08)", href: "/billing/calculator" },
    ],
    gap: "Covered. The versioned Tariff Master editor (P5-1) is still the pre-P0 screen — see P5-1.",
  },
  {
    code: "M11",
    name: "Invoice / Payment / Waiver",
    tier: "tier2",
    coverage: "partial",
    phase: "P5-3 … P5-6",
    flows: ["FC-07"],
    screens: [
      { label: "Invoice generation", href: "/finance-manager/invoice-generation" },
      { label: "Waiver workflow", href: "/finance-manager/waiver-workflow" },
      { label: "Payment reconciliation", href: "/finance-manager/payment-reconciliation" },
      { label: "Godown rent voucher", href: "/billing/godown-rent" },
      { label: "Invoice, payment & waiver", href: "/billing/invoice" },
    ],
    gap: "Covered: GR voucher with GODOWNRENTDETAIL lines, the full payment block, duplicates, invoice, reconciliation queue and the waiver approval chain. Free-hand GR (FreeHandGR / ImportFreeHandedCalc) is still unmodelled.",
  },
  {
    code: "M12",
    name: "Delivery Order Management",
    tier: "tier2",
    coverage: "built",
    phase: "P5-7",
    flows: ["FC-07", "FC-08"],
    screens: [
      { label: "DO issuance & release gate", href: "/billing/delivery-order" },
      { label: "DO collection", href: "/cha/do-collection" },
      { label: "Pay & download DO", href: "/consignee/pay-do" },
    ],
    gap: "Covered. Issuance, the 39-column authorised-agent record and the five-condition release gate are built; BLK-10 keeps special-clearance conditional.",
  },
  {
    code: "M23",
    name: "Equipment & Lifter Fleet",
    tier: "tier2",
    coverage: "built",
    phase: "P11-3 ✓",
    flows: ["FC-15"],
    screens: [
      { label: "Lifter status & fit-for-duty", href: "/lifter-operator/lifter-status" },
      { label: "Task queue", href: "/lifter-operator/tasks" },
      { label: "Task detail & tag verification", href: "/lifter-operator/task-detail" },
      { label: "Handheld RFID scan", href: "/lifter-operator/rfid-scan" },
      { label: "Movement log", href: "/lifter-operator/movement-log" },
      { label: "RFID reader estate", href: "/rfid-integration" },
    ],
    gap: "Covered: sign-on to a named asset behind a fit-for-duty gate, the task queue, twice-verified RFID movement (matched / mismatch / duplicate), structured fault reporting where Out-of-service actually removes the asset from dispatch, and the per-piece movement log that gives FC-08 a chain of custody inside the shed. No CMTS equipment or telemetry table exists — the whole module is an AirVault addition.",
  },
  {
    code: "M26",
    name: "Airmail / Postal",
    tier: "tier2",
    coverage: "not-started",
    phase: "P9-6",
    flows: ["FC-18"],
    screens: [],
    gap: "Not built, and shown rather than omitted. Three CMTS tables — AIRMAILDELIVERYBILL (25 cols), AIRMAILTRANSFERMANIFEST (19), POMailType (3) — with no screen, no route and, until FC-18, no flowchart either. Two questions block it: BLK-01, there is no airmail rate in the tariff master, so charging under FC-07 versus contract-billing the Post Office is unresolved; and postal customs is not a Single Declaration regime, so FC-06 does not apply. FC-18 stays a specification until SAPS answer both.",
  },

  // ---- Messaging spine ----
  {
    code: "M07",
    name: "Messaging Engine",
    tier: "messaging",
    coverage: "built",
    phase: "P7-1",
    flows: ["FC-05"],
    screens: [
      { label: "IATA Cargo-IMP console", href: "/messaging/iata" },
      { label: "Customs messaging console", href: "/messaging/customs" },
    ],
    gap: "Covered: all 13 Cargo-IMP types with per-flight pre-arrival completeness and failure surfacing. The ULD builder has MOVED to M24 / FC-16 — UCM, SCM and LUC are not among these thirteen types, so listing the builder here claimed coverage M07 does not have. The two tracks join on the flight, never on the AWB, and the IMP console cross-links to M24 rather than absorbing it.",
  },
  {
    code: "M08",
    name: "Notification Engine",
    tier: "messaging",
    coverage: "built",
    phase: "P7-2, P7-3",
    flows: ["FC-05"],
    screens: [{ label: "Notifications & messaging", href: "/messaging/notifications" }],
    gap: "Covered: versioned Email/SMS/WhatsApp templates, dispatch history with delivery and read receipts, the 9-trigger map, and the 3 unwired FC-05 notifications surfaced as an explicit gap.",
  },
  {
    code: "M24",
    name: "ULD Management",
    tier: "messaging",
    coverage: "partial",
    phase: "P11-4",
    flows: ["FC-16"],
    screens: [
      { label: "ULD message builder", href: "/uld-message-builder" },
      { label: "Import ULDs", href: "/uld-message-builder/import-ulds" },
      { label: "UCM builder", href: "/uld-message-builder/ucm" },
      { label: "SCM stock check", href: "/uld-message-builder/scm" },
      { label: "LUC control receipts", href: "/uld-message-builder/luc" },
      { label: "Search", href: "/uld-message-builder/search" },
      { label: "Message log", href: "/uld-message-builder/message-log" },
    ],
    gap: "UCM / SCM / LUC are a second messaging track and are NOT among M07's thirteen Cargo-IMP types — the two join on the flight, never on the AWB, which is why this is a sibling of M07 rather than part of it. Import with per-row validation, the three builders, search and the message log with correction lineage are all built. Partial because the SCM condition list offers only “No Damage”, so a damaged or off-hire unit cannot be expressed and FC-16 §11 is a specification rather than a transcription.",
  },

  // ---- Exception spine ----
  {
    code: "M15",
    name: "Transhipment Management",
    tier: "exception",
    coverage: "built",
    phase: "P8-1, P8-2",
    flows: ["FC-09"],
    screens: [
      { label: "Bonded transhipment register", href: "/transhipment/register" },
      { label: "Inter-station handoff", href: "/transhipment/handoff" },
      { label: "Bonded area", href: "/storage/bonded" },
    ],
    gap: "Covered. AWBTRANSFER 25-col parity plus the permit, digital bond supervision and the HQ-synced inter-station handoff — none of which have a CMTS table.",
  },
  {
    code: "M16",
    name: "Re-export Management",
    tier: "exception",
    coverage: "built",
    phase: "P3-5",
    flows: ["FC-10"],
    screens: [
      { label: "Re-export console (FC-10-B)", href: "/exceptions/re-export" },
      { label: "CHA re-export / long-stay", href: "/cha/re-export-long-stay" },
    ],
    gap: "Covered: eight stages, PSW-primary filing, and the §B6-before-§B7 charge gate.",
  },
  {
    code: "M17",
    name: "Mishandled Cargo Management",
    tier: "exception",
    coverage: "built",
    phase: "P3-4",
    flows: ["FC-10"],
    screens: [{ label: "Mishandled cargo (FC-10-A)", href: "/exceptions/mishandled" }],
    gap: "Covered. Built with no CMTS table behind it — AWBTRANSFER cannot express this branch.",
  },
  {
    code: "M18",
    name: "Long-Stay / Auction / Disposal",
    tier: "exception",
    coverage: "built",
    phase: "P3-6",
    flows: ["FC-10"],
    screens: [
      { label: "Long-stay / Section 82", href: "/exceptions/long-stay" },
      { label: "Aging dashboard", href: "/exceptions/queue" },
    ],
    gap: "Covered. Per-site Section82Days remains open as BLK-07 — the demo applies one threshold everywhere.",
  },
  {
    code: "M22",
    name: "Ops Supervision & Workforce",
    tier: "exception",
    coverage: "built",
    phase: "P11-2 ✓",
    flows: ["FC-14"],
    screens: [
      { label: "Shift handover", href: "/operations-supervisor/shift-handover" },
      { label: "Live ops view", href: "/operations-supervisor/live-ops-view" },
      { label: "Escalation inbox", href: "/operations-supervisor/escalation-inbox" },
      { label: "MoM & floor notes", href: "/operations-supervisor/mom-floor-notes" },
      { label: "Performance console", href: "/operations-supervisor/performance-console" },
    ],
    gap: "Covered: the 40-field handover bounding the shift at both ends, the live ops board, the escalation inbox carrying source module / AWB / SLA deadline / evidence count with a timestamped decision trail, floor notes chased to closure, and the performance console. It sits above M06 as the human decision tier: the inbox routes rather than resolves, so an escalation closed here without the owning flow (FC-04 / FC-07 / FC-10 / FC-15) closing is abandonment, not resolution. No CMTS table — CEmployee / CDepartment / SHIFT (gap G10) supply establishment for the roster only.",
  },

  // ---- Tier 3: Output ----
  {
    code: "M13",
    name: "Gate Pass & Dispatch",
    tier: "tier3",
    coverage: "built",
    phase: "P6-1 … P6-3",
    flows: ["FC-08"],
    screens: [
      { label: "Gate pass & picking", href: "/dispatch/gate-pass" },
      { label: "Gate-out verification", href: "/dispatch/gate-out" },
      { label: "Vehicle entry", href: "/gate-entry/vehicle-entry" },
      { label: "Vehicle exit", href: "/gate-entry/vehicle-exit" },
      { label: "Live vehicle board", href: "/gate-entry/live-vehicle-board" },
      { label: "Picking", href: "/warehouse-manager/picking" },
    ],
    gap: "Covered: 43-column gate pass, RFID-verified pick session with the short-pick CDR route, and gate-out tag match plus release re-evaluation.",
  },
  {
    code: "M14",
    name: "POD Capture",
    tier: "tier3",
    coverage: "built",
    phase: "P6-4, P6-5",
    flows: ["FC-08"],
    screens: [{ label: "POD history (consignee view)", href: "/consignee/pod-history" }],
    gap: "Covered: six-item digital POD incl. geo (an AirVault addition with no CMTS column) and the evaluated closure checklist with Lock propagation.",
  },
  {
    code: "M19",
    name: "Reports & Dashboards",
    tier: "tier3",
    coverage: "partial",
    phase: "P10-6",
    flows: ["FC-12"],
    screens: [
      { label: "Reports", href: "/reports" },
      { label: "Auditor home", href: "/auditor" },
    ],
    gap: "A shell with sample charts rather than reports derived from the modules.",
  },
  {
    code: "M20",
    name: "Audit Trail & Archive",
    tier: "tier3",
    coverage: "partial",
    phase: "P10-5",
    flows: ["FC-12"],
    screens: [
      { label: "Audit trail browser", href: "/admin/audit-trail" },
      { label: "Session & event log", href: "/admin/event-log" },
      { label: "Cargo trace", href: "/auditor/cargo-trace" },
    ],
    gap: "No before/after diff (the CMTS XmlTesst pattern), no session drill-down, no per-record history.",
  },
  {
    code: "M25",
    name: "Finance ERP Bridge",
    tier: "tier3",
    coverage: "partial",
    phase: "P11-5",
    flows: ["FC-17"],
    screens: [
      { label: "ERP bridge & GL mapping", href: "/finance-manager/erp-bridge-mapping" },
      { label: "Integration health board", href: "/integration-status" },
    ],
    gap: "GL mapping per charge type, the push / skip / retry lifecycle and the verbatim ERP response against every sync record are built. Partial because the connector itself is not: the integration board reports “Connection refused — ERP endpoint unreachable”, awaiting VPN config. The bridge is outside the awarded contract scope and the screen says so — which is the reason FC-17 exists at all, so the optional integration has a defined edge rather than an implied one.",
  },
];

export const TIER_ORDER: Tier[] = ["tier1", "tier2", "messaging", "exception", "tier3"];

export function modulesByTier(tier: Tier): ModuleDef[] {
  return MODULES.filter((m) => m.tier === tier);
}

export function coverageSummary() {
  const by: Record<Coverage, number> = { built: 0, partial: 0, stub: 0, "not-started": 0 };
  for (const m of MODULES) by[m.coverage]++;
  return by;
}

/* ================================================================== *
 * Flow walkthroughs
 * ================================================================== */

export interface FlowStep {
  /** The flow's own step reference, e.g. "05a" or "B4". */
  ref: string;
  label: string;
  /** Where this step happens in the product; null when nothing implements it. */
  href: string | null;
  module: string;
  note?: string;
  /**
   * The swimlane this step sits in, for flows drawn as swimlane diagrams
   * (FC-02). Omitted on single-track flows, which render as a plain
   * sequence. Steps must stay in flow order — the renderer groups
   * consecutive runs, so a lane may legitimately appear more than once
   * where the flow crosses back into it.
   */
  lane?: string;
  /** True where the flow draws this node as a decision diamond. */
  decision?: boolean;
}

export interface FlowDef {
  id: string;
  title: string;
  subtitle: string;
  /** From the FigJam title block. */
  docNo: string;
  rev: string;
  steps: FlowStep[];
  /** The AirVault amendment, summarised. */
  amendment: string;
}

export const FLOWS: FlowDef[] = [
  {
    id: "FC-01",
    title: "Master End-to-End Air Cargo Flow",
    subtitle: "The complete cargo lifecycle from airline handover to file closure",
    docNo: "SAPS-ACMS-FC-01",
    rev: "Rev 2.0",
    amendment:
      "Step 05 becomes OCR-assisted intake (05a–05f): scan → auto-extract line items with per-item confidence → operator accepts/corrects → capture declared (OCR) vs physical (received) → commit. A variance ≥ tolerance raises a CDR directly (FC-04). A4: step 22 splits — 22b the terminal issues the DO after payment clears and all five release conditions pass as an AND, and 22a is where the CHA collects the issued DO. The “requested after the NOA” reading of 22a is retired: its screen is /cha/do-collection, whose queue opens at “DO Ready” and runs DO Ready → Driver Assigned → Vehicle Assigned → Scheduled → Collected. There is no requested state on it, so 22a cannot precede the issuance it collects, and it now sits below 22b. A5: the duplicated orphan “08 Discrepancy Found?” / “SB3” pair with its self-referencing Yes edge is deleted; one diamond survives. A6: the §14 → §08 back-edge is deleted — a weighing or condition discrepancy at §14 raises a CDR at §14a instead of rewinding past indexation, tagging, split and segregation.",
    steps: [
      { ref: "01–04", label: "Handover, pouch opening", href: "/import/flights", module: "M01" },
      { ref: "05", label: "Document verification (OCR intake 05a–05f)", href: "/import/ocr-intake", module: "M02" },
      { ref: "06", label: "AWB summary preparation", href: "/import/summary", module: "M03" },
      { ref: "07–08", label: "Manifest reconciliation → discrepancy found?", href: "/import/manifest", module: "M03", decision: true, note: "A5 — the single authoritative diamond. The duplicated 08/SB3 pair with the self-referencing Yes edge is deleted from the board. Yes → CDR (FC-04); No → §09 indexation." },
      { ref: "09", label: "Indexation & classification", href: "/import/indexing", module: "M03" },
      { ref: "10", label: "Piece-level tagging (barcode / RFID)", href: "/storage/rfid-binding", module: "M05" },
      { ref: "11–12", label: "Split identification, segregation", href: "/import/consolidation", module: "M03" },
      { ref: "13–14", label: "Acceptance, weighing & condition check", href: "/import/acceptance", module: "M04", note: "A6 — a weight or condition discrepancy here raises a CDR directly at §14a. The §14 → §08 back-edge is deleted: its No exit dropped at §09, so clearing a discrepancy re-ran tagging, split, segregation and acceptance." },
      { ref: "14a", label: "Weighing / condition discrepancy → CDR raised (FC-04)", href: "/exceptions/cdr", module: "M06", note: "A6 — the replacement for the deleted §14 → §08 rewind. The discrepancy is recorded once, against the AWB, and the spine carries on rather than restarting." },
      { ref: "15–16", label: "Storage allocation, data capture", href: "/storage/allocation", module: "M05" },
      { ref: "17", label: "IATA messaging (ARR / RCF / NFD)", href: "/messaging/iata", module: "M07" },
      { ref: "18", label: "Notice of Arrival to consignee / CHA", href: "/import/arrival-advice", module: "M08" },
      { ref: "19", label: "Customs clearance tracking", href: "/customs/channels", module: "M09" },
      { ref: "20–21", label: "Charges calculation, invoice", href: "/billing/calculator", module: "M10" },
      { ref: "21a", label: "Godown rent voucher issued", href: "/billing/godown-rent", module: "M11", note: "A10 — this is where FC-07 ends. Everything below is FC-01/M12 and beyond." },
      { ref: "22b", label: "DO issued by the terminal — after payment + the five-condition release gate", href: "/billing/delivery-order", module: "M12", note: "A4/A11 — the issue half of old step 22. Gated on the AND of OOC verified against the SD · AWB authority verified · DO charges paid · cargo not on hold · special clearance completed. evaluateReleaseGate() in lib/domain/finance.ts." },
      /*
       * §22a moved below §22b. It was drawn above §19 customs as the "request"
       * half of the split, but its screen is /cha/do-collection, a collection
       * queue whose first state is "DO Ready" — an already-issued DO awaiting a
       * driver. Collection cannot precede issuance, and FC-02 §33 and FC-08 §01
       * both put the same act after the DO exists.
       */
      { ref: "22a", label: "DO collected by the CHA / consignee — driver and vehicle assigned against the issued DO", href: "/cha/do-collection", module: "M12", note: "A4 — the collection half of old step 22, and it follows §22b issuance. The queue runs DO Ready → Driver Assigned → Vehicle Assigned → Scheduled → Collected; nothing on it raises a request. Collecting does not release cargo either — release is the gate-out re-check at §24." },
      { ref: "23", label: "Gate pass", href: "/dispatch/gate-pass", module: "M13" },
      { ref: "24", label: "Physical delivery / dispatch", href: "/dispatch/gate-out", module: "M13" },
      { ref: "25–26", label: "POD capture, DLV message", href: "/dispatch/closure", module: "M14" },
      { ref: "27", label: "AWB closure / file archive", href: "/dispatch/closure", module: "M20" },
    ],
  },
  {
    id: "FC-02",
    title: "Import Cargo Detailed Flow",
    subtitle:
      "The import journey across six swimlanes — airline, terminal, documentation, customs, finance, consignee",
    docNo: "SAPS-ACMS-FC-02-02",
    rev: "Rev 2.0",
    amendment:
      "Documentation intake is OCR-assisted: scan MAWB / HAWB → per-item extract (item, category, qty, vol, wt) with confidence → operator accepts or corrects each item before the AWB summary sheet, MAWB/HAWB verification and indexation. Declared (OCR) vs physical count from the terminal lane raises a CDR (FC-04). Cargo classification (class / subclass) is set at Indexation, not later. OCR is limited to the two scan points — inbound MAWB/HAWB here, and the receiver's documents at collection; every other capture on this flow is a keyed form.",
    // Ordered by the diagram's connectors, not lane by lane — FC-02 crosses
    // lanes seven times and reading it lane-first misstates the sequence.
    // The terminal's physical track (15–18) and the documentation track
    // (11–14) both hang off "Manifest checked" and run concurrently; they
    // rejoin where the warehoused location is captured against the AWB.
    steps: [
      /*
       * §00 is upstream of the flight itself: the forwarding agent's digital
       * pre-lodgement carries the scheduled arrival, so it is submitted before
       * §01 notifies that arrival. It is the electronic alternative to the
       * pouch §06a scans, and its piece matrix is the declared count that §11
       * physically counts against.
       */
      { lane: "Consignee / CHA", ref: "00", label: "AWB pre-lodged digitally by the forwarding agent — MAWB / HAWB, flight & routing, piece matrix, documents, payment intent", href: "/forwarding-agent/awb-entry-digital", module: "M03", note: "Five-section wizard with per-step validation, ending in “Submit to SAPS”. Optional path — a shipment that arrives on paper joins the flow at §01 and is captured by OCR at §06a instead." },

      { lane: "Airline / Carrier", ref: "01", label: "Flight arrival notification", href: "/import/flights", module: "M01" },
      { lane: "Airline / Carrier", ref: "02", label: "FFM / FWB / FHL received", href: "/messaging/iata", module: "M07" },
      { lane: "Airline / Carrier", ref: "03", label: "Cargo + flight pouch (concertina) handed over to terminal", href: "/import/flights", module: "M01" },

      { lane: "Cargo Terminal / Warehouse", ref: "04", label: "Cargo received in import section", href: "/import/acceptance", module: "M04" },
      { lane: "Cargo Terminal / Warehouse", ref: "05", label: "Pouch / concertina opened", href: "/import/flights", module: "M01" },
      { lane: "Cargo Terminal / Warehouse", ref: "06", label: "Manifest checked", href: "/import/manifest", module: "M03" },

      { lane: "Documentation — OCR intake", ref: "06a", label: "OCR scan — MAWB / HAWB off the pouch", href: "/import/ocr-intake", module: "M02", note: "Scan point 1 of 2. Scanner source, not a file upload." },
      { lane: "Documentation — OCR intake", ref: "06b", label: "Auto-extract line items (item, category, qty, vol, wt) with confidence", href: "/import/ocr-intake", module: "M02" },
      { lane: "Documentation — OCR intake", ref: "06c", label: "All items accepted? (confidence ≥ threshold & operator-confirmed)", href: "/import/ocr-intake", module: "M02", decision: true },
      { lane: "Documentation — OCR intake", ref: "06d", label: "Operator corrects low-confidence items individually", href: "/import/ocr-intake", module: "M02", note: "Loops back to 06c until every item clears." },

      { lane: "Documentation", ref: "07", label: "AWB summary sheet prepared", href: "/import/summary", module: "M03" },
      { lane: "Documentation", ref: "08", label: "MAWB / HAWB verified", href: "/import/summary", module: "M03" },
      { lane: "Documentation", ref: "09", label: "Indexation completed", href: "/import/indexing", module: "M03", note: "Cargo class / subclass is set here — not later. FC-03 allocation depends on it." },
      { lane: "Documentation", ref: "10", label: "AirVault AWB record created", href: "/awb/1", module: "M03", note: "B5 — AirVault is the system of record. CMTS keeps its name only where it denotes the legacy system being migrated from." },

      { lane: "Cargo Terminal / Warehouse", ref: "11", label: "Cargo physically counted & weighed", href: "/import/acceptance", module: "M04", note: "Physical count vs the OCR-declared count at 06b — variance raises a CDR (FC-04)." },
      { lane: "Cargo Terminal / Warehouse", ref: "12", label: "Cargo inspected", href: "/import/acceptance", module: "M04" },
      { lane: "Cargo Terminal / Warehouse", ref: "13", label: "Cargo sorted", href: "/import/acceptance", module: "M04" },
      { lane: "Cargo Terminal / Warehouse", ref: "14", label: "Cargo warehoused in designated areas", href: "/storage/allocation", module: "M05", note: "System-suggested rack/bin by class + subclass (FC-03), confirmed by scan." },

      { lane: "Documentation", ref: "15", label: "Storage location captured", href: "/storage/allocation", module: "M05" },
      { lane: "Documentation", ref: "16", label: "Status updated", href: "/awb/1", module: "M03" },
      { lane: "Documentation", ref: "17", label: "Messages triggered — RCF on warehousing", href: "/messaging/iata", module: "M07", note: "A7 — RCF fires here. NFD no longer fires off the racking event; it follows the NOA at §30a. NOA to the consignee is §30, not §22, and §30 is drawn immediately below this node rather than after the finance lane." },

      /*
       * §30 / §30a moved up from below §29. §18 GD filing is the CHA's act, and
       * the CHA is only brought into the shipment by the NOA — FC-06 states the
       * order outright (§01 NOA → §02 CHA collects documents → §03 SD filed) and
       * FC-01 does too. Drawn after §29 the consignee was paying at §29 for a
       * shipment it was first told about at §30. §30a travels with §30 because
       * A7 wires NFD to the NOA's own issue event (warehoused → NOA → NFD).
       */
      { lane: "Consignee / CHA", ref: "30", label: "NOA received", href: "/consignee/notice-of-arrival", module: "M08", note: "The receipt surface, not the issue surface: notice status Unread / Read / Action Required / Resolved, free-period expiry countdown, documents-required list and a recommended action. /import/arrival-advice is the terminal issuing it — FC-05 §03 and FC-06 §01." },
      { lane: "Consignee / CHA", ref: "30a", label: "NFD — Notified for Delivery sent (fires after the NOA)", href: "/messaging/iata", module: "M07", note: "A7 — moved off the cargo-warehoused trigger. TRIGGER_MAP in lib/domain/messaging.ts owns the wiring." },

      { lane: "Customs / Agencies", ref: "18", label: "GD filed in PSW / WeBOC", href: "/customs/filing", module: "M09", note: "SD replaces GD; PSW primary, WeBOC parallel-run. Reached from §30 — the CHA files against the NOA it has just received." },
      { lane: "Customs / Agencies", ref: "19", label: "Customs channel assigned", href: "/customs/channels", module: "M09" },
      { lane: "Customs / Agencies", ref: "20", label: "Risk channel — Green / Yellow / Red?", href: "/customs/channels", module: "M09", decision: true, note: "A8 — the third channel is Red (physical examination + sampling). “Normal” is retired. Yellow and Red were absent from this lane entirely; all three edges now exist." },
      { lane: "Customs / Agencies", ref: "21", label: "ANF / ASF clearance if required", href: "/customs/channels", module: "M09" },
      { lane: "Customs / Agencies", ref: "22", label: "OOC issued", href: "/customs/channels", module: "M09", note: "Fetched from PSW, or keyed from the print when the gateway is down, then verified field-by-field against the SD." },

      { lane: "Finance / Billing", ref: "23", label: "Storage clock reads the intake timestamp (§04 receipt / §11 count)", href: "/billing/godown-rent", module: "M11", note: "A3 — the clock STARTS at intake. Finance reads that timestamp; it does not set it. The board's “general & pharma only” annotation is a free-period rule, not a clock rule: the clock runs for every class, and the class decides how many free days precede the chargeable period at §24." },
      { lane: "Finance / Billing", ref: "24", label: "Free / grace period applied → chargeable days = dwell − free", href: "/billing/calculator", module: "M10", note: "A3 — free period follows the clock start. chargeableDays = max(0, totalDays − freeDays) + supplementDays, calculateCharges() in lib/domain/finance.ts." },
      { lane: "Finance / Billing", ref: "25", label: "Chargeable weight calculated", href: "/billing/calculator", module: "M10" },
      { lane: "Finance / Billing", ref: "26", label: "Tariff applied", href: "/billing/calculator", module: "M10", note: "The tariff master IS versioned — /finance-manager/tariff-master-editor carries TariffVersion with effectiveFrom / effectiveTo, status, createdBy and approvedBy, and the calculator stores tariffVersion on the calculation rather than looking it up at render, so a rate change cannot restate historic invoices. The version in force is resolved at FC-07 §07a. This note previously asserted the opposite; it was stale." },
      { lane: "Finance / Billing", ref: "27", label: "Invoice generated", href: "/billing/invoice", module: "M10" },
      { lane: "Finance / Billing", ref: "28", label: "Adjustment / waiver if required", href: "/billing/invoice", module: "M10", note: "Role & rights restricted, per the flow's own annotation." },
      { lane: "Finance / Billing", ref: "29", label: "Payment received", href: "/billing/invoice", module: "M10" },

      { lane: "Consignee / CHA", ref: "31", label: "Documents submitted", href: "/gate-entry/authority-letter-digitisation", module: "M13", note: "Scan point 2 of 2 — the receiver's documents are scanned and OCR'd at collection." },
      { lane: "Consignee / CHA", ref: "32", label: "Charges paid", href: "/consignee/pay-do", module: "M10", note: "The consignee's own gateway journey — “Payment initiated. Redirecting to gateway…” → Payment Successful / Payment Failed with a transaction reference. /billing/invoice is the terminal's ledger view of the same event at §29." },
      { lane: "Consignee / CHA", ref: "33", label: "DO collected", href: "/cha/do-collection", module: "M12", note: "Re-pointed at the collecting party's own queue — DO Ready → Driver Assigned → Vehicle Assigned → Scheduled → Collected. /billing/delivery-order is the terminal issuing the DO." },
      { lane: "Consignee / CHA", ref: "33a", label: "Pickup slot booked — eligibility checked (OOC · charges · DO issued · no hold), driver and vehicle nominated", href: "/consignee/schedule-pickup", module: "M12", note: "The join into FC-13 §06: the booking runs on the planner's slot grid, so a slot the planner has blocked is refused here. The forwarding agent books the same slot from /forwarding-agent/pickup-scheduling — one action, two surfaces, not two steps." },

      /*
       * §36 moved up from the end of the flow to sit between §33 and §34. It is
       * gate-out — the terminal authorising the cargo to leave — so it has to
       * precede the collection it authorises and the POD signed at handover.
       * FC-08 orders the same three events §11 gate-out → §12 POD → §14
       * delivered, and FC-01 runs §24 dispatch → §25–26 POD.
       */
      { lane: "Cargo Terminal / Warehouse", ref: "36", label: "Cargo released after DO", href: "/dispatch/gate-out", module: "M13", note: "Gate-out matches the RFID tag to the gate pass + DO and auto-checks OOC, charges paid and no-hold." },

      { lane: "Consignee / CHA", ref: "34", label: "Cargo collected", href: "/dispatch/gate-out", module: "M13" },
      { lane: "Consignee / CHA", ref: "35", label: "POD signed", href: "/dispatch/closure", module: "M14" },
      { lane: "Consignee / CHA", ref: "35a", label: "POD retrieved by the consignee; delivery dispute raised against the signed POD", href: "/consignee/pod-history", module: "M14", note: "The dispute is the step that exists nowhere else — reason, 500-character description, evidence upload and an evidence bundle download. FC-08's closure has no post-delivery challenge path without it." },
    ],
  },
  {
    id: "FC-03",
    title: "Cargo Classification & Storage Allocation",
    subtitle: "How cargo is routed to the correct storage zone by handling code",
    docNo: "SAPS-ACMS-FC-03-02",
    rev: "Rev 2.0",
    amendment:
      "Allocation is system-driven: the system suggests rack/bin by class + subclass + capacity using CARGOSUBCLASSLOCATION rules, validates availability, offers overflow, then binds the RFID tag to the location with putaway confirmed by scan. A1: the Pharma → Dangerous Goods edge is deleted. Pharma (PHR) is a GDP cold-chain class, not a DG class; routing it into the DGR segregated store is a handling error. PHR joins the special-handling roster with its own destination — Cold Chain Storage in the COL/CRT band.",
    steps: [
      { ref: "—", label: "Cargo classified by handling code", href: "/awb/1", module: "M03" },
      { ref: "—", label: "Class / subclass set at intake", href: "/awb/1?tab=intake", module: "M03" },
      { ref: "—", label: "System suggests rack / bin", href: "/warehouse-manager/putaway", module: "M05", note: "Rules engine is P2-1/P2-2" },
      { ref: "—", label: "Location valid & available?", href: "/warehouse-manager/storage-map", module: "M05" },
      { ref: "A", label: "General / Normal zones (GCR, AFU, ICG, UAB)", href: "/warehouse-manager/storage-map", module: "M05" },
      { ref: "B", label: "Special handling — DGR, PER, VAL, AVI, HUM, AOG, DIP, VUN, PHR", href: "/warehouse-manager/storage-map", module: "M05", note: "A1 — DGR routes to the segregated DG store, not to cold chain. PHR is on the roster but does NOT share DGR's destination; see §B-COL." },
      { ref: "B-COL", label: "Pharma (PHR) / temperature-controlled → Cold Chain Storage (COL/CRT, 2–8 °C)", href: "/warehouse-manager/cold-chain", module: "M05", note: "A1 — Pharma routes to cold chain, NOT to Dangerous Goods. lib/domain/masters.ts already models class 13 Pharmaceuticals (PHR) → subclass “Pharma — GDP” → Pharma Store, band 2–8 °C. The board was wrong and the code was right." },
      { ref: "C", label: "Controlled / exception zones", href: "/exceptions/queue", module: "M06" },
      /*
       * The bind step moved to the foot of the array. §A, §B, §B-COL and §C are
       * the branch outcomes of "System suggests rack / bin" and "Location valid
       * & available?" — they are what resolves the location. The bind names a
       * location, so it cannot run above the branch that chooses one, and drawn
       * there it left all four destinations dangling below it. FC-15 gives the
       * real order: §06 tag matched → §07 pickup → §08 drop-off scanned at the
       * destination → §08a binding written back to storage. Binding is the last
       * act of putaway, not the first.
       */
      { ref: "—", label: "Bind RFID tag → location; confirm by scan", href: "/lifter-operator/rfid-scan", module: "M05", note: "Binding is P2-4. Same event as FC-15 §08a — one scan, one record; FC-02 §14 warehoused → §15 storage location captured says the same." },
    ],
  },
  {
    id: "FC-04",
    title: "CDR / Discrepancy Handling Flow",
    subtitle: "Identification through evidence capture to final action",
    docNo: "SAPS-ACMS-FC-04-02",
    rev: "Rev 2.0",
    amendment:
      "CDR is variance-driven: declared-vs-physical variance ≥ tolerance auto-raises it. Evidence is a digital pack (scan/photos, RFID/AWB-linked, timestamped) rather than remarks-only. CDR numbering continues the CMTS sequence. A2: FC-04 gains a second entry point at handover — piece-count mismatch, cargo unavailable and damage found at the condition check all route here. As drawn on FC-08 those three edges terminated with no route out of the system.",
    steps: [
      { lane: "Entry decision", ref: "—", label: "Variance flagged at intake / acceptance (FC-01/02 declared vs physical)", href: "/import/ocr-intake", module: "M04" },
      { lane: "Entry decision", ref: "—", label: "Declared vs physical variance ≥ tolerance?", href: "/exceptions/cdr", module: "M06", decision: true },
      { lane: "Entry decision", ref: "—", label: "No → continue normal flow, no CDR raised", href: "/exceptions/cdr", module: "M06", note: "The No edge leaves no record behind, so the near-misses are listed on the workbench — otherwise there is no way to tell the rule ran from the rule being off." },
      { lane: "Entry decision", ref: "—", label: "Handover-time entry (FC-08 §07–09): cargo unavailable · piece-count mismatch · damage at condition check", href: "/warehouse-manager/picking", module: "M06", note: "A2 — all three FC-08 verification failures land here. Previously “Piece Count Matched?” had a Yes edge only, “Cargo Available? → No” terminated, and the condition check had no decision at all." },

      { lane: "Identify & evidence", ref: "01", label: "Discrepancy identified", href: "/exceptions/cdr", module: "M06", note: "Auto-raised when variance ≥ tolerance — no operator required." },
      { lane: "Identify & evidence", ref: "02", label: "Type of discrepancy selected (9 types)", href: "/exceptions/cdr", module: "M06", note: "Shortage · Overage · Damage · Leakage/Wet · Tampering · Pilferage · Missing Documents · Wrong Weight · Misrouted." },
      { lane: "Identify & evidence", ref: "03", label: "Capture evidence (6 items)", href: "/exceptions/cdr", module: "M06", note: "Photos · weight · piece count · package condition · seal condition · remarks." },
      { lane: "Identify & evidence", ref: "03a", label: "Digital evidence pack — RFID / AWB-linked, timestamped, attached (M02)", href: "/import/documents", module: "M02", note: "The amendment: a pack, not remarks-only as in CMTS." },
      { lane: "Identify & evidence", ref: "03b", label: "Damage recorded (DamageDetail)", href: "/exceptions/damage", module: "M06", note: "Not every damage finding escalates to a CDR." },

      { lane: "Raise & notify", ref: "04", label: "Create CDR in AirVault", href: "/exceptions/cdr", module: "M06" },
      { lane: "Raise & notify", ref: "05", label: "Assign CDR reference number", href: "/exceptions/cdr", module: "M06", note: "Continues the CMTS sequence — doc-numbering continuity." },
      { lane: "Raise & notify", ref: "06", label: "Notify airline representative", href: "/messaging/notifications", module: "M08" },
      { lane: "Raise & notify", ref: "07", label: "Notify customs if required", href: "/messaging/notifications", module: "M08" },
      { lane: "Raise & notify", ref: "08", label: "Send DIS status message", href: "/messaging/iata", module: "M07", note: "§10's No edge returns here — the DIS is re-sent on every escalation round, to a higher authority each time." },
      { lane: "Raise & notify", ref: "09", label: "Move cargo to discrepancy / quarantine hold", href: "/exceptions/holds", module: "M05" },

      { lane: "Instruction loop", ref: "10", label: "Instruction received?", href: "/exceptions/cdr", module: "M06", decision: true, note: "No → keep on hold / escalate, back to §08. Rounds are recorded individually; a chase nobody can date is not evidence of chasing." },
      { lane: "Instruction loop", ref: "11", label: "Final action", href: "/exceptions/cdr", module: "M06", decision: true },
      { lane: "Instruction loop", ref: "F1", label: "Release after correction", href: "/exceptions/cdr", module: "M06", note: "Closes inside FC-04 — rejoins the main flow at FC-07 charging." },
      { lane: "Instruction loop", ref: "F2", label: "Adjust pieces / weight", href: "/exceptions/cdr", module: "M06", note: "Closes inside FC-04 — the adjusted basis re-drives the FC-07 charge." },
      { lane: "Instruction loop", ref: "F3", label: "Forward as mishandled → FC-10-A", href: "/exceptions/mishandled", module: "M17" },
      { lane: "Instruction loop", ref: "F4", label: "Re-export → FC-10-B", href: "/exceptions/re-export", module: "M16" },
      { lane: "Instruction loop", ref: "F5", label: "Claim / liability process", href: "/exceptions/cdr", module: "M06", note: "No demo module — carrier liability claims are flagged on the module map." },

      { lane: "Closure", ref: "12", label: "Close CDR", href: "/exceptions/cdr", module: "M06", note: "Gated: evidence measured, airline notified, DIS sent, instruction received, final action selected. Closing short of that is abandonment, not resolution." },
    ],
  },
  {
    id: "FC-05",
    title: "Messaging & Notification Flow",
    subtitle:
      "IATA Cargo-IMP messages and customer notifications, event-triggered off the operational spine",
    docNo: "SAPS-ACMS-FC-05-02",
    rev: "Rev 2.0",
    amendment:
      "Event-driven auto-dispatch off the operational triggers rather than manual send. Multi-channel customer notification (Email / SMS / WhatsApp) with versioned templates and delivery/read receipts; IATA messages go out over SITA. A7: the four unwired nodes are wired — TGC ← ground-custody handover, Free Period Expiry ← the FC-07 dwell clock, Customs Hold ← the FC-06 hold register, Payment Due ← M11 invoicing — taking the board's nine triggers to fourteen. NFD now fires off the NOA's own issue event rather than off the cargo-warehoused racking event, so the real order is warehoused → NOA → NFD. UCM / SCM / LUC are ULD messages and sit outside FC-05's thirteen types — they belong to FC-16.",
    steps: [
      { lane: "Pre-arrival (inbound)", ref: "A1", label: "FFM / FWB / FHL / NOTOC received from the carrier", href: "/messaging/iata", module: "M07", note: "Per-flight pre-arrival completeness is scored on the flight board (M01)." },

      { lane: "Trigger bus", ref: "T", label: "Fourteen operational triggers raised by the modules", href: "/messaging/notifications", module: "M08", note: "TRIGGER_MAP in lib/domain/messaging.ts. Array order is load-bearing — it is rendered as the flow's running order." },

      { lane: "Operational status (outbound)", ref: "01", label: "Cargo received → RCF", href: "/messaging/iata", module: "M07" },
      { lane: "Operational status (outbound)", ref: "02", label: "Cargo warehoused → NOA raised to the consignee", href: "/storage/allocation", module: "M07", note: "A7 — NFD no longer fires here. The racking event raises the NOA; the NFD acknowledging it fires at §04." },
      { lane: "Operational status (outbound)", ref: "03", label: "NOA issued to consignee / CHA", href: "/import/arrival-advice", module: "M08" },
      { lane: "Operational status (outbound)", ref: "04", label: "NFD — Notified for Delivery (fires off the noa-issued trigger)", href: "/messaging/iata", module: "M07", note: "A7 — moved off the cargo-warehoused trigger onto the NOA's own issue event." },
      { lane: "Operational status (outbound)", ref: "05", label: "Docs missing → AWD + Missing Document Alert", href: "/import/documents", module: "M08" },
      { lane: "Operational status (outbound)", ref: "06", label: "Discrepancy raised → DIS (FC-04 §08)", href: "/exceptions/cdr", module: "M07", note: "Re-sent on every escalation round, to a higher authority each time." },
      { lane: "Operational status (outbound)", ref: "07", label: "Payment + OOC + DO ready → DO Ready Alert", href: "/billing/delivery-order", module: "M08" },
      { lane: "Operational status (outbound)", ref: "08", label: "POD captured → DLV + Delivery Completed Alert", href: "/dispatch/closure", module: "M07" },
      { lane: "Operational status (outbound)", ref: "09", label: "Transfer cargo accepted → RCT", href: "/transhipment/register", module: "M07" },
      { lane: "Operational status (outbound)", ref: "10", label: "Transfer to carrier → TFD", href: "/transhipment/register", module: "M07" },
      { lane: "Operational status (outbound)", ref: "11", label: "Onward flight departed → DEP", href: "/transhipment/register", module: "M07" },

      { lane: "Newly wired (A7)", ref: "12", label: "Ground-custody handover → TGC", href: "/import/acceptance", module: "M07", note: "A7 — TGC sat in STATUS_MESSAGES with no producer; it now has one." },
      { lane: "Newly wired (A7)", ref: "13", label: "Free-period boundary crossed (FC-07 dwell clock) → Free Period Expiry Alert", href: "/billing/calculator", module: "M08", note: "A7 — sourced off the M10 dwell clock (FC-07 §02–03). UNWIRED_NOTIFICATIONS is now empty." },
      { lane: "Newly wired (A7)", ref: "14", label: "Customs hold placed (FC-06) → Customs Hold Alert", href: "/exceptions/holds", module: "M08", note: "A7 — sourced off the M06 hold register (HOLDINGSTATUS)." },
      { lane: "Newly wired (A7)", ref: "15", label: "Invoice issued / due date approaching → Payment Due Alert", href: "/billing/invoice", module: "M08", note: "A7 — sourced off M11 invoicing, and sits below the free-period trigger because the charge only becomes payable once the free period has run out." },

      { lane: "Dispatch & receipts", ref: "16", label: "Channel + template version resolved (Email / SMS / WhatsApp)", href: "/messaging/notifications", module: "M08" },
      { lane: "Dispatch & receipts", ref: "17", label: "Dispatched; delivery and read receipts recorded, failures surfaced for retry", href: "/messaging/notifications", module: "M08" },
      { lane: "Dispatch & receipts", ref: "17a", label: "Recipient opens the notification — read receipt raised, action taken or resolved from the inbox", href: "/forwarding-agent/notifications-history", module: "M08", note: "The producer of the read receipt §17 records. The inbox also jumps straight out to payment and pickup scheduling, so a notification is where the recipient's next act starts." },
      /*
       * §18 is the carrier side of "failures surfaced for retry". §17 hrefs at
       * /messaging/notifications, which is the customer-notification channel;
       * a carrier gateway refusing traffic is triaged per message, not per
       * customer, and that console is /messaging/customs.
       */
      { lane: "Dispatch & receipts", ref: "18", label: "Carrier message failure triage — airline, carrier reference, retry count, error and raw payload per message", href: "/messaging/customs", module: "M07", note: "The message-level question, where /messaging/iata answers the flight-level one. It carries four dimensions the canonical IataMessage model has no field for — airline, carrier reference, retry count and a per-message audit trail — plus ARR and FIW, two live types outside FC-05's canonical thirteen." },
    ],
  },
  {
    id: "FC-06",
    title: "Pakistan Customs Clearance Flow",
    subtitle: "NOA through risk channel and duty to out-of-charge",
    docNo: "SAPS-ACMS-FC-06-02",
    rev: "Rev 2.0",
    amendment:
      "PSW (Pakistan Single Window) is primary, WeBOC legacy/parallel-run — build behind a provider-abstracted customs gateway. Single Declaration (SD) replaces GD. SD status, risk channel and OOC are fetched electronically. OOC is fetched from PSW — or keyed from the print when the gateway is down — and verified field-by-field against the SD; the reconciliation is the control, not the capture. A8: the three risk channels are Green / Yellow / Red — “Normal” is retired and BLK-03 closes with it. Step 08 splits accordingly: 08a captures the OOC, 08b reconciles it against the SD, and it is 08b that gates release. Issuance alone does not release cargo — the direct “OOC issued → eligible for release” edge is deleted, and an OOC that exists but has not been reconciled blocks exactly as hard as no OOC at all.",
    steps: [
      { ref: "01", label: "NOA issued to consignee / CHA", href: "/import/arrival-advice", module: "M08" },
      { ref: "02", label: "CHA collects import documents", href: "/import/documents", module: "M02" },
      { ref: "03", label: "SD filed (GD in CMTS terms)", href: "/customs/filing", module: "M09", note: "Filed to both providers during the parallel run" },
      { ref: "03a", label: "Gateway submission — PSW primary / WeBOC parallel", href: "/customs/gateway", module: "M09", note: "BLK-04 — divergence blocks settlement" },
      { ref: "04", label: "Risk channel assigned (fetched, not typed)", href: "/customs/channels", module: "M09" },
      /*
       * §04a sits between the channel assignment and the per-channel work
       * because it is what routes a declaration to either of them: its rows
       * open Channel Detail (§05-*) and Capture OOC (§08a-K). It also carries
       * Apply Hold / Release Hold, which are real writes and the only hold
       * node anywhere on FC-06.
       */
      { ref: "04a", label: "Declarations queued for officer action — channel, CHA, cargo class, age; hold applied or released from the queue", href: "/customs/queue", module: "M09", note: "Six row actions: View Channel Detail · Capture OOC · Apply Hold · Release Hold · View AWB · Customs Messaging. The hold it applies is the same HOLDINGSTATUS the FC-05 §14 Customs Hold Alert fires off." },
      /*
       * §05-G / §05-Y / §05-R re-pointed from /customs/channels to
       * /customs/channel-detail. The channels screen is a read-only viewer of
       * query and examination records; channel-detail is the workbench where a
       * scrutiny is recorded, and its three panels are exactly these three
       * refs — Green a 5-point readiness checklist, Yellow query capture, Red
       * examination scheduling. §04 and §06–§09 stay on the viewer.
       */
      { ref: "05-G", label: "Green — auto-cleared", href: "/customs/channel-detail", module: "M09", note: "The Green panel is a 5-point readiness checklist run before auto-release." },
      { ref: "05-Y", label: "Yellow — document scrutiny → query loop", href: "/customs/channel-detail", module: "M09", note: "The Yellow panel: the 9-item document review plus query capture — query reference, response notes, supporting documents, reviewer remarks. The broker's half of the same loop is §05-C." },
      { ref: "05-R", label: "Red — physical examination → sampling", href: "/customs/channel-detail", module: "M09", note: "A8 — the three channels are Green / Yellow / Red. “Normal” is retired, along with the RISK_CHANNEL_FLOW_LABEL map that rendered red as “Normal” and the BLK-03 banner on the channels screen. The Red panel schedules the exam — date, time, bay, officer, sample required and type, result tri-state, remarks, photo evidence." },
      { ref: "05-R1", label: "Examination discrepancy → cargo detained", href: "/customs/detained", module: "M09", note: "Gap G1 — the sub-identity carries across 12 tables" },
      { ref: "05-C", label: "CHA responds to the yellow-channel query and attends the red-channel examination", href: "/cha/channel-specific-workflow", module: "M09", note: "The broker's side of §05-Y and §05-R, which had a customs side and no counterparty: response submitted to customs, supporting documents attached, query marked resolved, exam scheduled, exam evidence uploaded." },
      { ref: "06", label: "Duty / sales tax / FED / WHT assessed and paid", href: "/customs/channels", module: "M09" },
      { ref: "07", label: "ANF / ASF clearance", href: "/customs/channels", module: "M09" },
      { ref: "08a", label: "OOC issued and captured — fetched from PSW, or keyed from the print", href: "/customs/channels", module: "M09", note: "Capture only. On its own this carries no release authority; the old direct edge from here to §09 is deleted. The keyed half of this label has its own screen at §08a-K." },
      /*
       * §08a-K is the keyed branch §08a's own label already promises. It is the
       * sole writer of OutOfCharge.keyedAt — nothing else in the product can
       * produce that value — and when the PSW gateway is down it is the only
       * path that gets cargo released. Suffix follows the §05-G / §05-Y / §05-R
       * convention already in this flow.
       */
      { ref: "08a-K", label: "OOC keyed from the counter print when the PSW gateway is down — source fixed at “keyed”", href: "/customs/ooc-capture", module: "M09", note: "OutOfCharge.source is set to “keyed” by construction, not by dropdown: a record keyed off a counter copy must not be able to badge itself as a gateway fetch. It still has to clear §08b like any other." },
      { ref: "08a-C", label: "CHA tracks OOC issuance — OOC reference and PDF supplied, DO collection assigned to a driver", href: "/cha/ooc-tracking", module: "M09", note: "The broker-side feed for the same keyed-OOC path as §08a-K, and its driver assignment is the hand-off into FC-08 §01 / FC-02 §33." },
      { ref: "08b", label: "OOC reconciled field-by-field against the SD — every field agrees?", href: "/customs/channels", module: "M09", decision: true, note: "The gate. Yes → §09; No → the mismatching fields are listed and the OOC is re-fetched or re-keyed. oocVerified() / oocMismatches() in lib/domain/customs.ts, read by the “OOC verified against SD” release condition." },
      { ref: "09", label: "Verification passed → eligible for release → FC-07 charging", href: "/customs/channels", module: "M10", note: "Reached from §08b, never from §08a. Release eligibility is the verification, not the issuance." },
    ],
  },
  {
    id: "FC-07",
    title: "Charges, Invoice, Waiver & Godown Rent Voucher",
    subtitle:
      "Charge calculation, tariff application, adjustments, the five-condition gate and the godown-rent voucher — the DO itself is issued at FC-01 §22b (M12)",
    docNo: "SAPS-ACMS-FC-07-02",
    rev: "Rev 2.0",
    amendment:
      "Charges auto-computed from a versioned Tariff Master. Payment is cash-less via gateway, auto-reconciled. Waiver runs role-based multi-level approval + audit → credit note. A3: the storage clock starts at INTAKE, not at flight arrival and not in the finance lane; the free/grace period runs from the clock start; the chargeable period is dwell − free. The steps are ordered that way — §01 arrival, §02 clock start, §03 free period, §03a chargeable period — because the old combined node stated the free period before the clock had started. A11: the five release conditions are an AND gate, not the fan-out the board draws — all five (where applicable) must pass. A10: this flow ends at the godown-rent voucher; DO issuance is FC-01 §22b / M12.",
    steps: [
      { ref: "01", label: "Flight arrival time recorded — provenance only, never priced", href: "/awb/1", module: "M04", note: "A3 — the gap between the aircraft landing and the cargo being accepted is the handler's, and is never billed to the consignee. Code field: ChargeCalculation.arrivalAt." },
      { ref: "02", label: "Storage clock starts at cargo intake", href: "/awb/1?tab=charges", module: "M10", note: "A3 — clock first. The anchor is the AWB's intakeAt, surfaced as ChargeCalculation.clockStartedAt; FC-02 §23 says the same thing, so the two flows now agree." },
      { ref: "03", label: "Free / grace period runs from the clock start — nothing accrues in it", href: "/awb/1?tab=charges", module: "M10", note: "A3 — free period second, and derived from the cargo class rather than typed. Code field: ChargeCalculation.freeDays." },
      { ref: "03a", label: "Chargeable period = dwell − free (+ supplements)", href: "/awb/1?tab=charges", module: "M10", note: "A3 — the only period priced. chargeableDays = max(0, totalDays − freeDays) + supplementDays, calculateCharges() in lib/domain/finance.ts." },
      { ref: "04–06", label: "Actual → volumetric (L×W×H/6000) → chargeable = max()", href: "/awb/3?tab=charges", module: "M10" },
      { ref: "07", label: "Category surcharge applied", href: "/awb/3?tab=charges", module: "M10" },
      /*
       * §07a / §07b sit above §08 because a slab cannot be applied before the
       * rate set it belongs to is resolved. UPWARD_REFERENCES in Sidebar.tsx
       * already states this relationship for the calculator — "the tariff is an
       * input to the calculation, so it is established above it" — and it was
       * missing from the flow.
       */
      { ref: "07a", label: "Tariff master version in force resolved — slab table, free days, minimum charge, effective dates", href: "/finance-manager/tariff-master-editor", module: "M10", note: "TariffVersion carries effectiveFrom / effectiveTo, status, createdBy and approvedBy, with an audit drawer behind it; the resolved version is stored on the calculation rather than looked up at render. FC-02 §26 says the same." },
      { ref: "07b", label: "Negotiated tariff set applied — agent contract × consignee tier × route × class, rate override under approval", href: "/finance-manager/multi-tariff-engine", module: "M10", note: "A negotiated set overrides the master rate for the matching contract, and the override goes out for approval rather than taking effect on save." },
      { ref: "08", label: "Tariff slab applied (D1-3 / D4-7 / D8-14 / D15+)", href: "/awb/3?tab=charges", module: "M10" },
      { ref: "09", label: "Invoice / tax invoice generated", href: "/billing/invoice", module: "M11" },
      { ref: "10–12", label: "Waiver? → approval workflow → credit note", href: "/billing/invoice", module: "M11" },
      { ref: "12a", label: "CHA settles the consignee's invoices from the broker desk — receipt issued, invoice dispute raised", href: "/cha/payments", module: "M11", note: "The payment is MADE here; §13 is where it is RECEIVED. The consignee's own equivalent surface is FC-02 §32 (/consignee/pay-do)." },
      { ref: "13", label: "Payment received", href: "/billing/invoice", module: "M11" },
      /*
       * The amendment says payment is "cash-less via gateway, auto-reconciled"
       * and only the first half had a step. §13a is the second half.
       */
      { ref: "13a", label: "Gateway payment reconciled — webhook matched to the invoice, settlement, failure reason, refund status", href: "/finance-manager/payment-gateway-reconciliation", module: "M11", note: "Six providers — HBL, Meezan, NIFT, Easypaisa, JazzCash, 1LINK — with the verbatim webhook payload and a per-transaction audit trail. The gateway itself is a named FC-12 node at §11-P." },
      { ref: "14", label: "Release gate — ALL five conditions must pass (AND)", href: "/awb/3?tab=customs", module: "M11", decision: true, note: "A11 — AND, not the fan-out the board draws: OOC verified against the SD · AWB authority verified · DO charges paid · cargo not on hold · special clearance completed. Special clearance is conditional on cargo class (BLK-10) and shows N/A rather than blocking. evaluateReleaseGate() in lib/domain/finance.ts — canRelease is blockedBy.length === 0." },
      { ref: "15", label: "G.Rent voucher issued — end of FC-07", href: "/billing/godown-rent", module: "M11", note: "A10 — the five conditions gate THIS, not the DO. FC-07 ends here." },
      { ref: "→", label: "Handoff: DO issued by the terminal — FC-01 §22b (M12)", href: "/billing/delivery-order", module: "M12", note: "A10 — the DO is not an FC-07 node. It is issued after this voucher, on the FC-01 spine." },
    ],
  },
  {
    id: "FC-08",
    title: "Gate Pass, POD & AWB Closure",
    subtitle: "Physical delivery verification, POD capture and file closure",
    docNo: "SAPS-ACMS-FC-08-02",
    rev: "Rev 2.0",
    amendment:
      "RFID/scan-verified end to end: the tag bound at putaway is read at retrieval and gate-out, where it is matched to the gate pass + DO with an automatic re-check of OOC, DO charges and no-hold. POD is digital — e-signature + CNIC scan + geo/timestamp + photo. A2: the three verification decisions get real failure paths — cargo unavailable, piece-count mismatch and damage at the condition check all route to CDR (FC-04); as drawn, a short pick or a damaged piece at delivery had nowhere to go. A13: renumbered 01–16 with no gaps — SAPS confirmed the missing 02, 05 and 11 were misnumbering, not lost steps.",
    steps: [
      { ref: "01", label: "Consignee / agent presents DO", href: "/cha/do-collection", module: "M12" },
      /*
       * §01a–§01d are sub-refs so A13's contiguous 01–16 numbering survives.
       * They fill the gap between presenting the DO and the gate verifying it:
       * the agent pre-registers driver and vehicle, submits both to SAPS, and
       * the vehicle is then admitted at the inbound gate. FC-08 modelled
       * gate-OUT (§10, §11) and never modelled gate-IN at all.
       */
      { ref: "01a", label: "Driver pre-registered by the agent — CNIC, licence and expiry, allowed AWBs / DOs", href: "/forwarding-agent/driver-register", module: "M13", note: "This is the register §02 verifies against. It is the agent-side twin of /gate-entry/driver-identity-register: same driver, two sides of the counter, kept apart by the internal-ops / customer portal split rather than by content." },
      { ref: "01b", label: "Vehicle pre-registered by the agent — number, type, capacity, insurance expiry", href: "/forwarding-agent/vehicle-register", module: "M13" },
      { ref: "01c", label: "Authority letter and vehicle pre-registration submitted to SAPS, queued for review", href: "/forwarding-agent/dispatch-documents", module: "M13", note: "The submission §03 verifies and FC-02 §31 scans. The queue carries Submitted At / Reviewed By / Status, which is what makes §01a and §01b two-sided rather than duplicated." },
      { ref: "01d", label: "Vehicle admitted at the inbound gate — entry timestamp, guard, photo; seven-point verification; allow / hold / reject", href: "/gate-entry/vehicle-entry", module: "M13", decision: true, note: "Seven checks: CNIC Valid · Authority Letter · DO/AWB Validation · Payment Status · Customs Hold · Vehicle Status · Driver Visit History. Three exits, and none of them were on the board — FC-08 drew the exit gate and not the entry gate." },
      { ref: "02", label: "Verify receiver identity / CNIC", href: "/gate-entry/driver-identity-register", module: "M13" },
      { ref: "03", label: "Verify authority letter", href: "/gate-entry/authority-letter-digitisation", module: "M13", note: "Scan point 2 of 2." },
      { ref: "04", label: "Generate gate pass", href: "/dispatch/gate-pass", module: "M13", note: "43-column gate pass." },
      { ref: "05", label: "Picking request raised", href: "/warehouse-manager/picking", module: "M13" },
      { ref: "06", label: "Retrieval from rack — RFID tag read against the putaway binding", href: "/warehouse-manager/picking", module: "M13" },
      { ref: "07", label: "Cargo available?", href: "/warehouse-manager/picking", module: "M13", decision: true, note: "A2 — No → CDR (FC-04). Previously “Cargo unavailable / investigate” terminated with nothing leaving the node." },
      { ref: "08", label: "Piece count matched?", href: "/warehouse-manager/picking", module: "M13", decision: true, note: "A2 — No → CDR (FC-04). Previously a Yes edge only, with no No branch at all." },
      { ref: "09", label: "Condition verification — damage found?", href: "/warehouse-manager/picking", module: "M13", decision: true, note: "A2 — Yes → CDR (FC-04). Previously no decision followed the condition check, so damage at handover had nowhere to go." },
      { ref: "10", label: "Load to vehicle", href: "/gate-entry/vehicle-exit", module: "M13" },
      { ref: "11", label: "Gate-out verification — tag ↔ gate pass ↔ DO, re-check OOC / charges / no-hold", href: "/dispatch/gate-out", module: "M13", decision: true, note: "B2 — an in-line gate with a defined fail path, not a dangling annotation. Fail → back to the release gate." },
      { ref: "12", label: "POD captured (signature, CNIC, pieces, photo, geo, timestamp)", href: "/awb/2?tab=dispatch", module: "M14" },
      { ref: "13", label: "DLV sent", href: "/awb/2?tab=messaging", module: "M07" },
      { ref: "14", label: "AWB marked delivered", href: "/awb/2?tab=dispatch", module: "M14" },
      { ref: "15", label: "Finance reconciled", href: "/billing/invoice", module: "M11" },
      { ref: "16", label: "Documents archived, file closed", href: "/awb/6?tab=audit", module: "M20" },
    ],
  },
  {
    id: "FC-09",
    title: "Transhipment Cargo Bonded Transfer",
    subtitle: "Transit cargo under customs bond awaiting onward carriage",
    docNo: "SAPS-ACMS-FC-09",
    rev: "Rev 1.0",
    amendment:
      "RFID-tracked bonded zone with digital customs-bond supervision. If the onward leg goes to another SAPS site, an inter-station ownership handoff moves the owning site via HQ with bond continuity preserved.",
    steps: [
      { ref: "01–02", label: "Received from flight, identified as transhipment", href: "/awb/24", module: "M15" },
      { ref: "03", label: "Indexed in AirVault", href: "/awb/24", module: "M03" },
      { ref: "04", label: "Stored in bonded transhipment zone", href: "/storage/bonded", module: "M15" },
      { ref: "05", label: "RCT message sent", href: "/awb/24?tab=messaging", module: "M07" },
      { ref: "06–07", label: "Transhipment permit (PSW), bond supervision", href: "/transhipment/register", module: "M15", note: "A lapsed permit blocks re-tender — the permit clock is the control." },
      { ref: "08–09", label: "Await connecting flight; storage charges on over-dwell", href: "/transhipment/register", module: "M15" },
      { ref: "10", label: "Re-tender to onward carrier", href: "/transhipment/register", module: "M15" },
      { ref: "—", label: "Onward leg to another SAPS site? → ownership handoff", href: "/transhipment/handoff", module: "M15", decision: true },
      { ref: "11–13", label: "TFD, DEP, file closed", href: "/transhipment/register", module: "M15" },
    ],
  },
  {
    id: "FC-10",
    title: "Exception Cargo Flow",
    subtitle: "Mishandled, re-export and long-stay / abandoned cargo",
    docNo: "SAPS-ACMS-FC-10-02",
    rev: "Rev 2.0",
    amendment:
      "Aging-driven: the dwell clock auto-fires the long-stay alert and drives the Section 82 statutory timeline, with notices scheduled automatically. Exception holds are RFID-tracked and surfaced on an aging dashboard.",
    steps: [
      { ref: "A1–A2", label: "Misrouted → exception hold", href: "/exceptions/mishandled", module: "M17" },
      { ref: "A3–A5", label: "Create DIS/CDR, notify airline, AIRLINE issues the recovery instruction", href: "/exceptions/mishandled", module: "M17", note: "A14 — the instruction is the airline's. §A6 executes it." },
      { ref: "A6", label: "Recovery action performed by CUSTOMS, on the airline's §A5 instruction", href: "/exceptions/mishandled", module: "M17", decision: true, note: "A14 — the label was “Recovery Action by Custom” with three unlabelled exits and an actor contradicting §A5. Airline instructs; Customs acts. Each of the three recovery options carries its own field set and its own labelled exit." },
      { ref: "A7–A8", label: "Re-tender, close as forwarded", href: "/exceptions/mishandled", module: "M17" },
      { ref: "B1–B3", label: "Cannot clear → re-export hold → request raised", href: "/exceptions/re-export", module: "M16" },
      { ref: "B3a", label: "CHA raises and tracks the re-export case — reason, stage, permission document, customs decision, final disposition", href: "/cha/re-export-long-stay", module: "M16", note: "§B1–B3 says the request is raised and never says on whose screen; this is it. Its permission upload is §B4–B6's permission. Its second tab is Long-Stay / Section 82 — the notified-party side of §C3–C4 — so this one console serves both branches and is not drawn twice." },
      { ref: "B4–B6", label: "Re-export SD (PSW), permission, charges settled", href: "/exceptions/re-export", module: "M16", note: "PSW-primary — no WeBOC path on this branch" },
      { ref: "B7–B8", label: "Re-tender as export, close import AWB", href: "/exceptions/re-export", module: "M16", note: "Blocked until §B6 settles — the lien depends on the order" },
      { ref: "C1–C2", label: "Not cleared after period → long-stay alert", href: "/exceptions/long-stay", module: "M18", note: "Alert is auto-fired by the FC-07 dwell clock" },
      { ref: "C3–C4", label: "Notify parties, escalate to customs", href: "/exceptions/long-stay", module: "M18" },
      { ref: "C5–C7", label: "Section 82 → release / auction / disposal → closed", href: "/exceptions/long-stay", module: "M18" },
      { ref: "aging", label: "Cross-branch aging dashboard", href: "/exceptions/queue", module: "M18", note: "The FC-10 amendment's unified exception queue — six kinds, six thresholds" },
    ],
  },
  {
    id: "FC-11",
    title: "Export Cargo Management Flow",
    subtitle: "Terminal-side export from booking to airline handover (ramp excluded)",
    docNo: "SAPS-ACMS-FC-11-02",
    rev: "Rev 2.0",
    amendment:
      "Greenfield — CMTS holds only CARGOACCEPTANCE / ACCEPTENCEDETAIL / ExportGodownrent, so this flow is the specification. Export documents are keyed at the counter (OCR is limited to the two import-side scan points). SD + Form-E (EFE) lodged via PSW EDI, PSW-primary from day one with no WeBOC fallback. Security screening produces a tamper-evident record — method, result, screener ID, RFID seal — feeding a chain of custody (ACC3 / known-consignor); a broken seal forces re-screening before uplift. Weighing scales auto-capture gross / net / tare. Handheld RFID scans pieces at acceptance, build-up and ULD verification; the ULD build is verified against the PFM / load plan, and missing or excess items produce a Build-up Report + Discrepancy Note before handover to ramp. A16: SAPS confirmed the terminal order is correct as drawn — customs / ANF genuinely comes before acceptance and screening — so the connectors stand and the step numbers change to match, contiguous 01–25. The standalone export-OCR node is deleted, the three duplicate weighing nodes collapse to §03, the “Clearance ???” placeholder becomes §08, and the blank diamond after manifest messaging becomes §20 “FFM acknowledged?”.",
    // Ordered by the diagram's connectors, and now NUMBERED that way too.
    // A16: SAPS confirmed the terminal order is correct as drawn — customs /
    // ANF comes before cargo acceptance and before screening — so the
    // connector order stands and the board's step numbers change to match.
    // Old numbers 02, 10 and 11 never existed; the sequence below is
    // contiguous 01..25 with no gaps.
    steps: [
      { lane: "Booking", ref: "01", label: "Booking information from airline / GSA", href: "/export/booking", module: "M16" },

      { lane: "Documentation", ref: "02", label: "Document collection — AWB, invoice, packing list, keyed at the counter", href: "/export/acceptance", module: "M16", note: "A16 — no OCR on the export side. OCR is limited to the two import-side scan points, so the separate “captured, keyed at the counter” node folds into this one." },

      { lane: "Weighment", ref: "03", label: "Weight captured / verified — gross, net, tare, auto-captured from the scale", href: "/export/acceptance", module: "M16", note: "A16 — the three weighing nodes (06 Weight Captured, the “Wighment” typo node, and the scale-integration overlay) collapse to this one. No manual entry. §21 is a separate post-build-up confirmation, not a fourth duplicate." },

      { lane: "Customs / ANF", ref: "04", label: "Customs / ANF check", href: "/export/customs", module: "M09", decision: true },
      { lane: "Customs / ANF", ref: "05", label: "Inspection for clearance", href: "/export/customs", module: "M09" },
      { lane: "Customs / ANF", ref: "06", label: "Document check — AWB / GD signed by customs / ANF", href: "/export/customs", module: "M09" },
      { lane: "Customs / ANF", ref: "07", label: "Export declaration (SD) + Form-E (EFE) lodged via PSW EDI", href: "/export/customs", module: "M09", note: "PSW-primary day one — no WeBOC parallel run on the export side." },
      { lane: "Customs / ANF", ref: "08", label: "Customs / ANF clearance granted?", href: "/export/customs", module: "M09", decision: true, note: "A16 — replaces the “Clearance ???” placeholder that sat in a live decision node. Yes → acceptance; No → §09 hold till correction." },
      { lane: "Customs / ANF", ref: "09", label: "Hold till correction — loops back to the check", href: "/export/customs", module: "M09", note: "A16 — was drawn as a diamond but named as an action; the branch lives at §08." },
      { lane: "Customs / ANF", ref: "10", label: "Returned to shipper / detained", href: "/export/customs", module: "M09", note: "The terminal No edge — the only way out of the loop that is not clearance." },

      { lane: "Acceptance", ref: "11", label: "Physical check — dimensions, count, marking, packaging, damage", href: "/export/acceptance", module: "M16" },
      { lane: "Acceptance", ref: "12", label: "Cargo acceptance at the export terminal", href: "/export/acceptance", module: "M16" },

      { lane: "Screening", ref: "13", label: "Security screening — X-ray / ETD / EDD / physical", href: "/export/acceptance", module: "M16" },
      { lane: "Screening", ref: "14", label: "Screening record — method, result, screener ID, RFID seal, chain of custody", href: "/export/acceptance", module: "M16", note: "ACC3 / known-consignor. A broken seal at any handover forces re-screening." },

      { lane: "Classification & Storage", ref: "15", label: "Cargo classification", href: "/export/warehousing", module: "M16" },
      { lane: "Classification & Storage", ref: "16", label: "Special cargo?", href: "/export/warehousing", module: "M16", decision: true },
      { lane: "Classification & Storage", ref: "16a", label: "Special handling verification — DGR / PER / AVI / VAL", href: "/export/warehousing", module: "M16" },
      { lane: "Classification & Storage", ref: "16b", label: "General export storage", href: "/export/warehousing", module: "M16", note: "A8 hygiene — was “Normal export storage”. “Normal” is retired as a risk-channel label and the word is not left lying around on the board to invite the same confusion." },
      { lane: "Classification & Storage", ref: "17", label: "Export warehousing", href: "/export/warehousing", module: "M16" },

      { lane: "Build-up", ref: "18", label: "Build-up as per PFM / load plan", href: "/export/buildup", module: "M16" },
      { lane: "Build-up", ref: "18a", label: "Handheld RFID reader — piece-level scan", href: "/export/buildup", module: "M16" },
      { lane: "Build-up", ref: "18b", label: "ULD build verification — built items vs PFM / load plan", href: "/export/buildup", module: "M16" },
      { lane: "Build-up", ref: "18c", label: "Missing / excess items?", href: "/export/buildup", module: "M16", decision: true },
      { lane: "Build-up", ref: "18d", label: "Flag & reconcile — add / remove / return items", href: "/export/buildup", module: "M16" },
      { lane: "Build-up", ref: "18e", label: "Generate ULD Build-up Report + Discrepancy Note", href: "/export/buildup", module: "M16" },

      { lane: "Messaging", ref: "19", label: "Manifest / FFM / FWB / FHL messaging", href: "/messaging/iata", module: "M07" },
      { lane: "Messaging", ref: "20", label: "Manifest accepted by the airline — FFM acknowledged?", href: "/messaging/iata", module: "M07", decision: true, note: "A16 — names the blank diamond that carried Yes/No edges and no question. No → back to §18b build-up reconciliation before the manifest is re-sent; Yes → handover." },

      { lane: "Handover & Uplift", ref: "21", label: "Weighment after build-up / RFID / volume confirmation", href: "/export/buildup", module: "M16", decision: true, note: "No edge routes back to §09 hold till correction." },
      { lane: "Handover & Uplift", ref: "22", label: "Handover to ramp / airline", href: "/export/buildup", module: "M16" },
      { lane: "Handover & Uplift", ref: "23", label: "Payload compatibility with flight?", href: "/export/uplift", module: "M16", decision: true, note: "No edge returns the consignment to §17 warehousing — “can be offloaded depending upon weight provision”." },
      { lane: "Handover & Uplift", ref: "24", label: "On-boarded", href: "/export/uplift", module: "M16" },

      { lane: "Closure", ref: "25", label: "Export invoice / closure / archive", href: "/export/uplift", module: "M20", note: "BLK-02 — closure and archive are built; the export revenue share (INTERNATIONALCARGO) is parked pending SAPS." },
    ],
  },
  {
    id: "FC-12",
    title: "AirVault Platform & System Architecture",
    subtitle:
      "Per-site nodes under Islamabad HQ, portal-separated RBAC, integration gateways and the audit spine",
    docNo: "SAPS-ACMS-FC-12-02",
    rev: "Rev 2.0",
    amendment:
      "AirVault platform layer: three site nodes (KHI / LHE / PEW) each owning their own cargo, storage and finance data, under an Islamabad HQ tier where site scope “HQ” means all sites. Portals are separated cleanly — admin, warehouse, lifter, customs, finance, customer and agent are distinct surfaces reachable from one sidebar — with RBAC snapshotable as at a date. Every external system sits behind a named gateway (PSW/WeBOC, SITA Cargo-IMP, RFID estate, payment, ERP) with a single health board over all of them.",
    steps: [
      { lane: "Sites & HQ", ref: "01", label: "Per-site node — KHI / LHE / PEW, each owning its cargo, storage and finance data", href: "/admin/settings", module: "M20", note: "SiteCode, lib/domain/common.ts. CMTS carried Comp_Code / Off_Code on ~20 tables; AirVault adds the HQ tier on top." },
      { lane: "Sites & HQ", ref: "02", label: "Islamabad HQ tier — scope “HQ” means all sites; CDC / outbox sync", href: "/integration-status", module: "M20", note: "SiteScope and the sync state both live in lib/domain/common.ts." },
      { lane: "Sites & HQ", ref: "03", label: "Inter-station ownership handoff via HQ, bond continuity preserved (FC-09)", href: "/transhipment/handoff", module: "M15" },

      { lane: "Access & RBAC", ref: "04", label: "Portal separation — admin / warehouse / lifter / customs / finance / customer / agent, one sidebar", href: "/admin/roles", module: "M20" },
      { lane: "Access & RBAC", ref: "05", label: "User & role administration", href: "/admin/users", module: "M20" },
      { lane: "Access & RBAC", ref: "06", label: "RBAC snapshot — who could see what, as at a date", href: "/auditor/rbac-snapshot", module: "M20" },
      { lane: "Access & RBAC", ref: "07", label: "Master data — cargo classes, subclasses, locations, tariff", href: "/admin/master-data", module: "M20" },

      { lane: "Integration gateways", ref: "08", label: "Customs gateway — PSW primary / WeBOC parallel-run", href: "/customs/gateway", module: "M09", note: "BLK-04 — divergence between the two blocks settlement." },
      { lane: "Integration gateways", ref: "09", label: "SITA / IATA Cargo-IMP gateway — 13 message types", href: "/messaging/iata", module: "M07", note: "Thirteen consignment message types. The ULD track (UCM / SCM / LUC) is a sibling gateway on the same spine — FC-16 / M24 — not one of these thirteen." },
      { lane: "Integration gateways", ref: "10", label: "RFID / scanner estate", href: "/rfid-integration", module: "M05" },
      /*
       * §11 named two gateways and hrefed at one. The payment gateway is a
       * separate external system with its own screen, so it becomes §11-P and
       * §11 narrows to the ERP bridge it actually points at.
       */
      { lane: "Integration gateways", ref: "11-P", label: "Payment gateway — providers, webhook capture, invoice matching, settlement, refunds", href: "/finance-manager/payment-gateway-reconciliation", module: "M11", note: "Six providers — HBL, Meezan, NIFT, Easypaisa, JazzCash, 1LINK. FC-07 §13a is the reconciliation this gateway feeds." },
      { lane: "Integration gateways", ref: "11", label: "ERP bridge", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "The ERP bridge had no owning flow; FC-17 picks it up and M25 owns it. The payment gateway it used to share this node with is §11-P." },
      { lane: "Integration gateways", ref: "12", label: "Integration health board — every gateway, last sync, failures", href: "/integration-status", module: "M20" },
      { lane: "Integration gateways", ref: "13", label: "Admin integration configuration", href: "/admin/integrations", module: "M20" },

      { lane: "Audit & reporting", ref: "14", label: "Audit trail browser", href: "/admin/audit-trail", module: "M20" },
      { lane: "Audit & reporting", ref: "15", label: "Session & event log", href: "/admin/event-log", module: "M20" },
      { lane: "Audit & reporting", ref: "16", label: "Cargo trace", href: "/auditor/cargo-trace", module: "M20" },
      { lane: "Audit & reporting", ref: "17", label: "Financial trace", href: "/auditor/financial-trace", module: "M19" },
      /*
       * §17a sits below §06, §16 and §17 because it bundles their outputs: the
       * pack's contents are the RBAC snapshot, the cargo timeline and the
       * financial timeline. It generates and exports; it is not a fourth view
       * of the traces above it.
       */
      { lane: "Audit & reporting", ref: "17a", label: "Audit evidence pack generated and exported — cargo timeline, financial timeline, RBAC snapshot, evidence, event logs", href: "/auditor/export-centre", module: "M20" },
      { lane: "Audit & reporting", ref: "18", label: "Reports & dashboards", href: "/reports", module: "M19" },
      { lane: "Audit & reporting", ref: "19", label: "Module map — 26 modules against FC-01…FC-18", href: "/modules", module: "M19" },
    ],
  },
  {
    id: "FC-13",
    title: "Planning & Capacity",
    subtitle: "Forecast to published shift plan — demand, zone capacity, slots and crews",
    docNo: "SAPS-ACMS-FC-13",
    rev: "Rev 1.0",
    amendment:
      "Planning is forecast-driven rather than clerical. The inbound demand line is assembled from the FFM / FWB / FHL already sitting on the messaging spine (M07) instead of being keyed, and a missing pre-arrival message is raised as a named gap — FWB missing, FHL pending, FFM not received, expected AWB not received — against the flight it belongs to, rather than being quietly forecast around. Forecast pieces are then applied against zone capacity by handling code, so an 84%-full ODC block and an 85%-full cold room read as High risk before the aircraft lands, not after the cargo is on the floor. Slot booking runs on the same class → subclass → location rules FC-03 allocates by, conflict detection runs on the grid itself, and a conflict the planner cannot resolve leaves the Planner portal as an escalation carrying Planner as its source module instead of dying in a spreadsheet. The roster is deliberately read-only here: establishment stays in HR (CMTS CEmployee / SHIFT, gap G10) and the planner consumes availability only. One inconsistency is left visible rather than papered over — asset FL-03 reads 91% battery on the roster and 68% on the lifter status screen, so the fleet needs one owner, and FC-15 is it. No CMTS table backs any of this; planning is an AirVault addition and is flagged for sign-off on that basis. M21 sits in FC-12 Tier 1 — Input, because planning consumes the same pre-arrival messages M01 does and produces the constraints Tier 2 works inside.",
    steps: [
      { ref: "01", label: "Inbound flight forecast built from FFM / FWB / FHL already received", href: "/planner/demand-forecast", module: "M21", note: "Sourced off the M07 messaging spine, not keyed — the demand line is a by-product of the pre-arrival messages FC-05 already handles." },
      { ref: "02", label: "Pre-arrival message gap?", href: "/planner/demand-forecast", module: "M21", decision: true, note: "Four named gap types — FWB missing, FHL pending, FFM not received, expected AWB not received — each with a severity and a flight." },
      { ref: "02a", label: "Gap flagged for chase on the Cargo-IMP console", href: "/messaging/iata", module: "M07", note: "Pre-arrival completeness is a flight-level fact the IMP console already owns; the planner raises it, messaging chases it." },
      { ref: "03", label: "Expected pieces, weight and cargo class per inbound flight", href: "/planner/demand-forecast", module: "M21", note: "Cargo class on the forecast is provisional — FC-02 §09 sets the binding class at indexation." },
      { ref: "04", label: "Forecast inbound applied against zone capacity by handling code", href: "/planner/capacity-dashboard", module: "M21", note: "Per zone: total / occupied / available / blocked, plus forecastInbound and a risk level, keyed on the FC-03 handling codes." },
      { ref: "05", label: "Zone at capacity risk?", href: "/planner/capacity-dashboard", module: "M21", decision: true, note: "ODC block-stacking at 84% and Cold Room COL at 85% are High before anything is received." },
      { ref: "05a", label: "Overflow zone checked against the class → subclass → location rules", href: "/warehouse-manager/storage-map", module: "M05", note: "FC-03 §B / §B-COL decide where overflow may legally go (CARGOSUBCLASSLOCATION); the planner may not invent a zone." },
      { ref: "06", label: "Slot booked on the day / week grid for the ULD or vehicle bay", href: "/planner/slot-planner", module: "M21" },
      { ref: "07", label: "Slot conflict?", href: "/planner/slot-planner", module: "M21", decision: true, note: "Three exits on the grid — move, cancel, resolve — with a conflict panel that carries the conflict id." },
      { ref: "07a", label: "Unresolvable conflict leaves the portal as an escalation", href: "/operations-supervisor/escalation-inbox", module: "M22", note: "Rack Conflict and ULD Bay double-book already arrive in the supervisor's inbox with Planner as the source module." },
      { ref: "08", label: "Crew availability by role checked for the slot", href: "/planner/resource-roster", module: "M21", note: "Read-only in Planner — the screen says so and links out to HR; establishment lives in CMTS CEmployee / SHIFT (gap G10)." },
      { ref: "09", label: "Assets assigned to the shift — forklifts, handhelds, gate scanners", href: "/planner/resource-roster", module: "M21", note: "Same fleet FC-15 dispatches tasks to, and the two currently disagree: FL-03 reads 91% here and 68% on lifter status. FC-15 owns the truth." },
      { ref: "10", label: "Roster gap? → shortfall handed to the incoming shift", href: "/operations-supervisor/shift-handover", module: "M22", decision: true, note: "Two operators short is a planner KPI today with nowhere to go; FC-14's handover form is where it lands." },
      { ref: "11", label: "Plan published for the shift — utilisation, inbound, expected pieces, gaps, conflicts", href: "/planner", module: "M21" },
      { ref: "12", label: "Flight arrives; receipt begins under FC-01 / FC-02", href: "/import/flights", module: "M01" },
      { ref: "13", label: "Forecast vs actual variance re-drives the next capacity cycle", href: "/planner/capacity-dashboard", module: "M21", note: "The loop back to §04 — a forecast nobody scores against the actual is a guess with a chart." },
    ],
  },
  {
    id: "FC-14",
    title: "Ops Supervision & Workforce",
    subtitle: "The supervised shift — live floor, escalation routing, decision, handover",
    docNo: "SAPS-ACMS-FC-14",
    rev: "Rev 1.0",
    amendment:
      "FC-12 lists “Ops & Workforce” as a platform service and stops there; this flow makes it a loop with a start and an end. The shift is bounded by a handover record at both ends — the incoming supervisor opens on the outgoing supervisor's submitted 40-field form, not on a verbal brief — and the form's counters (open CDRs, RFID mismatches, long-stay alerts) are reported here but owned by FC-04, FC-15 and FC-10, so the handover never becomes a second version of the truth. Every escalation carries its source module, AWB, SLA deadline and evidence count, which makes a breach a measurable fact rather than an impression, and the decision is timestamped against the deciding user with remarks — something CMTS's free-text remarks columns cannot express. The inbox routes rather than resolves: damage and shortage go to the CDR workbench (FC-04), customs holds and long-stay to FC-10, payment holds and waivers to FC-07, RFID and equipment faults to FC-15. The supervisor decides ownership; the owning flow decides the outcome. Floor notes carry an owner and a due date and are chased to closure instead of being minutes nobody reads. Nothing here has a CMTS table behind it — CEmployee / CDepartment / SHIFT (gap G10) supply the establishment behind the roster only. M22 sits on the FC-12 exception spine, above M06, as the human decision tier that routes into it.",
    steps: [
      { ref: "01", label: "Incoming supervisor opens on the outgoing supervisor's submitted handover", href: "/operations-supervisor/shift-handover", module: "M22", note: "40 fields across shift info, open items, blockers, equipment, receipts, dispatch, exceptions and notes." },
      { ref: "02", label: "Live ops board — cargo states, asset tiles, exception counts, event stream", href: "/operations-supervisor/live-ops-view", module: "M22", note: "Events carry module, actor, entity, severity and an inc/exc scope; cargo states carry average dwell and a trend." },
      { ref: "03", label: "Anomaly on the board?", href: "/operations-supervisor/live-ops-view", module: "M22", decision: true },
      { ref: "04", label: "Owner assigned and the exception opened from the board", href: "/operations-supervisor/live-ops-view", module: "M22", note: "Open exception, assign owner, escalate, resolve and the jump-outs to AWB, gate board and storage map all sit on this screen." },
      { ref: "05", label: "Escalation raised with source module, AWB, SLA deadline and evidence count", href: "/operations-supervisor/escalation-inbox", module: "M22", note: "Six source modules feed it — Warehouse, Gate Entry, Finance, Excise, Planner, Lifter." },
      { ref: "06", label: "Which flow owns this escalation?", href: "/operations-supervisor/escalation-inbox", module: "M22", decision: true, note: "The inbox routes; it does not resolve. An escalation closed here without the owning flow closing is abandonment, not resolution." },
      { ref: "06a", label: "Damage / shortage / wrong weight → CDR workbench (FC-04)", href: "/exceptions/cdr", module: "M06" },
      { ref: "06b", label: "Customs hold / long-stay alert → FC-10", href: "/exceptions/long-stay", module: "M18", note: "Section 82 and the 72-hour long-stay trigger already arrive here as Excise-sourced escalations." },
      { ref: "06c", label: "Payment hold / waiver → FC-07", href: "/finance-manager/waiver-workflow", module: "M11" },
      { ref: "06d", label: "RFID mismatch / equipment fault → FC-15", href: "/lifter-operator/movement-log", module: "M23" },
      { ref: "07", label: "Decision — approve, reject or reassign, with decision notes", href: "/operations-supervisor/escalation-inbox", module: "M22", decision: true, note: "Six states: Open, Awaiting Decision, Reassigned, Approved, Rejected, Closed." },
      { ref: "08", label: "Decision timeline recorded — user, timestamp, action, remarks", href: "/operations-supervisor/escalation-inbox", module: "M22" },
      { ref: "09", label: "Floor note / MoM raised with an owner and a due date", href: "/operations-supervisor/mom-floor-notes", module: "M22" },
      { ref: "10", label: "Follow-up actions chased to closure", href: "/operations-supervisor/mom-floor-notes", module: "M22" },
      { ref: "11", label: "Operator, team and SLA performance measured across the shift", href: "/operations-supervisor/performance-console", module: "M22" },
      { ref: "12", label: "Handover submitted — counters, blockers, equipment status, safety notes", href: "/operations-supervisor/shift-handover", module: "M22", note: "Open CDRs, damage cases, gate mismatches, RFID mismatches and long-stay alerts are reported here and owned by FC-04, FC-15 and FC-10." },
      { ref: "13", label: "Accepted by the incoming supervisor → loops back to §01", href: "/operations-supervisor/shift-handover", module: "M22", note: "Submit, PDF and email-incoming are the three exits on the form." },
      { ref: "14", label: "Shift record retained for audit", href: "/admin/audit-trail", module: "M20" },
    ],
  },
  {
    id: "FC-15",
    title: "Equipment & Lifter Fleet",
    subtitle: "Asset readiness, tag-verified movement and fleet telemetry inside the shed",
    docNo: "SAPS-ACMS-FC-15",
    rev: "Rev 1.0",
    amendment:
      "FC-03 and FC-08 need a scan and a putaway; neither says who is holding the reader or whether the machine works. FC-15 closes that gap. The operator signs on to a named asset and the asset has to be fit for duty — battery above the 30% threshold and no Out-of-service fault — before the queue will dispatch to it, so a task is never assigned to a forklift that is on charge. Every move is tag-verified twice, at pickup and at drop-off, and the reader returns one of exactly three outcomes: matched, mismatch, duplicate. A mismatch is not retried into submission; it leaves the portal as an RFID-mismatch escalation with Lifter as its source module (FC-14), and the drop-off scan is the same event FC-03 uses to bind tag to location, so the fleet writes the storage record rather than duplicating it. Faults are a structured record — category, severity, description, photo, can-continue — not a radio call, and Out-of-service removes the asset from dispatch instead of leaving it on the roster. Movement is logged per piece with time, task type, AWB, piece, RFID and from/to, which gives FC-08 a chain of custody inside the shed that CMTS has no table for. Fixed-reader and handheld configuration is kept off the operator's screen and on the integration console, where power, EPC filter and duplicate window belong. The whole module is an AirVault addition — there is no CMTS equipment or telemetry table. M23 sits in FC-12 Tier 2 — Core Processing, because it is the physical execution layer under M05 storage and M13 dispatch, not a reporting surface.",
    steps: [
      { ref: "01", label: "Operator signs on to a named lifter asset", href: "/lifter-operator/lifter-status", module: "M23", note: "Asset id, type, operator, status, battery, location, last charge, last movement, active tasks." },
      { ref: "02", label: "Fit for duty? — battery above threshold, no Out-of-service fault", href: "/lifter-operator/lifter-status", module: "M23", decision: true, note: "Threshold 30%; the demo asset also carries a 48-hour brake-pad maintenance warning." },
      { ref: "02a", label: "Fault reported — category, severity, description, photo, can-continue", href: "/lifter-operator/lifter-status", module: "M23", note: "Eight categories (Battery, Hydraulic, Brake, Tyre, Fork, Electrical, Safety, Other); severity includes Out-of-service, which takes the asset off dispatch." },
      { ref: "02b", label: "On charge — asset unavailable until the charging slot completes", href: "/lifter-operator/lifter-status", module: "M23" },
      { ref: "03", label: "Task queue — Putaway, Pick, Move, Charge, by priority and SLA remaining", href: "/lifter-operator/tasks", module: "M23", note: "Tasks originate in FC-03 putaway and FC-08 picking; the fleet executes work, it does not create it. Each row carries AWB, piece id, RFID, from/to, class, handling code, assigner." },
      { ref: "04", label: "Task started; route and piece shown — from, to, AWB, HAWB, class, handling code", href: "/lifter-operator/task-detail", module: "M23" },
      { ref: "05", label: "RFID read at source", href: "/lifter-operator/rfid-scan", module: "M23", note: "Handheld; a disconnected reader is an explicit error state with pairing guidance, not a silent failure." },
      { ref: "06", label: "Tag matches the assigned piece?", href: "/lifter-operator/task-detail", module: "M23", decision: true, note: "Three outcomes only — matched, mismatch, duplicate." },
      { ref: "06a", label: "Mismatch escalated as an RFID mismatch", href: "/operations-supervisor/escalation-inbox", module: "M22", note: "Lifter is already a source module in the supervisor's inbox." },
      { ref: "07", label: "Pickup confirmed", href: "/lifter-operator/task-detail", module: "M23" },
      { ref: "08", label: "Drop-off scanned and confirmed at destination", href: "/lifter-operator/task-detail", module: "M23", note: "The same scan FC-03 uses to bind tag → location — one event, not two records." },
      { ref: "08a", label: "Tag → location binding written back to storage", href: "/storage/rfid-binding", module: "M05" },
      { ref: "09", label: "Task completed; SLA outcome stamped", href: "/lifter-operator/task-detail", module: "M23" },
      { ref: "10", label: "Movement written to the log — time, task type, AWB, piece, RFID, from / to", href: "/lifter-operator/movement-log", module: "M23" },
      { ref: "11", label: "Shift movement timeline and productivity roll-up", href: "/lifter-operator/movement-log", module: "M23" },
      { ref: "12", label: "Fleet and reader health surfaced on the ops board", href: "/operations-supervisor/live-ops-view", module: "M22", note: "Asset tiles carry total / active / fault / offline per class." },
      { ref: "13", label: "Fixed-reader and handheld fleet configuration", href: "/rfid-integration", module: "M23", note: "Gate readers, antennas, power, EPC filter and duplicate window sit here, not on the operator's screen." },
      { ref: "14", label: "Equipment status carried into the shift handover", href: "/operations-supervisor/shift-handover", module: "M22", note: "Lifters, RFID readers, handhelds, conveyor, gate devices and cold-chain sensors are six named lines on the handover form." },
    ],
  },
  {
    id: "FC-16",
    title: "ULD Management",
    subtitle: "UCM, SCM and LUC — the ULD messaging track running beside Cargo-IMP",
    docNo: "SAPS-ACMS-FC-16",
    rev: "Rev 1.0",
    amendment:
      "UCM, SCM and LUC appear nowhere in FC-05's message map. FC-05 lists thirteen Cargo-IMP types — FFM, FWB, FHL, NOTOC, RCF, NFD, AWD, DIS, DLV, RCT, TFD, DEP, TGC — and not one of them is a ULD message, yet the demo has carried a full UCM / SCM / LUC builder since before the flows were reviewed. They are a second, parallel messaging track: Cargo-IMP tracks the consignment, ULD messaging tracks the container it flew in, and the two join on the flight, never on the AWB. The build therefore keeps ULD messaging as a sibling of M07 on the messaging spine rather than folding it in — the IMP console cross-links to the ULD builder and carries none of its types, and M07's coverage note says so instead of letting thirteen types read as the whole of messaging. The AirVault delta on top of that: rows are imported and validated before any message exists — type, number and owner are mandatory and a duplicate Type+Nbr+Owner is rejected on the IN list, the OUT list and across the two — the IATA syntax is generated from the grid and shown for review rather than typed by hand, and a failed send stays in the log as Failed with a correction raised against the original message reference, so correction lineage is a record instead of a re-key. One gap is left honest rather than drawn as working: the SCM condition list offers only “No Damage”, so a damaged or off-hire unit cannot yet be expressed and the repair branch below is a specification, not a transcription. M24 sits on the FC-12 messaging spine, alongside M07 and M08.",
    steps: [
      { ref: "01", label: "Flight identified — IN and OUT flight numbers, aircraft registration, station", href: "/import/flights", module: "M01", note: "UCM is per-flight, not per-AWB — the join to the cargo flows is the flight and the registration, never the consignment." },
      { ref: "02", label: "ULD rows loaded — CSV, XLSX, paste, or from an existing UCM / SCM / LUC", href: "/uld-message-builder/import-ulds", module: "M24" },
      { ref: "03", label: "Rows validated before a message exists?", href: "/uld-message-builder/import-ulds", module: "M24", decision: true, note: "Valid / warning / invalid per row: type, nbr and owner mandatory, duplicate Type+Nbr+Owner rejected, In-Repair flagged as a warning." },
      { ref: "03a", label: "Invalid rows corrected or removed before import", href: "/uld-message-builder/import-ulds", module: "M24" },
      { ref: "04", label: "UCM built — IN and OUT lists, destination and content per OUT unit", href: "/uld-message-builder/ucm", module: "M24" },
      { ref: "05", label: "Units moved between IN and OUT as the aircraft is worked", href: "/uld-message-builder/ucm", module: "M24", note: "A unit cannot sit on both lists — the cross-list duplicate check blocks the move in either direction." },
      { ref: "06", label: "IATA syntax generated from the grid and reviewed before send", href: "/uld-message-builder/ucm", module: "M24", note: "UCM / flight pair / registration / station, then the IN block, the OUT block with dest and content, and an SI line. Generated, never typed." },
      { ref: "07", label: "Message saved and submitted to the airline", href: "/uld-message-builder/ucm", module: "M24", note: "Save is gated on validation, sending station and flight date, and at least one IN or OUT row." },
      { ref: "08", label: "Send failed?", href: "/uld-message-builder/message-log", module: "M24", decision: true, note: "Four states a message can hold: Draft, Sent, Correction, Failed." },
      { ref: "09", label: "Correction raised against the original message reference", href: "/uld-message-builder/ucm", module: "M24", note: "The log keeps correctionOf, so the lineage survives as a record rather than a silent re-key." },
      { ref: "10", label: "Periodic station stock check — every unit's status and condition", href: "/uld-message-builder/scm", module: "M24", note: "Status Available / In Repair; condition offers only “No Damage” today." },
      { ref: "11", label: "Unit damaged or off-hire?", href: "/uld-message-builder/scm", module: "M24", decision: true, note: "Open gap — with a single condition value this branch cannot be expressed. Damage codes and the repair / off-hire route need SAPS before this node is buildable." },
      { ref: "12", label: "SCM syntax generated per unit and sent", href: "/uld-message-builder/scm", module: "M24", note: "One line per unit: originator, station, local date/time, type, nbr, owner, substation, status, condition, plus an SI line." },
      { ref: "13", label: "LUC control receipts registered per flight reference", href: "/uld-message-builder/luc", module: "M24", note: "Register only — reference, station, created / submitted, status, creator." },
      { ref: "14", label: "Search across all three types — station, flight, registration, ULD type / nbr / owner, date", href: "/uld-message-builder/search", module: "M24" },
      { ref: "15", label: "Message log — every message with status, creator and correction lineage", href: "/uld-message-builder/message-log", module: "M24" },
      { ref: "16", label: "Cargo-IMP status messages for the same flight", href: "/messaging/iata", module: "M07", note: "The separate spine: the IMP console carries the thirteen FC-05 types, cross-links here, and carries none of the ULD types itself." },
      { ref: "17", label: "Export-side ULD build verified against the PFM / load plan", href: "/export/buildup", module: "M16", note: "FC-11 §18b — same physical unit, different control. The UCM says which units flew; the build-up report says what was in them." },
    ],
  },
  {
    id: "FC-17",
    title: "Finance ERP Bridge",
    subtitle: "GL mapping, journal push and the failure path to SAP / Oracle",
    docNo: "SAPS-ACMS-FC-17",
    rev: "Rev 1.0",
    amendment:
      "The ERP bridge is outside the awarded contract scope and the screen carries that notice itself; this flow exists so the optional integration has a defined edge rather than an implied one. The delta is that AirVault does not post to the ledger — it maps and pushes. A charge type is bound to a GL account, tax account, cost centre, posting rule, debit/credit indicator, tax code and currency, and nothing reaches SAP or Oracle that is not covered by an active mapping; an inactive mapping produces a Skipped sync record rather than a silent drop. The push fires only after FC-07 has an invoice and a reconciled payment, so a journal is evidence of a settled charge and not an accrual guess. Every response is retained verbatim against the sync record — the ERP document number on success, the actual fault on failure: 500 GL timeout, 401 expired token, 503 with the retry attempt number — because a “Failed” with no response body is precisely what makes a month-end unreconcilable. Retries are counted, zero-amount lines auto-skip, and what survives both becomes a named GL exception rather than a silent hole. The connector's health sits on the same integration board as PSW / WeBOC, the payment gateway and the airline feed, so an ERP outage is visible in the same place as every other outage. There is no CMTS table behind any of this. M25 sits in FC-12 Tier 3 — Output / Closure, beside M19 and M20, since it is a post-settlement outbound record rather than a processing step.",
    steps: [
      { ref: "01", label: "ERP target configured — SAP / Oracle / None, environment, endpoint, auth type", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "Four environments and four auth types; None is a first-class choice, so the bridge can be switched off rather than left half-wired." },
      { ref: "02", label: "Connection tested before any journal is pushed", href: "/finance-manager/erp-bridge-mapping", module: "M25", decision: true },
      { ref: "03", label: "GL mapping rule per charge type — GL, tax account, cost centre, posting rule, D/C, tax code, currency", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "Ten charge types, five posting rules (Standard, Reversal, Split, Consolidated, Auto-Post), five tax codes — the same charge vocabulary FC-07 bills on." },
      { ref: "04", label: "Mapping active?", href: "/finance-manager/erp-bridge-mapping", module: "M25", decision: true, note: "An inactive or retired mapping yields a Skipped record, not a silent drop — retired storage charges and the zero-rated bond fee both show as Skipped today." },
      { ref: "05", label: "Invoice / tax invoice raised (FC-07 §09)", href: "/finance-manager/invoice-generation", module: "M11" },
      { ref: "06", label: "Payment received and reconciled (FC-07 §13)", href: "/finance-manager/payment-reconciliation", module: "M11", note: "The push fires on a settled charge, so the journal is not an accrual guess." },
      { ref: "07", label: "Journal assembled — invoice, AWB, charge type, amount, tax, GL account, cost centre", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "Each sync record carries its own payload alongside the assembled journal." },
      { ref: "08", label: "Pushed — immediately, or held for the batch window", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "Pending means queued for the batch window, and says so in the audit trail rather than looking like a stall." },
      { ref: "09", label: "ERP response captured verbatim", href: "/finance-manager/erp-bridge-mapping", module: "M25", decision: true, note: "Success carries the ERP document number; failure carries the real fault — 500 Oracle GL timeout, 401 expired API token, 503 with retry 2/3." },
      { ref: "09a", label: "Zero-amount line auto-skipped, not failed", href: "/finance-manager/erp-bridge-mapping", module: "M25" },
      { ref: "09b", label: "Failure retried with an attempt count; what survives becomes a GL exception", href: "/finance-manager/erp-bridge-mapping", module: "M25", note: "Failed pushes and GL exceptions are counted separately on the KPI strip so a retry queue is not mistaken for a clean run." },
      { ref: "10", label: "Journal reference written back against the invoice", href: "/finance-manager/invoice-generation", module: "M11", note: "Every successful sync carries a JV reference; failed and retrying rows carry none." },
      { ref: "11", label: "Payload and per-sync audit trail retained", href: "/finance-manager/erp-bridge-mapping", module: "M25" },
      { ref: "12", label: "Connector health shown alongside the other integrations", href: "/integration-status", module: "M25", note: "ERP Push SAP / Oracle already sits on the integration board with its last error — “Connection refused — ERP endpoint unreachable”, awaiting VPN config." },
      { ref: "13", label: "Financial trace — invoice → payment → journal", href: "/auditor/financial-trace", module: "M20" },
    ],
  },
  {
    id: "FC-18",
    title: "Airmail / Postal",
    subtitle: "Dispatch receipt, transfer manifest and delivery bill — specification, not transcription",
    docNo: "SAPS-ACMS-FC-18",
    rev: "Rev 1.0",
    amendment:
      "Airmail has three CMTS tables and no flowchart. AIRMAILDELIVERYBILL (25 columns), AIRMAILTRANSFERMANIFEST (19) and POMailType (3) carry dispatch number, AV7 number, PO of origin and destination, mail type, loose-parcels gross and physical weight and an irregularity field, and none of it is reachable from FC-01 through FC-12 or from any screen in the demo — every step below has a null href because nothing implements it. Three things this flow has to settle rather than inherit. First, gross-versus-physical weight on loose parcels is the same declared-versus-physical variance FC-01 raises a CDR for, and the airmail irregularity column is a second parallel record of the same fact; one has to win, and the AirVault position is that airmail irregularities are raised through the FC-04 CDR mechanism with the dispatch number as the entity, not through a free-text column nobody can report on. Second, postal customs is not FC-06 — dutiable postal items do not travel on a Single Declaration, so that node is drawn as an open branch pending SAPS rather than wired into the PSW gateway. Third, there is no airmail rate in the tariff master, so whether a dispatch is charged under FC-07 or billed under a Post Office contract is unresolved and is drawn as a decision, not assumed away. This is BLK-01 in the build plan, parked at P9-6, and it stays a specification until SAPS confirm the regime. M26 sits in FC-12 Tier 2 — Core Processing, since it is a distinct cargo type processed end to end, borrowing M13 gate pass and M14 POD only at the tail.",
    steps: [
      { ref: "01", label: "Mail received off the flight against the AV7 delivery bill", href: null, module: "M26", note: "AIRMAILDELIVERYBILL, 25 columns — dispatch no, AV7 no. Not built; no route exists." },
      { ref: "02", label: "Dispatch identified — PO of origin, PO of destination, mail type", href: null, module: "M26", note: "POMailType is a three-column lookup; the code list itself has to come from SAPS before this node is buildable." },
      { ref: "03", label: "Receptacles counted and weighed — loose-parcels gross vs physical weight", href: null, module: "M26", note: "Both weights are CMTS columns on the delivery bill; capturing one without the other makes the variance check impossible." },
      { ref: "04", label: "Gross vs physical variance beyond tolerance?", href: null, module: "M26", decision: true, note: "Structurally identical to FC-01/FC-02 declared-vs-physical. Raised through the FC-04 CDR mechanism with the dispatch number as the entity, not as a private airmail exception type." },
      { ref: "05", label: "Irregularity recorded against the dispatch", href: null, module: "M26", note: "CMTS carries its own irregularity column; running it alongside a CDR would give two records of one fact. One of the two must be the source — the AirVault position is the CDR." },
      { ref: "06", label: "Mail segregated and stored by mail type", href: null, module: "M26", note: "No mail-type → zone rule exists in CARGOSUBCLASSLOCATION, so FC-03 cannot allocate airmail today." },
      { ref: "07", label: "Onward leg required?", href: null, module: "M26", decision: true, note: "The Yes edge is airmail's own transfer path and does not reuse the FC-09 bonded transhipment register." },
      { ref: "08", label: "Transfer manifest raised to the receiving carrier or station", href: null, module: "M26", note: "AIRMAILTRANSFERMANIFEST, 19 columns. Not built." },
      { ref: "09", label: "Dutiable postal items presented to customs", href: null, module: "M26", decision: true, note: "Open branch — not FC-06. Postal items do not travel on a Single Declaration, so the PSW / WeBOC gateway does not apply and the regime needs SAPS confirmation." },
      { ref: "10", label: "Chargeable under the tariff, or contract-billed to the Post Office?", href: null, module: "M26", decision: true, note: "BLK-01 — no airmail rate exists in the tariff master and P9-6 is parked pending SAPS." },
      { ref: "11", label: "Delivery bill signed at handover to Pakistan Post", href: null, module: "M26", note: "The airmail equivalent of FC-08's POD; whether it reuses the digital POD pack (signature, CNIC, geo, photo) is a decision for SAPS, not an assumption." },
      { ref: "12", label: "Dispatch closed and archived", href: null, module: "M26", note: "Closure and archive would fold into M20 once the module exists; today there is nothing to close." },
    ],
  },
];

export function flow(id: string): FlowDef | undefined {
  return FLOWS.find((f) => f.id === id);
}
