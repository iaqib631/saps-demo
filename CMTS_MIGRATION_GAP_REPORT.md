# CMTS → AirVault Migration Gap Report

**Purpose.** CMTS is the legacy system whose data will be migrated into AirVault. This report says,
for every one of its 105 tables, **which AirVault form owns it, which fields that form is missing,
and which tables have no form at all** — so the gaps can go straight onto the board as tickets.

**Sources.** Live `CMTS` database on the local SQL Server instance (schema read 14 Aug 2026 —
105 tables, 1,737 columns, 21 foreign keys, 120 stored procedures, 7 views) · `saps-demo` at
137 routes, analysed screen by screen.

**Method, and why it is trustworthy.** Ownership is not guessed. Every AirVault screen names the CMTS
tables it descends from, in its header comment and on its source-table card, and there are 104
explicit `cmts="COLUMN"` parity markers on fields. This report treats those citations as the ground
truth for *which form owns a table*, and uses field-level matching only to measure *how much of that
table the form renders*. Each screen was resolved to its full file set — its page, its sibling files
and its imported component tree, 9.2 files per route on average — so a field counted as present is
present on **that** screen, not merely somewhere in the repo.

Two exclusions, both deliberate: `/modules` is a catalogue that cites nearly every CMTS table by
design, so letting it own one would hide a real gap behind a documentation chip; and generic column
names (`ID`, `NAME`, `STATUS`, `CreatedBy` …) are never scored, because their presence proves
nothing.

---

## The headline

| | Tables | Fields |
|---|---|---|
| **A · Form exists, fields missing** | 19 | **101** |
| **B · Table mentioned on a screen that is not its home — no real form** | 19 | — |
| **C · No screen names the table at all** | 52 | — |
| Form exists and is complete | 15 | — |

Of the **101 missing form fields in Section A**, **46 are already built somewhere else in AirVault**
and simply do not appear on the form that owns the record — those are cheap. The other **55 are not
built anywhere** and are real work.

**The single biggest form gap is `/billing/godown-rent` with 37 missing fields** across `GODOWNRENT`,
`GODOWNRENTDETAIL` and `GODOWNRENTDUPLICATE` — the voucher screen is missing its entire charge
breakdown (`DOCUMENTATION`, `DECONSOLIDATION`, `SPECIALHANDLING`, `MISCELLANEOUS`, `AFUAMOUNT`,
`MINIMUMCHARGES`, `TAXAMOUNT`, `TAXPERCENTAGE`) and its unit columns (`HANDLINGUNIT`, `STORGEUNIT`,
`LOCATIONUNIT`). A voucher that cannot show how the number was reached is not a voucher.

---

## What Section B really means

These 19 tables are named on a screen that is **not their home**. `DELIVERYINFO` and
`PHYSICALDELIVERY` are mentioned only by `/customs/detained`, because detained cargo carries its own
identity through delivery — but **AirVault has no delivery-record form at all**. `ExportGodownrent`
(53 columns) is named only by `/export/buildup`, the ULD build screen; there is **no export billing
form**. `grCharges` (48 columns), the charge working table, is named by `/billing/calculator` which
renders 9 of its 46 fields.

The five that matter most, by size and by how central they are to a working terminal:

| Table | Cols | Named on | What is actually missing |
|---|---|---|---|
| `ExportGodownrent` | 53 | `/export/buildup` | The whole export billing form |
| `grCharges` | 48 | `/billing/calculator` | The per-line charge working set behind a voucher |
| `INTERNATIONALCARGO` | 44 | `/export/uplift` | Export revenue, IATA rates, agency commission, SAPS share |
| `PHYSICALDELIVERY` | 22 | `/customs/detained` | The physical delivery record |
| `DELIVERYINFO` | 20 | `/customs/detained` | Consignee / shipper / agent delivery contacts |

---

## Section C, classified

52 tables no screen names. Left as a flat list it reads alarming; classified, most of it is not work.

