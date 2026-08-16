# Flow Decisions — signed off

Companion to [`FLOW_REVIEW_AND_SIMPLIFICATION.md`](./FLOW_REVIEW_AND_SIMPLIFICATION.md).
That document raised 20 defects and 18 open questions. This one records the answers, and is the
authority for the implementation. Where a flowchart and this document disagree, **this document wins**
and the flowchart is the thing that gets amended.

**Signed off by:** Aqib, on behalf of SAPS · **Date:** 14 Aug 2026
**Status of the board:** not yet amended — see §5.

---

## 1. Answers from SAPS

| # | Question | Answer | Consequence |
|---|---|---|---|
| **9** | Does OOC scanner verification gate release, or is the direct `07 → 08` path allowed? | **It gates.** | The `07 OOC issued → 08 Cargo eligible for release` bypass is **deleted**. Release requires OOC captured by scanner **and** field-verified against the Single Declaration. A sixth condition joins the release gate. |
| **10** | When does the storage clock start? | **At cargo intake.** A grace period follows during which nothing is charged; the system then computes a chargeable period. | `Arrival recorded → clock starts → free/grace period applied → chargeable period = dwell − free`. Resolves the FC-02 ↔ FC-07 contradiction **in FC-02's favour**: clock first, free period applied against it. FC-07 §02/§03 get reordered. |
| **11** | Is the DO one step or two? | *Deferred to us* — see §2. | Split in two. Today they are **§22 DO issued** and **§22a DO collected** — see §2.1, which records the two later corrections to the halves' order and their numbering. |
| **12** | Piece-count mismatch, unavailable cargo, damage at handover? | **A CDR is created.** | All three FC-08 dead ends now route into FC-04. Three new failure paths. |
| **13** | What were FC-08 steps 02, 05 and 11? | **Mis-numbering on our side** — no steps are missing. | FC-08 renumbers `01…16`, no gaps. Nothing to recover. |
| **14** | FC-11 terminal order — accept → screen → customs, or customs first? | **Customs comes first.** | The drawn **connector order is correct**; the *step numbers* are what's wrong. FC-11 gets renumbered to follow its connectors, not rewired. |
| **15** | Export docs OCR'd or keyed? | *Deferred to us* — "standard approach as followed in export cargo". See §2. | Keyed at the counter. OCR node removed from FC-11. |
| **16** | Pharma → cold chain, not DG? | **Confirmed.** | `Pharma → Dangerous Goods` edge deleted; `Pharma → Cold Chain Storage` drawn. Code already correct. |
| **17** | FC-10-A6 — recovery decided by airline or Customs? | **The airline issues the instruction; Customs performs the recovery action.** | A5 keeps the airline as instructing party. A6 relabels to *"Recovery action executed by Customs"*, and its three exits get labelled. |
| **18** | Are planning, ops supervision, lifter fleet, ULD messaging, ERP bridge and airmail in scope? | **All in scope.** | Six new flowcharts, **FC-13 … FC-18**, and six new module codes. Nothing gets parked. |

## 2. The two calls deferred to us

### 2.1 The Delivery Order is two steps, not one

FC-01 numbers the DO as step 22 and places it *after* invoicing, but the connectors run
`18 NOA → 22 DO → 19 Customs Clearance Tracking`. Both are right about different things, because
node 22 is doing two jobs.

**Decision — split it.** As signed off, the two halves were:

| Step | Actor | Trigger | Gate |
|---|---|---|---|
| ~~**22a. DO requested**~~ | CHA / consignee | On receipt of the NOA | none — it is an application |
| ~~**22b. DO issued**~~ | Terminal (M12) | After payment received | the five-condition release gate, now six with OOC-verified |

`evaluateReleaseGate()` in `lib/domain/finance.ts` gates the issuing half, and that has not changed.
The **request** half has: it was written against `/cha/do-collection`, on the reading that the CHA
raises the DO application off the NOA, and that reading is retired. That screen is a collection
queue — its first state is “DO Ready”, an already-issued DO awaiting a driver, and it runs
DO Ready → Driver Assigned → Vehicle Assigned → Scheduled → Collected. Nothing on it raises a
request. So the half is a **collection**, and a collection cannot precede the issuance it collects;
FC-02 §33 and FC-08 §01 both put the same act after the DO exists. The two halves swapped order.

**The halves as they stand:**

| Step | Actor | Trigger | Gate |
|---|---|---|---|
| **22. DO issued** | Terminal (M12) | After payment received | the five-condition release gate, now six with OOC-verified |
| **22a. DO collected** | CHA / consignee | Once the DO is issued | none — driver and vehicle are assigned against the issued DO |

