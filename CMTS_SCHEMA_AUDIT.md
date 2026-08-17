# CMTS Schema Audit

**Source:** local SQL Server `MSSQLSERVER` → database `CMTS`, read 14 Aug 2026 (SQL Server 17.00.1000)
**Compared against:** `saps-demo` — 590 TypeScript files across `app/`, `components/`, `lib/`
**Method:** full `sys.tables` / `sys.columns` / `sys.foreign_keys` / `sys.sql_modules` extract, then
token-matched against the repo. Raw dumps in the session scratchpad (`cmts/*.tsv`, `cmts/procs/*.sql`).

---

## 0. Read this first — the database has no data

Every one of the **105 tables is empty**. Verified two ways: `SUM(sys.partitions.rows)` returns zero
for all tables, and direct `COUNT(*)` on `IMPORTAWB`, `GODOWNRENT`, `AIRLINE` and `CARGOCLASS` each
return 0.

That bounds what this audit can say:

| Answerable from a schema-only restore | **Not** answerable |
|---|---|
| Every table, column, type, length, nullability, default | Reference data — cargo classes, charge types, locations, tax rates |
| Declared keys and constraints | Which columns are actually used vs vestigial |
| All 120 stored procedures and 7 views, with full bodies | Real cardinality, data volumes, value distributions |
| The business rules encoded in those procedures | Whether a nullable column is null in practice |

**The reference data is the gap that matters.** `CARGOSUBCLASSCHARGES`, `LOCATIONCHARGES`,
`CargoClassCharges`, `TaxType`, `Section82Days` and `Lookup` are all rate and rule tables — the
numbers SAPS actually bills on. A schema restore gives us their shape and none of their content. To
finish the tariff work we need a data-bearing extract of those six tables at minimum.

**Headline counts.** 105 tables · 1,737 columns · 21 foreign keys · 120 stored procedures · 7 views ·
102 of 105 tables carry a declared primary key.

---

## 1. Relationships — the cargo core has no referential integrity

**21 foreign keys across 105 tables**, and they are not where you would expect:

| Where the 21 FKs live | Count |
|---|---|
| HR / RBAC / geography — `CEmployee`, `CUsers`, `CGroups`, `CPages`, `CCompany`, `COffice`, `City`, `Country`, `CDesignation` | **17** |
| Cargo — `AWBSplit`, `CARGOSUBCLASSCHARGES`, `CARGOSUBCLASSLOCATION`, `IMPORTAWBBOUNDEDAREA` | 4 |

So the parts of CMTS that came from a packaged HR/admin module are properly constrained, and **the
entire cargo lifecycle — AWB, manifest, location, godown rent, delivery order, gate pass, delivery —
has essentially none.**

### The join key is a naming convention, not a constraint

| Column | Carried on |
|---|---|
| `AWBNO` | **27 tables** |
| `IGMNO` | **25 tables** |
| `HWBNO` | 12 tables |
| `SEQUENCE` | 11 tables |
| `INDEXNO` | 6 tables |
| `CityId` | **32 tables** |
| `Comp_Code` / `Off_Code` | 17 / 16 tables |

Nothing enforces that an `AWBNO` in `GODOWNRENT` exists in `IMPORTAWB`. A further **70 joins are
inferable** from the `<Table>ID` naming convention (`AWBCONSOLE.CARGOCLASSID → CARGOCLASS`,
`AWBTRANSFER.AirlineId → AIRLINE`, and so on) — **none of them declared.**

**Consequence for migration:** the AirVault import cannot assume referential integrity. It needs an
explicit reconciliation pass that reports orphans — godown-rent rows whose AWB does not exist,
locations pointing at deleted subclasses — rather than a straight `INSERT … SELECT` that will either
fail late or silently carry the orphans across.

### Three tables have no primary key at all

`CargoClassGroupwise` · `GODOWNRENTHistory` · `PLAN_TABLE`

`GODOWNRENTHistory` is the serious one: 75 columns, the audit history of every rent voucher, and no
key. Rows cannot be uniquely addressed, so a corrected history row cannot be identified.

### A misnamed constraint worth knowing about

```
FK_AWBSplit_AWBSplit :  AWBSplit.ID  →  CARGOCLASS.ID
```

The name says self-reference; the constraint actually points at `CARGOCLASS`. `AWBSplit.SplitId` is
the real primary key, and `ID` is a cargo-class reference wearing a generic name. The demo already
models this as `SplitClassId`, which is clearer than the source — worth keeping rather than
"correcting" back to the legacy name during migration.

---

## 2. Field coverage — where the 1,737 columns stand

| Bucket | Columns | Meaning |
|---|---|---|
| **Rendered** | **869** | Appears on a screen under `app/` or `components/`, or carries an explicit `cmts="…"` parity marker |
| **Typed but never rendered** | **109** | Modelled in `lib/domain` but no form field anywhere — *the literal answer to the question asked* |
| **Absent** | **350** | Nowhere in the repo |
| Too generic to score | 409 | `ID`, `NAME`, `STATUS`, `CreatedBy` … — presence proves nothing |