| Bucket | Tables | Verdict |
|---|---|---|
| **Billing calculation** — `GODOWNRENTHistory` (75), `TempImportCalculation` (39), `ImportFreeHandedCalc` (23), `FreeHandGR` (16) | 4 | **Real gaps.** Rent history has no form; free-hand GR has no representation at all |
| **Master / reference data** — `AIRPORT`, `CCompany`, `COffice`, `TaxType`, `CargoType`, `UnitType`, `Chargestype`, `CPaymentMode`, `CBankInformation`, `ORIGINDESTINATION`, `Flight_Airport`, `CATEGORY`, `CargoClassGroupwise`, `POMailType` | 14 | **Real gaps.** The Master Data Editor needs these entities or the migration has nowhere to land |
| **RBAC / auth / logging** — `CPages`, `CGroups`, `CUsers`, `CPageForClass`, `CPageForCity`, `CGroupWithPages`, `CUserWithGroups`, `ACTION`, `PARENTACTION`, `APPLICATIONACCESSIBILITY`, `CSessionLog`, `CSessionLogDetail`, `ErrorLog`, `EventLog`, `CredentialIds` | 15 | AirVault replaces these natively. **Not a form gap — a data-mapping ticket**: existing accounts and page permissions still have to land somewhere |
| **HR / workforce** — `CEmployee` (58), `CEmployeeQualification`, `CEmployeeExperience`, `CEmployeeDependent`, `CDepartment`, `CDesignation`, `CJobStatus`, `SHIFT` | 8 | Scope decision. FC-14 covers "Ops & Workforce"; the 58-column employee record is a different thing |
| **Airmail** — `AIRMAILDELIVERYBILL`, `AIRMAILTRANSFERMANIFEST` | 2 | Known. FC-18 exists as a specification with nothing built |
| **Export booking / revenue** — `CARGOBOOKING`, `CARGOBOOKINGDETAIL`, `INTERNATIONALCARGODETAIL` | 3 | Known. Parked pending the SAPS revenue-share decision |
| **Messaging** — `EmailHistory`, `SmsHistory`, `EmailTemplate`, `SMSTemplate` | 4 | Substantially covered by `/messaging/notifications`; needs the citation and the sender fields |
| **Migration debris** — `PLAN_TABLE` (Oracle plan table), `CUsers_Backup`, `XmlTesst` | 3 | **Do not build.** Confirm with SAPS and drop from the migration scope |

So of 52 unowned tables, roughly **21 are genuine product gaps**, 15 are a data-mapping exercise
rather than screens, 8 are a scope decision, and 3 should be dropped.

---

## Suggested ticket shape

1. **One ticket per form in Section A** — 14 tickets, 101 fields. Split each into "surface the 46
   already built" (fast) and "build the 55 that are not" (real).
2. **One ticket per new form in Section B** — 19, but the five in the table above are the ones that
   block a working terminal.
3. **Master Data Editor: 14 entities** — one epic, one ticket per entity.
4. **RBAC data-mapping spike** — how do 15 legacy permission tables land in AirVault's model?
5. **Three scope decisions for SAPS** — HR depth, airmail, export revenue share.
6. **One deletion ticket** — confirm and drop the three debris tables.

---

## A caveat that bounds all of this

The CMTS database restored locally is **schema only — every table is empty**. So this report is
complete on structure and silent on content. It cannot tell you which columns are actually populated
in production, which are vestigial, or what the reference tables contain. Before the migration is
built rather than planned, a data-bearing extract is needed — most urgently of the rate tables
(`CARGOSUBCLASSCHARGES`, `LOCATIONCHARGES`, `CargoClassCharges`, `TaxType`, `Section82Days`,
`Lookup`), because those hold the numbers SAPS bills on.

---

# Detailed field listings

Everything below is generated directly from the schema and the repo — no hand transcription.
## A · Forms that exist but are missing fields

Each block is one ticket: the screen is right, the fields are not all there.


### `/billing/godown-rent` — 37 missing fields

