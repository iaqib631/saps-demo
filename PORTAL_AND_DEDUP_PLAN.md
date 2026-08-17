# Portal Separation & Duplication Plan

Companion to [`FLOW_REVIEW_AND_SIMPLIFICATION.md`](./FLOW_REVIEW_AND_SIMPLIFICATION.md) and
[`FLOW_DECISIONS.md`](./FLOW_DECISIONS.md). This document supersedes §4.3 of the review.

---

## 1. Correction to the review

The review said **33 routes / 22,537 LOC are duplicates and can be deleted**. A screen-by-screen
diff of every candidate against its canonical counterpart shows that number is wrong, and wrong in
the dangerous direction: **most of those routes carry functionality the canonical screen does not
have.** Deleting them as proposed would have removed working surfaces from the product.

What the diff actually found:

| Verdict | Routes | Meaning |
|---|---|---|
| **True duplicate — delete** | **12** | Fully absorbed. Deleting loses at most a source-table citation. |
| **Relocate** | **8** | Rich screen sitting in the wrong portal. Move the route; keep every line. |
| **Merge then delete** | **5** | Genuine overlap. Port the unique half into the canonical screen first. |
| **Keep — not a duplicate** | **12** | Different audience or different job. Deleting these was a mistake in the review. |

The three worst calls in the original review:

**`/excise-compliance/channel-detail` (1,079 LOC) was marked deletable.** It is the *working surface*
where a customs officer records the yellow-channel document review and schedules the red-channel
examination — a 9-item review checklist, query capture with reference numbers and attachments, exam
date/time/bay/officer, sample type, exam result tri-state, photo evidence. The "canonical"
`/customs/channels` is a **read-only viewer**. Deleting the working screen and keeping the viewer
would have removed the only way to record a customs scrutiny.

**`/finance-manager/multi-tariff-engine` (1,037 LOC) was marked deletable.** It is the only place
negotiated rates are modelled: Agent Contract × Consignee Tier × Route × Cargo Class × Special
Handling, with rate overrides, effective/expiry dating, and an approval workflow on the tariff set.
Neither `/billing/calculator` nor `/finance-manager/tariff-master-editor` carries any contract, tier
or route dimension. Deleting it removes negotiated-rate pricing from the product entirely.

**The six `/cha/*` and `/consignee/*` screens were marked deletable.** By the rule in
`FLOW_DECISIONS.md` §4 — *duplication is two screens for the same audience doing the same job* —
these are not duplicates. `/customs/filing` is the terminal **reading** a declaration;
`/cha/gd-filing-workbench` is the CHA **filing** it. Delete the second and the first describes an
actor with no surface.

## 2. The four buckets

### 2.1 Delete — 12 routes, ~1,970 LOC

Fully absorbed by their canonical counterpart. Port the named line, then delete.

| Route | Absorbed by | Port first |
|---|---|---|
| `/cmts-absorption` | `/modules` | Annexure-G scope-delta note; CMTS coverage summary; per-module source-table chips |
| `/cmts-absorption/cargo-acceptance` | `/import/acceptance` | `CARGOACCEPTANCE · ACCEPTENCEDETAIL · CARGOACCEPTANCEHWB` citation |
| `/cmts-absorption/awb-consolidation` | `/import/consolidation` | "New consolidation" action; carrier/origin in the tree header; `AWBTRANSFER`, `AWBARRIVALADVICE` citations |
| `/cmts-absorption/manifest-reconciliation` | `/import/manifest` | `IMPORTAWBLOCATION` citation |
| `/cmts-absorption/godown-rent-history` | `/billing/godown-rent` | AWB-scoped search; **multi-voucher rent history** (one AWB spanning several GRVs — the canonical screen is voucher-scoped and cannot express it) |
| `/cmts-absorption/charges-calculator` | `/billing/calculator` | Per-rule CMTS source-table attribution |
| `/export-cargo` | `/export/booking` | 4 cross-stage export KPI tiles |
| `/export-cargo/acceptance` | `/export/acceptance` | Named 6-document checklist; `Held` screening state; export storage allocation with override-and-reason |
| `/export-cargo/customs` | `/export/customs` | Export GD register table; `Query`/`Held` filter chips |
| `/export-cargo/manifest-handover` | `/export/buildup`, `/export/uplift` | **Outbound message send panel** (FFM/FWB/FHL/NOTOC with sent state); airline handover checklist with acceptance signature |
| `/uld-message-builder/register` | `/admin/users` | Access-request form; station list; requested-role taxonomy |
| `/uld-message-builder/forgot-password` | `/login` | Password-reset request flow |

### 2.2 Relocate — 8 routes, no content change

Right screen, wrong portal. Move the route, update links, keep every line.

