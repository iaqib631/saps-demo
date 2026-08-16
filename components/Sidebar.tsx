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
  Plug,
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
  Mail,
} from "lucide-react";

/* =============================================================================
 * PORTAL-SEPARATED NAVIGATION  ·  three portals, twenty-three blocks, one rail
 * -----------------------------------------------------------------------------
 * The client requirement is two things at once, and they pull in opposite
 * directions:
 *
 *   (a) every portal is SEPARATE and self-contained — warehouse, consignee and
 *       superadmin each own their own screens, none congested into another —
 *       because each portal is eventually lifted into its own repository; and
 *   (b) all three are visible in ONE sidebar, because until that split happens
 *       the client needs to see the whole picture in a single rail.
 *
 * The resolution is that a portal is a first-class thing in the data model
 * (`PORTALS`), carrying its audience and its owning flow, and the rail is a
 * flat, flow-ordered list of blocks (`RAIL`) where each block declares which
 * portal owns it. Headings are DERIVED by grouping consecutive blocks with the
 * same portal, which means portal membership and rail position are authored
 * exactly once each and cannot drift apart. With three portals the rail runs
 * as three unbroken headed runs; the grouping is kept derived anyway, so that
 * re-ordering a block can never silently orphan it from its heading.
 *
 * The audience tag on every heading is not decoration: it is the repo-split
 * boundary written into the nav, so that when the portals are extracted the
 * question "who ships this screen?" is answerable from the sidebar alone.
 *
 * WHAT THE RAIL IS NOT. An owned route is not automatically a rail entry. A
 * screen that shows ONE record, reached by clicking that record in a list, is a
 * DRILL-IN target: somewhere you are taken, not somewhere you navigate to. A nav
 * slot for it has to name a record in its href — `/awb/1`, "the" task, "the"
 * channel — and so offers a fixture as if it were a destination, which is what
 * "Select an AWB to view channel detail" says when you arrive from the rail
 * instead of from a row. Those routes live in `DRILL_IN` below, each naming the
 * parent list it is entered from; the four auth states, which render outside the
 * app shell entirely, live in `AUTH_STATES`. Both are folded into the route →
 * portal index exactly as the rail is, so an off-rail route is still an OWNED
 * route — see the audit invariant stated above `hits()`.
 * ===========================================================================*/

/**
 * Who a portal is built for. This is the eventual repository boundary — an
 * `internal-ops` screen and a `customer` screen must never end up in the same
 * bundle once the portals are extracted, however similar their content looks.
 */
export type Audience = "internal-ops" | "customer" | "admin";

export type PortalId = "warehouse" | "consignee" | "superadmin";

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

/**
 * Three portals, in the order the client fixed:
 *
 *   1. Warehouse   — cargo handling and airport services. Everything SAPS staff
 *                    do to a consignment, from forecast to file closure.
 *   2. Consignee   — the external parties. The consignee is the named one, and
 *                    the CHA and the freight forwarder sit with it because they
 *                    are the same side of the counter: people SAPS serves, not
 *                    people SAPS employs. Putting them in Warehouse would put a
 *                    broker's screens in the terminal's repository.
 *   3. Superadmin  — platform administration, oversight and the shared shell.
 *
 * Each is self-contained enough to be lifted into its own repository, which is
 * what `audience` records: it is the split boundary, written into the nav.
 */
export const PORTALS: Record<PortalId, PortalMeta> = {
  warehouse: {
    label: "Warehouse Portal",
    audience: "internal-ops",
    // FC-18 joins the tag with the Airmail block below. Airmail is handled by the
    // same terminal staff on the same site, so it is a warehouse-portal flow even
    // though it shares no step with the FC-01 import spine.
    flow: "FC-01 · FC-02 · FC-03 · FC-04 · FC-05 · FC-06 · FC-07 · FC-08 · FC-09 · FC-10 · FC-11 · FC-13 · FC-14 · FC-15 · FC-16 · FC-17 · FC-18",
  },
  consignee: {
    label: "Consignee Portal",
    audience: "customer",
    flow: "FC-02 consignee lane · FC-05 §17a · FC-06 · FC-07 §12a · FC-08 §01–01c · FC-10",
  },
  superadmin: {
    label: "Superadmin Portal",
    audience: "admin",
    flow: "FC-12 · M19 / M20 · platform services",
  },
};