**GODOWNRENT** — 46 of 69 modelled fields on the form, 23 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `ARRIVALDATE` | datetime | YES | built elsewhere - surface it here |
| `CLEARINGAGENT` | varchar(256) | YES | **not built anywhere** |
| `DECONSOLIDATION` | float | YES | built elsewhere - surface it here |
| `DELIVERYDATE` | datetime | YES | built elsewhere - surface it here |
| `DETENDUNIQUEIDENTIFICATION` | varchar(100) | YES | built elsewhere - surface it here |
| `DOCUMENTATION` | float | YES | built elsewhere - surface it here |
| `DONO` | varchar(15) | YES | built elsewhere - surface it here |
| `GDNUM` | varchar(50) | YES | **not built anywhere** |
| `GDUNIQUEIDENTIFICATION` | varchar(250) | YES | **not built anywhere** |
| `GODOWNID` | int | NO | **not built anywhere** |
| `GRREFERENCE` | varchar(20) | YES | **not built anywhere** |
| `INDEXNO` | varchar(10) | YES | built elsewhere - surface it here |
| `MASTERCARD` | varchar(50) | YES | **not built anywhere** |
| `MISCELLANEOUS` | float | YES | built elsewhere - surface it here |
| `PAYORDERDATE` | datetime | YES | **not built anywhere** |
| `SPECIALHANDLING` | float | YES | built elsewhere - surface it here |
| `SUBAWBNO` | varchar(40) | YES | **not built anywhere** |
| `SUBINDEXNO` | varchar(10) | YES | **not built anywhere** |
| `SUMAFUAMOUNT` | float | YES | **not built anywhere** |
| `SUMMINIMUMCHARGES` | float | YES | **not built anywhere** |
| `SUMTOTALAMOUNTWITHOUTTAX` | float | YES | **not built anywhere** |
| `TOTALAMOUNT` | float | YES | built elsewhere - surface it here |
| `WAIVEOFFAMOUNT` | float | YES | **not built anywhere** |

**GODOWNRENTDETAIL** — 11 of 24 modelled fields on the form, 13 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AFUAMOUNT` | float | YES | **not built anywhere** |
| `DECONSOLIDATION` | float | YES | built elsewhere - surface it here |
| `DOCCHARGES` | float | YES | **not built anywhere** |
| `GODOWNID` | int | YES | **not built anywhere** |
| `GRNO` | varchar(20) | NO | built elsewhere - surface it here |
| `HANDLINGUNIT` | varchar(20) | YES | **not built anywhere** |
| `INDEXNO` | int | YES | built elsewhere - surface it here |
| `LOCATIONUNIT` | varchar(20) | YES | **not built anywhere** |
| `MINIMUMCHARGES` | float | YES | built elsewhere - surface it here |
| `SPECIALCHARGES` | float | YES | **not built anywhere** |
| `STORGEUNIT` | varchar(20) | YES | **not built anywhere** |
| `TAXAMOUNT` | float | YES | built elsewhere - surface it here |
| `TAXPERCENTAGE` | varchar(15) | YES | **not built anywhere** |

**GODOWNRENTDUPLICATE** — 8 of 9 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `DUPLICATETAX` | float | YES | **not built anywhere** |


### `/export/acceptance` — 14 missing fields

**CARGOACCEPTANCE** — 15 of 29 modelled fields on the form, 14 missing

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


### `/billing/delivery-order` — 9 missing fields

**AWBDELEIVERYORDER** — 22 of 31 modelled fields on the form, 9 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `DOID` | int | NO | **not built anywhere** |
| `DUPLICATEREASON` | varchar(500) | YES | **not built anywhere** |
| `FIRDATE` | datetime | YES | **not built anywhere** |
| `HWBNO` | varchar(40) | YES | built elsewhere - surface it here |
| `IGMNO` | varchar(12) | NO | built elsewhere - surface it here |
| `ISLOCK` | bit | NO | built elsewhere - surface it here |
| `REASON` | varchar(-1) | YES | built elsewhere - surface it here |
| `SHIFT` | varchar(50) | YES | built elsewhere - surface it here |
| `TAX` | int | YES | built elsewhere - surface it here |


### `/dispatch/gate-pass` — 9 missing fields

**GATEPASS** — 27 of 36 modelled fields on the form, 9 missing

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


### `/import/acceptance` — 7 missing fields

**ACCEPTENCEDETAIL** — 4 of 7 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CARGODATE` | datetime | NO | built elsewhere - surface it here |
| `CARGOID` | varchar(13) | NO | **not built anywhere** |
| `NATUREOFGOODS` | varchar(40) | YES | built elsewhere - surface it here |