| From | To | Why |
|---|---|---|
| `/excise-compliance/customs-queue` | `/customs/queue` | The tabular customs work queue. `/customs/channels` is master-detail and has no queue at all. |
| `/excise-compliance/channel-detail` | `/customs/channel-detail` | The officer's working surface. Pairs with `/customs/channels` as list → detail. |
| `/excise-compliance/ooc-capture` | `/customs/ooc-capture` | The only path that can key an OOC when the PSW gateway is down — which the canonical model already assumes exists (`ooc.keyedAt`). |
| `/excise-compliance/customs-messaging` | `/messaging/customs` | It was never a customs screen — nothing under `/customs/*` renders IATA messages. |
| `/uld-message-builder/sign-in` | fold into `/login` | Port Remember Me, password-recovery link, and the authn-vs-authz split. |
| `/uld-message-builder/no-access` | `/auth/no-access` | Not a ULD screen. **`AuthGuard` redirects every route here — repoint the guard first.** |
| `/uld-message-builder/permission-denied` | `/auth/permission-denied` | Same. The only RBAC-refusal surface in the app. |
| `/uld-message-builder/session-expired` | `/auth/session-expired` | Same. |

> **Ordering hazard.** `components/auth/AuthGuard.tsx` redirects *every route in the app* into four
> of these paths. They must be moved and the guard repointed in the same change, or any
> unauthenticated visit 404s.

### 2.3 Merge then delete — 5 routes

Genuine overlap, but the duplicate holds the working half and the canonical holds the audit half.
Port, verify, then delete.

| Duplicate | Canonical | What must be ported |
|---|---|---|
| `/excise-compliance/hold-register` | `/exceptions/holds` | **ANF and ASF as first-class hold types** (canonical collapses both into `security` — they are two different Pakistani agencies); hold priority; functional owner; interim statuses Under Review / Escalated; **the Add Hold and Release Hold drawers** — canonical renders the seven release columns but has no action that populates them |
| `/excise-compliance/section-82-long-stay` | `/exceptions/long-stay` | Customs Decision as a field distinct from Final Disposition; Final Notice status; case register with consignee/class/pieces/weight; owner and escalation date; the six action verbs (Generate Notice → Record Final Disposition) |
| `/warehouse-manager/exceptions-queue` | `/exceptions/cdr` | Priority; owner and assignment (canonical has `raisedBy` but no owner, so an unowned CDR is invisible); age and the 6-hour SLA; queue statuses and Escalate/Resolve actions; type quick-filter chips |
| `/notifications-messaging` | `/messaging/notifications` | Template CRUD and the Edit modal with a variable palette; template Active/Draft lifecycle; preview; message-log error column and per-row Retry |
| `/excise-compliance` (hub) | new `/customs` index | 5-tile customs KPI strip; **Customs SLA Watch** (AWBs within 4h of free-period expiry — no free-period proximity surface exists anywhere under `/customs/*`) |

### 2.4 Keep — 12 routes the review was wrong about

**Customer and agent portals** — different audience, so not duplication:
`/cha/gd-filing-workbench` · `/cha/channel-specific-workflow` · `/cha/ooc-tracking` ·
`/cha/payments` · `/cha/re-export-long-stay` · `/consignee/pay-do`

**Finance** — different job, so not duplication:

| Route | Why it stays |
|---|---|
| `/finance-manager/tariff-master-editor` | Base rate card — the versioned Tariff Master of FC-07 |
| `/finance-manager/multi-tariff-engine` | Negotiated rates — contract × tier × route × class matrix. Nothing else models these. |
| `/finance-manager/payment-reconciliation` | Bank settlement reconciliation |
| `/finance-manager/payment-gateway-reconciliation` | Gateway/webhook reconciliation — named providers (HBL, Meezan, NIFT, Easypaisa, JazzCash, 1LINK), refunds, webhook errors. `/billing/invoice` deliberately shows only the legacy-instrument queue. |
| `/finance-manager/waiver-workflow`, `/finance-manager/invoice-generation` | The FC-07 §10–12 approval chain |

## 3. The three portals

**Superseded, 14 Aug 2026:** an earlier draft of this section proposed fourteen portals. The client
fixed the number at **three**, in this order.

Every surviving route belongs to exactly one portal. All three stay reachable from one sidebar so the
prototype shows the whole picture; each is self-contained enough to be lifted into its own repository
later, which is what the `audience` tag records — it is the split boundary, written into the nav.

| # | Portal | Audience | What it is | Flows |
|---|---|---|---|---|
| **1** | **Warehouse Portal** | internal-ops | Cargo handling and airport services — everything SAPS staff do to a consignment, from forecast to file closure | FC-01 … FC-11 · FC-13 … FC-17 |
| **2** | **Consignee Portal** | customer | The external parties SAPS serves | FC-02 consignee lane · FC-06 · FC-07 §13 · FC-08 §01 · FC-10 |
| **3** | **Superadmin Portal** | admin | Platform administration, oversight and the shared shell | FC-12 · M19 / M20 |