**On the numbering.** The letters `a` / `b` were assigned when the request half was drawn first, and
were not touched when the steps swapped, so FC-01 printed its badges `21a, 22b, 22a, 23` and
descended. The order above is correct and did not move; the **letters** were the defect. The issuing
half takes the bare parent number **§22** — old step 22 was a single node and issuance is the act on
the FC-01 spine, performed by the terminal — and the CHA's collection stays **§22a**, a sub-step
subordinate to it. That is the convention everywhere else in the flows: a lettered suffix hangs off
an existing numbered parent (§14a under §14, §21a under §21, and FC-02's 06a–06d, 18a, 33a, 35a).
Under the old pair there was no §22 at all for `22a` / `22b` to be subordinate to.

**Ref `22b` is retired.** FC-01 reads `21a → 22 → 22a → 23`, ascending in array order.

### 2.2 Export documents are keyed at the counter, not OCR'd

The board's FC-11 overlay shows *"Export docs OCR-captured … confidence + operator acceptance"*.
The repo records the opposite as already confirmed by SAPS.

**Decision — keyed.** OCR stays on the **two import-side scan points only**:

1. inbound MAWB / HAWB / manifest off the flight pouch (FC-01 §05a, FC-02 §06a)
2. the receiver's authority letter and documents at collection (FC-08 §04)

**Why.** An OCR confidence score is only worth having when there is something to reconcile the
extraction *against*. On the import side there is: the manifest, the FFM/FWB/FHL and the physical
count, which is exactly what produces the declared-vs-physical variance that auto-raises a CDR.
On the export side the documents arrive from the shipper as the first record of the consignment —
there is nothing to check them against, so a confidence score would be decoration and an operator
would accept every line unread. Keying at the counter with validation is the standard export-cargo
approach and is the honest one here.

**Consequence:** remove the OCR node from FC-11; keep `04a. Export documents captured — keyed at
the counter`. Board and repo agree again.

## 3. Scope decision — six new flowcharts

All six previously-unowned areas are in scope and get a flow. Nothing is parked.

| New flow | Covers | Existing screens |
|---|---|---|
| **FC-13** Planning & Capacity | capacity, slotting, roster, demand forecast | `/planner/*` |
| **FC-14** Ops Supervision & Workforce | live ops, performance, escalation, shift handover, floor notes | `/operations-supervisor/*` |
| **FC-15** Equipment & Lifter Fleet | tasks, RFID scan, movement log, lifter status | `/lifter-operator/*` |
| **FC-16** ULD Management | UCM, SCM, LUC, import, message log | `/uld-message-builder/*` |
| **FC-17** Finance ERP Bridge | GL mapping, posting, sync log | `/finance-manager/erp-bridge-mapping` |
| **FC-18** Airmail / Postal | delivery bill, transfer manifest, mail types | **not built** — CMTS `AIRMAILDELIVERYBILL`, `AIRMAILTRANSFERMANIFEST`, `POMailType` |

FC-05 and FC-12 also gain the `FLOWS[]` entries they never had, so all eighteen flows are declared
in `lib/architecture.ts`.

> **Superseded, 2026-08-16.** This originally read "…so all eighteen flows are walkable at
> `/flows/FC-nn`". The flow walkthrough renderer (`app/flows/[flowId]`) and the module map
> (`app/modules`) were both deleted when the **Architecture & Flows** sidebar block was removed, so
> no flow is walkable in the UI any more. The eighteen `FLOWS[]` entries remain, and are still the
> authority the rail order and the step-sequence audits are checked against — they simply have no
> screen. See the header of `lib/architecture.ts`.

## 4. Portal decision

**Every portal is separate and self-contained** — admin, lifter, customer, CHA, forwarding agent,
warehouse, planning, finance and the rest each own their screens, with no screens shared or
congested into one another. All of them stay reachable from **one sidebar**, so the prototype shows
the client the whole picture before the portals are split into their own repositories.

Two structural rules follow:

1. **A screen belongs to exactly one portal.** Where an internal screen and a customer-facing screen
   show the same data, they are *different views for different audiences* and both survive — that is
   not duplication. Duplication is two screens for the *same* audience doing the *same* job.
2. **Nav order follows flow order, top to bottom.** If a screen links onward to another, the target
   sits below it in the same portal. No more jumping between unrelated groups to follow one
   consignment.

## 5. What still needs a decision from you

**The Figma board has not been touched.** Every amendment above is staged and ready, but the board is
a client-facing document prepared by Faisal Engineering Services, and writing to it is not reversible
from here. Three options — tell us which:

| Option | What happens |
|---|---|
| **A · Amend in place** | The 24 existing frames are edited directly. Cleanest result, no history. |
| **B · New Rev 3.0 row** | A third row of corrected frames is added below the AirVault row; Rev 2.0 stays intact as the record of what was reviewed. **Recommended** — it preserves the audit trail and lets SAPS diff the two. |
| **C · Change list only** | We hand over a per-frame instruction list and your team applies it. |

Until that is answered, the repo is the authority and carries every decision in this document.
