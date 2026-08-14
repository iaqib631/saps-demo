"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Warehouse,
  Truck,
  Calendar,
  Ship,
  UserCheck,
  Receipt,
  Forklift,
  ChevronLeft,
  ChevronRight,
  UserCog,
  X,
  Network,
  Plug,
  KeyRound,
  Package,
  Container,
  Gauge,
  ShieldCheck,
  Wallet,
  FileScan,
  Boxes,
  TriangleAlert,
  Landmark,
  Coins,
  PackageCheck,
  Send,
  Repeat,
  PlaneTakeoff,
} from "lucide-react";

/* =============================================================================
 * PORTAL-SEPARATED NAVIGATION  ·  fourteen portals, one rail
 * -----------------------------------------------------------------------------
 * The client requirement is two things at once, and they pull in opposite
 * directions:
 *
 *   (a) every portal is SEPARATE and self-contained — admin, lifter, customer
 *       and broker each own their own screens, none congested into another —
 *       because each portal is eventually lifted into its own repository; and
 *   (b) all fourteen are visible in ONE sidebar, because until that split
 *       happens the client needs to see the whole picture in a single rail.
 *
 * The resolution is that a portal is a first-class thing in the data model
 * (`PORTALS`), carrying its audience and its owning flow, and the rail is a
 * flat, flow-ordered list of blocks (`RAIL`) where each block declares which
 * portal owns it. Headings are DERIVED by grouping consecutive blocks with the
 * same portal, which means portal membership and rail position are authored
 * exactly once each and cannot drift apart. It also means a portal that has to
 * be interrupted for flow reasons — see Terminal Operations below — renders as
 * two headed runs automatically rather than needing a second hand-kept list.
 *
 * The audience tag on every heading is not decoration: it is the repo-split
 * boundary written into the nav, so that when the portals are extracted the
 * question "who ships this screen?" is answerable from the sidebar alone.
 * ===========================================================================*/

/**
 * Who a portal is built for. This is the eventual repository boundary — an
 * `internal-ops` screen and a `customer` screen must never end up in the same
 * bundle once the portals are extracted, however similar their content looks.
 */
export type Audience =
  | "internal-ops"
  | "admin"
  | "customer"
  | "agent"
  | "partner"
  | "oversight"
  | "platform";

export type PortalId =
  | "platform"
  | "terminal-ops"
  | "finance"
  | "customer"
  | "cha"
  | "forwarding-agent"
  | "gate-yard"
  | "warehouse"
  | "equipment"
  | "uld"
  | "planning"
  | "supervision"
  | "administration"
  | "audit";

export interface PortalMeta {
  /** Heading shown in the rail. */
  label: string;
  /**
   * Rendered verbatim beside the heading. The raw taxonomy word is used rather
   * than a friendlier label on purpose: the point of showing it at all is that
   * the eventual repo split is legible from the nav, and "internal-ops" says
   * which bundle a screen ships in where "Operations" would not.
   */
  audience: Audience;
  /** The flow(s) this portal owns, so the split is legible from the nav itself. */
  flow: string;
}

export const PORTALS: Record<PortalId, PortalMeta> = {
  platform: { label: "Platform", audience: "platform", flow: "Shared shell — stays behind on the split" },
  "terminal-ops": { label: "Terminal Operations", audience: "internal-ops", flow: "FC-01 · FC-02 · FC-03 · FC-04 · FC-06 · FC-09 · FC-10 · FC-11" },
  finance: { label: "Finance", audience: "internal-ops", flow: "FC-07 · FC-17" },
  customer: { label: "Customer Portal", audience: "customer", flow: "FC-02 consignee lane" },
  cha: { label: "CHA Portal", audience: "agent", flow: "FC-06 · FC-07 §13 · FC-08 §01 · FC-10" },
  "forwarding-agent": { label: "Forwarding Agent Portal", audience: "partner", flow: "FC-01 §22a · FC-07 §13 · FC-08 §01–04" },
  "gate-yard": { label: "Gate & Yard", audience: "internal-ops", flow: "FC-08 §02–04, §11–13" },
  warehouse: { label: "Warehouse", audience: "internal-ops", flow: "FC-03 · FC-08 §07–10" },
  equipment: { label: "Equipment & Lifter Fleet", audience: "internal-ops", flow: "FC-15" },
  uld: { label: "ULD Management", audience: "internal-ops", flow: "FC-16" },
  planning: { label: "Planning & Capacity", audience: "internal-ops", flow: "FC-13" },
  supervision: { label: "Operations Supervision", audience: "internal-ops", flow: "FC-14" },
  administration: { label: "Administration", audience: "admin", flow: "FC-12 platform" },
  audit: { label: "Audit & Oversight", audience: "oversight", flow: "FC-12 M19 / M20" },
};

interface NavLeaf {
  label: string;
  href: string;
  /**
   * Only for dynamic segments. `/awb/[awbId]` and `/flows/[flowId]` cannot be
   * named by a single href, so they declare the prefix that should light them
   * up. Every other entry matches EXACTLY — see `hits()` for why that is safe.
   */
  matchPrefix?: string;
}

