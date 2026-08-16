# CMTS → AirVault Migration Gap Report

**Scope.** AirVault is a **screen prototype with no backend** — a typed mock-data layer, no
persistence. So this report counts a legacy column as a *missing form field* only when a human would
see or type it. Everything that exists to make a relational database work is out of scope and is
reported separately rather than silently dropped.

**Purpose.** For every one of CMTS's 105 tables: which AirVault form owns it, which fields that form
is missing, and which tables have no form at all — ready to become tickets.

**Sources.** Live `CMTS` database (schema read 14 Aug 2026 — 105 tables, 1,737 columns, 21 foreign
keys, 120 stored procedures) · `saps-demo` at 137 routes, analysed screen by screen.

---

## What is out of scope, and why

| Excluded | Columns | Reason |
|---|---|---|
| Audit stamps — `CreatedBy`, `UpdatedDate`, `IsActive`, `IsDeleted` … | 258 | Persistence bookkeeping. No backend, no rows to stamp |
| FK surrogates — int columns ending `Id` (`GodownId`, `LOCATIONID`, `CARGOCLASSID` …) | 97 | The prototype renders the *related thing* — a cargo class name, a location — never its integer key |
| Composite-key plumbing — `INDEXNO`, `SUBINDEXNO`, `SEQUENCE`, `PAGENO`, `CityId`, `Comp_Code`, `Off_Code` | 85 | The CMTS join key, carried on 25–32 tables by convention. Nothing an operator types |
| Surrogate primary keys (auto-increment identities) | 81 | Database identity, not business identity |
| Names too generic to score — `ID`, `NAME`, `STATUS`, `TYPE` … | 47 | Presence would prove nothing either way |
| GUID correlators — `*UniqueIdentification` | 26 | Row-correlation plumbing |
| **Total excluded** | **594** | |
| **In scope as form fields** | **1,143** | |

**The distinction that is easy to get wrong, and that this report gets right:** a surrogate key like
`GodownId` is plumbing, but a business document number like `DONO`, `GRNO`, `CHALLANNO`, `BDNO` or
`GDNUM` is something an operator reads off a piece of paper and types in. Both look like ids. Only
the first is excluded — all 55 varchar document-number columns are kept and scored.

---

## The headline

| | Tables | Fields |
|---|---|---|
| **A · Form exists, fields missing** | 19 | **86** |
| **B · Table named on a screen that is not its home — no real form** | 17 | — |
| **C · No screen names it** | 48 | — |
| Pure join/plumbing — no form needed in a prototype | 6 | — |
| Form exists and is complete | 15 | — |

Of the **86 missing form fields**, **42 are already built elsewhere in AirVault** and simply do not
appear on the form that owns the record — cheap. The other **44 are not built anywhere** and are real
work.

**Six tables need no form at all**, now that plumbing is excluded: `CARGOSUBCLASSLOCATION`,
`TABLESEQUENCE`, `CUserWithGroups`, `CPageForCity`, `CPageForClass`, `CargoClassGroupwise`. They are
join tables and sequence counters — data that moves in a migration and never appears on a screen.

**The largest single gap is `/billing/godown-rent`, 30 fields.** The voucher renders 45 of 63
in-scope `GODOWNRENT` fields but is missing most of its charge breakdown — `SPECIALCHARGES`,
`AFUAMOUNT`, `DOCCHARGES`, `TAXPERCENTAGE` — and every unit column (`HANDLINGUNIT`, `STORGEUNIT`,
`LOCATIONUNIT`). A voucher that cannot show how the number was reached is not a voucher.

---

## Section B · the missing forms

These 17 tables are named on a screen that is not their home. Grouped by what needs building:

| Group | Tables | Note |
|---|---|---|
| **Transactional forms that do not exist** | `ExportGodownrent` (53) · `grCharges` (48) · `INTERNATIONALCARGO` (44) · `PHYSICALDELIVERY` (22) · `DELIVERYINFO` (20) | The critical path. No export billing form, no physical-delivery record, no charge working set |
| **Rate / tariff forms** | `CARGOSUBCLASSCHARGES` (15) · `LOCATIONCHARGES` (10) | The rate tables the whole tariff hangs off |
| **Party masters** | `CONSIGNEE` (13) · `AGENCY` (11) · `SHIPPER` (11) | Named on `/import/indexing`, which uses the parties but does not maintain them |
| **Reference & config** | `City` · `Country` · `SHIFT` · `REMARKS` · `Lookup` · `Setting` · `AuditTrail` | Master-data editor entries |