The repo carries **104 explicit `cmts="COLUMN"` parity markers** on screens, which is how the
rendered count is verifiable rather than guessed.

### 2.1 The missing form fields — typed but never rendered

These are already in the domain model. Each needs a field on the screen that owns it.

| Table | Missing form fields |
|---|---|
| `GODOWNRENT` / `GODOWNRENTHistory` | `SUBAWBNO` · `SUBINDEXNO` · `GRREFERENCE` · `PAYORDERDATE` · `MASTERCARD` · `GodownId` · `GdUniqueIdentification` · `GDNum` · `sumTotalAmountWithoutTax` · `sumAFUAmount` · `sumMinimumCharges` |
| `DELIVERYINFO` | `ConsgneePhone` · `ConsigneeEid` · `ShipName` · `ShipAdd` · `ShipPhone` · `ShipEid` · `AgentPhone` · `AgentEid` — **the entire shipper and agent contact block** |
| `CARGOACCEPTANCE` | `CARGOID` · `AWBCODE` · `BAGNO` · `TIMEOFWEIGHMENT` · `TIMEOFACCEPTENCE` · `VEHICALNO` · `SHIPPERPHONENO` · `CONSIGNEEADDRESS` · `CONSIGNEEPHONENO` |
| `GODOWNRENTDETAIL` | `HandlingUnit` · `StorgeUnit` · `LocationUnit` · `TaxPercentage` · `SpecialCharges` · `DocCharges` · `AFUAmount` · `GodownId` |
| `CARGOSUBCLASSCHARGES` | `WEIGHTFROM` · `WEIGHTTO` · `DAYTO` · `CHARGESTYPE` · `SPECIALCHARGES` · `FLATERATE` |
| `LOCATIONCHARGES` | `WEIGHTFROM` · `WEIGHTTO` · `DAYTO` · `FLATERATE` |
| `GATEPASS` | `CASHNODate` · `BDNo` · `BDDate` · `AWBNODate` · `HWBNODate` |
| `AWBDELEIVERYORDER` | `DuplicateReason` · `FIRdate` |
| `PHYSICALDELIVERY` | `BLNO` · `BECASHNO` |
| `TaxType` | `ChargesType` · `IsDo` |
| `EmailHistory` / `SmsHistory` | `SenderName` · `SenderEmail` / `SenderNumber` |

The four rate-table rows in that list are not cosmetic — see §3.

### 2.2 Tables with no representation at all

14 tables, 97 columns, nothing rendered and nothing typed:

`FreeHandGR` (16) · `CDesignation` (10) · `REMARKS` (10) · `SHIFT` (10) · `CJobStatus` (9) ·
`Country` (9) · `CGroupWithPages` (7) · `ACTION` (5) · `CSessionLogDetail` (5) · `Lookup` (5) ·
`APPLICATIONACCESSIBILITY` (3) · `CATEGORY` (3) · `CUserWithGroups` (3) · `Setting` (2)

Most are RBAC or reference plumbing. Two deserve a decision:

- **`FreeHandGR` (16 cols)** — free-hand godown rent, a manual override of the calculated rent. Zero
  representation. If SAPS uses it, there is no screen for it and no field for it.
- **`Lookup` (5) and `Setting` (2)** — generic key/value configuration. Whatever tunes CMTS at
  runtime lives here, and with an empty database we cannot see what.

### 2.3 Tables the repo knows but under-covers

| Table | Cols | Absent | Note |
|---|---|---|---|
| `CEmployee` | 58 | 37 | HR. In scope only as "Ops & Workforce"; the full 58-column employee record is not |
| `grCharges` | 48 | 21 | The charge working table — see §3 |
| `INTERNATIONALCARGO` | 44 | 19 | Export revenue share, still parked pending SAPS |
| `PLAN_TABLE` | 27 | 17 | Oracle-style plan table; almost certainly migration debris, not a business table |
| `AIRMAILTRANSFERMANIFEST` | 19 | 16 | FC-18 — in scope, unbuilt |
| `ExportGodownrent` | 53 | 15 | Export-side rent |
| `CPages` | 22 | 13 | Page-level RBAC |
| `AIRMAILDELIVERYBILL` | 25 | 11 | FC-18 — in scope, unbuilt |

---

## 3. The charge calculation — the most valuable thing in this database

**The billing rules are not in the schema. They are in the stored procedures**, and all 127 objects
have readable bodies. `Charges`, `SPGRCharges`, `GodownRentVoucher` and `WaveOffGodownRentVoucher`
carry the real arithmetic. Reading `Charges` against the demo's `calculateCharges` produces six
findings.

### 3.1 The demo under-counts dwell — every invoice is short

CMTS counts **calendar days, inclusive of both ends**:

```sql
(DATEDIFF(day, i.CARGODATE, @enddate) + 1) AS Days
```