interface NavBlock extends NavLeaf {
  /** The portal that owns this block. Consecutive blocks sharing a portal render under one heading. */
  portal: PortalId;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  subItems?: NavLeaf[];
}

/* -----------------------------------------------------------------------------
 * THE ORDERING RULE, AND THE DISTINCTION THAT MAKES IT TESTABLE
 * -----------------------------------------------------------------------------
 * The rail runs in FLOW ORDER: if a screen links onward to another, the target
 * sits below it. Applied naively that rule is unsatisfiable — no linear order
 * exists for this product, because `/billing/delivery-order` links back to
 * `/billing/godown-rent`, which links back to `/billing/calculator`, and the
 * customs filing/gateway pair links both ways.
 *
 * So the rule is stated over two different kinds of link:
 *
 *   ONWARD CTA        the "do this next" action. MUST point down the rail.
 *                     Every onward CTA in the app satisfies the rail below.
 *   DRILL-BACK REF    a look-up of something already established — the rate card
 *                     a calculation reads, the prerequisite a gate pass depends
 *                     on, the hub an object lives in. MAY point up, and should
 *                     be presented as a reference rather than a next step.
 *
 * `UPWARD_REFERENCES` is the complete set of links that point up the rail. It is
 * exported rather than inlined as prose so the rule is checkable: any link in
 * the app that points up the rail and is NOT in this list is an ordering bug.
 * -------------------------------------------------------------------------- */
export const UPWARD_REFERENCES: { from: string; to: string; why: string }[] = [
  {
    from: "/billing/calculator",
    to: "/finance-manager/multi-tariff-engine",
    why: "Reads the negotiated rate card. The tariff is an input to the calculation, so it is established above it.",
  },
  {
    from: "/billing/godown-rent",
    to: "/billing/calculator",
    why: "Drill-back to the charge lines the rent voucher was derived from.",
  },
  {
    from: "/billing/delivery-order",
    to: "/billing/godown-rent",
    why: "Drill-back to the rent voucher the release gate checks as paid.",
  },
  {
    from: "/dispatch/gate-pass",
    to: "/gate-entry/driver-identity-register",
    why: "FC-08 §03 is a PREREQUISITE of §06. Gate & Yard is deliberately placed above Dispatch so this reads upward into a check already performed.",
  },
  {
    from: "/dispatch/gate-pass",
    to: "/gate-entry/authority-letter-digitisation",
    why: "FC-08 §04, same prerequisite relationship as §03.",
  },
  {
    from: "/dispatch/gate-pass",
    to: "/cha/do-collection",
    why: "FC-08 §01 is the trigger that opened this flow, not its next step. The CHA portal sits above Dispatch for exactly this reason.",
  },
  {
    from: "/dispatch/closure",
    to: "/customs/detained",
    why: "Conditional 'blocked by customs detention' reference on a closure that cannot complete — not a step in the closure sequence.",
  },
  {
    from: "/export/buildup",
    to: "/messaging/iata",
    why: "The IATA console is a cross-cutting spine serving FC-01 §17, FC-04 §08, FC-09 §05 and FC-11 §13. It is held once, upstream, rather than copied into each caller.",
  },
  {
    from: "/warehouse-manager",
    to: "/exceptions/queue",
    why: "Cross-portal escalation out of the warehouse into the terminal's aging dashboard. Escalation reads upward by nature.",
  },
  {
    from: "*",
    to: "/awb/[awbId]",
    why: "The AWB hub is the object every portal drills into — the target of twelve flow steps. It is shared infrastructure, so it sits at the top of Platform and every link into it is a drill-in reference, never an onward CTA.",
  },
];

/* =============================================================================
 * THE RAIL
 * -----------------------------------------------------------------------------
 * Flow order, top to bottom. Portal headings are derived from the `portal`
 * field, so the ordering decisions live here and nowhere else.
 *
 * Portal sequence and why:
 *   Platform            the shell: home, the AWB hub every portal drills into,
 *                       the architecture views, and the auth states.
 *   Terminal Operations FC-01 spine, run 1: import → storage → messaging → customs.
 *   Finance             FC-07 §20–22 of the spine: charges → invoice → DO. Sits
 *                       between customs and dispatch because the DO is what the
 *                       gate pass is issued against.
 *   Customer Portal     the consignee receives the NOA, pays, collects the DO.
 *   CHA Portal          the broker files the GD, pays, collects the DO (FC-08 §01).
 *   Forwarding Agent    the forwarder registers the driver and vehicle that will
 *                       present at the gate (FC-08 §01–04).
 *   Gate & Yard         FC-08 §02–04 — identity and authority letter are verified
 *                       BEFORE §06 issues the gate pass, so this portal is placed
 *                       between the customs block and the dispatch block.
 *   Terminal Operations run 2: dispatch → exceptions → transhipment → export.
 *   Warehouse           physical execution of the allocation and the pick.
 *   Equipment           field execution of the tag binding.
 *   ULD Management      M07's other half; the IATA console links down into it.
 *   Planning            forecast → capacity → slots → roster.
 *   Supervision         watch the floor, measure it, escalate, hand over.
 *   Administration      the write side of configuration and RBAC.
 *   Audit & Oversight   read-only, and last: nothing flows out of it.
 * ===========================================================================*/