Three of these are not missing fields but missing **forms**, on the critical path of a working
terminal: **export billing**, **the physical delivery record**, and **the charge working set** behind
every voucher.

---

## Section C, classified

48 tables that no screen names. Flat, the list reads alarming; classified, most of it is not
prototype work.

| Bucket | Tables | Verdict |
|---|---|---|
| **Billing calculation** — `GODOWNRENTHistory` (75) · `TempImportCalculation` (39) · `ImportFreeHandedCalc` (23) · `FreeHandGR` (16) | 4 | **Real gaps.** Rent history has no form; free-hand GR has no representation at all |
| **Master / reference data** — `AIRPORT` · `CCompany` · `COffice` · `TaxType` · `CargoType` · `UnitType` · `Chargestype` · `CPaymentMode` · `CBankInformation` · `ORIGINDESTINATION` · `Flight_Airport` · `CATEGORY` · `POMailType` | 13 | **Real gaps.** The Master Data Editor needs these entities |
| **RBAC / auth / logging** — `CPages` · `CGroups` · `CUsers` · `CGroupWithPages` · `ACTION` · `PARENTACTION` · `APPLICATIONACCESSIBILITY` · `CSessionLog` · `CSessionLogDetail` · `ErrorLog` · `EventLog` · `CredentialIds` | 12 | AirVault replaces these natively. **Not prototype work** — a migration-mapping question for when the backend exists |
| **HR / workforce** — `CEmployee` (58) · qualifications · experience · dependents · department · designation · job status | 7 | Scope decision. FC-14 covers "Ops & Workforce"; a 58-column employee record is a different product |
| **Messaging** — `EmailHistory` · `SmsHistory` · `EmailTemplate` · `SMSTemplate` | 4 | Substantially covered by `/messaging/notifications`; needs the citation and the sender fields |
| **Export booking / revenue** — `CARGOBOOKING` · `CARGOBOOKINGDETAIL` · `INTERNATIONALCARGODETAIL` | 3 | Known. Parked pending the SAPS revenue-share decision |
| **Airmail** — `AIRMAILDELIVERYBILL` · `AIRMAILTRANSFERMANIFEST` | 2 | Known. FC-18 exists as a specification with nothing built |
| **Migration debris** — `PLAN_TABLE` (Oracle plan table) · `CUsers_Backup` · `XmlTesst` | 3 | **Do not build.** Confirm with SAPS and drop from scope |

So of 48 unowned tables: **17 are genuine prototype gaps** (billing calculation + master data), 12
are a backend-era mapping question, 7 are a scope decision, 9 are known and parked, and 3 should be
dropped.

---

## Suggested ticket shape

1. **14 tickets, one per form in Section A — 86 fields.** Split each into "surface the 42 already
   built" (fast) and "build the 44 that are not". Start with `/billing/godown-rent` (30).
2. **5 tickets for the transactional forms in Section B** — export billing, charge working set,
   export revenue, physical delivery, delivery contacts.
3. **Master Data Editor epic — 13 entities from Section C plus the 7 reference tables in Section B.**
4. **3 party-master tickets** — consignee, agency, shipper.
5. **Three scope decisions for SAPS** — HR depth, airmail, export revenue share.
6. **One deletion ticket** — drop the three debris tables from migration scope.

Not prototype work, deferred until a backend exists: the 12 RBAC/logging tables, and the 594
plumbing columns.

---

## A caveat that bounds all of this

The CMTS database restored locally is **schema only — every table is empty**. This report is
therefore complete on structure and silent on content: it cannot say which columns are populated in
production, which are vestigial, or what the reference tables contain. When the migration moves from
planning to building, a data-bearing extract is needed — most urgently of the rate tables
(`CARGOSUBCLASSCHARGES`, `LOCATIONCHARGES`, `CargoClassCharges`, `TaxType`, `Section82Days`,
`Lookup`), because those hold the numbers SAPS bills on.

---

# Detailed field listings

Generated directly from the schema and the repo — no hand transcription. Plumbing columns are
already filtered out, so every field below is one a person would see or type.
## A · Forms that exist but are missing fields

Each block is one ticket: the screen is right, the fields are not all there.


### `/billing/godown-rent` — 30 missing fields