**Warehouse Portal**, in flow order — 17 blocks:
Planning & Capacity · Import Documentation · Storage & Allocation · Warehouse Floor ·
Lifter Fleet · Messaging & Alerts · ULD Messaging · Customs Clearance · Tariff & Charges ·
Invoice, Payment & Release · Gate & Yard · Dispatch & Closure · Exceptions & CDR · Transhipment ·
Export · Operations Supervision · Integrations

**Consignee Portal** — 3 blocks: Customer Self-Service · Customs Broker Desk · Freight Forwarder Desk

**Superadmin Portal** — 2 blocks: Administration · Audit & Oversight

> **Updated 2026-08-16.** Three changes since this section was written, all verified against the
> live rail (22 blocks, 127 leaf hrefs):
>
> - **AWB Hub left the rail.** It is a drill-in target — you reach it by clicking an AWB number,
>   not by navigating — so it moved to the `DRILL_IN` registry in `components/Sidebar.tsx` along
>   with the customs channel detail and lifter task detail screens. The warehouse count stays 17
>   because Integrations moved in as it left.
> - **Integrations moved from Superadmin to Warehouse**, at the foot of the run: the gateway estate
>   is handled per site, and Warehouse is the per-site portal.
> - **Architecture & Flows and Access & Session are gone.** The first was deleted outright, pages
>   included (`/modules`, `/flows/[flowId]`). The second lost only its rail entries — `/login` and
>   the three `/auth/*` pages still exist, in the `AUTH_STATES` registry, because `AuthGuard`,
>   header sign-out and the landing CTAs all target them.

### Why the CHA and the freight forwarder sit in the Consignee portal

With three portals rather than fourteen, the broker and the forwarder have to land somewhere. They go
with the consignee because they are **the same side of the counter** — people SAPS serves, not people
SAPS employs. Putting them in Warehouse would put a broker's screens in the terminal's repository
when the split happens, which is the one outcome the `audience` boundary exists to prevent.

### Two details preserved from the fourteen-portal draft

- **Planning leads the Warehouse portal.** FC-13 ends at "flight arrives; receipt begins under
  FC-01 / FC-02", so the forecast genuinely precedes the import spine rather than trailing it.
- **`/awb/[awbId]` has a first-class entry.** It had no sidebar entry at all before this work despite
  being the declared target of twelve flow steps; it now opens the Warehouse portal as the record
  every other screen drills into.

**Home** sits above all three headings. It belongs to no portal — it is the page you arrive on before
choosing one — and giving it a portal id would render a fourth heading.

## 4. Flow-ordered navigation

The rule is: **if a screen links onward to another, the target sits below it.** Seventeen violations
exist today. The four that matter most:

1. **`/import/acceptance` → `/warehouse-manager/putaway`.** The primary CTA of the most-walked step
   in the import spine ("Continue to storage allocation") jumps ten nav sections down — *and*
   contradicts the spec, which resolves FC-01 §15–16 to `/storage/allocation`. Re-point the CTA.
2. **Gate pass before its own prerequisites.** FC-08 runs §03 verify identity and §04 verify
   authority letter *before* §06 generate gate pass. The nav has the gate pass in Operational Flow
   and both checks far below in Role Views, so walking the nav top-to-bottom generates the pass
   before seeing the checks that gate it. Gate & Yard must sit between the customs block and the
   dispatch block.
3. **`/customs/gateway` above `/customs/filing`.** A declaration is filed (§03) and only then
   transmitted (§03a). The nav inverts them.
4. **`/exceptions/queue` at the top of the exceptions block.** FC-10 puts the cross-branch aging
   dashboard at the *end*. The nav promotes the summary above the six branches that feed it.

One honest caveat: **no linear order satisfies the rule completely.** `/billing/delivery-order`
links back up to `/billing/godown-rent`, which links back up to `/billing/calculator`; the customs
filing/gateway pair links both ways. The rule needs a distinction between an **onward CTA** (must
point down) and a **drill-back reference** (may point up, and should be styled as a reference rather
than a next step). That distinction is what makes the rule testable, and it is how the nav will be
built.

## 5. Sequence

Per the agreed order of work, the flow model and the behaviour fixes land first; the portal and
duplication work follows, because deleting routes while the flow model is still moving would leave
the two out of step.

1. **In progress** — the seven behaviour fixes (BC-1…BC-7) and the flow model rewrite: FC-01…FC-12
   amended, FC-05 and FC-12 walkthroughs added, FC-13…FC-18 written, modules M21…M26 created.
2. Screen-layer follow-through for the behaviour fixes.
3. Bucket 2.1 — the 12 true deletions.
4. Bucket 2.2 — the 8 relocations, `AuthGuard` repointed first.
5. Bucket 2.3 — the 5 merges.
6. Portal separation and the flow-ordered sidebar.
7. Figma Rev 3.0 content amendments.
