# CMTS → AirVault · scope decisions taken without SAPS

**Status:** decided 2026-08-16 · **Decided by:** AirVault build team · **Ticket:** 86eyn3nmq

SAPS confirmed they will not supply answers or a data extract. The eight open questions and the
six-table data request were blocking four tickets. Rather than leave them blocked, each has been
decided here, with the reasoning and — where it matters — the direction the decision fails in.

Every decision below is **reversible**. Each names what would have to change if SAPS later
contradicts it, so none of this hardens into an assumption nobody can find.

> **The governing rule for all eight:** where a wrong guess is recoverable in one direction and
> silent in the other, choose the recoverable direction. A prototype that visibly under-reaches is
> a conversation; one that silently bills wrongly is a defect nobody catches until go-live.

---

## Q1 · HR depth — `CEmployee` (58 cols) + 7 supporting tables

**Decision: roster-only. The full employee record is migration-only, with no prototype screen.**

FC-14 is the only flow touching workforce, and its steps are shift handover, live ops supervision,
escalation and performance — *operational* concerns. Nothing in any of the eighteen flows consumes
qualifications, experience, dependents, department or job status. The rail already carries
`/planner/resource-roster` and `/operations-supervisor/shift-handover`, which need a name, a shift, a
role and an assignment, and nothing else.

Building a 58-column employee record plus seven satellite tables would add an HRIS to a cargo
terminal demo. That is a different product, and its absence is obvious rather than hidden.

**Reverse if:** SAPS wants AirVault to be the system of record for staff, not just for shifts. That
is a scope expansion, not a gap-fill, and should be its own epic.

---

## Q2 · Airmail — `AIRMAILDELIVERYBILL` (25) · `AIRMAILTRANSFERMANIFEST` (19)

**Decision: in scope. Already answered by SAPS — build it.**

This one is not actually open. SAPS confirmed airmail in scope alongside planning, ops supervision,
lifter fleet, ULD messaging and the ERP bridge. FC-18 is declared with nine steps in
`lib/architecture.ts`, and **every one of them carries `href: null`** — the flow is specified and
entirely unbuilt.

**Consequence:** FC-18 needs screens. Built as part of this decision round.

---

## Q3 · Export revenue share — is the `INTERNATIONALCARGO` model retained?

**Decision: retained in full, including agency commission and SAPS share.**

The table carries a six-level rate stack — `TARRIFRATE`, `RATE`, `IATARATE`, `IATAFREIGHT`,
`NNFREIGHT`, `SPECIALRATE` — resolving through `INCENTIVEAMOUNT` and `AGENCYCOMMISSION` to `PAYABLE`
and `SAPSSHARE`. That is the only model anywhere in CMTS of *what the terminal actually earns* on an
export booking, as distinct from what it invoices.

Dropping it would make export revenue unrepresentable, and there is no second source to reconstruct
it from. Retaining columns whose exact arithmetic is uncertain costs nothing; discarding them loses
the only record that the distinction exists.

**Reverse if:** SAPS confirms the commission model is retired. Then the columns become
migration-only and the screen loses its lower half.

---

## Q4 · `FreeHandGR` — live or abandoned?

**Decision: live. Modelled as a manual-override variant of the godown rent voucher.**

The ticket flags it as the only table with zero representation anywhere, which reads as evidence of
abandonment. It is not: `ImportFreeHandedCalc` (23 columns) exists as its **calculation partner**.
An abandoned table does not keep a live working-set companion — the pair only makes sense if
free-hand GR is a real billing path.

"Free hand" reads as a manually-keyed voucher: a charge an operator enters directly rather than one
the engine derives, for cases the rate card does not cover.

**Reverse if:** SAPS confirms it is dead. Then both tables drop together, and P5-4 loses one of its
three tables.

---

## Q5 · Migration debris — `PLAN_TABLE` · `CUsers_Backup` · `XmlTesst`

**Decision: dropped from migration scope. Not a judgement call.**

- **`PLAN_TABLE`** is Oracle's `EXPLAIN PLAN` output table, carrying Oracle's exact column
  signature. It is a query-optimiser artifact that arrived with a migration and was never dropped.
  It holds no business data by construction.
- **`CUsers_Backup`** is a backup copy of `CUsers`. The live table is the authority.
- **`XmlTesst`** is a misspelled test table.

None carries business meaning. Excluded from the migration inventory; the effective table count is
**102, not 105**.

**Reverse if:** never, realistically. If one turns out to hold data at extract time that is a data
finding, not a scope change.

---

## Q6 · `Lookup` / `Setting` — which keys are load-bearing?

**Decision: build key-agnostic. Do not assume a key set.**