**GODOWNRENT** — 45 of 63 modelled fields on the form, 18 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `ARRIVALDATE` | datetime | YES | built elsewhere - surface it here |
| `CLEARINGAGENT` | varchar(256) | YES | **not built anywhere** |
| `DECONSOLIDATION` | float | YES | built elsewhere - surface it here |
| `DELIVERYDATE` | datetime | YES | built elsewhere - surface it here |
| `DOCUMENTATION` | float | YES | built elsewhere - surface it here |
| `DONO` | varchar(15) | YES | built elsewhere - surface it here |
| `GDNUM` | varchar(50) | YES | **not built anywhere** |
| `GRREFERENCE` | varchar(20) | YES | **not built anywhere** |
| `MASTERCARD` | varchar(50) | YES | **not built anywhere** |
| `MISCELLANEOUS` | float | YES | built elsewhere - surface it here |
| `PAYORDERDATE` | datetime | YES | **not built anywhere** |
| `SPECIALHANDLING` | float | YES | built elsewhere - surface it here |
| `SUBAWBNO` | varchar(40) | YES | **not built anywhere** |
| `SUMAFUAMOUNT` | float | YES | **not built anywhere** |
| `SUMMINIMUMCHARGES` | float | YES | **not built anywhere** |
| `SUMTOTALAMOUNTWITHOUTTAX` | float | YES | **not built anywhere** |
| `TOTALAMOUNT` | float | YES | built elsewhere - surface it here |
| `WAIVEOFFAMOUNT` | float | YES | **not built anywhere** |

**GODOWNRENTDETAIL** — 9 of 20 modelled fields on the form, 11 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AFUAMOUNT` | float | YES | **not built anywhere** |
| `DECONSOLIDATION` | float | YES | built elsewhere - surface it here |
| `DOCCHARGES` | float | YES | **not built anywhere** |
| `GRNO` | varchar(20) | NO | built elsewhere - surface it here |
| `HANDLINGUNIT` | varchar(20) | YES | **not built anywhere** |
| `LOCATIONUNIT` | varchar(20) | YES | **not built anywhere** |
| `MINIMUMCHARGES` | float | YES | built elsewhere - surface it here |
| `SPECIALCHARGES` | float | YES | **not built anywhere** |
| `STORGEUNIT` | varchar(20) | YES | **not built anywhere** |
| `TAXAMOUNT` | float | YES | built elsewhere - surface it here |
| `TAXPERCENTAGE` | varchar(15) | YES | **not built anywhere** |

**GODOWNRENTDUPLICATE** — 6 of 7 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `DUPLICATETAX` | float | YES | **not built anywhere** |


### `/export/acceptance` — 14 missing fields

**CARGOACCEPTANCE** — 16 of 30 modelled fields on the form, 14 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AGENTNAME` | varchar(30) | YES | built elsewhere - surface it here |
| `AWBCODE` | varchar(20) | YES | **not built anywhere** |
| `BAGNO` | varchar(11) | YES | **not built anywhere** |
| `CARGOAGENTNAME` | varchar(30) | YES | built elsewhere - surface it here |
| `CARGODATE` | datetime | NO | built elsewhere - surface it here |
| `CARGOID` | varchar(13) | NO | **not built anywhere** |
| `CONSIGNEEADDRESS` | varchar(50) | YES | **not built anywhere** |
| `CONSIGNEEPHONENO` | varchar(21) | YES | **not built anywhere** |
| `SHIPPERADDRESS` | varchar(60) | YES | built elsewhere - surface it here |
| `SHIPPERPHONENO` | varchar(21) | YES | **not built anywhere** |
| `TIMEOFACCEPTENCE` | varchar(5) | YES | **not built anywhere** |
| `TIMEOFWEIGHMENT` | varchar(5) | YES | **not built anywhere** |
| `VEHICALNO` | varchar(12) | YES | **not built anywhere** |
| `WEIGHTAWB` | float | NO | built elsewhere - surface it here |


### `/dispatch/gate-pass` — 9 missing fields

**GATEPASS** — 24 of 33 modelled fields on the form, 9 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AWBNODATE` | datetime | YES | **not built anywhere** |
| `BDDATE` | datetime | YES | **not built anywhere** |
| `BDNO` | varchar(20) | YES | **not built anywhere** |
| `CASHNODATE` | datetime | YES | **not built anywhere** |
| `DODATE` | datetime | YES | built elsewhere - surface it here |
| `GRDATE` | datetime | YES | built elsewhere - surface it here |
| `HWBNODATE` | datetime | YES | **not built anywhere** |
| `IGMNODATE` | datetime | YES | **not built anywhere** |
| `SERIALNO` | int | YES | built elsewhere - surface it here |


### `/billing/delivery-order` — 8 missing fields

**AWBDELEIVERYORDER** — 23 of 31 modelled fields on the form, 8 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `DUPLICATEREASON` | varchar(500) | YES | **not built anywhere** |
| `FIRDATE` | datetime | YES | **not built anywhere** |
| `HWBNO` | varchar(40) | YES | built elsewhere - surface it here |
| `IGMNO` | varchar(12) | NO | built elsewhere - surface it here |
| `ISLOCK` | bit | NO | built elsewhere - surface it here |
| `REASON` | varchar(-1) | YES | built elsewhere - surface it here |
| `SHIFT` | varchar(50) | YES | built elsewhere - surface it here |
| `TAX` | int | YES | built elsewhere - surface it here |


### `/import/acceptance` — 7 missing fields

**ACCEPTENCEDETAIL** — 6 of 9 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CARGODATE` | datetime | NO | built elsewhere - surface it here |
| `CARGOID` | varchar(13) | NO | **not built anywhere** |
| `NATUREOFGOODS` | varchar(40) | YES | built elsewhere - surface it here |