const RAIL: NavBlock[] = [
  /* ── Platform ─────────────────────────────────────────────────────────────
   * The only routes that stay in the host repo when the other thirteen portals
   * are extracted. Placed first because it is the shell, and because the AWB
   * hub — the object every other portal drills into — belongs at the top where
   * every reference to it reads as an upward drill-in rather than a next step.
   * -------------------------------------------------------------------------- */
  { portal: "platform", label: "Home", icon: LayoutDashboard, href: "/" },
  {
    // Had NO sidebar entry at all before this rewrite, despite being the declared
    // target of twelve flow steps across FC-02, FC-07, FC-08 and FC-09. It was
    // reachable only by accident, through in-page deep links. `/awb/1` is the
    // demo's first fixture AWB; `matchPrefix` keeps the entry lit for any id.
    portal: "platform",
    label: "AWB Hub — M03",
    icon: Package,
    href: "/awb/1",
    matchPrefix: "/awb",
  },
  {
    portal: "platform",
    label: "Architecture & Flows",
    icon: Network,
    href: "/modules",
    subItems: [
      { label: "Module Map", href: "/modules" },
      { label: "Flow Walkthroughs", href: "/flows/FC-01", matchPrefix: "/flows" },
    ],
  },
  {
    portal: "platform",
    label: "Integrations",
    icon: Plug,
    href: "/integration-status",
    subItems: [
      { label: "Integration Status", href: "/integration-status" },
      { label: "RFID Integration", href: "/rfid-integration" },
      // Build-QA surface rather than a client-facing screen. It is listed rather
      // than hidden because the audit rule for this rail is that every route under
      // app/ appears in exactly one portal — an unlisted route is an unowned route.
      { label: "QA Checklist (internal)", href: "/qa-checklist" },
    ],
  },
  {
    // These four render outside the app shell (LayoutClient skips AppShell for
    // them), so following one of these links leaves the rail behind. They are
    // listed anyway because they are real, owned routes and because the demo is
    // frequently walked through each auth state on purpose.
    portal: "platform",
    label: "Access & Session",
    icon: KeyRound,
    href: "/login",
    subItems: [
      { label: "Sign In", href: "/login" },
      { label: "Session Expired", href: "/auth/session-expired" },
      { label: "Permission Denied", href: "/auth/permission-denied" },
      { label: "No Access", href: "/auth/no-access" },
    ],
  },

  /* ── Terminal Operations · run 1 ──────────────────────────────────────────
   * The FC-01 import spine. These are the routes wired to the typed domain
   * model in lib/domain, which is what makes them one portal: the import
   * boundary is the natural repo split line.
   * -------------------------------------------------------------------------- */
  {
    portal: "terminal-ops",
    label: "Import Documentation",
    icon: FileScan,
    href: "/import/flights",
    subItems: [
      { label: "Flight & Airline Data — M01", href: "/import/flights" }, //          §01–04
      { label: "OCR Intake Workbench", href: "/import/ocr-intake" }, //              §05
      { label: "AWB Summary Sheet", href: "/import/summary" }, //                    §06
      { label: "Manifest & IGM Reconciliation", href: "/import/manifest" }, //       §07–08
      { label: "AWB Indexing — M03", href: "/import/indexing" }, //                  §09
      { label: "Document Repository — M02", href: "/import/documents" }, //          FC-02 §02
      // Consolidation before acceptance. The old rail had these the other way
      // round, contradicting FC-01, which splits the house bills (§11–12) and only
      // then accepts and weighs them (§13–14).
      { label: "Consolidation & Split", href: "/import/consolidation" }, //          §11–12
      { label: "Cargo Acceptance & Weighing — M04", href: "/import/acceptance" }, // §13–14
    ],
  },
  {
    portal: "terminal-ops",
    label: "Storage & Allocation",
    icon: Boxes,
    href: "/storage/master",
    subItems: [
      { label: "Cargo & Location Master", href: "/storage/master" }, //              FC-03 §01
      { label: "Allocation Engine", href: "/storage/allocation" }, //                §15–16
      { label: "Logical vs Physical", href: "/storage/locations" }, //               FC-03 §04
      { label: "Tag Binding (RFID)", href: "/storage/rfid-binding" }, //             §10 / FC-03 §05
      { label: "Bonded Area", href: "/storage/bonded" }, //                          FC-09 §04
    ],
  },
  {
    portal: "terminal-ops",
    label: "Messaging & Alerts",
    icon: Send,
    href: "/messaging/iata",
    subItems: [
      { label: "IATA Cargo-IMP — M07", href: "/messaging/iata" }, //                 §17
      { label: "Customs Messaging Console", href: "/messaging/customs" }, //         FC-05
      { label: "Notification Engine — M08", href: "/messaging/notifications" }, //   FC-05
      // Moved out of the Import Documentation block. The notification engine links
      // onward to the NOA, and FC-01 agrees — §17 messaging, then §18 notice of
      // arrival — so the NOA has to sit below the messaging screens, not above them.
      { label: "Arrival Advice / NOA", href: "/import/arrival-advice" }, //          §18 / FC-06 §01
    ],
  },
  {
    portal: "terminal-ops",
    label: "Customs Clearance",
    icon: Landmark,
    href: "/customs",
    subItems: [
      { label: "Overview & SLA Watch", href: "/customs" }, //                        FC-06 §00
      // Filing above gateway. A declaration is filed (§03) and only then transmitted
      // (§03a); the old rail inverted them because the gateway screen was annotated
      // "canonical", which is not a reason to place a step first in a flow-ordered nav.
      { label: "SD / GD Filing — M09", href: "/customs/filing" }, //                 §03
      { label: "Gateway (PSW / WeBOC)", href: "/customs/gateway" }, //               §03a
      { label: "Customs Work Queue", href: "/customs/queue" }, //                    §04–08
      { label: "Channels & OOC", href: "/customs/channels" }, //                     §04–08 (viewer)
      { label: "Channel Detail", href: "/customs/channel-detail" }, //               §04–08 (working surface)
      { label: "OOC Capture", href: "/customs/ooc-capture" }, //                     §08
      { label: "Detained Cargo", href: "/customs/detained" }, //                     §05-R1
    ],
  },

  /* ── Finance ──────────────────────────────────────────────────────────────
   * FC-07 in full, plus the FC-17 ERP hand-off that closes it. Placed here, not
   * further down, because §20–22 of the import spine — charges, invoice,
   * delivery order — run between customs clearance and the gate pass. The gate
   * pass is issued against a DO, so the DO has to be established above it.
   *
   * Internal order is forced by the actual in-page links rather than by FC-07's
   * step numbers: invoice and calculator both link onward to godown-rent, and
   * both godown-rent and invoice link onward to delivery-order, so this is the
   * only arrangement in which no onward CTA points up.
   * -------------------------------------------------------------------------- */
  {
    portal: "finance",
    label: "Tariff & Charges",
    icon: Coins,
    href: "/finance-manager",
    subItems: [
      { label: "Finance Dashboard", href: "/finance-manager" }, //                       §00
      // Two tariff screens, deliberately: the master editor is the versioned BASE
      // rate card, the multi-tariff engine is the negotiated matrix (agent contract ×
      // consignee tier × route × cargo class). Neither expresses what the other does.
      { label: "Tariff Master Editor", href: "/finance-manager/tariff-master-editor" }, // §08
      { label: "Multi-Tariff Engine (negotiated)", href: "/finance-manager/multi-tariff-engine" }, // §08
      { label: "Charges Calculator — M10", href: "/billing/calculator" }, //            §01–08
    ],
  },
  {
    portal: "finance",
    label: "Invoice, Payment & Release",
    icon: Wallet,
    href: "/billing/invoice",
    subItems: [
      { label: "Invoice Generation", href: "/finance-manager/invoice-generation" }, //   §09
      { label: "Invoice, Payment & Waiver", href: "/billing/invoice" }, //               §09–13
      { label: "Waiver Approval Workflow", href: "/finance-manager/waiver-workflow" }, // §10–12
      { label: "Godown Rent Voucher — M11", href: "/billing/godown-rent" }, //           §14
      { label: "Payment Reconciliation (bank)", href: "/finance-manager/payment-reconciliation" }, // §13
      { label: "Payment Gateway Reconciliation", href: "/finance-manager/payment-gateway-reconciliation" }, // §13
      { label: "Delivery Order & Release — M12", href: "/billing/delivery-order" }, //   §15
      { label: "ERP Bridge Mapping", href: "/finance-manager/erp-bridge-mapping" }, //   FC-17 §01
    ],
  },

  /* ── Customer Portal ──────────────────────────────────────────────────────
   * The receiver's self-service journey, in the order the receiver experiences
   * it: notice received → charges paid → DO downloaded → pickup booked → POD
   * signed. Nothing under app/consignee imports lib/domain, which is what makes
   * this portal genuinely liftable into a customer-facing repo of its own.
   * -------------------------------------------------------------------------- */
  {
    portal: "customer",
    label: "Customer Self-Service",
    icon: Receipt,
    href: "/consignee/dashboard",
    subItems: [
      { label: "Dashboard", href: "/consignee/dashboard" }, //                       FC-02 §30
      { label: "My Shipments", href: "/consignee/my-shipments" }, //                 FC-02 §30
      { label: "Notice of Arrival", href: "/consignee/notice-of-arrival" }, //        FC-06 §01
      { label: "Pay & Download DO", href: "/consignee/pay-do" }, //                   FC-02 §32–33
      { label: "Schedule Pickup", href: "/consignee/schedule-pickup" }, //            FC-08 §01
      { label: "POD History", href: "/consignee/pod-history" }, //                    FC-08 §14
    ],
  },

  /* ── CHA Portal ───────────────────────────────────────────────────────────
   * The customs broker's own surface. It is not a duplicate of the terminal's
   * customs block: `/customs/filing` is the terminal READING a declaration,
   * `/cha/gd-filing-workbench` is the broker FILING it. Placed above Dispatch
   * because `/cha/do-collection` is FC-08 §01 — the literal first step of the
   * gate-pass flow, which the old rail buried ~150 lines below the flow it opens.
   * -------------------------------------------------------------------------- */
  {
    portal: "cha",
    label: "Customs Broker Desk",
    icon: UserCheck,
    href: "/cha",
    subItems: [
      { label: "Dashboard", href: "/cha" }, //                                       FC-06 §02
      { label: "GD Filing Workbench", href: "/cha/gd-filing-workbench" }, //          FC-06 §03
      { label: "Channel-Specific Workflow", href: "/cha/channel-specific-workflow" }, // §04–05
      { label: "OOC Tracking", href: "/cha/ooc-tracking" }, //                        §08
      { label: "Payments", href: "/cha/payments" }, //                                FC-07 §13
      { label: "DO Collection", href: "/cha/do-collection" }, //                      FC-08 §01
      { label: "Re-export / Long-Stay Console", href: "/cha/re-export-long-stay" }, // FC-10
    ],
  },

  /* ── Forwarding Agent Portal ──────────────────────────────────────────────
   * The freight forwarder, ordered as their booking-to-settlement arc. Not
   * FC-18 — that is Airmail. This is an actor portal over FC-01/FC-07/FC-08
   * touchpoints, which is why it needs no flow of its own. It sits immediately
   * above Gate & Yard because the driver and vehicle registered here are the
   * ones the gate verifies next.
   * -------------------------------------------------------------------------- */
  {
    portal: "forwarding-agent",
    label: "Freight Forwarder Desk",
    icon: Ship,
    href: "/forwarding-agent",
    subItems: [
      { label: "Dashboard", href: "/forwarding-agent" },
      { label: "AWB Entry — Digital", href: "/forwarding-agent/awb-entry-digital" }, //   FC-01 §22a
      { label: "Pickup Scheduling", href: "/forwarding-agent/pickup-scheduling" }, //     FC-08 §01
      { label: "Driver Register", href: "/forwarding-agent/driver-register" }, //         FC-08 §03
      { label: "Vehicle Register", href: "/forwarding-agent/vehicle-register" }, //       FC-08 §12
      { label: "Dispatch Documents", href: "/forwarding-agent/dispatch-documents" },
      { label: "Payments", href: "/forwarding-agent/payments" }, //                       FC-07 §13
      { label: "Notifications & History", href: "/forwarding-agent/notifications-history" },
    ],
  },

  /* ── Gate & Yard ──────────────────────────────────────────────────────────
   * Placed here, between Terminal Operations' customs block and its dispatch
   * block, for one specific reason: FC-08 verifies receiver identity (§03) and
   * the authority letter (§04) BEFORE it generates the gate pass (§06). The old
   * rail had the gate pass in Operational Flow and both checks far below in Role
   * Views, so walking the nav top-to-bottom issued the pass before showing the
   * two checks that gate it.
   *
   * Vehicle exit (§12–13) trails the gate pass in flow terms but stays with its
   * portal: for a six-screen portal, self-containment is worth more than the one
   * intra-portal step that reads out of order, and splitting it would defeat the
   * whole point of the exercise.
   * -------------------------------------------------------------------------- */
  {
    portal: "gate-yard",
    label: "Gate & Yard",
    icon: Truck,
    href: "/gate-entry",
    subItems: [
      { label: "Gate Dashboard", href: "/gate-entry" }, //                            §00
      { label: "Vehicle Entry — M13", href: "/gate-entry/vehicle-entry" }, //          §02
      { label: "Driver Identity Register", href: "/gate-entry/driver-identity-register" }, // §03
      { label: "Authority Letter Digitisation", href: "/gate-entry/authority-letter-digitisation" }, // §04
      { label: "Live Vehicle Board — M13", href: "/gate-entry/live-vehicle-board" }, // §11
      { label: "Vehicle Exit", href: "/gate-entry/vehicle-exit" }, //                  §12–13
    ],
  },

  /* ── Terminal Operations · run 2 ──────────────────────────────────────────
   * The same portal resumed. This is the one place the rail interrupts a portal,
   * and it is deliberate: the alternative is issuing a gate pass above the checks
   * that authorise it. The heading renders as a continuation so the reader can
   * see that these blocks belong to the portal above, not to Gate & Yard.
   * -------------------------------------------------------------------------- */
  {
    portal: "terminal-ops",
    label: "Dispatch & Closure",
    icon: PackageCheck,
    href: "/dispatch/gate-pass",
    subItems: [
      { label: "Gate Pass & Picking — M13", href: "/dispatch/gate-pass" }, //         §23 / FC-08 §06
      { label: "Gate-out & POD — M14", href: "/dispatch/gate-out" }, //               §24 / FC-08 §12–13
      { label: "AWB Closure & Archive", href: "/dispatch/closure" }, //               §25–27
    ],
  },
  {
    portal: "terminal-ops",
    label: "Exceptions & CDR",
    icon: TriangleAlert,
    href: "/exceptions/cdr",
    subItems: [
      { label: "CDR Workbench — M06", href: "/exceptions/cdr" }, //                   FC-04 §01–12
      { label: "Damage Register", href: "/exceptions/damage" }, //                    FC-04 §03b
      { label: "Hold Register", href: "/exceptions/holds" }, //                       FC-04 §09
      { label: "Mishandled Cargo — M17", href: "/exceptions/mishandled" }, //          FC-10 §A1–A8
      { label: "Re-export — M16", href: "/exceptions/re-export" }, //                 FC-10 §B1–B8
      { label: "Long-stay / S.82 — M18", href: "/exceptions/long-stay" }, //          FC-10 §C1–C7
      // Last, not first. It is the cross-branch aging dashboard that FC-10 puts at
      // the END; the old rail promoted the summary above the six branches feeding it,
      // which is why long-stay appeared to link "backwards" into it.
      { label: "Exception Aging Dashboard", href: "/exceptions/queue" }, //           FC-10 §aging
    ],
  },
  {
    portal: "terminal-ops",
    label: "Transhipment",
    icon: Repeat,
    href: "/transhipment/register",
    subItems: [
      { label: "Bonded Register — M15", href: "/transhipment/register" }, //          FC-09 §06–13
      { label: "Inter-station Handoff", href: "/transhipment/handoff" },
    ],
  },
  {
    portal: "terminal-ops",
    label: "Export (FC-11)",
    icon: PlaneTakeoff,
    href: "/export/booking",
    subItems: [
      { label: "Booking & Allotment", href: "/export/booking" }, //                   §01
      { label: "Acceptance & Screening", href: "/export/acceptance" }, //             §03–06
      { label: "Customs & ANF", href: "/export/customs" }, //                         §05a–05g
      { label: "Classification & Warehousing", href: "/export/warehousing" }, //      §07–09
      { label: "Build-up & Declaration", href: "/export/buildup" }, //                §12–14
      { label: "Uplift & Closure", href: "/export/uplift" }, //                       §15
    ],
  },

  /* ── Warehouse ────────────────────────────────────────────────────────────
   * The floor's own portal, below Terminal Operations because putaway and
   * picking are the PHYSICAL EXECUTION of the allocation and the gate pass
   * recorded above. awb-detail is kept as the warehouse-facing AWB register —
   * it is the only screen here wired to lib/domain, and it links up into the
   * shared AWB hub rather than restating it.
   * -------------------------------------------------------------------------- */
  {
    portal: "warehouse",
    label: "Warehouse Floor",
    icon: Warehouse,
    href: "/warehouse-manager",
    subItems: [
      { label: "Warehouse Dashboard", href: "/warehouse-manager" }, //                FC-03 §00
      { label: "AWB Register", href: "/warehouse-manager/awb-detail" }, //             FC-02 §10 / M03
      { label: "Putaway", href: "/warehouse-manager/putaway" }, //                     FC-03 §03
      { label: "Storage Map", href: "/warehouse-manager/storage-map" }, //             FC-03 §04 / §A
      { label: "Cold Chain Console", href: "/warehouse-manager/cold-chain" }, //       FC-03 §B
      { label: "Picking", href: "/warehouse-manager/picking" }, //                     FC-08 §07–10
    ],
  },

  /* ── Equipment & Lifter Fleet ─────────────────────────────────────────────
   * The lifter operator's handheld-shaped portal, FC-15. The portal root is a
   * redirect to /lifter-operator/tasks and was omitted from the old rail
   * entirely, leaving the portal with no listed entry point. Ordered on the
   * operator's real sequence — the RFID scan links back to both tasks and task
   * detail, so both sit above it.
   * -------------------------------------------------------------------------- */
  {
    portal: "equipment",
    label: "Lifter Fleet",
    icon: Forklift,
    href: "/lifter-operator",
    subItems: [
      { label: "Lifter Home", href: "/lifter-operator" }, //                          §00
      { label: "My Tasks", href: "/lifter-operator/tasks" }, //                       §01
      { label: "Task Detail", href: "/lifter-operator/task-detail" }, //              §02
      { label: "RFID Scan", href: "/lifter-operator/rfid-scan" }, //                  §03 / FC-03 §05
      { label: "Movement Log", href: "/lifter-operator/movement-log" }, //            §04
      { label: "Lifter Status", href: "/lifter-operator/lifter-status" }, //          §05
    ],
  },

  /* ── ULD Management ───────────────────────────────────────────────────────
   * FC-16, promoted out of the old "System & Roadmap" bucket into a first-class
   * portal. It is the other half of M07: the IATA console links down into it,
   * and the old rail had the two furthest-apart sections of the nav holding one
   * module. The six auth screens that used to live under this namespace were
   * never ULD screens and are now in Platform, where they survive the split.
   * -------------------------------------------------------------------------- */
  {
    portal: "uld",
    label: "ULD Messaging",
    icon: Container,
    href: "/uld-message-builder",
    subItems: [
      { label: "ULD Dashboard", href: "/uld-message-builder" }, //                    §00
      { label: "Import ULDs", href: "/uld-message-builder/import-ulds" }, //          §01
      { label: "UCM — ULD Control Message", href: "/uld-message-builder/ucm" }, //     §02
      { label: "SCM — Stock Check Message", href: "/uld-message-builder/scm" }, //     §03
      { label: "LUC Message Builder", href: "/uld-message-builder/luc" }, //          §04
      { label: "Message Log", href: "/uld-message-builder/message-log" }, //          §05
      { label: "Search ULD Messages", href: "/uld-message-builder/search" }, //       §06
    ],
  },

  /* ── Planning & Capacity ──────────────────────────────────────────────────
   * FC-13. Demand Forecast is FIRST: it is filed under M01 Flight & Airline
   * Data as an INPUT, so the capacity view and the slot plan are built FROM it.
   * The old rail listed it last, which read as though the forecast were a
   * by-product of the roster. The /planner hub itself was unlisted; it is the
   * portal entry point and is restored here.
   * -------------------------------------------------------------------------- */
  {
    portal: "planning",
    label: "Planning & Capacity",
    icon: Calendar,
    href: "/planner",
    subItems: [
      { label: "Planning Home", href: "/planner" }, //                                §00
      { label: "Demand Forecast", href: "/planner/demand-forecast" }, //              §01 / M01
      { label: "Capacity Dashboard", href: "/planner/capacity-dashboard" }, //        §02
      { label: "Slot Planner", href: "/planner/slot-planner" }, //                    §03
      { label: "Resource Roster", href: "/planner/resource-roster" }, //              §04
    ],
  },

  /* ── Operations Supervision ───────────────────────────────────────────────
   * FC-14, ordered as the supervisor's shift arc: watch the floor, measure it,
   * handle what escalates, hand the shift over, record the notes. The root is a
   * redirect to live-ops-view and, like the other persona roots, was missing
   * from the old rail.
   * -------------------------------------------------------------------------- */
  {
    portal: "supervision",
    label: "Operations Supervision",
    icon: Gauge,
    href: "/operations-supervisor",
    subItems: [
      { label: "Supervision Home", href: "/operations-supervisor" }, //               §00
      { label: "Live Ops View", href: "/operations-supervisor/live-ops-view" }, //     §01
      { label: "Performance Console", href: "/operations-supervisor/performance-console" }, // §02
      { label: "Escalation Inbox", href: "/operations-supervisor/escalation-inbox" }, // §03
      { label: "Shift Handover", href: "/operations-supervisor/shift-handover" }, //   §04
      { label: "MoM / Floor Notes", href: "/operations-supervisor/mom-floor-notes" }, // §05
    ],
  },

  /* ── Administration ───────────────────────────────────────────────────────
   * Tenant configuration and the WRITE side of RBAC, ordered identity →
   * permissions → reference data → integrations → settings → the two read-back
   * logs. Kept strictly separate from Audit & Oversight below: an admin who can
   * edit roles must not be the same surface that certifies them.
   * -------------------------------------------------------------------------- */
  {
    portal: "administration",
    label: "Administration",
    icon: UserCog,
    href: "/admin",
    subItems: [
      { label: "Admin Dashboard", href: "/admin" }, //                                §T3-01
      { label: "Users", href: "/admin/users" }, //                                    §T3-02
      { label: "Roles & Permissions", href: "/admin/roles" }, //                      §T3-03
      { label: "Master Data Editor", href: "/admin/master-data" }, //                 §T3-04
      { label: "Integration Console", href: "/admin/integrations" }, //               §T3-05
      { label: "System Settings", href: "/admin/settings" }, //                       §T3-06
      { label: "Audit Trail Browser", href: "/admin/audit-trail" }, //                §M20-01
      { label: "Session & Event Log", href: "/admin/event-log" }, //                  §M20-02
    ],
  },

  /* ── Audit & Oversight ────────────────────────────────────────────────────
   * Read-only, and last, because nothing flows out of it. /reports joins the
   * auditor screens here rather than sitting alone in a utilities bucket: both
   * are M19/M20 output surfaces for the same audience, and the old rail split
   * that one audience across two sections. Ordered home → the two traces → the
   * RBAC certification → the export that leaves the building.
   * -------------------------------------------------------------------------- */
  {
    portal: "audit",
    label: "Audit & Oversight",
    icon: ShieldCheck,
    href: "/auditor",
    subItems: [
      { label: "Auditor Home", href: "/auditor" }, //                                 §M19-01
      { label: "Cargo Trace", href: "/auditor/cargo-trace" }, //                      §M20-03
      { label: "Financial Trace", href: "/auditor/financial-trace" }, //              §M20-04
      { label: "RBAC Snapshot", href: "/auditor/rbac-snapshot" }, //                  §M20-05
      { label: "Export Centre", href: "/auditor/export-centre" }, //                  §M20-06
      { label: "Reports & Dashboards", href: "/reports" }, //                         §M19-02
    ],
  },
];