The restored database is schema-only, so the keys are genuinely unknowable — no amount of deciding
recovers them. Guessing a fixed list would bake in a wrong assumption that only surfaces at
migration.

Build a **typed key/value editor that does not hard-code its keys**: it renders whatever keys exist,
groups by prefix, infers the editor from the value shape, and tolerates unknown keys on import
rather than rejecting them. Seed it with the keys this demo itself needs, each marked as
demo-seeded rather than migrated.

This is strictly better than waiting: a key-agnostic editor works for *any* key set SAPS turns out
to have, so the extract — whenever it arrives — needs no rework.

**Reverse if:** nothing. This decision is robust to any answer.

---

## Q7 · `NONUSEABEL` on `CHARGETYPE` — does it mean "retired"?

**Decision: yes. Treat as retired, and fail safe in that direction.**

The column name is "non-useable" with a dropped vowel — the same misspelling class as `RECIEVEDBY`,
`GrosssWeight` and `TARRIFRATE` elsewhere in this schema. Read plainly, a charge type flagged
non-useable is one SAPS stopped using.

**This is the decision where the two failure directions are not symmetric**, which is what settles
it:

| If we guess | and it is actually | consequence |
|---|---|---|
| retired | live | the charge type is missing from new calculations — **visible immediately**, one flag flip to fix |
| live | retired | migrated rates **silently re-activate billing SAPS stopped doing** — wrong invoices, discovered by a customer |

The second is exactly the risk the ticket names. So: **excluded from new calculations, still
rendered on historical records** carrying a retired marker, because a voucher raised while the type
was live must still display what it was billed under.

**Reverse if:** SAPS says it means something else — most plausibly "not selectable manually but
still applied by the engine", which would be a third state rather than a flip.

---

## Q8 · `TempImportCalculation` (39) / `ImportFreeHandedCalc` (23) — operator-visible?

**Decision: visible, but as derivation rather than as records. No standalone screens.**

The ticket proposes closing this as backend-era working state. That reasoning is half right and
leads to the wrong action, because **`GRCHARGES` is working state too** — and a charge derivation
view is being built for it, because "why is this the amount?" is the single most useful question a
billing demo can answer.

Consistency decides it. All three tables record *how a charge was computed*, for three different
paths:

| Table | Path |
|---|---|
| `GRCHARGES` | standard import godown rent |
| `TempImportCalculation` | temporary import |
| `ImportFreeHandedCalc` | free-hand / manually-keyed (see Q4) |

So they belong on **one charge-derivation screen with three tabs**, not three screens and not a
closed ticket. They are never presented as documents an operator files — only as the audit trail
behind a number already on a voucher.

**Reverse if:** SAPS confirms operators never query a derivation. The screen then becomes
internal-QA rather than client-facing, which is a label change, not a rebuild.

---

## The data request — six rate tables, no data

`CARGOSUBCLASSCHARGES` · `LOCATIONCHARGES` · `CargoClassCharges` · `TaxType` · `Section82Days` ·
`Lookup`

**Decision: synthesise an illustrative rate card, and label it unmistakably as not SAPS data.**

Every one of the 105 tables is empty. These six hold the numbers SAPS bills on, so without them the
charge engine has nothing to resolve against and the billing screens cannot be demonstrated at all.

The rate card in `lib/domain` is therefore **invented** — internally consistent, plausible for air
cargo, and sufficient to exercise every branch of the calculation (banded day slabs, free-day
allowances, location and handling units, tax percentage, Section 82 thresholds).

> **This is the one decision that can cause real harm if it goes unnoticed.** An invented tariff that
> gets mistaken for SAPS's actual rates would produce confidently wrong numbers in a client
> conversation. So the obligation is not just to invent carefully — it is to make the invention
> impossible to miss:
>
> - every synthesised rate table carries a header comment naming it as illustrative;
> - the tariff screens render a persistent banner stating the rates are illustrative and not
>   SAPS-supplied;
> - the values are deliberately round and obviously synthetic rather than realistic-looking
>   precision, so nobody mistakes them for an extract.

**Reverse if / when:** SAPS supplies the extract. Replacing the fixtures is then a data swap with no
code change, because nothing outside `lib/domain` hard-codes a rate. That property is the point of
keeping it all in one place.

---

## What this unblocks

| Ticket | Was | Now |
|---|---|---|
| 86eyn3nmq | 8 open questions | all answered above |
| 86eyn3nkw | blocked on Q8 | build as tabs on the charge-derivation screen |
| P5-1 (tariff master) | unverifiable | buildable against the illustrative rate card |
| P5-4 (free-hand GR) | premise uncertain | confirmed live by Q4 |
| FC-18 airmail | unbuilt, 9 null hrefs | in scope per Q2 |