**CARGOACCEPTANCEHWB** — 4 of 7 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CARGODATE` | datetime | NO | built elsewhere - surface it here |
| `CARGOGROUP` | int | YES | built elsewhere - surface it here |
| `HWBNO` | varchar(45) | NO | built elsewhere - surface it here |

**IMPORTAWBDETAIL** — 23 of 24 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `IGMNO` | varchar(15) | NO | built elsewhere - surface it here |


### `/billing/calculator` — 5 missing fields

**CHARGETYPE** — 3 of 7 modelled fields on the form, 4 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CHTYPEABB` | varchar(50) | YES | **not built anywhere** |
| `CHTYPEDESC` | varchar(50) | YES | **not built anywhere** |
| `CHTYPENAME` | varchar(50) | YES | **not built anywhere** |
| `NONUSEABEL` | varchar(50) | YES | **not built anywhere** |

**CHARGECALCULATER** — 2 of 3 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `VOUCHERNO` | varchar(50) | YES | built elsewhere - surface it here |


### `/exceptions/long-stay` — 3 missing fields

**AWBSECTION82** — 12 of 15 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CARGODATE` | datetime | YES | built elsewhere - surface it here |
| `CONTENTS` | varchar(250) | YES | built elsewhere - surface it here |
| `PCS` | int | YES | built elsewhere - surface it here |


### `/import/flights` — 2 missing fields

**AIRLINE** — 6 of 8 modelled fields on the form, 2 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `ABBREVATION` | varchar(15) | YES | built elsewhere - surface it here |
| `LOGO` | varchar(200) | YES | **not built anywhere** |


### `/import/consolidation` — 2 missing fields

**AWBConsolDetail** — 6 of 8 modelled fields on the form, 2 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `GROSSWEIGHT` | float | YES | **not built anywhere** |
| `UNIQUEINDENTIFICATION` | varchar(50) | YES | **not built anywhere** |


### `/import/manifest` — 2 missing fields

**IMPORTMANIFIEST** — 18 of 20 modelled fields on the form, 2 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AIRLINENAME` | varchar(40) | YES | built elsewhere - surface it here |
| `DFLAG` | varchar(1) | YES | built elsewhere - surface it here |


### `/warehouse-manager/awb-detail` — 1 missing field

**AutoIncrementValues** — 1 of 2 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `INCREMENTEDNO` | int | YES | **not built anywhere** |


### `/import/ocr-intake` — 1 missing field

**CARGOSUBCLASS** — 3 of 4 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `MINCHARGES` | float | YES | built elsewhere - surface it here |


### `/exceptions/holds` — 1 missing field