The demo counts **elapsed 24-hour periods**:

```ts
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / MS_PER_DAY));
}
```

Cargo received 12 May 23:00, priced 14 May 01:00 — CMTS bills **3 days**, the demo bills **1**. Even
on whole days the demo is one short, because it lacks the `+1`. This is a real billing defect and it
affects every consignment.

### 3.2 Free days are per subclass × location × weight band, not per cargo class

CMTS derives the free period from the rate row whose amount is zero:

```sql
(case when s.AMOUNT = 0 then (s.DAYTO + @ExtraFreeDays) end) AS hhh
```

`s` is `CARGOSUBCLASSCHARGES`, keyed on cargo class **and subclass and location and weight band**.
The demo reads `cargoClass.freeDays` — one number per class. Two consignments of the same class in
different zones or weight bands can have different free periods in CMTS and cannot in the demo.

`@ExtraFreeDays` is a per-invocation grant on top. The demo has `supplementDays`, which is the same
idea, so the mechanism exists — the per-subclass derivation does not.

### 3.3 Rates band by weight *and* day; the demo bands by day only

```sql
AND l.WEIGHT >= s.WEIGHTFROM
AND l.WEIGHT <= s.WEIGHTTO
```

on both `CARGOSUBCLASSCHARGES` and `LOCATIONCHARGES`. The demo's `slabBreakdown(chargeableDays,
chargeableKg)` bands on days and multiplies by weight — it does not select a *rate* by weight band.
`WEIGHTFROM` / `WEIGHTTO` are typed and never priced (§2.1).

### 3.4 Billing follows the LOGICAL location, not the physical one

```sql
inner join CARGOSUBCLASSLOCATION t1 on l.LOGICALCARGOSUBCLASSID = t1.SUBCLASSID
  and l.Cargoclassid = t1.CLASSID and l.LOGICALLOCATIONID = t1.Id
```

The demo models `LOGICALLOCATIONID` / `PHYSICALLOCATIONID` and flags divergence, but the charge path
does not price off the logical location. Where the two diverge — cargo physically overflowed into
another zone while logically still allocated — CMTS bills the logical zone. That is a rule, and it
is currently unimplemented.

### 3.5 There are two tax rates, and the demo models one

```sql
(select t.Amount from TaxType t where t.IsDo = 0 and t.ChargesType like 'GD%') AS TaxPercentage
```

`TaxType.IsDo` splits godown-rent tax (`0`) from delivery-order tax (`1`), and `ChargesType` selects
within each. **Both columns are typed and never rendered.** The demo applies a single tax rate.

### 3.6 Deconsolidation is waived on a supplementary bill

```sql
case when @IsSuppliment = 'Suppliment' then 0
     else (select c.DECONSOLIDATIONCHARGES from CARGOCLASS c where c.ID = l.Cargoclassid) end
```

A supplementary invoice does not re-charge deconsolidation. The demo has no bill-type concept on the
charge path, so a supplementary bill would double-charge it.

Also visible: `CHARGESTYPE = 'Demrage'` is the discriminator that separates demurrage from the other
charge types on the same rate table — `CHARGESTYPE` is typed and never rendered.

---

## 4. What I recommend, in order

1. **Fix the day count.** `daysBetween` needs calendar-day semantics with an inclusive `+1` on the
   billing path. This is a one-line change with a wide blast radius, so it wants a fixture test
   pinning a known consignment to a known day count before it moves.
2. **Get a data-bearing extract of six tables** — `CARGOSUBCLASSCHARGES`, `LOCATIONCHARGES`,
   `CargoClassCharges`, `TaxType`, `Section82Days`, `Lookup`. Without the rates, §3.2–§3.5 cannot be
   implemented against anything real.
3. **Implement the four charge rules**: weight-banded rate selection, per-subclass free days, logical-
   location pricing, and the DO-vs-GR tax split.
4. **Add the 109 missing form fields**, starting with the `DELIVERYINFO` shipper/agent contact block
   and the `CARGOACCEPTANCE` capture fields — those are operator data-entry, not reporting.
5. **Decide `FreeHandGR`.** 16 columns of manual rent override with no representation at all.
6. **Plan the migration around absent referential integrity** — an orphan-reporting reconciliation
   pass, not a straight insert.
7. **Give `GODOWNRENTHistory` a key** before migrating it.

---

## 5. Questions for SAPS

1. Is the CMTS dwell count really inclusive of both the arrival day and the release day? §3.1 assumes
   the procedure is authoritative.
2. `@ExtraFreeDays` — who grants it, and is it audited? It silently extends the free period.
3. Is `FreeHandGR` live, or abandoned?
4. `PLAN_TABLE` — migration debris, or something you use?
5. Which `Lookup` and `Setting` keys are load-bearing? We cannot see them in an empty database.
6. `TaxType.ChargesType` — what is the full value set beyond the `GD%` prefix the procedure matches?
7. Can we have a data extract of the six rate tables in §4.2, even anonymised?