/* -----------------------------------------------------------------------------
 * ROUTE → PORTAL index.
 *
 * Built from the rail rather than hand-maintained, which is the point: the old
 * shell kept a separate hand-written map of route → portal name for the header,
 * and it had drifted badly — every /import/*, /customs/* and /billing/* route
 * was missing from it and fell through to "Home". Deriving it here means the
 * header can never disagree with the sidebar about which portal you are in.
 * -------------------------------------------------------------------------- */
const ROUTE_PORTAL = new Map<string, PortalId>();
const PREFIX_PORTAL: { prefix: string; portal: PortalId }[] = [];

for (const block of RAIL) {
  const entries: NavLeaf[] = [block, ...(block.subItems ?? [])];
  for (const entry of entries) {
    ROUTE_PORTAL.set(entry.href, block.portal);
    if (entry.matchPrefix) PREFIX_PORTAL.push({ prefix: entry.matchPrefix, portal: block.portal });
  }
}

/** The portal that owns `pathname`, or `null` for a route no portal claims. */
export function portalForPath(pathname: string): PortalMeta | null {
  const exact = ROUTE_PORTAL.get(pathname);
  if (exact) return PORTALS[exact];
  for (const { prefix, portal } of PREFIX_PORTAL) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return PORTALS[portal];
  }
  return null;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  /**
   * Matching is EXACT, not prefix-based, with `matchPrefix` as the single opt-in
   * escape hatch for the two dynamic routes. Prefix matching used to be needed
   * because the rail was incomplete — an unlisted child route had to light up
   * its nearest listed ancestor. Now that every route under app/ appears in the
   * rail exactly once, prefix matching only causes false positives: it would
   * light up the Finance "Tariff & Charges" block for every /finance-manager/*
   * route, including the six that live in the block below it.
   */
  const hits = (item: NavLeaf) =>
    pathname === item.href ||
    (item.matchPrefix !== undefined &&
      (pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + "/")));

  const renderBlock = (block: NavBlock) => {
    const Icon = block.icon;
    const isActive = hits(block) || (block.subItems?.some(hits) ?? false);

    return (
      <div key={`${block.portal}:${block.label}`}>
        <Link
          href={block.href}
          onClick={() => onMobileClose?.()}
          className="relative flex items-center gap-3 h-10 rounded-lg transition-all duration-200 cursor-pointer no-underline"
          style={{
            paddingLeft: collapsed ? 16 : 12,
            paddingRight: collapsed ? 16 : 12,
            backgroundColor: isActive ? "#EBF0F7" : "transparent",
            color: isActive ? "#0B2545" : "#64748B",
          }}
        >
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
              style={{ backgroundColor: "#0B2545" }}
            />
          )}
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
          </div>
          {!collapsed && (
            <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {block.label}
            </span>
          )}
        </Link>
        {block.subItems && !collapsed && isActive && (
          <div className="flex flex-col gap-0.5 mt-0.5 ml-2 pl-4 border-l-2 border-[#E2E8F0]">
            {block.subItems.map((sub) => {
              const isSubActive = hits(sub);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => onMobileClose?.()}
                  className="relative flex items-center h-8 rounded-lg transition-all duration-200 cursor-pointer no-underline text-[12px] font-medium px-3"
                  style={{
                    backgroundColor: isSubActive ? "#EBF0F7" : "transparent",
                    color: isSubActive ? "#0B2545" : "#94A3B8",
                  }}
                >
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /**
   * Group the flat rail into headed runs. A run is a maximal stretch of
   * consecutive blocks owned by the same portal, so the fourteen headings fall
   * out of the ordering rather than being declared alongside it. A portal that
   * appears twice — only Terminal Operations does — renders its second run as a
   * continuation, which is honest about the interruption instead of hiding it.
   */
  const runs: { portal: PortalId; blocks: NavBlock[]; continued: boolean }[] = [];
  const seen = new Set<PortalId>();
  for (const block of RAIL) {
    const last = runs[runs.length - 1];
    if (last && last.portal === block.portal) {
      last.blocks.push(block);
      continue;
    }
    runs.push({ portal: block.portal, blocks: [block], continued: seen.has(block.portal) });
    seen.add(block.portal);
  }

  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 ease-in-out relative z-40"
      style={{ width: collapsed ? 64 : 248 }}
    >
      <div className="lg:hidden flex items-center justify-end px-3 py-2 border-b border-[#E2E8F0]">
        <button
          onClick={onMobileClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <nav className="flex flex-col gap-0.5 px-2">
          {runs.map((run, idx) => {
            const meta = PORTALS[run.portal];
            return (
              <div key={`${run.portal}-${idx}`} className="flex flex-col gap-0.5">
                {!collapsed ? (
                  <div className="px-3 pt-4 pb-1.5 select-none">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0B2545] whitespace-nowrap overflow-hidden text-ellipsis">
                        {meta.label}
                        {run.continued && (
                          <span className="font-normal text-[#94A3B8] normal-case tracking-normal"> · cont.</span>
                        )}
                      </span>
                      <span className="flex-shrink-0 text-[9px] font-medium tracking-wide text-[#94A3B8]">
                        {meta.audience}
                      </span>
                    </div>
                    {!run.continued && (
                      <div className="mt-0.5 text-[9px] leading-tight text-[#94A3B8]">{meta.flow}</div>
                    )}
                  </div>
                ) : (
                  /* Collapsed rail hides headings, so a hairline is the only thing
                   * left to show where one portal ends and the next begins. */
                  idx > 0 && <div className="my-2 mx-2 h-px bg-[#E2E8F0]" />
                )}
                {run.blocks.map(renderBlock)}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="px-2 py-2 border-t border-[#E2E8F0]">
        <button
          onClick={onToggle}
          className="w-full h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer transition-colors"
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft size={18} />
              <span className="text-[12px] font-medium">Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