**HOLDINGSTATUS** — 17 of 18 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CITY` | int | YES | built elsewhere - surface it here |


### `/storage/master` — 1 missing field

**LOCATION** — 2 of 3 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `REMARKS` | nvarchar(500) | YES | built elsewhere - surface it here |


**Section A total: 86 fields across 14 forms.**


## B · Tables mentioned on a screen that is not their home

The screen names the table in passing; no form actually captures it.

| CMTS table | Cols | Mentioned on | Rendered there | Verdict |
|---|---|---|---|---|
| `ExportGodownrent` | 53 | `/export/buildup` | 6/46 | needs its own form |
| `grCharges` | 48 | `/billing/calculator` | 10/42 | needs its own form |
| `INTERNATIONALCARGO` | 44 | `/export/uplift` | 6/43 | needs its own form |
| `PHYSICALDELIVERY` | 22 | `/customs/detained` | 3/11 | needs its own form |
| `DELIVERYINFO` | 20 | `/customs/detained` | 1/15 | needs its own form |
| `CARGOSUBCLASSCHARGES` | 15 | `/billing/calculator` | 2/9 | needs its own form |
| `CONSIGNEE` | 13 | `/import/indexing` | 3/9 | needs its own form |
| `AGENCY` | 11 | `/import/indexing` | 1/7 | needs its own form |
| `SHIPPER` | 11 | `/import/indexing` | 1/7 | needs its own form |
| `LOCATIONCHARGES` | 10 | `/billing/calculator` | 2/7 | needs its own form |
| `REMARKS` | 10 | `/customs/filing` | 0/1 | needs its own form |
| `SHIFT` | 10 | `/import/indexing` | 0/3 | needs its own form |
| `City` | 9 | `/finance-manager/waiver-workflow` | 0/1 | needs its own form |
| `Country` | 9 | `/import/flights` | 0/2 | needs its own form |
| `AuditTrail` | 7 | `/finance-manager/waiver-workflow` | 0/4 | needs its own form |
| `Lookup` | 5 | `/billing/calculator` | 0/1 | needs its own form |
| `Setting` | 2 | `/billing/calculator` | 0/1 | needs its own form |

## C · Tables no screen names at all

| CMTS table | Cols | Rendered anywhere | Verdict |
|---|---|---|---|
| `GODOWNRENTHistory` | 75 | 53/63 | partial, no owning form |
| `CEmployee` | 58 | 11/43 | partial, no owning form |
| `TempImportCalculation` | 39 | 15/32 | partial, no owning form |
| `PLAN_TABLE` | 27 | 8/25 | partial, no owning form |
| `AIRMAILDELIVERYBILL` | 25 | 11/23 | partial, no owning form |
| `ImportFreeHandedCalc` | 23 | 10/16 | partial, no owning form |
| `CPages` | 22 | 3/14 | partial, no owning form |
| `AIRMAILTRANSFERMANIFEST` | 19 | 3/19 | partial, no owning form |
| `CARGOBOOKING` | 19 | 12/17 | partial, no owning form |
| `CCompany` | 18 | 1/11 | partial, no owning form |
| `COffice` | 18 | 0/8 | no form |
| `AIRPORT` | 16 | 5/6 | partial, no owning form |
| `FreeHandGR` | 16 | 0/15 | no form |
| `CEmployeeQualification` | 14 | 1/6 | partial, no owning form |
| `CUsers` | 14 | 1/4 | partial, no owning form |
| `CUsers_Backup` | 14 | 1/4 | partial, no owning form |
| `CEmployeeExperience` | 12 | 1/8 | partial, no owning form |
| `CGroups` | 12 | 0/3 | no form |
| `TaxType` | 12 | 1/3 | partial, no owning form |
| `CargoType` | 11 | 1/3 | partial, no owning form |
| `CDepartment` | 11 | 0/2 | no form |
| `UnitType` | 11 | 1/3 | partial, no owning form |
| `CBankInformation` | 10 | 1/3 | partial, no owning form |
| `CDesignation` | 10 | 0/1 | no form |
| `Chargestype` | 10 | 1/2 | partial, no owning form |
| `ErrorLog` | 10 | 2/8 | partial, no owning form |
| `CEmployeeDependent` | 9 | 1/4 | partial, no owning form |
| `CJobStatus` | 9 | 0/2 | no form |
| `CSessionLog` | 9 | 2/7 | partial, no owning form |
| `EmailHistory` | 9 | 4/7 | partial, no owning form |
| `CPaymentMode` | 8 | 0/1 | no form |
| `SmsHistory` | 8 | 4/6 | partial, no owning form |
| `XmlTesst` | 8 | 3/6 | partial, no owning form |
| `CARGOBOOKINGDETAIL` | 7 | 5/6 | partial, no owning form |
| `CGroupWithPages` | 7 | 0/4 | no form |
| `EmailTemplate` | 7 | 3/3 | partial, no owning form |
| `EventLog` | 7 | 2/5 | partial, no owning form |
| `CredentialIds` | 6 | 2/5 | partial, no owning form |
| `Flight_Airport` | 6 | 0/5 | no form |
| `INTERNATIONALCARGODETAIL` | 6 | 4/5 | partial, no owning form |
| `ACTION` | 5 | 0/5 | no form |
| `CSessionLogDetail` | 5 | 0/2 | no form |
| `ORIGINDESTINATION` | 5 | 3/3 | partial, no owning form |
| `SMSTemplate` | 5 | 2/2 | partial, no owning form |
| `PARENTACTION` | 4 | 0/3 | no form |
| `APPLICATIONACCESSIBILITY` | 3 | 0/3 | no form |
| `CATEGORY` | 3 | 0/1 | no form |
| `POMailType` | 3 | 1/2 | partial, no owning form |