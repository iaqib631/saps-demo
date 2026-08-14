# Flow Review & Simplification Report
**Inputs:** Figma board [`SAPS`](https://www.figma.com/board/rmPPrQkEIho2eyLpIzNEaY/SAPS?node-id=0-1) — 24 frames (FC-01…FC-12 SAPS as-is + FC-01…FC-12 AirVault) · `saps-demo` repo — 154 routes, 134,886 LOC
**Purpose:** identify what must be amended on the board *before* more building, check the demo screen-by-screen against the flows, and show where the flows can be simplified.
**Status:** for your verification. Nothing has been changed in the board or the repo.

---

## 0. What is actually on the board

Two rows of twelve frames.

| Row | Frames | Origin |
|---|---|---|
| **Top (y ≈ −3546)** | FC-01 … FC-12 | SAPS as-is. Title block: Faisal Engineering Services · client SAPS · *Air Cargo Management System* · Rev 2.0 · 25-05-2026 · prepared by Ammar Shahid |
| **Bottom (y ≈ 8352)** | FC-01 (AirVault) … FC-12 (AirVault) | Node-for-node **copies** of the row above, plus overlay nodes and one *"AirVault amendment"* sticky per frame |

The AirVault row is not a redrawn flow — it is the SAPS flow with additions layered on top. That matters, because **every defect in the SAPS row has been inherited verbatim**, and because the overlays were drawn *alongside* the original edges rather than replacing them (see §2).

The twelve AirVault amendments are, in one line each:

| Flow | AirVault delta vs CMTS |
|---|---|
| FC-01 | Step 05 becomes OCR-assisted intake (05a–05f) with per-item confidence + operator acceptance; declared-vs-physical variance feeds reconciliation |
| FC-02 | Documentation lane is OCR-assisted; class/subclass set **at indexation** |
| FC-03 | Allocation is system-driven (`CARGOSUBCLASSLOCATION` rules) + RFID tag bound to location, putaway confirmed by scan |
| FC-04 | CDR is variance-driven and auto-raised; evidence is a digital pack, not remarks |
| FC-05 | Event-driven auto-dispatch, multi-channel Email/SMS/WhatsApp, IATA via SITA, delivery/read receipts |
| FC-06 | PSW primary / WeBOC legacy behind a provider-abstracted gateway; SD replaces GD; OOC scanner-captured and verified vs SD |
| FC-07 | Versioned Tariff Master, cash-less gateway payment, multi-level waiver approval, auto-gated DO release |
| FC-08 | RFID/scan-verified retrieval → gate-out; digital POD (e-sign, CNIC, geo, photo) |
| FC-09 | RFID-tracked bonded zone; inter-station ownership handoff KHI↔LHE↔PEW via HQ |
| FC-10 | Aging-driven long-stay + Section 82 statutory clock; RFID-tracked exception holds; aging dashboard |
| FC-11 | Greenfield export: PSW SD + Form-E, tamper-evident screening record, scale integration, handheld RFID, ULD build verification |
| FC-12 | AirVault platform layer: per-site nodes (KHI/LHE/PEW) + Islamabad HQ, two-portal RBAC, integration gateways |

---

## 1. Defects in the SAPS row, inherited by AirVault

These need a decision before they are built. Ordered: correctness first, then labelling.

### 1.1 Correctness — these would produce wrong behaviour

**A1 · FC-03: `Pharma → Dangerous Goods` is a wrong edge.**
In section *B. Special Handling*, the `Pharma` node connects to `Dangerous Goods`. Pharma is a GDP cold-chain class, not a DG class; routing it into the DGR segregated store is a genuine handling error. The demo already models it correctly — `lib/domain/masters.ts` has class 13 *Pharmaceuticals* → subclass *Pharma — GDP* → location *Pharma Store*, band 2–8 °C. **The board is wrong and the code is right.**
→ Redraw as `Pharma → Cold Chain Storage`, in the COL/CRT band. Carried unchanged into FC-03 (AirVault), so fix both.

**A2 · FC-08: two verification decisions have no failure path.**
- `Piece Count Matched?` has a **Yes edge only**. There is no No branch at all.
- `Cargo Available? → No → Cargo unavailable / investigate` terminates — nothing leaves that node.
- `10. Condition Verification` has no decision after it, so cargo found damaged at handover has nowhere to go.

As drawn, a short pick or a damaged piece at the point of delivery has no route through the system. All three should route to FC-04 (raise CDR).

**A3 · FC-02 and FC-07 disagree on when the storage clock starts.**
FC-02's Finance lane runs `Storage clock starts → Free period calculated`. FC-07 runs `02. Free Period Calculated → 04 → 05 → 03. Storage / Demurrage Clock Starts`. One of them is wrong, and godown rent depends on which. Note FC-02 also annotates the clock *"General & Pharma only — triggers with date & time (optional)"*, which the demo carries through to `/billing/godown-rent`.

**A4 · FC-01: the drawn edges contradict the step numbers on the money path.**
The numbering implies `19 customs → 20 charges → 21 invoice → 22 DO → 23 gate pass`. The connectors actually say:

```
18 NOA → 22 Delivery Order (DO) → 19 Customs Clearance Tracking
      → 20 Charges → 21 Invoice → GoDown Rent Voucher → 23 Gate Pass
```

So node 22 sits *before* customs clearance. Almost certainly node 22 is doing two jobs — the CHA **requesting** a DO after the NOA, and the terminal **issuing** it after payment and the release gate. Split it into `22a. DO requested` and `22b. DO issued`.

**A5 · FC-01 has a duplicated, orphaned decision.**
There are two `08. Discrepancy Found?` diamonds and two `SB3: Mishandled / CDR Flow` nodes. One pair is wired correctly (`07 → 08 → 09` / `→ SB3`). The other pair — `71:1838`/`71:1854` in SAPS, `142:1933`/`142:1935` in AirVault — carries a self-referencing "Yes" connector that resolves to nothing. Delete the orphan pair.

**A6 · FC-01: the `14 → 08` back-edge rewinds too far.**
A weight/condition discrepancy at §14 returns to the §08 diamond. Its "No" exit drops you at §09 Indexation, so clearing the discrepancy re-runs tagging, split, segregation and acceptance. Intent is surely "raise a CDR without rewinding". Draw §14 → SB3 directly, or give §14 its own decision.

**A7 · FC-05: four messages/alerts are drawn but never fired.**
`TGC — Transferred to Ground Custody` (operational) and `Free Period Expiry Alert`, `Customs Hold Alert`, `Payment Due Alert` (customer) have no inbound trigger edge. Three of the seven customer notifications therefore never fire. The demo has already spotted this — `lib/architecture.ts` M08 records *"the 3 unwired FC-05 notifications surfaced as an explicit gap"*.
→ Wire them: free-period expiry ← FC-07 dwell clock · customs hold ← FC-06 hold · payment due ← FC-07 invoice · TGC ← ground-custody handover.
Also: `NFD — Notified for Delivery` is fired by *Cargo Warehoused*, alongside NOA. NFD conventionally follows the NOA rather than the racking event.

### 1.2 Labelling, numbering and shape errors

| # | Flow | Issue |
|---|---|---|
| **A8** | FC-06, FC-02 | The third risk channel is labelled **"Normal"**, and "Normal" points at *Red Channel – Physical Examination*. Green / Yellow / Normal → should be Green / Yellow / Red. The demo carries this as **BLK-03** and prints it on `/customs/channels`. |
| **A9** | FC-02 | `Green / Normal` is drawn as a **diamond with one exit** (→ ANF/ASF clearance). Yellow and Red do not exist in FC-02 at all, so FC-02 tells a story where every consignment clears green. |
| **A10** | FC-07 | Frame is titled *"Charges, Invoice, Waiver & **DO Release**"* but **contains no DO node**. It ends at `G.Rent Voucher issued`. The five conditions gate the voucher, not the DO. Rename the frame or add the DO node after the gate. |
| **A11** | FC-07 | The five release conditions (OOC available · AWB authority verified · DO charges paid · cargo not on hold · special clearance completed) are drawn as a **fan-out**, which reads as OR. Intent is AND. The demo built it correctly as an AND in `evaluateReleaseGate()` (`lib/domain/finance.ts:469`) — the board should match. |
| **A12** | FC-07 | Step numbers do not follow the connectors: `01 → 02 → 04 → 05 → 03 → 06`. Renumber. |
| **A13** | FC-08 | Numbering **skips 02, 05 and 11**. Confirm nothing was lost (validate DO still current? confirm charges? re-weigh?). |
| **A14** | FC-10-A | `A6. Recovery Action by Custom` — a decision diamond with **three unlabelled exits** (no criteria), and the actor contradicts A5, which says the *airline* issues the recovery instruction. Also "Custom" → "Customs". |
| **A15** | FC-06, FC-09 | Both frames **end on a Note node** (*"OOC permits release but physical delivery still requires DO…"*, *"Transhipment cargo remains under customs bond…"*). A note is not a process step — make them frame annotations. |

### 1.3 FC-11 needs the most work

FC-11 is the greenfield export flow, so it *is* the specification — and it is the least finished frame on the board.

1. **Connector order contradicts step numbers throughout.** Actual order: `01 Booking → 04 Doc Collection → 06 Weight Captured → Custom/ANF Check → … → Physical Check → Weighment → 03 Cargo Acceptance → 05 Security Screening → 07 Classification`. **Steps 02, 10 and 11 do not exist on the chart at all.**
2. **Customs/ANF clearance happens before cargo is accepted (03) and before it is screened (05).** For a terminal the order is normally accept → screen → customs → classify → warehouse → build-up. As drawn, you clear cargo you have not yet accepted.
3. **`Clearance ???`** is a literal placeholder in a live decision node.
4. **`Hold till correction`** is drawn as a diamond but named as an action.
5. **Three weighing nodes**: `06. Weight Captured / Verified (Gross, Net, Tare)`, `Wighment` (typo), and the AirVault overlay `Weighing scale integration`. Collapse to one.
6. **An unnamed decision** after `13. Manifest / FFM / FWB / FHL Messaging` — the edges are labelled Yes/No but the diamond has no text.

---

## 2. Defects introduced by the AirVault overlays

**B1 · Every AirVault insert is a parallel path, not a replacement — the original edge survives.**

In each of these four places the new AirVault step was added *next to* the old direct edge, which is still on the canvas. The new control is therefore optional:

| Flow | Bypass edge still present | Consequence |
|---|---|---|
| FC-01 | `05 Document Verification → 06 AWB Summary` | OCR intake (05a–05f) can be skipped entirely |
| FC-02 | `Manifest checked → AWB summary sheet prepared` | ditto for the documentation lane |
| FC-06 | `03 SD lodged → 04 Risk Channel Assigned` | PSW integration can be skipped; channel re-keyed by hand |
| **FC-06** | **`07 OOC issued → 08 Cargo Eligible for Release`** | **cargo can become eligible for release without the OOC ever being verified against the Single Declaration** |

The last one is the one that matters. Verifying OOC-vs-SD is precisely the control the amendment exists to create, and as drawn it is bypassable.

→ **Delete the bypass edge in all four places.** If a bypass is deliberate — gateway down, key from the print — draw it as a *labelled exception edge with its own compensating step*, not as a silent equal path. The demo has already taken this reading; `lib/architecture.ts` FC-06 says OOC is *"fetched from PSW, or keyed from the print when the gateway is down, then verified field-by-field against the SD; the reconciliation is the control, not the capture."* That sentence belongs on the board.

**B2 · FC-08's three AirVault nodes are dangling annotations, not gates.**
`RFID / barcode scan`, `RFID gate-out verification` and `Digital POD` each have one inbound edge and **no outbound edge**. As drawn they are comments hanging off the flow. The sticky says gate-out verification *"auto-checks OOC, DO charges & no-hold"* — if that is a gate it must sit in-line between §13 and §14, with a defined fail path.

**B3 · FC-11's overlay contradicts a decision SAPS has already given.**
The board still shows *"Export docs OCR-captured (AWB / Invoice / Packing List) — confidence + operator acceptance"*. The repo records the opposite as settled: `lib/architecture.ts` FC-11 amendment reads *"Export documents are keyed at the counter (OCR is limited to the two import-side scan points)"*, and the step note says *"Drawn as OCR; converted once SAPS confirmed OCR runs only at the two import-side scan points."*
**This is the one place where the board and the build disagree on a confirmed decision.** Either the board is stale, or the demo is wrong. Needs an explicit answer.

**B4 · The FC-03 overlay does not fix the Pharma edge (A1).** It adds the allocation engine and leaves the wrong edge intact.

**B5 · Naming is inconsistent across the AirVault row.** FC-09 renames the datastore to *"03. Indexed in AirVault"*, but FC-06 still ends at *"09. CMTS Customs Status Updated"* and FC-04 still says *"04. Create CDR in CMTS"*. Pick one name for the system of record.

---

## 3. Where the flows are more complex than they need to be

### 3.1 The main source: enumerable field values drawn as flow nodes

The board repeatedly draws *the values of one field* as a fan-out of nodes that immediately fan back in. None of these branches changes downstream behaviour — every branch converges on the same next step. They are dropdowns and forms, drawn as process.

| Flow | Fan-out | Nodes | Connectors | What it really is |
|---|---|---|---|---|
| FC-04 §02 | 9 discrepancy types | 9 | 18 | one dropdown |
| FC-04 §03 | 6 evidence items | 6 | 12 | one upload set |
| FC-08 §14 | 5 POD items | 5 | 10 | one form |
| FC-07 gate | 5 release conditions | 5 | 10 | one AND gate |
| FC-03 | 24 class→zone pairs | 48 | 24 | one lookup table (`CARGOSUBCLASSLOCATION`) |
| FC-05 | 20 message types + 9 triggers | 29 | 12 | one trigger→message matrix |
| | **totals** | **~102** | **~86** | |

FC-07 already shows the better pattern: the nine category surcharges are collapsed into a single node reading *"Surcharge chips: DGR, PER, VAL, AVI, AOG, HUM, Cold, Vault, Special"*. Do the same everywhere else.

**Recommended collapses:**

1. FC-04 §02 → one node *"Select discrepancy type"*, with the 9 values in a table in the frame margin.
2. FC-04 §03 → one node *"Capture digital evidence pack"*, listing the 6 fields.
3. FC-08 §14 → one node *"Capture digital POD"*, listing the 6 fields (incl. geo).
4. FC-07 gate → one node *"Release gate — all 5 conditions must pass"*, listing the 5. This also fixes A11.
5. FC-03 → keep A/B/C as *category bands*; replace the 24 individual class→zone pairs with the subclass→location **rules table**. The rules are data, not flow.
6. FC-05 → replace the three message banks and the trigger row with a single **9 × 20 trigger→message matrix**. That is exactly what the demo built at `/messaging/notifications`.

Net effect: roughly **100 fewer nodes and 86 fewer connectors** across the pack, with no requirement lost, and the actual decision points — which is what a developer reads a flow for — become visible instead of buried in field enumerations.

### 3.2 FC-02 re-draws FC-06 and FC-07 at lower fidelity

FC-02's *Customs / Agencies* lane is a 5-node degraded copy of FC-06 that omits Yellow and Red entirely (A9). Its *Finance / Billing* lane is a 6-node copy of FC-07 that **contradicts it** on ordering (A3).

→ FC-02 should keep the **swimlane hand-offs** — which is what a swimlane diagram is for — and reference FC-06 and FC-07 for their internals. Removes ~11 nodes and one live contradiction.

### 3.3 Scope with no owning flow

These will otherwise be built by default because they already exist in the demo. Each is a real capability; none is required by the flows you are about to sign off. Either give each one a flowchart or park it explicitly.

- **Planning** — capacity dashboard, slot planner, resource roster, demand forecast. No FC covers planning.
- **Ops supervision** — shift handover, MoM/floor notes, performance console, escalation inbox. FC-12 mentions *"Ops & Workforce"* only as a platform service.
- **Lifter fleet telemetry** — battery, charging station, fault register, movement log. FC-03/FC-08 need scan + putaway/pick, not fleet management.
- **ULD messaging (UCM / SCM / LUC)** — **none of these three appear in FC-05's message map**, which lists FFM, FWB, FHL, NOTOC, RCF, NFD, AWD, DIS, DLV, RCT, TFD, DEP, TGC.
- **ERP bridge mapping** — no FC.
- **Airmail / postal** — already flagged in the build plan as covered by no flow.

---

## 4. saps-demo vs the flows — screen by screen

### 4.1 Headline

| Metric | Value |
|---|---|
| Routes | **154** |
| Total LOC (pages + their components) | **134,886** |
| Routes reachable from `lib/architecture.ts` (module map + flow walkthroughs) | **77** |
| Routes **not referenced by any module or flow** | **77** (50%) |
| Dead links in `architecture.ts` | **0** — every href resolves ✓ |
| Flow walkthroughs defined | FC-01, 02, 03, 04, 06, 07, 08, 09, 10, 11 |
| Flow walkthroughs **missing** | **FC-05 and FC-12** — `/flows/FC-05` and `/flows/FC-12` 404 |

The good news first: there are no broken links, the AWB hub spine exists, the domain layer is genuinely typed and CMTS-named, and several flow readings in the code are **more correct than the board** (the AND release gate, the Pharma classification, the OOC-verification-as-control wording). Where the demo and the board disagree, the demo is usually right.

### 4.2 Flow coverage

| Flow | Canonical screens | Verdict |
|---|---|---|
| FC-01 Master | `/import/*` → `/billing/*` → `/dispatch/*`, walkthrough at `/flows/FC-01` | **Good** — 19 steps, all reachable |
| FC-02 Import detail | `/import/*` (9 routes, 10,059 LOC) | **Good** — 36 steps mapped, lane-crossing order preserved |
| FC-03 Classification & storage | `/storage/*` (5 routes) | **Partial** — allocation engine and rules editor exist; `architecture.ts` still records allocation as *"decorative"* for M05 |
| FC-04 CDR | `/exceptions/cdr`, `/exceptions/damage`, `/exceptions/holds` | **Good** — variance entry, 9 types, evidence pack, close gate |
| **FC-05 Messaging** | `/messaging/iata`, `/messaging/notifications` | **Built but not walkable** — no `FLOWS[]` entry, so no `/flows/FC-05` |
| FC-06 Customs | `/customs/*` (4 routes) | **Good** — gateway switch, filing, channels, detained; BLK-03 surfaced on screen |
| FC-07 Charges & DO | `/billing/*` (4 routes) | **Good** — full arithmetic, 5-condition AND gate |
| FC-08 Gate pass & POD | `/dispatch/*`, `/gate-entry/*`, `/warehouse-manager/picking` | **Good** — but see A2: the board gives no failure path to build |
| FC-09 Transhipment | `/transhipment/*`, `/storage/bonded` | **Good** — register + inter-station handoff |
| FC-10 Exceptions | `/exceptions/*` (7 routes) | **Good** — all three branches + aging dashboard |
| FC-11 Export | `/export/*` (6 routes, 9,254 LOC) | **Good in code, weak in spec** — the demo is ahead of the board here |
| **FC-12 Module map** | `/modules`, `/admin/*`, `/auditor/*` | **Partial** — no `FLOWS[]` entry; HQ/site two-portal RBAC not built |

### 4.3 Duplication — the same flow step built two or three times

`components/Sidebar.tsx` carries **two parallel navigation trees**: *Operational Flow* (module-based) and *Role Views* (persona-based). Each tree grew its own screen for the same flow step. A consolidation pass has already hidden the duplicates from the nav under an explicit **"NOTHING IS DELETED"** policy (Sidebar.tsx:70) — but the routes, the code and the deep links all remain.

**The consolidation is nav-only, and the deep links still point at the hidden copies:**

| Where | Line | Links to (nav-hidden) |
|---|---|---|
| `lib/domain/finance.ts` — `evaluateReleaseGate()` "where to go to fix it" | 493 | `/excise-compliance/ooc-capture` |
| " | 521 | `/excise-compliance/hold-register` |
| " | 535 | `/excise-compliance/customs-queue` |
| `components/awb/AwbTabs.tsx` — the AWB hub every screen links into | 154 | `/cmts-absorption/manifest-reconciliation` |
| " | 374 | `/excise-compliance/customs-queue` |
| " | 453 | `/excise-compliance/hold-register` |
| " | 604 | `/cmts-absorption/godown-rent-history` |
| " | 830 | `/excise-compliance/customs-messaging` |
| `app/page.tsx` — home tiles | 54, 71, 72 | `/excise-compliance`, `/cmts-absorption`, `/export-cargo` |

So a user who fails the release gate is sent to a screen the sidebar says does not exist. Hiding without redirecting is the worst of both worlds.

**Duplicate clusters, measured:**

| Cluster | Canonical | Superseded copies | Routes | LOC |
|---|---|---|---|---|
| FC-06 Customs | `/customs/*` | `/excise-compliance/{customs-queue, channel-detail, ooc-capture, customs-messaging}`, `/cha/{gd-filing-workbench, channel-specific-workflow, ooc-tracking}` | 8 | **8,634** |
| FC-10 Exceptions | `/exceptions/*` | `/excise-compliance/{hold-register, section-82-long-stay}`, `/warehouse-manager/exceptions-queue`, `/cha/re-export-long-stay` | 4 | **5,747** |
| FC-07 Billing | `/billing/*` | `/finance-manager/{multi-tariff-engine, payment-gateway-reconciliation}`, `/cmts-absorption/{charges-calculator, godown-rent-history}`, `/cha/payments`, `/consignee/pay-do` | 6 | **4,384** |
| Auth / error | `/login` | 6 screens under `/uld-message-builder/` (sign-in, register, forgot-password, no-access, permission-denied, session-expired) | 6 | **1,646** |
| FC-01/02 Import | `/import/*` | `/cmts-absorption/*` | 4 | **834** |
| FC-11 Export | `/export/*` | `/export-cargo/*` | 4 | **669** |
| FC-05 Messaging | `/messaging/*` | `/notifications-messaging` | 1 | **623** |
| | | **TOTAL** | **33** | **22,537** |

**Screens with no owning flowchart:**

| Area | Routes | LOC |
|---|---|---|
| Planning | 5 | 4,157 |
| Lifter fleet telemetry | 5 | 4,250 |
| Ops supervision | 6 | 3,651 |
| ULD messaging (UCM/SCM/LUC) | 7 | 2,309 |
| ERP bridge mapping | 1 | 1,267 |
| Build/QA meta screens | 3 | 1,249 |
| **TOTAL** | **27** | **16,883** |

### 4.4 The combined number

> **60 of 154 routes and 39,420 of 134,886 LOC — 29% of the demo — is either a second copy of a screen that already exists, or has no owning flowchart.**

### 4.5 External-party portals are 21 screens for 6 touchpoints

FC-02's *Consignee / CHA* lane specifies exactly six touchpoints:

```
NOA received → Documents submitted → Charges paid → DO collected → Cargo collected → POD signed
```

The demo has **21 screens across three portals** — `/cha` (7), `/consignee` (6), `/forwarding-agent` (8) — totalling **24,028 LOC**, with a dashboard, a payments screen and a notifications history in each.

→ Recommend **one external portal, six screens, role-scoped** (CHA / consignee / forwarding agent see different subsets), rather than three portals with triplicated dashboards, payments and notification histories.

---

## 5. Recommended order of work

**Step 1 — Board fixes that change behaviour.** Do these before building anything else.
A1 (Pharma edge) · A2 (FC-08 failure paths) · A3 (storage clock) · A4 (DO split) · B1 (four bypass edges, especially FC-06 OOC) · B2 (FC-08 gates in-line).

**Step 2 — Decide the two open contradictions.**
B3 (export OCR: board says OCR, repo says keyed) · A3 (clock order).

**Step 3 — Board fixes that are labelling/numbering.**
A5, A6, A8, A9, A10, A11, A12, A13, A14, A15, B4, B5, and the six FC-11 items in §1.3.

**Step 4 — Simplification pass on the board (§3).**
Collapse the six fan-outs, de-duplicate FC-02's customs and finance lanes, move Note nodes to annotations. Removes ~100 nodes / ~86 connectors.

**Step 5 — Repo clean-up.**
Redirect or remove the 33 duplicate routes · fix the 11 deep links into nav-hidden screens · add `FLOWS[]` entries for FC-05 and FC-12 · decide the 27 no-flow routes.

**Step 6 — Scope decision** on planning, ops supervision, lifter fleet, ULD messaging, ERP bridge and airmail: give each a flow, or park it.

---

## 6. Questions for SAPS

The build plan already carries 8 open items. This review adds ten more.

| # | Question | From |
|---|---|---|
| 9 | Does OOC scanner verification **gate** release, or is the direct `07 → 08` path allowed? | B1 |
| 10 | Does the storage clock start **before or after** the free period is calculated? | A3 |
| 11 | Is the DO one step or two — CHA request vs terminal issue? | A4 |
| 12 | What happens on piece-count mismatch, unavailable cargo, and damage found at handover? | A2 |
| 13 | What were FC-08 steps **02, 05 and 11**? | A13 |
| 14 | FC-11: is the real terminal order accept → screen → customs, or customs first? | §1.3 |
| 15 | FC-11: export docs OCR'd, or keyed at the counter? (board and demo disagree) | B3 |
| 16 | FC-03: confirm Pharma routes to cold chain, not DG. | A1 |
| 17 | FC-10-A6: is the recovery action decided by the **airline** or by **Customs**? | A14 |
| 18 | Are planning, ops supervision, lifter fleet, ULD messaging, ERP bridge and airmail in scope? If yes, each needs a flow. | §3.3 |

---

*Report generated from the live Figma board and a full sweep of the `saps-demo` repo. All line references verified against the current working tree. No board or repo changes have been made.*