interface NavLeaf {
  label: string;
  href: string;
  /**
   * Only for dynamic segments, which cannot be named by a single href. No RAIL
   * entry needs it any more — `/flows/[flowId]` is gone and `/awb/[awbId]` is a
   * registered drill-in — but `DRILL_IN` reuses this shape and the AWB hub still
   * declares `/awb`, which is the one thing mapping every `/awb/*` id to the
   * warehouse portal for the header. Every other entry matches EXACTLY — see
   * `hits()` for why that is safe.
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
 * `UPWARD_REFERENCES` is the complete set of links that are NOT onward CTAs. It
 * is exported rather than inlined as prose so the rule is checkable: any link in
 * the app that points up the rail and is NOT in this list is an ordering bug.
 *
 * ANOMALY, named rather than hidden: two entries below read DOWN the rail, not
 * up — `/dispatch/gate-pass` → `/cha/do-collection` and `/warehouse-manager` →
 * `/exceptions/queue`. Both cross the portal boundary, and the three-portal
 * grouping (every warehouse block above every consignee block) outranks flow
 * order across that boundary. They stay listed because what this array actually
 * whitelists is "drill-back, not next step", which is true of both; each says so
 * in its own `why`. Fixing the direction would mean interleaving the portals,
 * which is the one thing the rail may not do.
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
    why: "FC-08 §02 (verify receiver identity / CNIC) is a PREREQUISITE of §04 (generate gate pass). Gate & Yard is deliberately placed above Dispatch so this reads upward into a check already performed.",
  },
  {
    from: "/dispatch/gate-pass",
    to: "/gate-entry/authority-letter-digitisation",
    why: "FC-08 §03 (verify authority letter), same prerequisite relationship to §04 as §02.",
  },
  {
    from: "/dispatch/gate-pass",
    to: "/cha/do-collection",
    why: "FC-08 §01 is the trigger that opened this flow, not its next step. Reads DOWN the rail, not up: the CHA desk belongs to the Consignee portal, which the three-portal grouping puts below every warehouse block. Listed anyway because the property this array whitelists is drill-back-not-CTA, and that holds in either direction.",
  },
  {
    from: "/dispatch/closure",
    to: "/customs/detained",
    why: "Conditional 'blocked by customs detention' reference on a closure that cannot complete — not a step in the closure sequence.",
  },
  {
    from: "/export/buildup",
    to: "/messaging/iata",
    why: "The IATA console is a cross-cutting spine serving FC-01 §17, FC-02 §17, FC-04 §08, FC-05 §A1 / §01 / §04, FC-11 §19–20, FC-12 §09, FC-13 §02a and FC-16 §16 — the export caller here is FC-11 §19–20. It is held once, upstream, rather than copied into each caller.",
  },
  {
    from: "/warehouse-manager",
    to: "/exceptions/queue",
    why: "Escalation out of the warehouse floor into the terminal's cross-branch aging dashboard (FC-10 §aging). Reads DOWN the rail: FC-10 puts the aging dashboard at the END of the exception flow, so Exceptions & CDR sits below Warehouse Floor. Listed because it is a jump into a summary, not the floor's next step.",
  },
  {
    from: "*",
    to: "/awb/[awbId]",
    why: "The AWB hub is the object every portal drills into — the target of nineteen flow steps across FC-02, FC-03, FC-07, FC-08 and FC-09, counting one step per array entry over every /awb/* href and tab. Every link into it is a drill-in reference, never an onward CTA, which is precisely why it is registered in DRILL_IN and holds no rail slot: it has no position in flow order to be above or below.",
  },
];

/* =============================================================================
 * THE RAIL
 * -----------------------------------------------------------------------------
 * Flow order, top to bottom, WITHIN each portal. Portal headings are derived
 * from the `portal` field, so the ordering decisions live here and nowhere else.
 *
 * The three-portal grouping is the outer constraint and it outranks flow order:
 * every warehouse block runs before every consignee block, and both before
 * superadmin, because the rail must read as three unbroken headed runs. Flow
 * order is therefore satisfied inside a run, not across the boundary — which is
 * why the CHA desk holding FC-08 §01, the trigger for the gate pass, sits BELOW
 * Dispatch. `UPWARD_REFERENCES` names the two links that cross the wrong way.
 *
 * Block sequence and why, in the order they appear below. The AWB hub, the
 * channel-detail and task-detail workbenches and the four auth states are
 * absent from this list on purpose — they are off-rail routes, registered in
 * `DRILL_IN` and `AUTH_STATES` beneath the array:
 *   Planning            FC-13: forecast → capacity → slots → roster.
 *   Import Documentation FC-01 spine, run 1: §01–04 through §13–14.
 *   Storage & Allocation the location model, then FC-01 §10 tagging and §15–16.
 *   Warehouse Floor     physical execution of the allocation and the pick.
 *   Lifter Fleet        FC-15, field execution of the move and the tag binding.
 *   Messaging & Alerts  FC-01 §17–18 and the FC-05 dispatch tail.
 *   ULD Messaging       M24 / FC-16, the second messaging track beside M07.
 *   Customs Clearance   FC-06, filing → gateway → channels → OOC.
 *   Tariff & Charges    FC-07 §07a–§07b, the rate card the calculation reads.
 *   Invoice & Release   FC-07's tail plus FC-01 §20–22: charges → invoice → DO.
 *                       Sits between customs and dispatch because the DO is what
 *                       the gate pass is issued against.
 *   Gate & Yard         FC-08 §01d–§03 — the vehicle is admitted and identity and
 *                       the authority letter are verified BEFORE §04 issues the
 *                       gate pass, so this block is placed above Dispatch.
 *   Dispatch & Closure  run 2: gate pass → gate-out → closure.
 *   Exceptions & CDR    FC-04 and FC-10, with the aging dashboard last.
 *   Transhipment        FC-09.
 *   Airmail             FC-18. A whole cargo type, not a stage of the import run —
 *                       the block's own comment argues the position against FC-09.
 *   Export              FC-11.
 *   Supervision         FC-14: hand over, watch the floor, escalate, measure it.
 *   Integrations        the site's gateway estate. Last in the warehouse run
 *                       because it is site infrastructure, not a step in the
 *                       cargo pipeline — the block's own comment argues the
 *                       position and the per-site ownership.
 *   — consignee portal —
 *   Customer Portal     the consignee receives the NOA, pays, collects the DO.
 *   CHA Portal          the broker files the SD, pays, collects the DO (FC-08 §01).
 *   Forwarding Agent    the forwarder pre-registers the driver and vehicle that
 *                       will present at the gate (FC-08 §01a–§01c).
 *   — superadmin portal —
 *   Administration      the write side of configuration and RBAC.
 *   Audit & Oversight   read-only: nothing flows out of it.
 * ===========================================================================*/

/**
 * The landing page sits ABOVE the three portals rather than inside one.
 * It belongs to no portal — it is the page you arrive on before choosing
 * one — and giving it a portal id would render a fourth heading, which is
 * exactly the thing this rail no longer has.
 */
const HOME: NavLeaf & { icon: React.ComponentType<{ size?: number; strokeWidth?: number }> } = { label: "Home", icon: LayoutDashboard, href: "/" };

const RAIL: NavBlock[] = [
  {
    portal: "warehouse",
    label: "Planning & Capacity",
    icon: Calendar,
    href: "/planner",
    subItems: [
      // Re-derived against FC-13. The old 00/01/02/03/04 tokens were the entries'
      // own positions in this list, not flow steps — FC-13 numbers these screens
      // §01–§13 and has no step 00 at all.
      //
      // ANOMALY, named: Planning Home is FC-13 §11, the LAST planner node — the
      // published shift plan is the output of the forecast, capacity and slot work
      // below it. It is kept first anyway because every block in this rail leads
      // with its section home, and that consistency is worth one backwards ref.
      { label: "Planning Home", href: "/planner" }, //                                section home · FC-13 §11
      { label: "Demand Forecast", href: "/planner/demand-forecast" }, //              FC-13 §01–03
      { label: "Capacity Dashboard", href: "/planner/capacity-dashboard" }, //        FC-13 §04–05 / §13
      { label: "Slot Planner", href: "/planner/slot-planner" }, //                    FC-13 §06–07
      { label: "Resource Roster", href: "/planner/resource-roster" }, //              FC-13 §08–09
    ],
  },
  {
    portal: "warehouse",
    label: "Import Documentation",
    icon: FileScan,
    href: "/import/flights",
    subItems: [
      { label: "Flight & Airline Data — M01", href: "/import/flights" }, //          §01–04
      { label: "OCR Intake Workbench", href: "/import/ocr-intake" }, //              §05
      { label: "AWB Summary Sheet", href: "/import/summary" }, //                    §06
      { label: "Manifest & IGM Reconciliation", href: "/import/manifest" }, //       §07–08
      { label: "AWB Indexing — M03", href: "/import/indexing" }, //                  §09
      // Consolidation before acceptance. The old rail had these the other way
      // round, contradicting FC-01, which splits the house bills (§11–12) and only
      // then accepts and weighs them (§13–14).
      { label: "Consolidation & Split", href: "/import/consolidation" }, //          §11–12
      { label: "Cargo Acceptance & Weighing — M04", href: "/import/acceptance" }, // §13–14
      // Last, and deliberately outside the numbered run. Everything above is a
      // strict FC-01 spine (§01–04 · 05 · 06 · 07–08 · 09 · 11–12 · 13–14); the
      // repository carries no § of its own because it is the cross-cutting M02
      // store, and every flow that reaches it — FC-04 §03a evidence packs, FC-05
      // §05 missing-document alerts, FC-06 §02 CHA collection — arrives after the
      // spine has run. Wedged at position 6 it broke the rail's one continuous
      // numbered sequence.
      { label: "Document Repository — M02", href: "/import/documents" }, //          FC-04 §03a / FC-05 §05 / FC-06 §02
    ],
  },
  {
    portal: "warehouse",
    label: "Storage & Allocation",
    icon: Boxes,
    href: "/storage/master",
    subItems: [
      // The two reference screens first, together. Neither `/storage/master` nor
      // `/storage/locations` is touched by any flow step — they are the location
      // model you configure before allocating against it — and splitting them
      // around the operational pair is what made this block read as scrambled.
      //
      // Their trailing annotations used to read "FC-03 01" and "FC-03 04", which
      // contradicted the sentence above and were invented besides: FC-03's refs
      // are —, —, —, —, A, B, B-COL, C, — and it has no step 01 or 04 at all.
      { label: "Cargo & Location Master", href: "/storage/master" }, //              reference data — no flow step
      { label: "Logical vs Physical", href: "/storage/locations" }, //               reference data — no flow step
      // Tag binding above allocation. FC-01 tags pieces at §10 and allocates
      // storage at §15–16: a piece carries its tag out of indexing and only later
      // acquires a location. The screen is re-entered for the tag → location
      // write-back at FC-15 §08a, but first entry governs. (The old "FC-03 05"
      // here was invented too — FC-03's bind step is unnumbered and hrefs
      // /lifter-operator/rfid-scan, not this screen.)
      { label: "Tag Binding (RFID)", href: "/storage/rfid-binding" }, //             FC-01 §10 / FC-15 §08a
      { label: "Allocation Engine", href: "/storage/allocation" }, //                FC-01 §15–16 / FC-02 §14–15 / FC-05 §02
      { label: "Bonded Area", href: "/storage/bonded" }, //                          FC-09 §04
    ],
  },
  {
    portal: "warehouse",
    label: "Warehouse Floor",
    icon: Warehouse,
    href: "/warehouse-manager",
    subItems: [
      // Re-derived against FC-03, which numbers almost none of these: its refs are
      // —, —, —, —, A, B, B-COL, C, —. The old 00 / 03 / 04 tokens were list
      // positions, and §B was the storage-map ref pinned on the cold-chain screen.
      { label: "Warehouse Dashboard", href: "/warehouse-manager" }, //                section home — no flow step
      { label: "AWB Register", href: "/warehouse-manager/awb-detail" }, //             M03 — no flow step; the record is created at FC-02 §10 (/awb/1)
      { label: "Putaway", href: "/warehouse-manager/putaway" }, //                     FC-03 (unnumbered) — "system suggests rack / bin"
      { label: "Storage Map", href: "/warehouse-manager/storage-map" }, //             FC-03 §A / §B (+ the unnumbered validity check) · FC-13 §05a
      { label: "Cold Chain Console", href: "/warehouse-manager/cold-chain" }, //       FC-03 §B-COL
      { label: "Picking", href: "/warehouse-manager/picking" }, //                     FC-08 §05–09 · FC-04 handover entry (unnumbered)
    ],
  },
  {
    portal: "warehouse",
    label: "Lifter Fleet",
    icon: Forklift,
    href: "/lifter-operator",
    subItems: [
      { label: "Lifter Home", href: "/lifter-operator" }, //                          section home — no flow step
      // THE GATING RULE (applied identically in Operations Supervision below).
      // A screen that every screen beneath it depends on having already happened
      // is placed FIRST, at its §01, whatever else it is also touched by later.
      // Lifter Status was LAST and is FC-15 §01–02b. It is where the operator signs
      // on to a named asset and where fit-for-duty is decided — battery above the
      // 30% threshold, no Out-of-service fault — and the queue will not dispatch to
      // an unfit asset. It gates every screen below it, so it cannot sit beneath them.
      // FC-15 §14 re-enters the same fleet at the shift handover; first entry governs.
      { label: "Lifter Status", href: "/lifter-operator/lifter-status" }, //          FC-15 §01–02b
      // FC-15 §04 / §06–09 is /lifter-operator/task-detail, which is NOT listed
      // here: it is the one-task workbench you open from a row of My Tasks, so it
      // is a registered drill-in rather than a rail entry. The §03 → §04 edge is
      // still satisfied, it is just drawn by the list rather than by the nav.
      { label: "My Tasks", href: "/lifter-operator/tasks" }, //                       FC-15 §03
      { label: "RFID Scan", href: "/lifter-operator/rfid-scan" }, //                  FC-15 §05 · FC-03 bind step (unnumbered)
      { label: "Movement Log", href: "/lifter-operator/movement-log" }, //            FC-15 §10–11 · FC-14 §06d
    ],
  },
  {
    portal: "warehouse",
    label: "Messaging & Alerts",
    icon: Send,
    href: "/messaging/iata",
    subItems: [
      { label: "IATA Cargo-IMP — M07", href: "/messaging/iata" }, //                 FC-01 §17 · FC-05 §A1 / §01 / §04
      // NOA directly beneath the IMP console, not at the foot of the block. The
      // previous note here had it backwards: it argued the NOA must sit below the
      // notification engine because the engine links onward to it, but FC-05 runs
      // §03 NOA issued long before §16–17 channel/template resolved and dispatched.
      // The engine is that flow's TAIL — the NOA is issued and the engine then
      // dispatches it — and FC-01 makes the pairing explicit: §17 IATA messaging,
      // then §18 Notice of Arrival, spine-adjacent.
      { label: "Arrival Advice / NOA", href: "/import/arrival-advice" }, //          FC-01 §18 / FC-05 §03 / FC-06 §01
      // Notification Engine above the Customs Messaging Console, which is the
      // reverse of how these two sat. The console was annotated "FC-05" with no
      // step, which hid the ordering: it is FC-05 §18, the carrier-side half of
      // "failures surfaced for retry", and the engine is §T (the trigger bus) plus
      // §16–17, the channel/template resolution and the dispatch that §18 triages
      // the failures of. §18 cannot precede §16–17.
      { label: "Notification Engine — M08", href: "/messaging/notifications" }, //   FC-05 §T / §16–17 · FC-04 §06–07
      { label: "Customs Messaging Console", href: "/messaging/customs" }, //         FC-05 §18
    ],
  },
  {
    portal: "warehouse",
    label: "ULD Messaging",
    icon: Container,
    href: "/uld-message-builder",
    subItems: [
      // Re-derived against FC-16. The old 00–06 tokens were list positions: FC-16
      // runs §01–§17 and its §01 is /import/flights, not a screen in this block.
      // The two registers at the foot are cross-cutting rather than out of order —
      // the log holds §08 (send failed?) as well as §15, and search holds §14; both
      // are entered from the three builders above rather than run after them.
      { label: "ULD Dashboard", href: "/uld-message-builder" }, //                    section home — no flow step
      { label: "Import ULDs", href: "/uld-message-builder/import-ulds" }, //          FC-16 §02–03a
      { label: "UCM — ULD Control Message", href: "/uld-message-builder/ucm" }, //     FC-16 §04–07 / §09
      { label: "SCM — Stock Check Message", href: "/uld-message-builder/scm" }, //     FC-16 §10–12
      { label: "LUC Message Builder", href: "/uld-message-builder/luc" }, //          FC-16 §13
      { label: "Message Log", href: "/uld-message-builder/message-log" }, //          FC-16 §08 / §15
      { label: "Search ULD Messages", href: "/uld-message-builder/search" }, //       FC-16 §14
    ],
  },
  {
    portal: "warehouse",
    label: "Customs Clearance",
    icon: Landmark,
    href: "/customs",
    subItems: [
      { label: "Overview & SLA Watch", href: "/customs" }, //                        section home — no flow step (FC-06 has no step 00)
      // Filing above gateway. A declaration is filed (§03) and only then transmitted
      // (§03a); the old rail inverted them because the gateway screen was annotated
      // "canonical", which is not a reason to place a step first in a flow-ordered nav.
      //
      // The annotations below were blanket "04–08" / "08" ranges that fitted none
      // of the screens they sat on. FC-06 splits the work precisely: the queue is
      // §04a alone, the channels screen is the read-only viewer for §04 and §06–09,
      // and OOC Capture is §08a-K, the keyed branch. Detained sits last because
      // §05-R1 is a branch OUT of the block, not a step in it.
      //
      // FC-06 §05-G / §05-Y / §05-R is /customs/channel-detail, and it is NOT
      // listed here. It is the working surface for ONE declaration's channel —
      // reached by clicking a row on Channels & OOC, which is why it greets a
      // direct visit with "Select an AWB to view channel detail" — so it is a
      // registered drill-in. The §04 → §05 ordering it used to demonstrate is
      // unaffected: the viewer above still comes first, it just hands off through
      // its own rows now instead of through the nav.
      { label: "SD / GD Filing — M09", href: "/customs/filing" }, //                 FC-06 §03 · FC-02 §19
      { label: "Gateway (PSW / WeBOC)", href: "/customs/gateway" }, //               FC-06 §03a · FC-12 §08
      { label: "Customs Work Queue", href: "/customs/queue" }, //                    FC-06 §04a
      { label: "Channels & OOC", href: "/customs/channels" }, //                     FC-06 §04 / §06–09 (viewer)
      { label: "OOC Capture", href: "/customs/ooc-capture" }, //                     FC-06 §08a-K
      { label: "Detained Cargo", href: "/customs/detained" }, //                     FC-06 §05-R1
    ],
  },
  {
    portal: "warehouse",
    label: "Tariff & Charges",
    icon: Coins,
    href: "/finance-manager",
    subItems: [
      { label: "Finance Dashboard", href: "/finance-manager" }, //                       section home — no flow step
      // Two tariff screens, deliberately: the master editor is the versioned BASE
      // rate card, the multi-tariff engine is the negotiated matrix (agent contract ×
      // consignee tier × route × cargo class). Neither expresses what the other does.
      // Both were annotated with a bare "08". FC-07 has since given each its own
      // step — §07a resolves the master version in force, §07b applies the
      // negotiated set — and both sit ABOVE FC-07 §08, the slab, because a slab
      // cannot be applied before the rate set it belongs to is resolved.
      { label: "Tariff Master Editor", href: "/finance-manager/tariff-master-editor" }, // FC-07 §07a
      { label: "Multi-Tariff Engine (negotiated)", href: "/finance-manager/multi-tariff-engine" }, // FC-07 §07b
      // The calculator's own flow steps are FC-01 §20–21 and FC-02 §25–27. FC-07's
      // charge run §01–§08 is the same arithmetic but is drawn on the AWB charges
      // tab (/awb/1?tab=charges, /awb/3?tab=charges), which is why MODULES M10
      // labels this screen "Charges calculator (FC-07 §01–08)" and no FC-07 step
      // hrefs here. The old bare "§01–08" read as an FC-07 citation it never was.
      { label: "Charges Calculator — M10", href: "/billing/calculator" }, //            FC-01 §20–21 · FC-02 §25–27 · FC-05 §13
      // BELOW the calculator and ABOVE the invoice block, which is exactly the
      // span this screen covers. The calculator COMPUTES the figure; this is the
      // stored derivation of it — the CMTS `grCharges` working set, one row per
      // band walked — and the invoice that prints the result is FC-07 §09, the
      // first entry of the block beneath. Its own steps are the ones between:
      // §03 free period, §03a chargeable period, §07 category surcharge, §08 slab.
      // Those four href /awb/*?tab=charges rather than this route, the same way
      // the calculator above carries FC-07 §01–08 without an FC-07 href — the
      // block comment already argues that case, and MODULES M10 states it.
      //
      // A rail entry rather than a drill-in: the href names no fixture, and the
      // screen opens on its own list of runs, so nothing has to be clicked
      // elsewhere first to make it a destination.
      { label: "Charge Working Set", href: "/billing/charge-working-set" }, //          FC-07 §03 / §03a / §07–08 · committed against the §15 voucher
    ],
  },
  {
    portal: "warehouse",
    label: "Invoice, Payment & Release",
    icon: Wallet,
    href: "/billing/invoice",
    subItems: [
      // FC-07's tail, and the FC-07 events read monotonically down the block:
      //   §09 invoice → §10–12 waiver → §13 payment → §13a gateway reconciliation →
      //   §15 G.Rent voucher (FC-07 ENDS here) → FC-01 §22 DO issued.
      // FC-07 §14, the five-condition AND gate, is deliberately absent: it hrefs
      // /awb/3?tab=customs, so it is drawn on the AWB hub, not in this block. The
      // godown-rent entry used to claim it as "§14–15" and it never had it.
      //
      // Generation stays above the lifecycle screen: `/finance-manager/invoice-generation`
      // works UNBILLED cargo (source card, line items, billing validation, Generate)
      // while `/billing/invoice` works the ISSUED invoice — draft/issued/part-paid/
      // paid/overdue/credited, the waiver chain, the payment queue. Same §09 event,
      // two hrefs across two flows (FC-17 §05 cites "FC-07 §09" by name), not an
      // inversion.
      { label: "Invoice Generation", href: "/finance-manager/invoice-generation" }, //   FC-17 §05 / §10 — the FC-07 §09 event, cited by name in FC-17 §05
      { label: "Invoice, Payment & Waiver", href: "/billing/invoice" }, //               FC-07 §09–13 · FC-02 §28–30
      { label: "Waiver Approval Workflow", href: "/finance-manager/waiver-workflow" }, // FC-14 §06c — the FC-07 §10–12 waiver chain, which FC-07 itself draws on /billing/invoice
      // The two reconciliation screens ARE §13 — FC-17 §06 annotates
      // `/finance-manager/payment-reconciliation` as "Payment received and reconciled
      // (FC-07 §13)" — so they sit above the §14 gate and the §15 voucher, not below
      // the DO. They also remain above `erp-bridge-mapping`, which consumes them
      // (FC-17 §06 reconciled → §07 journal assembled → §08 push → §10 write-back).
      { label: "Payment Reconciliation (bank)", href: "/finance-manager/payment-reconciliation" }, // FC-17 §06 ("payment received and reconciled — FC-07 §13")
      { label: "Payment Gateway Reconciliation", href: "/finance-manager/payment-gateway-reconciliation" }, // FC-07 §13a · FC-12 §11-P
      // Voucher then DO, contiguous and in that order. FC-07 §15 is explicitly the
      // end of the flow and its handoff note says the DO is issued after the voucher,
      // on the FC-01 spine (§21a voucher, §22 DO). The DO was below the two
      // reconciliation screens, which put the release ahead of nothing and behind
      // downstream bookkeeping.
      { label: "Godown Rent Voucher — M11", href: "/billing/godown-rent" }, //           FC-07 §15 · FC-01 §21a · FC-02 §24
      // FC-01 §22 was cited here as §22b. The numbering pass gave the issuance
      // the bare parent number and left the CHA's collection at §22a below it,
      // so this screen is §22 and /cha/do-collection is §22a. Order unchanged.
      { label: "Delivery Order & Release — M12", href: "/billing/delivery-order" }, //   FC-01 §22 (FC-07 §→ handoff) · FC-05 §07
      { label: "ERP Bridge Mapping", href: "/finance-manager/erp-bridge-mapping" }, //   FC-17 §01–04 / §07–09b / §11 · FC-12 §11-E
    ],
  },
  {
    portal: "warehouse",
    label: "Gate & Yard",
    icon: Truck,
    href: "/gate-entry",
    subItems: [
      // Re-derived against FC-08, which A13 renumbered to a contiguous 01–16 with
      // §01a–§01d inserted as sub-refs. The old §02 / §03 / §04 / §11 / §12–13
      // tokens were one step out at every row and the order below is unaffected:
      // entry §01d → identity §02 → authority §03 → exit §10 still ascends.
      { label: "Gate Dashboard", href: "/gate-entry" }, //                            section home — no flow step
      { label: "Vehicle Entry — M13", href: "/gate-entry/vehicle-entry" }, //          FC-08 §01d
      { label: "Driver Identity Register", href: "/gate-entry/driver-identity-register" }, // FC-08 §02
      { label: "Authority Letter Digitisation", href: "/gate-entry/authority-letter-digitisation" }, // FC-08 §03 · FC-02 §31
      { label: "Live Vehicle Board — M13", href: "/gate-entry/live-vehicle-board" }, // M13 — no flow step
      { label: "Vehicle Exit", href: "/gate-entry/vehicle-exit" }, //                  FC-08 §10
    ],
  },
  {
    portal: "warehouse",
    label: "Dispatch & Closure",
    icon: PackageCheck,
    href: "/dispatch/gate-pass",
    subItems: [
      { label: "Gate Pass & Picking — M13", href: "/dispatch/gate-pass" }, //         FC-01 §23 · FC-08 §04
      { label: "Gate-out & POD — M14", href: "/dispatch/gate-out" }, //               FC-01 §24 · FC-02 §34 · FC-08 §11
      // THIRD OF FOUR, and the position is forced from both sides by FC-08's own
      // tail: §11 gate-out verification (the entry above) → §12 POD captured → §14
      // AWB marked delivered (HERE) → §16 documents archived, file closed (the entry
      // below). The gate event is the boundary, the POD is the receiver's evidence,
      // and CMTS `PHYSICALDELIVERY` is the terminal's own book entry — three writes
      // by three people at three moments, which is why the table survives instead of
      // being three more columns on the gate pass.
      //
      // §12 and §14 both href /awb/2?tab=dispatch in lib/architecture.ts, so no
      // FC-08 step names this route. That is the same shape as Charge Working Set
      // over in Tariff & Charges, whose §03 / §03a / §07–08 href /awb/*?tab=charges:
      // a screen is placed at the step it IS, and the ref is the citation, not a
      // claim on the href. A rail entry rather than a drill-in for the usual test —
      // the href names no fixture and the screen opens on its own list of vouchers.
      { label: "Physical Delivery Record", href: "/dispatch/physical-delivery" }, //  FC-08 §14 (CMTS PHYSICALDELIVERY + DELIVERYINFO)
      { label: "AWB Closure & Archive", href: "/dispatch/closure" }, //               FC-01 §25–27 · FC-02 §35 · FC-05 §08
    ],
  },
  {
    portal: "warehouse",
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
    portal: "warehouse",
    label: "Transhipment",
    icon: Repeat,
    href: "/transhipment/register",
    subItems: [
      { label: "Bonded Register — M15", href: "/transhipment/register" }, //          FC-09 §06–13 · FC-05 §09–11
      { label: "Inter-station Handoff", href: "/transhipment/handoff" }, //           FC-12 §03 · FC-09 (unnumbered ownership-handoff branch)
    ],
  },
  {
    // A BLOCK OF ITS OWN, and the argument is cargo type rather than stage. FC-18
    // is a postal dispatch received off a flight, weighed against CN-35 tags,
    // segregated, and either handed to Pakistan Post or re-tendered onward. It
    // shares NO step with the FC-01 import spine — there is no air waybill, no
    // consignee, no piece count, no Single Declaration — so wedging these screens
    // into Import Documentation or Dispatch would put a flow with none of that
    // flow's objects inside it.
    //
    // POSITION: after Transhipment, before Export. The build note asked for "after
    // Transhipment and BEFORE Exceptions", which is not satisfiable — Exceptions &
    // CDR sits ABOVE Transhipment in this rail, so the two halves name opposite
    // sides of the same block, and honouring the second half would mean moving an
    // existing block. The half that is satisfiable is the one with a reason behind
    // it: FC-18 §07's own note says its onward-leg gate "is deliberately the same
    // shape as FC-09's re-tender gate — so a reviewer who has read one recognises
    // the other", and adjacency to Transhipment is what makes that recognition
    // available. Beyond that, nothing constrains the slot: all ten resolved FC-18
    // steps href /airmail/*, so no flow edge crosses this block's boundary in
    // either direction and no ordering rule is at stake. The trio now reads as the
    // three whole-cargo-type flows in a row — FC-09 transhipped, FC-18 postal,
    // FC-11 export — beneath the import run they are alternatives to.
    //
    // §10 and §12 are absent because they have no screen: §10 is BLK-01 (no airmail
    // rate exists in the tariff master) and §12 folds into M20 archive. Both are
    // null hrefs in lib/architecture.ts, deliberately, so there is nothing to list.
    portal: "warehouse",
    label: "Airmail (FC-18)",
    icon: Mail,
    href: "/airmail",
    subItems: [
      // Ascends §01 → §05 → §06 → §07–08 with no gaps other than the two unbuilt
      // steps above. The dispatch RECORD — FC-18 §02–04, §09 and §11 — is not
      // listed: it is one dispatch, opened from a row of the register, and it is
      // registered in DRILL_IN below.
      { label: "Dispatch Register — M26", href: "/airmail" }, //                      FC-18 §01
      { label: "Irregularities — CN-43", href: "/airmail/irregularities" }, //        FC-18 §05
      { label: "Segregation & Zones", href: "/airmail/segregation" }, //              FC-18 §06
      { label: "Transfer Manifests", href: "/airmail/transfer-manifest" }, //         FC-18 §07–08
    ],
  },
  {
    portal: "warehouse",
    label: "Export (FC-11)",
    icon: PlaneTakeoff,
    href: "/export/booking",
    subItems: [
      // Re-derived against FC-11, which A16 renumbered to a contiguous 01–25. The
      // old tokens predate that pass — "05a–05g" never existed in any numbering.
      // A16 also confirms the order below: customs / ANF (§04–10) genuinely comes
      // before acceptance and screening, so Customs & ANF sits above the screens
      // holding §11–14 even though the same screen holds §02–03 as well; first
      // entry governs, and /export/acceptance opens the flow at §02.
      { label: "Booking & Allotment", href: "/export/booking" }, //                   FC-11 §01
      { label: "Acceptance & Screening", href: "/export/acceptance" }, //             FC-11 §02–03 / §11–14
      { label: "Customs & ANF", href: "/export/customs" }, //                         FC-11 §04–10
      { label: "Classification & Warehousing", href: "/export/warehousing" }, //      FC-11 §15–17
      { label: "Build-up & Declaration", href: "/export/buildup" }, //                FC-11 §18–18e / §21–22 · FC-16 §17
      { label: "Uplift & Closure", href: "/export/uplift" }, //                       FC-11 §23–25
      // THE §25 PAIR. The screen is CMTS `ExportGodownrent`, the CHARGING half of
      // §25 "Export invoice / closure / archive". It was the last entry in this
      // block while §25's other half — the INTERNATIONALCARGO revenue share — was
      // BLK-02 in FC-11's own amendment and had no screen; CMTS_SCOPE_DECISIONS Q3
      // has since unparked it, so the entry beneath is that half and this one is no
      // longer last. The position is otherwise unchanged and still forced from
      // above: Uplift & Closure opens at §23, so this cannot be lifted past it.
      //
      // It bills clocks that start much earlier — `AccpetanceDate` is §12 cargo
      // acceptance and the FROMDATE/TODATE span is §17 export warehousing — but a
      // screen is placed at the step it IS, not at the steps it reads: §12 and §14
      // href /export/acceptance and §15–17 href /export/warehousing, and both of
      // those stand above it already.
      { label: "Billing & Rent Voucher", href: "/export/billing" }, //                 FC-11 §25 (charging half — CMTS ExportGodownrent)
      // LAST, and BELOW /export/billing rather than beside it. Same step, two halves:
      // billing is what the shipper is CHARGED for the days the cargo was held
      // (`ExportGodownrent`), this is what the terminal RETAINS on the carriage once
      // the agent's commission is out (`INTERNATIONALCARGO`, 44 columns). You cannot
      // split a figure that has not been billed, so the charging half stays above.
      //
      // It reads §01 (the airline sold the capacity these rates price) and §03 (the
      // scale produced the kilo CHRGWEIGHT bills on), and both of those screens —
      // Booking & Allotment and Acceptance & Screening — already stand above it. The
      // build plan's G5 row cites "FC-11 §15" for this table; that predates the A16
      // renumber, which made §15 "Cargo classification". lib/architecture.ts names
      // INTERNATIONALCARGO at §25, and §25 is the citation used here.
      { label: "Revenue Share", href: "/export/revenue" }, //                           FC-11 §25 (revenue half — CMTS INTERNATIONALCARGO)
    ],
  },
  {
    portal: "warehouse",
    label: "Operations Supervision",
    icon: Gauge,
    href: "/operations-supervisor",
    subItems: [
      // FC-14 owns this block and reads §01 handover → §02–04 live ops → §05–08
      // escalation → §09–10 floor notes → §11 performance → §12–13 handover submitted.
      // Performance Console sat at position 3: a shift-END measurement screen above
      // the escalation routing and floor notes that generate what it measures.
      //
      // Shift Handover moves from LAST to first-after-home, under THE GATING RULE
      // stated in Lifter Fleet above. The previous pass defended the tail slot as a
      // "bookend", which is the opposite rule to the one it applied to Lifter Status
      // in the same pass, and the two screens have the same shape: FC-14 §01 says
      // the incoming supervisor OPENS ON the outgoing supervisor's submitted
      // handover, so nothing on the board below it is read until it has happened.
      // A screen that is entered at §01 and re-entered at the end is placed at its
      // first entry; the re-entry (§12–13 here, FC-15 §14 for the fleet) does not
      // move it. One rule, both blocks — otherwise "gates what is below it" and
      // "bookends the flow" pick whichever position was already there.
      { label: "Supervision Home", href: "/operations-supervisor" }, //               section home — no flow step (FC-14 has no step 00)
      { label: "Shift Handover", href: "/operations-supervisor/shift-handover" }, //   FC-14 §01 / §12–13 · FC-13 §10 · FC-15 §14
      { label: "Live Ops View", href: "/operations-supervisor/live-ops-view" }, //     FC-14 §02–04 · FC-15 §12
      { label: "Escalation Inbox", href: "/operations-supervisor/escalation-inbox" }, // FC-14 §05–08 · FC-13 §07a · FC-15 §06a
      { label: "MoM / Floor Notes", href: "/operations-supervisor/mom-floor-notes" }, // FC-14 §09–10
      { label: "Performance Console", href: "/operations-supervisor/performance-console" }, // FC-14 §11
    ],
  },
  {
    // MOVED OUT OF SUPERADMIN, and the reason is ownership, not layout. The
    // gateway estate is provisioned, credentialed and watched PER SITE: a PSW /
    // WeBOC endpoint, an RFID reader fleet and their health boards belong to one
    // terminal, not to the platform. Superadmin is the platform-wide portal — the
    // one thing that is NOT per site — so a per-site estate cannot live there, and
    // the warehouse portal is the per-site portal. `/admin/integrations` (FC-12
    // §13) stays behind in Administration and is the right screen for that: it is
    // the platform's register OF the connectors, not any one site's live estate.
    //
    // LAST in the warehouse run, and deliberately not anywhere above. Everything
    // from Planning down to Operations Supervision is one continuous read — the
    // FC-01 spine, its FC-04 / FC-09 / FC-10 / FC-11 branches, then the shift that
    // supervises them — and this block is site infrastructure rather than a step
    // in the cargo pipeline. Wedged into that run it would interrupt consecutive
    // flow steps with a gateway health board; at the foot of the run it interrupts
    // nothing, which is the correct statement about a surface you open when the
    // cargo work is not what you are doing.
    //
    // Flow edges, since the old comment argued this position from FC-12's lanes:
    // FC-17 §12 `/integration-status` → §13 `/auditor/financial-trace` still reads
    // DOWN, because the whole warehouse run sits above the whole superadmin run.
    // FC-12 §12 `/integration-status` → §13 `/admin/integrations` now reads down
    // too — it was the inversion the old slot could not fix. What flips in
    // exchange is FC-12 §01 / §04–07 (`/admin/settings`, roles, users), which now
    // sit BELOW §02 / §10 / §12 here. That is the same class of anomaly as the CHA
    // desk holding FC-08 §01 below Dispatch: the three-portal grouping outranks
    // flow order ACROSS a portal boundary, and `/integration-status` appears twice
    // in FC-12 (§02 HQ sync board, §12 gateway health board) so no linear order
    // ever satisfied both anyway. Precedent for warehouse holding FC-12 steps is
    // already in this rail — Inter-station Handoff is FC-12 §03 and sits in
    // Transhipment — which is why the portal heading's flow tag is unchanged.
    portal: "warehouse",
    label: "Integrations",
    icon: Plug,
    href: "/integration-status",
    subItems: [
      { label: "Integration Status", href: "/integration-status" }, //               FC-12 §02 / §12
      { label: "RFID Integration", href: "/rfid-integration" }, //                    FC-12 §10
      // Build-QA surface rather than a client-facing screen. It is listed rather
      // than hidden because the audit rule for this rail is that every route under
      // app/ is owned by exactly one portal — an unowned route is the thing being
      // prevented, and being off the rail (see DRILL_IN / AUTH_STATES) is not the
      // same as being unowned. This one has no parent list to be drilled into
      // from, so a nav slot is the only thing that owns it.
      { label: "QA Checklist (internal)", href: "/qa-checklist" },
    ],
  },
  {
    portal: "consignee",
    label: "Customer Self-Service",
    icon: Receipt,
    href: "/consignee/dashboard",
    subItems: [
      // Re-derived against FC-02 as it stands after the renumber. Every annotation
      // in this block was wrong: the two landing screens are not flow nodes at all
      // (the old "FC-02 §30" is /billing/invoice, the terminal's ledger), the NOA
      // is FC-02 §18 and not FC-06 §01 (that ref is /import/arrival-advice, the
      // terminal issuing it), Pay & Download DO is FC-02 §32 only because FC-02
      // §33 is the CHA's /cha/do-collection, and the last two carried FC-08 refs
      // for screens FC-08 never touches. The lane now ascends 18 → 32 → 33a → 35a.
      { label: "Dashboard", href: "/consignee/dashboard" }, //                       portal home — no flow step
      { label: "My Shipments", href: "/consignee/my-shipments" }, //                 no flow step
      { label: "Notice of Arrival", href: "/consignee/notice-of-arrival" }, //        FC-02 §18
      { label: "Pay & Download DO", href: "/consignee/pay-do" }, //                   FC-02 §32
      { label: "Schedule Pickup", href: "/consignee/schedule-pickup" }, //            FC-02 §33a
      { label: "POD History", href: "/consignee/pod-history" }, //                    FC-02 §35a
    ],
  },
  {
    portal: "consignee",
    label: "Customs Broker Desk",
    icon: UserCheck,
    href: "/cha",
    subItems: [
      // FC-06 §02 and §03 belong to /import/documents and /customs/filing, the
      // terminal-side screens, not to the two broker screens they were pinned on.
      // The broker's own FC-06 nodes are the lettered ones — §05-C and §08a-C —
      // and its payment step is FC-07 §12a (payment MADE), not §13 (payment
      // RECEIVED, which is the terminal's /billing/invoice).
      { label: "Dashboard", href: "/cha" }, //                                       portal home — no flow step
      { label: "GD Filing Workbench", href: "/cha/gd-filing-workbench" }, //          M09 legacy screen — no flow step
      { label: "Channel-Specific Workflow", href: "/cha/channel-specific-workflow" }, // FC-06 §05-C
      { label: "OOC Tracking", href: "/cha/ooc-tracking" }, //                        FC-06 §08a-C
      { label: "Payments", href: "/cha/payments" }, //                                FC-07 §12a
      { label: "DO Collection", href: "/cha/do-collection" }, //                      FC-08 §01 · FC-02 §33 · FC-01 §22a
      { label: "Re-export / Long-Stay Console", href: "/cha/re-export-long-stay" }, // FC-10 §B3a
    ],
  },
  {
    portal: "consignee",
    label: "Freight Forwarder Desk",
    icon: Ship,
    href: "/forwarding-agent",
    subItems: [
      // The three pre-registration screens move ABOVE Pickup Scheduling. They are
      // FC-08 §01a driver → §01b vehicle → §01c submitted to SAPS, and the pickup
      // booking's own label (FC-02 §33a) says the driver and the vehicle are
      // nominated at the booking — you cannot nominate out of a register that is
      // listed beneath you. Scheduling now sits where the flow puts it, after the
      // registers it reads and after the DO exists.
      //
      // AWB Entry is FC-02 §00, the digital pre-lodgement, not FC-01 §22a — that
      // ref is /cha/do-collection and the mis-citation predates the FC-02 renumber.
      // Pickup Scheduling and Payments are touched by no flow step at all; the old
      // "FC-08 §01" and "FC-07 §13" on them named the CHA's and the terminal's
      // screens respectively.
      { label: "Dashboard", href: "/forwarding-agent" }, //                              portal home — no flow step
      { label: "AWB Entry — Digital", href: "/forwarding-agent/awb-entry-digital" }, //   FC-02 §00
      { label: "Driver Register", href: "/forwarding-agent/driver-register" }, //         FC-08 §01a
      { label: "Vehicle Register", href: "/forwarding-agent/vehicle-register" }, //       FC-08 §01b
      { label: "Dispatch Documents", href: "/forwarding-agent/dispatch-documents" }, //   FC-08 §01c
      { label: "Pickup Scheduling", href: "/forwarding-agent/pickup-scheduling" }, //     no flow step — FC-02 §33a books the same slot from /consignee/schedule-pickup
      { label: "Payments", href: "/forwarding-agent/payments" }, //                       no flow step
      { label: "Notifications & History", href: "/forwarding-agent/notifications-history" }, // FC-05 §17a
    ],
  },
  {
    portal: "superadmin",
    label: "Administration",
    icon: UserCog,
    href: "/admin",
    subItems: [
      // Re-annotated against FC-12, which actually numbers these screens. The old
      // T3-NN / M20-NN tokens were positional labels invented for the previous
      // order, so they would have scrambled the moment anything moved.
      { label: "Admin Dashboard", href: "/admin" }, //                                section home
      // System Settings up from position 6. It is the tenant/installation config —
      // company identity and tax registration (NTN / STRN / GST), branding, timezone,
      // currency, date format, weight and dimension units. Every document the system
      // renders (invoice, godown rent voucher, DO) prints against those values and
      // every other admin screen is scoped by them. FC-12 §01 makes it the platform's
      // first node.
      { label: "System Settings", href: "/admin/settings" }, //                       FC-12 §01
      // Roles before Users: you cannot assign a role that does not exist. This is a
      // dependency, not merely a flow ordering, and FC-12 agrees (§04 portal
      // separation → §05 user & role administration).
      { label: "Roles & Permissions", href: "/admin/roles" }, //                      FC-12 §04
      { label: "Users", href: "/admin/users" }, //                                    FC-12 §05
      { label: "Master Data Editor", href: "/admin/master-data" }, //                 FC-12 §07
      // A RAIL ENTRY, NOT A DRILL-IN, and the test is the one this file already
      // applies: a drill-in is a screen showing ONE record whose href has to name a
      // fixture, so that a rail slot would advertise demo row #1 as a destination.
      // This href names nothing — `/admin/settings/lookup-registry` is the WHOLE
      // `Lookup` / `Setting` store, and the screen opens on its own grouped list of
      // keys with search, filters and an importer. Nothing has to be clicked
      // elsewhere to make it a place. That is the identical argument Charge Working
      // Set carries in Tariff & Charges, and the same one that keeps `/awb/1` off
      // the rail for the opposite reason.
      //
      // POSITION: below BOTH screens that link into it, which is what fixes it here
      // rather than under System Settings where the path would suggest. The card on
      // /admin/settings (FC-12 §01) and the "configuration does not live here"
      // pointer on /admin/master-data (FC-12 §07) are both onward CTAs — "the value
      // you want is keyed, edit it there" — and the rail's rule is that an onward
      // CTA points DOWN. Sitting under System Settings would satisfy §01 and invert
      // §07, buying an UPWARD_REFERENCES exception for nothing; sitting here
      // satisfies both and needs none. It reads as the residue of the block above
      // it, too: Master Data Editor holds the coded entities that have a table of
      // their own, this holds everything CMTS tunes at runtime that does not.
      //
      // NO FLOW REF, deliberately. FC-12 numbers no step for it — it exists because
      // CMTS_SCOPE_DECISIONS Q6 says a schema-only restore cannot recover the keys,
      // so the editor must be key-agnostic. Inventing a § for it is the defect this
      // rail has purged twice.
      { label: "Lookup & Setting Registry", href: "/admin/settings/lookup-registry" }, // CMTS decision Q6 — no flow step
      { label: "Integration Console", href: "/admin/integrations" }, //               FC-12 §13
      { label: "Audit Trail Browser", href: "/admin/audit-trail" }, //                FC-12 §14
      { label: "Session & Event Log", href: "/admin/event-log" }, //                  FC-12 §15
    ],
  },
  {
    portal: "superadmin",
    label: "Audit & Oversight",
    icon: ShieldCheck,
    href: "/auditor",
    subItems: [
      // Re-annotated against FC-12, the same fix Administration already had. The
      // M19-NN / M20-NN tokens were positional labels invented for an earlier
      // order — module codes with a row number after them, not flow refs, and
      // nothing in lib/architecture.ts uses that notation.
      //
      // ANOMALY, named: RBAC Snapshot is FC-12 §06, in the Access & RBAC lane,
      // and so reads backwards against §16/§17 above it. It is kept here because
      // it is an /auditor/* route and this block is the auditor's read-only
      // surface; moving it would put a write-free audit view inside Administration.
      { label: "Auditor Home", href: "/auditor" }, //                                 M19 — no flow step
      { label: "Cargo Trace", href: "/auditor/cargo-trace" }, //                      FC-12 §16
      { label: "Financial Trace", href: "/auditor/financial-trace" }, //              FC-12 §17 · FC-17 §13
      { label: "RBAC Snapshot", href: "/auditor/rbac-snapshot" }, //                  FC-12 §06
      { label: "Export Centre", href: "/auditor/export-centre" }, //                  FC-12 §17a
      { label: "Reports & Dashboards", href: "/reports" }, //                         FC-12 §18
    ],
  },
];

/* =============================================================================
 * OFF-RAIL ROUTES  ·  owned by a portal, deliberately absent from the nav
 * -----------------------------------------------------------------------------
 * The rail is for places you navigate TO. These are routes you are TAKEN to, and
 * a nav slot for one is a category error rather than a convenience:
 *
 *   DRILL-IN     a screen that shows ONE record, entered by clicking that record
 *                in a list. Its href has to name a fixture — `/awb/1` — so the
 *                nav ends up advertising demo row #1 as though it were a place,
 *                and arriving from the rail rather than from a row is what the
 *                "Select an AWB to view channel detail" / "No task selected"
 *                empty states are apologising for. The parent list is the entry
 *                point; `parent` names it, and that link is the real navigation.
 *   AUTH STATE   a screen the shell REDIRECTS you into. All four render outside
 *                AppShell (LayoutClient skips it for them), so following one from
 *                the rail drops the rail — a nav entry that dismantles the nav.
 *                The pages stay on disk and are load-bearing: AuthGuard
 *                router.replace()s to all three /auth/* routes, Header pushes
 *                /login on sign-out, and three landing CTAs push /login.
 *
 * These are NOT unowned routes, and the distinction matters because the audit
 * invariant is about ownership, not about nav slots: every route under app/ is
 * either a rail entry or a registered off-rail route with a named parent, and
 * exactly one portal owns it either way. Both arrays feed the route → portal
 * index below on the same footing as RAIL, which is what keeps the header
 * naming "Warehouse Portal" on `/awb/[awbId]` — the `/awb` matchPrefix that
 * maps every id lives here now, and nowhere else.
 * ===========================================================================*/

export interface OffRailRoute extends NavLeaf {
  /** The portal that owns this route even though it holds no rail slot. */
  portal: PortalId;
  /**
   * The screen (or shell mechanism) you arrive from. A route may leave the rail
   * only if something else navigates to it, so this field is the thing that makes
   * removal safe rather than orphaning.
   */
  parent: string;
  /** Why it is not a nav item. */
  why: string;
}

export const DRILL_IN: OffRailRoute[] = [
  {
    label: "AWB Hub — M03",
    href: "/awb/1",
    matchPrefix: "/awb",
    portal: "warehouse",
    parent: "/warehouse-manager",
    why: "One AWB, opened from the AWB# column of the Live AWB Queue on the warehouse dashboard (and from the AWB Register at /warehouse-manager/awb-detail). It is the target of nineteen flow steps across FC-02, FC-03, FC-07, FC-08 and FC-09, every one of them a drill-in reference — see UPWARD_REFERENCES. `/awb/1` is the demo's first fixture AWB, which is exactly why it is not a destination: the rail cannot offer 'the' AWB. `matchPrefix` keeps every /awb/* id mapped to this portal for the header.",
  },
  {
    label: "Channel Detail",
    href: "/customs/channel-detail",
    matchPrefix: "/customs/channel-detail",
    portal: "warehouse",
    parent: "/customs/channels",
    why: "FC-06 §05-G / §05-Y / §05-R, the working surface for ONE declaration's channel. Channels & OOC is the §04 viewer that lists them and is the entry point. The real screen is now /customs/channel-detail/[awbId], reached from the row links on /customs/channels; the bare path kept here redirects there via its parent list, because nine flow-step hrefs in lib/architecture.ts still name it and have to land on something real. `matchPrefix` is what maps the dynamic children to this portal — without it portalForPath returns null for /customs/channel-detail/2 and the header falls back to 'AirVault'.",
  },
  {
    label: "Task Detail",
    href: "/lifter-operator/task-detail",
    matchPrefix: "/lifter-operator/task-detail",
    portal: "warehouse",
    parent: "/lifter-operator/tasks",
    why: "FC-15 §04 / §06–09, one lifter task. My Tasks (§03) is the queue it is opened from. The real screen is now /lifter-operator/task-detail/[taskId], reached from the task cards on /lifter-operator/tasks and from /lifter-operator/rfid-scan; the bare path redirects to the queue. `matchPrefix` maps the dynamic children to this portal, for the same reason as Channel Detail above.",
  },
  {
    label: "Airmail Dispatch Record — M26",
    href: "/airmail/3",
    matchPrefix: "/airmail",
    portal: "warehouse",
    parent: "/airmail",
    why: "ONE postal dispatch, opened from a row of the dispatch register. It carries five FC-18 steps — §02 delivery bill (PO of origin / destination / mail type), §03 receptacles weighed, §04 the gross-vs-physical variance strip, §09 dutiable items presented, §11 the handover panel — and every one of them is a panel on a single record, which is precisely what has no rail position: the rail cannot offer 'the' dispatch. `/airmail/3` is the fixture lib/architecture.ts names at §02–04 and §09 (§11 names /airmail/1, a terminating dispatch), and the register above is the entry point for both. `matchPrefix` is '/airmail' because a dispatch id is the only thing distinguishing these paths and no narrower prefix exists — the four static siblings (/airmail, /airmail/irregularities, /airmail/segregation, /airmail/transfer-manifest) are all EXACT keys in ROUTE_PORTAL, and portalForPath consults the exact map before the prefix list, so the prefix never decides their portal. Without it portalForPath returns null for /airmail/3 and the header renders 'AirVault' instead of 'Warehouse Portal' — the regression this file has already taken twice.",
  },
];

export const AUTH_STATES: OffRailRoute[] = [
  {
    label: "Sign In",
    href: "/login",
    portal: "superadmin",
    parent: "components/Header.tsx (sign-out) · landing-page CTAs",
    why: "Live application state, not a demo screen. Header pushes here on sign-out and three landing CTAs push here. Renders outside AppShell, so a rail entry would be a nav link that removes the nav.",
  },
  {
    label: "Session Expired",
    href: "/auth/session-expired",
    portal: "superadmin",
    parent: "components/auth/AuthGuard.tsx (router.replace)",
    why: "A guard redirect target. You are sent here; you do not choose it from a menu.",
  },
  {
    label: "Permission Denied",
    href: "/auth/permission-denied",
    portal: "superadmin",
    parent: "components/auth/AuthGuard.tsx (router.replace)",
    why: "A guard redirect target. Listing it offers 'go and be denied' as a destination.",
  },
  {
    label: "No Access",
    href: "/auth/no-access",
    portal: "superadmin",
    parent: "components/auth/AuthGuard.tsx (router.replace)",
    why: "A guard redirect target, for an authenticated user whose role owns no portal.",
  },
];

/** Every owned route that holds no rail slot, in one list for the audit. */
const OFF_RAIL: OffRailRoute[] = [...DRILL_IN, ...AUTH_STATES];

/* -----------------------------------------------------------------------------
 * ROUTE → PORTAL index.
 *
 * Built from the rail rather than hand-maintained, which is the point: the old
 * shell kept a separate hand-written map of route → portal name for the header,
 * and it had drifted badly — every /import/*, /customs/* and /billing/* route
 * was missing from it and fell through to "Home". Deriving it here means the
 * header can never disagree with the sidebar about which portal you are in.
 *
 * OFF_RAIL is folded in on the same footing, because ownership is not the same
 * question as nav placement. Leaving it out would silently un-map every /awb/*
 * route the moment the AWB hub left the rail, and AppShell would title the hub
 * "AirVault" instead of "Warehouse Portal".
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

for (const route of OFF_RAIL) {
  ROUTE_PORTAL.set(route.href, route.portal);
  if (route.matchPrefix) PREFIX_PORTAL.push({ prefix: route.matchPrefix, portal: route.portal });
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
   * THE AUDIT INVARIANT, in the form that survives routes leaving the rail:
   * every route under app/ is owned exactly once — either as a rail entry, or as
   * an OFF_RAIL route (DRILL_IN / AUTH_STATES) that names the parent it is
   * entered from. Nothing is unowned, and nothing is owned twice.
   *
   * Matching is EXACT, not prefix-based, with `matchPrefix` as the single opt-in
   * escape hatch — used by no rail entry at all, only by the four DRILL_IN routes
   * whose real screens live under a dynamic segment (`/awb/[awbId]`,
   * `/customs/channel-detail/[awbId]`, `/lifter-operator/task-detail/[taskId]`,
   * `/airmail/[dispatchId]`). Prefix matching used to be needed because the rail was incomplete
   * and an unlisted child route had to light up its nearest listed ancestor.
   * Under the invariant above, the routes that are absent from the rail are
   * absent DELIBERATELY and have no ancestor they should light up — you drilled
   * into a record, you did not enter a section — so prefix matching would only
   * cause false positives: it would light up the Finance "Tariff & Charges"
   * block for every /finance-manager/* route, including the six that live in the
   * block below it.
   */
  const hits = (item: NavLeaf) =>
    pathname === item.href ||
    (item.matchPrefix !== undefined &&
      (pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + "/")));

  /**
   * Takes the structural shape rather than `NavBlock` so it can render HOME,
   * which deliberately has no portal. Keyed on href because the audit guarantees
   * no route appears in the rail twice — routes may be absent from it, via
   * DRILL_IN / AUTH_STATES, but never duplicated within it.
   */
  const renderBlock = (block: NavLeaf & {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    subItems?: NavLeaf[];
  }) => {
    const Icon = block.icon;
    const isActive = hits(block) || (block.subItems?.some(hits) ?? false);

    return (
      <div key={block.href}>
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
   * consecutive blocks owned by the same portal, so the three headings fall out
   * of the ordering rather than being declared alongside it. If a portal ever
   * has to be interrupted for flow reasons it renders its second run as a
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
          {/* Home sits above the three portal headings — it is where you arrive,
              not a screen inside any one portal. */}
          {renderBlock(HOME)}
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