**CARGOACCEPTANCEHWB** — 2 of 5 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CARGODATE` | datetime | NO | built elsewhere - surface it here |
| `CARGOGROUP` | int | YES | built elsewhere - surface it here |
| `HWBNO` | varchar(45) | NO | built elsewhere - surface it here |

**IMPORTAWBDETAIL** — 29 of 30 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `IGMNO` | varchar(15) | NO | built elsewhere - surface it here |


### `/import/consolidation` — 5 missing fields

**AWBConsolDetail** — 7 of 12 modelled fields on the form, 5 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `CAEGOSUBCLASSID` | int | YES | **not built anywhere** |
| `GROSSWEIGHT` | float | YES | **not built anywhere** |
| `HWBDETAILID` | int | NO | **not built anywhere** |
| `HWBID` | int | YES | **not built anywhere** |
| `UNIQUEINDENTIFICATION` | varchar(50) | YES | **not built anywhere** |


### `/import/indexing` — 5 missing fields

**CONSIGNEE** — 2 of 5 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `FAX` | varchar(21) | YES | **not built anywhere** |
| `PHONENO` | varchar(21) | YES | **not built anywhere** |
| `ZIP` | varchar(50) | YES | built elsewhere - surface it here |

**Origin** — 2 of 4 modelled fields on the form, 2 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `COUNTRYID` | int | YES | **not built anywhere** |
| `ORIGINID` | int | NO | **not built anywhere** |


### `/storage/locations` — 5 missing fields

**IMPORTAWBLOCATION** — 12 of 17 modelled fields on the form, 5 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `DFLAG` | varchar(1) | YES | built elsewhere - surface it here |
| `HWBNO` | varchar(25) | YES | built elsewhere - surface it here |
| `SEQUENCE` | int | YES | built elsewhere - surface it here |
| `SPLITCLASSID` | int | YES | built elsewhere - surface it here |
| `UNIQUEIDENTIFICATION` | varchar(50) | YES | built elsewhere - surface it here |


### `/exceptions/long-stay` — 3 missing fields

**AWBSECTION82** — 12 of 15 modelled fields on the form, 3 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `AWBSECID` | int | NO | **not built anywhere** |
| `CARGODATE` | datetime | YES | built elsewhere - surface it here |
| `CRAETEDBY` | varchar(250) | YES | **not built anywhere** |


### `/import/flights` — 2 missing fields

**AIRLINE** — 8 of 10 modelled fields on the form, 2 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `ABBREVATION` | varchar(15) | YES | built elsewhere - surface it here |
| `LOGO` | varchar(200) | YES | **not built anywhere** |


### `/import/manifest` — 2 missing fields

**IMPORTMANIFIEST** — 22 of 24 modelled fields on the form, 2 missing

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

**CARGOSUBCLASS** — 7 of 8 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `MINCHARGES` | float | YES | built elsewhere - surface it here |


### `/exceptions/damage` — 1 missing field

**DamageDetail** — 6 of 7 modelled fields on the form, 1 missing

| Field | Type | Null | Status |
|---|---|---|---|
| `HWBID` | int | YES | **not built anywhere** |


**Section A total: 101 fields across 14 forms.**


## B · Tables mentioned on a screen that is not their home

The screen names the table in passing; no form actually captures it.

| CMTS table | Cols | Mentioned on | Rendered there | Verdict |
|---|---|---|---|---|
| `ExportGodownrent` | 53 | `/export/buildup` | 5/46 | needs its own form |
| `grCharges` | 48 | `/billing/calculator` | 9/46 | needs its own form |
| `INTERNATIONALCARGO` | 44 | `/export/uplift` | 5/41 | needs its own form |
| `PHYSICALDELIVERY` | 22 | `/customs/detained` | 4/14 | needs its own form |
| `DELIVERYINFO` | 20 | `/customs/detained` | 5/20 | needs its own form |
| `CARGOSUBCLASSCHARGES` | 15 | `/storage/master` | 1/12 | needs its own form |
| `AGENCY` | 11 | `/import/indexing` | 0/3 | needs its own form |
| `SHIPPER` | 11 | `/import/indexing` | 0/2 | needs its own form |
| `LOCATIONCHARGES` | 10 | `/billing/calculator` | 0/8 | needs its own form |
| `REMARKS` | 10 | `/customs/filing` | 0/2 | needs its own form |
| `SHIFT` | 10 | `/import/indexing` | 0/4 | needs its own form |
| `City` | 9 | `/import/indexing` | 1/3 | needs its own form |
| `Country` | 9 | `/import/flights` | 0/3 | needs its own form |
| `CHARGETYPE` | 8 | `/billing/calculator` | 3/8 | needs its own form |
| `AuditTrail` | 7 | `/finance-manager/waiver-workflow` | 0/5 | needs its own form |
| `CargoClassCharges` | 7 | `/billing/calculator` | 1/5 | needs its own form |
| `CHARGECALCULATER` | 6 | `/billing/calculator` | 1/4 | needs its own form |
| `Lookup` | 5 | `/billing/calculator` | 0/2 | needs its own form |
| `Setting` | 2 | `/billing/calculator` | 0/2 | needs its own form |

## C · Tables no screen names at all

| CMTS table | Cols | Rendered anywhere | Verdict |
|---|---|---|---|
| `GODOWNRENTHistory` | 75 | 56/69 | partial, no owning form |
| `CEmployee` | 58 | 11/48 | partial, no owning form |
| `TempImportCalculation` | 39 | 19/38 | partial, no owning form |
| `PLAN_TABLE` | 27 | 8/25 | partial, no owning form |
| `AIRMAILDELIVERYBILL` | 25 | 10/22 | partial, no owning form |
| `ImportFreeHandedCalc` | 23 | 14/22 | partial, no owning form |
| `CPages` | 22 | 2/15 | partial, no owning form |
| `AIRMAILTRANSFERMANIFEST` | 19 | 3/19 | partial, no owning form |
| `CARGOBOOKING` | 19 | 9/14 | partial, no owning form |
| `CCompany` | 18 | 2/12 | partial, no owning form |
| `COffice` | 18 | 3/12 | partial, no owning form |
| `AIRPORT` | 16 | 3/4 | partial, no owning form |
| `FreeHandGR` | 16 | 0/16 | no form |
| `CEmployeeQualification` | 14 | 3/11 | partial, no owning form |
| `CUsers` | 14 | 3/7 | partial, no owning form |
| `CUsers_Backup` | 14 | 3/7 | partial, no owning form |
| `CEmployeeExperience` | 12 | 2/11 | partial, no owning form |
| `CGroups` | 12 | 2/6 | partial, no owning form |
| `TaxType` | 12 | 1/3 | partial, no owning form |
| `CargoType` | 11 | 1/3 | partial, no owning form |
| `CDepartment` | 11 | 2/5 | partial, no owning form |
| `CPageForClass` | 11 | 3/4 | partial, no owning form |
| `UnitType` | 11 | 1/3 | partial, no owning form |
| `CBankInformation` | 10 | 1/4 | partial, no owning form |
| `CDesignation` | 10 | 0/3 | no form |
| `Chargestype` | 10 | 1/2 | partial, no owning form |
| `CPageForCity` | 10 | 2/3 | partial, no owning form |
| `ErrorLog` | 10 | 2/9 | partial, no owning form |
| `CEmployeeDependent` | 9 | 2/7 | partial, no owning form |
| `CJobStatus` | 9 | 0/3 | no form |
| `CSessionLog` | 9 | 1/8 | partial, no owning form |
| `EmailHistory` | 9 | 5/8 | partial, no owning form |
| `CPaymentMode` | 8 | 1/2 | partial, no owning form |
| `SmsHistory` | 8 | 5/7 | partial, no owning form |
| `XmlTesst` | 8 | 3/6 | partial, no owning form |
| `CARGOBOOKINGDETAIL` | 7 | 5/6 | partial, no owning form |
| `CGroupWithPages` | 7 | 0/7 | no form |
| `EmailTemplate` | 7 | 3/4 | partial, no owning form |
| `EventLog` | 7 | 2/6 | partial, no owning form |
| `CredentialIds` | 6 | 2/5 | partial, no owning form |
| `Flight_Airport` | 6 | 0/5 | no form |
| `INTERNATIONALCARGODETAIL` | 6 | 4/5 | partial, no owning form |
| `ACTION` | 5 | 0/5 | no form |
| `CSessionLogDetail` | 5 | 0/4 | no form |
| `ORIGINDESTINATION` | 5 | 1/1 | partial, no owning form |
| `SMSTemplate` | 5 | 2/2 | partial, no owning form |
| `PARENTACTION` | 4 | 1/4 | partial, no owning form |
| `APPLICATIONACCESSIBILITY` | 3 | 0/3 | no form |
| `CargoClassGroupwise` | 3 | 1/2 | partial, no owning form |
| `CATEGORY` | 3 | 0/1 | no form |
| `CUserWithGroups` | 3 | 0/2 | no form |
| `POMailType` | 3 | 1/3 | partial, no owning form |