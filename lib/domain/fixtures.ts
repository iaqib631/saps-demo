/**
 * AirVault domain — seeded fixture set.
 *
 * Everything here is deterministic. `Math.random()` would produce a
 * different tree on the server than on the client and Next would flag a
 * hydration mismatch (lib/rackData.ts has this bug today), and a demo
 * whose numbers change on refresh is not walkthrough-able.
 *
 * Coverage targets from P0-1:
 *   • 24 AWBs spanning every cargo class in FC-03's three groups
 *   • all three sites
 *   • at least one record in every exception state
 *   • internally consistent — an AWB's pieces, charges, DO, gate pass
 *     and POD all reference the same AWB
 */

import {
  DEMO_NOW,
  MS_PER_DAY,
  buildWeightSet,
  daysBetween,
  formatDate,
  intBetween,
  ocr,
  formEntry,
  pick,
  round2,
  seeded,
  variance,
  VARIANCE_TOLERANCE,
  type Dimensions,
  type SiteCode,
} from "./common";
import {
  AIRLINES,
  CARGO_CLASSES,
  PARTIES,
  SECTION_82_DAYS,
  STORAGE_LOCATIONS,
  SITES,
  cargoClass,
  subClassesOf,
} from "./masters";
import type {
  AWB,
  AWBDetail,
  AWBLocation,
  ArrivalAdvice,
  BranchState,
  DetendDetail,
  HouseAWB,
  LifecycleStage,
  Manifest,
  Piece,
} from "./cargo";
import { LIFECYCLE_ORDER, hasReached, stageIndex } from "./cargo";
import {
  calculateCharges,
  evaluateReleaseGate,
  type DeliveryOrder,
  type GodownRent,
  type GodownRentDetail,
  type GodownRentDuplicate,
  type Invoice,
  type PaymentRecord,
  type WaiverRequest,
} from "./finance";
import {
  PICK_CDR_ORIGIN,
  gateOutOutcome,
  pickSessionCdrTrigger,
  type ClosureChecklistItem,
  type ClosureState,
  type GateOutCheck,
  type GatePass,
  type PickLine,
  type PickSession,
  type ProofOfDelivery,
} from "./dispatch";
import {
  EXCEPTION_THRESHOLD_DAYS,
  type CDR,
  type CdrDispatch,
  type CdrOrigin,
  type CdrSourceRef,
  type CdrFinalAction,
  type CdrStatus,
  type DamageDetail,
  type DiscrepancyType,
  type EvidenceItem,
  type EvidenceKind,
  type ExceptionQueueRow,
  type HoldRecord,
  type LongStayCase,
  type MishandledCase,
  type ReExportCase,
} from "./exceptions";
import {
  RISK_CHANNEL_LABEL,
  dutyTotal,
  oocMismatches,
  oocVerified,
  type AgencyClearance,
  type AwbInformation,
  type CustomsClearance,
  type CustomsIgm,
  type CustomsQuery,
  type DutyAssessment,
  type ExaminationRecord,
  type GatewaySubmission,
  type OutOfCharge,
  type RiskChannel,
  type SdStatus,
} from "./customs";
import {
  CHANNEL_LABEL,
  CUSTOMER_NOTIFICATION_LABEL,
  TRIGGER_MAP,
  type Channel,
  type CustomerNotification,
  type IataMessage,
  type NotificationDispatch,
  type NotificationTemplate,
} from "./messaging";
import type { DocumentSource, DocumentType, StoredDocument } from "./documents";
import type { BondedHandover, TagBinding } from "./storage";
import { SPECIAL_HANDLING_LABEL } from "./exportcargo";
import type {
  AcceptanceHwb,
  AcceptanceLine,
  CargoAcceptance,
  ClearanceRound,
  CustodyEvent,
  ExportBooking,
  ExportClassification,
  ExportClearance,
  ExportClosure,
  ExportConsignment,
  ExportDeclaration,
  ExportStage,
  ExportWarehousing,
  PfmLine,
  ScreeningRecord,
  UpliftRecord,
  Weighment,
} from "./exportcargo";
import type {
  AwbTransfer,
  InterStationHandoff,
  SupervisionEvent,
  TranshipmentCase,
  TranshipmentPermit,
  TranshipmentStage,
} from "./transhipment";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const NOW_MS = Date.parse(DEMO_NOW);

function daysAgo(n: number, hour = 9, minute = 15): string {
  const d = new Date(NOW_MS - n * MS_PER_DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function siteKeys(code: SiteCode) {
  const s = SITES.find((x) => x.code === code)!;
  return { CityId: s.CityId, Comp_Code: s.Comp_Code, Off_Code: s.Off_Code };
}

function audit(createdDaysAgo: number, by = "s.khan") {
  return {
    CreatedBy: by,
    UpdatedBy: null,
    CreatedDate: daysAgo(createdDaysAgo),
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
  };
}

/**
 * Allocate a roll-up across `parts` detail lines so the lines add back to it
 * EXACTLY, to the paisa.
 *
 * The obvious version — multiply by `1 / parts` and round each line — is what
 * produces a voucher whose grid does not reach its own total. Rounding each
 * share independently can drop or gain half a paisa per line, and because the
 * GODOWNRENT `sum*` columns are printed directly above the GODOWNRENTDETAIL
 * lines, that drift is visible on the page. So the first `parts - 1` lines
 * take the rounded even share and the LAST line takes whatever is left. That
 * is also how the allocation is done by hand, which matters when a finance
 * officer reconciles the printed voucher against the legacy one.
 */
function splitExact(total: number, parts: number): number[] {
  const whole = round2(total);
  const each = round2(whole / parts);
  const out = Array.from({ length: parts }, () => each);
  out[parts - 1] = round2(whole - each * (parts - 1));
  return out;
}

const GOODS = [
  "Pharmaceutical preparations",
  "Cotton fabric rolls",
  "Automotive spare parts",
  "Consumer electronics",
  "Medical diagnostic kits",
  "Fresh cut flowers",
  "Lithium-ion battery packs",
  "Industrial valves",
  "Precision instruments",
  "Frozen seafood",
  "Aircraft hydraulic pumps",
  "Laboratory reagents",
];

const PACKS = ["Carton", "Wooden Crate", "Pallet", "Drum", "Bag"];

/* ------------------------------------------------------------------ *
 * AWB seed table
 *
 * Hand-authored so coverage is deliberate rather than accidental: every
 * cargo class appears, all three sites appear, every lifecycle stage is
 * occupied, and every exception branch has at least one AWB on it.
 * ------------------------------------------------------------------ */

interface Seed {
  awbNo: string;
  site: SiteCode;
  airline: string;
  origin: string;
  classAbbr: string;
  stage: LifecycleStage;
  branch: BranchState;
  arrivedDaysAgo: number;
  pieces: number;
  weightKg: number;
  /** Force a declared-vs-physical variance (fraction of declared). */
  varianceRatio?: number;
  isHwb?: boolean;
  isDetend?: boolean;
  onHold?: boolean;
}

const SEEDS: Seed[] = [
  // --- Group A: General / Normal ------------------------------------
  { awbNo: "214-45678901", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "AFU", stage: "stored", branch: null, arrivedDaysAgo: 6, pieces: 24, weightKg: 1240 },
  { awbNo: "176-88213340", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "GCR", stage: "delivered", branch: null, arrivedDaysAgo: 12, pieces: 48, weightKg: 2180 },
  { awbNo: "607-11902288", site: "LHE", airline: "TK", origin: "IST", classAbbr: "GCR", stage: "charged", branch: null, arrivedDaysAgo: 9, pieces: 16, weightKg: 640 },
  { awbNo: "157-33448821", site: "KHI", airline: "EY", origin: "AUH", classAbbr: "ICG", stage: "do-issued", branch: null, arrivedDaysAgo: 2, pieces: 6, weightKg: 185 },
  { awbNo: "214-90055512", site: "PEW", airline: "EK", origin: "DXB", classAbbr: "UAB", stage: "customs", branch: null, arrivedDaysAgo: 4, pieces: 3, weightKg: 96 },
  { awbNo: "306-77120943", site: "KHI", airline: "PK", origin: "LHR", classAbbr: "GCR", stage: "closed", branch: null, arrivedDaysAgo: 34, pieces: 30, weightKg: 1420 },

  // --- Group B: Special Handling ------------------------------------
  { awbNo: "020-55839014", site: "KHI", airline: "CV", origin: "FRA", classAbbr: "DGR", stage: "stored", branch: null, arrivedDaysAgo: 5, pieces: 12, weightKg: 780, onHold: true },
  { awbNo: "176-44029183", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "PER", stage: "gate-pass", branch: null, arrivedDaysAgo: 1, pieces: 40, weightKg: 920 },
  { awbNo: "125-66710244", site: "LHE", airline: "SV", origin: "JED", classAbbr: "VAL", stage: "stored", branch: null, arrivedDaysAgo: 3, pieces: 2, weightKg: 48 },
  { awbNo: "618-22910385", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "AVI", stage: "notified", branch: null, arrivedDaysAgo: 1, pieces: 8, weightKg: 310 },
  { awbNo: "214-30049917", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "HUM", stage: "dispatched", branch: null, arrivedDaysAgo: 2, pieces: 1, weightKg: 165 },
  { awbNo: "157-81002234", site: "KHI", airline: "EY", origin: "AUH", classAbbr: "AOG", stage: "do-issued", branch: null, arrivedDaysAgo: 1, pieces: 4, weightKg: 220 },
  { awbNo: "020-99183377", site: "LHE", airline: "CV", origin: "FRA", classAbbr: "DIP", stage: "stored", branch: null, arrivedDaysAgo: 8, pieces: 5, weightKg: 130 },
  { awbNo: "176-10293847", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "VUN", stage: "acceptance", branch: null, arrivedDaysAgo: 0, pieces: 18, weightKg: 540 },
  { awbNo: "125-40028811", site: "KHI", airline: "SV", origin: "JED", classAbbr: "PHR", stage: "charged", branch: null, arrivedDaysAgo: 7, pieces: 22, weightKg: 660 },

  // --- Intake / early stages (exercise the OCR workbench) -----------
  // One AWB parked on each early stage so the lifecycle bar and the flow
  // walkthrough have a live example at every step of FC-01.
  { awbNo: "214-10045566", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "GCR", stage: "handover", branch: null, arrivedDaysAgo: 0, pieces: 41, weightKg: 1870 },
  { awbNo: "176-20099887", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "GCR", stage: "awb-summary", branch: null, arrivedDaysAgo: 0, pieces: 19, weightKg: 730 },
  { awbNo: "125-30011223", site: "LHE", airline: "SV", origin: "JED", classAbbr: "GCR", stage: "tagging", branch: null, arrivedDaysAgo: 0, pieces: 23, weightKg: 890, varianceRatio: 0.012 },
  { awbNo: "306-40077665", site: "PEW", airline: "PK", origin: "PVG", classAbbr: "AFU", stage: "segregation", branch: null, arrivedDaysAgo: 0, pieces: 11, weightKg: 1420 },
  { awbNo: "607-55018822", site: "LHE", airline: "TK", origin: "IST", classAbbr: "GCR", stage: "doc-verification", branch: null, arrivedDaysAgo: 0, pieces: 35, weightKg: 1560, varianceRatio: 0.024 },
  { awbNo: "214-77220198", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "GCR", stage: "reconciliation", branch: null, arrivedDaysAgo: 0, pieces: 52, weightKg: 2340, varianceRatio: 0.06 },
  { awbNo: "306-19827364", site: "PEW", airline: "PK", origin: "PVG", classAbbr: "GCR", stage: "indexation", branch: null, arrivedDaysAgo: 0, pieces: 27, weightKg: 1105, varianceRatio: 0.018 },

  // --- Consolidation & split ----------------------------------------
  { awbNo: "176-92018374", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "GCR", stage: "stored", branch: null, arrivedDaysAgo: 10, pieces: 96, weightKg: 4120, isHwb: true },

  // --- Group C: Controlled / Exception ------------------------------
  // FC-04 — CDR raised from an intake variance
  { awbNo: "020-11223344", site: "KHI", airline: "CV", origin: "FRA", classAbbr: "GCR", stage: "acceptance", branch: "cdr", arrivedDaysAgo: 4, pieces: 20, weightKg: 880, varianceRatio: 0.15 },
  // FC-10-A — mishandled / misrouted
  { awbNo: "607-88991122", site: "LHE", airline: "TK", origin: "IST", classAbbr: "GCR", stage: "acceptance", branch: "mishandled", arrivedDaysAgo: 7, pieces: 14, weightKg: 520 },
  // FC-10-B — re-export
  { awbNo: "125-77665544", site: "KHI", airline: "SV", origin: "JED", classAbbr: "GCR", stage: "customs", branch: "re-export", arrivedDaysAgo: 22, pieces: 9, weightKg: 410 },
  // FC-10-C — long-stay / Section 82
  { awbNo: "306-55443322", site: "KHI", airline: "PK", origin: "LHR", classAbbr: "GCR", stage: "customs", branch: "long-stay", arrivedDaysAgo: 47, pieces: 33, weightKg: 1780 },
  // FC-09 — transhipment
  { awbNo: "214-66778899", site: "KHI", airline: "EK", origin: "DXB", classAbbr: "TRF", stage: "stored", branch: "transhipment", arrivedDaysAgo: 5, pieces: 26, weightKg: 1340 },
  // FC-06 — customs-detained portion (Detend)
  { awbNo: "176-33221100", site: "KHI", airline: "QR", origin: "DOH", classAbbr: "GCR", stage: "customs", branch: null, arrivedDaysAgo: 14, pieces: 40, weightKg: 1650, isDetend: true },
];

/* ------------------------------------------------------------------ *
 * Manifests
 * ------------------------------------------------------------------ */

function buildManifests(): Manifest[] {
  const byFlight = new Map<string, Seed[]>();
  for (const s of SEEDS) {
    const key = `${s.site}|${s.airline}|${s.arrivedDaysAgo}`;
    const list = byFlight.get(key) ?? [];
    list.push(s);
    byFlight.set(key, list);
  }

  let id = 1;
  const out: Manifest[] = [];
  for (const [key, seeds] of byFlight) {
    const [siteCode, airlineCode, ago] = key.split("|");
    const site = siteCode as SiteCode;
    const rng = seeded(id * 977);
    const al = AIRLINES.find((a) => a.AIRLINEID === airlineCode)!;
    const days = Number(ago);
    const year = new Date(NOW_MS - days * MS_PER_DAY).getFullYear();
    // Pre-arrival messages: mostly complete; deliberately incomplete for a couple
    // of flights so the flight board has something to flag (feeds AWD).
    const missingFhl = id % 5 === 0;
    const missingFfm = id % 7 === 0;

    out.push({
      ...audit(days, "import.docs"),
      ...siteKeys(site),
      ManifiestId: id,
      IGMNO: `IGM-${site}-${year}-${String(4000 + id).padStart(5, "0")}`,
      REGNO: `A6-E${intBetween(rng, 100, 999)}`,
      CARGODATE: daysAgo(days, 6, 40),
      MANIFESTDATE: daysAgo(days, 7, 10),
      TOTALWEIGHT: round2(seeds.reduce((n, s) => n + s.weightKg, 0)),
      AIRLINEID: al.AIRLINEID,
      AIRLINENAME: al.DESCRIPTION,
      ABBREVATION: al.ABBREVATION,
      FLIGHT: `${al.AIRLINEID} ${intBetween(rng, 200, 899)}`,
      ORIGIN: seeds[0].origin,
      DESTINATION: site,
      STATUS1: "A",
      STATUS2: "R",
      MANIFESTSTATUS: days > 2 ? "CLOSED" : "OPEN",
      POSTINGDATE: days > 2 ? daysAgo(days - 1, 11, 0) : null,
      MANIFESTNIL: null,
      DFLAG: null,
      USERID: "import.docs",
      TRNO: null,
      IsCloseIGM: days > 2,
      TransferSerialCounter: 0,
      site,
      messages: {
        FFM: { received: !missingFfm, receivedAt: missingFfm ? null : daysAgo(days, 4, 20) },
        FWB: { received: true, receivedAt: daysAgo(days, 4, 25) },
        FHL: { received: !missingFhl, receivedAt: missingFhl ? null : daysAgo(days, 4, 30) },
        NOTOC: { received: seeds.some((s) => ["DGR", "AVI", "PER"].includes(s.classAbbr)), receivedAt: daysAgo(days, 4, 35) },
      },
    });
    id++;
  }
  return out;
}

export const MANIFESTS: Manifest[] = buildManifests();

function manifestFor(seed: Seed): Manifest {
  return (
    MANIFESTS.find(
      (m) => m.site === seed.site && m.AIRLINEID === seed.airline && m.ORIGIN === seed.origin,
    ) ?? MANIFESTS[0]
  );
}

/* ------------------------------------------------------------------ *
 * AWBs
 * ------------------------------------------------------------------ */

function buildAwbs(): AWB[] {
  return SEEDS.map((seed, i) => {
    const rng = seeded((i + 1) * 7919);
    const cls = CARGO_CLASSES.find((c) => c.ABBREVATION === seed.classAbbr)!;
    const subs = subClassesOf(cls.ID);
    const sub = subs[i % subs.length];
    const manifest = manifestFor(seed);
    const al = AIRLINES.find((a) => a.AIRLINEID === seed.airline)!;

    const consignees = PARTIES.filter((p) => p.role === "consignee");
    const shippers = PARTIES.filter((p) => p.role === "shipper");
    const agents = PARTIES.filter((p) => p.role === "agent");
    const consignee = consignees[i % consignees.length];
    const shipper = shippers[i % shippers.length];
    const agent = agents[i % agents.length];

    const dims: Dimensions = {
      lengthCm: intBetween(rng, 80, 180),
      widthCm: intBetween(rng, 60, 120),
      heightCm: intBetween(rng, 60, 140),
      unit: "cm",
    };
    const weights = buildWeightSet(seed.weightKg, {
      ...dims,
      // Scale the envelope by piece count so volumetric is plausible.
      lengthCm: dims.lengthCm * Math.cbrt(seed.pieces),
    });

    const arrivedAt = daysAgo(seed.arrivedDaysAgo, 7, 45);

    // FC-07 §01/§02 — intake is a separate event from the flight landing, and
    // the storage clock hangs off intake. Breakdown, the ramp queue and
    // off-hours handovers put real hours between the two, so the seeds model
    // the gap instead of collapsing it: most cargo is taken into the shed the
    // same afternoon, every third consignment not until the next morning. A
    // zero gap would hide exactly the period nothing may be charged for.
    const intakeNextMorning = i % 3 === 2;
    const intakeAt = intakeNextMorning
      ? daysAgo(Math.max(0, seed.arrivedDaysAgo - 1), 9, 30)
      : daysAgo(seed.arrivedDaysAgo, 14, 20);

    const reachedDo = hasReached(seed.stage, "do-issued");

    // FC-01 05e — declared (OCR) vs physical (received).
    const vr = seed.varianceRatio ?? 0;
    const physicalPieces = Math.round(seed.pieces * (1 - vr));
    const physicalWeight = round2(seed.weightKg * (1 - vr * 0.8));
    const intakeVariance =
      stageIndex(seed.stage) >= stageIndex("doc-verification")
        ? {
            pieces: variance(seed.pieces, physicalPieces),
            weightKg: variance(seed.weightKg, physicalWeight),
            volumeM3: variance(
              round2((dims.lengthCm * dims.widthCm * dims.heightCm) / 1_000_000),
              round2((dims.lengthCm * dims.widthCm * dims.heightCm) / 1_000_000),
            ),
          }
        : null;

    return {
      ...audit(seed.arrivedDaysAgo, "index.officer"),
      ...siteKeys(seed.site),
      AWBId: i + 1,
      ManifiestId: manifest.ManifiestId,
      IGMNO: manifest.IGMNO,
      AWBNO: seed.awbNo,
      SEQUENCE: i + 1,
      PAGENO: Math.floor(i / 10) + 1,

      CARGODATE: daysAgo(seed.arrivedDaysAgo, 7, 45),
      CARGOTIME: daysAgo(seed.arrivedDaysAgo, 7, 45),
      REMARK: seed.branch ? `Routed to ${seed.branch} branch` : null,
      ORIGIN: seed.origin,
      DESTINATION: seed.site,
      SHIPMENTTYPE: seed.isHwb ? "CONSOL" : "DIRECT",

      AIRLINECODE: al.AIRLINEID,
      AIRLINENAME: al.DESCRIPTION,
      FLIGHT: manifest.FLIGHT,
      ABBREVATION: al.ABBREVATION,
      PHYSICALSTATUS: hasReached(seed.stage, "stored") ? "S" : "P",

      SHIPPER1: shipper.NAME,
      SHIPPER2: shipper.ADDRESS,
      SHIPPER3: `${shipper.CITY}, ${shipper.COUNTRY}`,
      SHIPPER4: shipper.PHONENO,
      CONSIGNEE1: consignee.NAME,
      CONSIGNEE2: consignee.ADDRESS,
      CONSIGNEE3: `${consignee.CITY}, ${consignee.COUNTRY}`,
      CONSIGNEE4: consignee.PHONENO,
      AGENT1: agent.NAME,
      AGENT2: agent.ADDRESS,
      AGENT3: `${agent.CITY}, ${agent.COUNTRY}`,
      AGENT4: agent.PHONENO,

      NIC: reachedDo ? `42101-${intBetween(rng, 1000000, 9999999)}-${intBetween(rng, 1, 9)}` : null,
      PASSPORT: i % 6 === 0 ? `AB${intBetween(rng, 1000000, 9999999)}` : null,
      CHALLANNO: reachedDo ? `CH-${seed.site}-${String(9000 + i).padStart(5, "0")}` : null,

      HOLDINGSTATUS: !!seed.onHold,

      DONO: reachedDo ? `DO-${seed.site}-2026-${String(3100 + i).padStart(5, "0")}` : null,
      DODATE: reachedDo ? daysAgo(Math.max(0, seed.arrivedDaysAgo - 3), 10, 30) : null,
      DOAMOUNT: al.DOAMOUNT,
      DOFREE: cls.ABBREVATION === "HUM" || cls.ABBREVATION === "DIP",

      TOTALPCS: seed.pieces,
      TOTALWEIGHT: weights.actualKg,
      TOTALCHRGWEIGHT: weights.chargeableKg,

      SHIFT: pick(rng, ["A", "B", "C"]),
      DFLAG: false,
      DELIVERED: hasReached(seed.stage, "delivered"),
      CARGOCLASSID: cls.ID,

      TRAIRLINEID: seed.branch === "transhipment" ? "TK" : null,
      TRID: seed.branch === "transhipment" ? 1 : null,

      ImportProcess: stageIndex(seed.stage),
      Process: seed.stage,
      Lock: seed.stage === "closed",
      Status: seed.branch ? 2 : 1,

      IsHwb: !!seed.isHwb,
      IsDetend: !!seed.isDetend,
      DetendUniqueIdentification: seed.isDetend ? `DTN-${seed.site}-2026-${String(700 + i)}` : null,

      isSpecial: cls.group === "special",
      isSpecialRemarks: cls.group === "special" ? `${cls.ABBREVATION} handling — ${sub.NAME}` : null,

      site: seed.site,
      cargoSubClassId: sub.SUBCLASSID,
      stage: seed.stage,
      branch: seed.branch,
      locationId: hasReached(seed.stage, "stored")
        ? (STORAGE_LOCATIONS.find((l) => l.site === seed.site && l.CLASSID === cls.ID)?.ID ?? null)
        : null,
      intakeVariance,
      cdrRaised: seed.branch === "cdr" || (intakeVariance?.pieces.overTolerance ?? false),
      arrivedAt,
      intakeAt,
    } satisfies AWB;
  });
}

export const AWBS: AWB[] = buildAwbs();

export function awbById(id: number): AWB | undefined {
  return AWBS.find((a) => a.AWBId === id);
}

export function awbByNo(no: string): AWB | undefined {
  return AWBS.find((a) => a.AWBNO === no);
}

/* ------------------------------------------------------------------ *
 * AWB detail lines
 * ------------------------------------------------------------------ */

export const AWB_DETAILS: AWBDetail[] = AWBS.flatMap((a, ai) => {
  const rng = seeded((ai + 1) * 3571);
  const lineCount = a.IsHwb ? 3 : intBetween(rng, 1, 2);
  const v = a.intakeVariance;

  return Array.from({ length: lineCount }, (_, li) => {
    const share = 1 / lineCount;
    const pcs = Math.round(a.TOTALPCS * share);
    const wt = round2(a.TOTALWEIGHT * share);
    const recvPcs = v ? Math.round(pcs * (v.pieces.physical / Math.max(1, v.pieces.declared))) : pcs;
    const recvWt = v ? round2(wt * (v.weightKg.physical / Math.max(1, v.weightKg.declared))) : wt;
    const short = Math.max(0, pcs - recvPcs);
    const damaged = a.branch === "cdr" && li === 0 ? intBetween(rng, 1, 3) : 0;
    const goods = GOODS[(ai + li) % GOODS.length];

    return {
      DetailId: ai * 10 + li + 1,
      AWBId: a.AWBId,
      IGMNO: a.IGMNO,
      AWBNO: a.AWBNO,
      SEQUENCE: li + 1,
      GOODS: goods,

      PCS: pcs,
      WEIGTH: wt,
      CHARGEWEIGTH: round2(a.TOTALCHRGWEIGHT * share),
      RECEIVEDPCS: recvPcs,
      RECEIVEDWT: recvWt,
      CHARGEDRECEIVEDWT: round2(a.TOTALCHRGWEIGHT * share * (recvWt / Math.max(1, wt))),

      TYPEOFPACK: pick(rng, PACKS),
      TYPEOFDAM: damaged ? "Crushed" : null,
      DEMAGEDETAIL: damaged ? "Outer carton crushed on one corner; contents inspected" : null,
      DAMAGEPCS: damaged,
      DAMAGEWEIGHT: damaged ? round2(wt * 0.04) : 0,

      SHORTLANDED: short,
      SHORTLANDEDREC: 0,
      IsShortDetailed: short > 0,

      Shipment: short > 0 ? "PART" : "FULL",
      PartRemaining: short,
      PartReceievd: recvPcs,

      ClassId: a.CARGOCLASSID,
      SplitClassId: null,
      DetendUniqueIdentification: a.DetendUniqueIdentification,

      DFLAG: false,
      UniqueIdentification: `${a.AWBNO}-D${li + 1}`,
      Remarks: null,
      IsLock: a.Lock,
      IsHold: a.HOLDINGSTATUS,
      CityId: a.CityId,

      dimensions: hasReached(a.stage, "acceptance")
        ? { lengthCm: intBetween(rng, 80, 180), widthCm: intBetween(rng, 60, 120), heightCm: intBetween(rng, 60, 140), unit: "cm" }
        : null,
      ocr: hasReached(a.stage, "doc-verification")
        ? {
            goods: ocr(goods, li === 0 ? 0.97 : 0.82),
            pcs: ocr(pcs, 0.99),
            weightKg: ocr(wt, li === 0 ? 0.94 : 0.71, li === 0 ? undefined : round2(wt)),
          }
        : null,
    } satisfies AWBDetail;
  });
});

export function detailsFor(awbId: number): AWBDetail[] {
  return AWB_DETAILS.filter((d) => d.AWBId === awbId);
}

/* ------------------------------------------------------------------ *
 * Pieces — the RFID chain (FC-03 bind → FC-08 read)
 * ------------------------------------------------------------------ */

export const PIECES: Piece[] = AWBS.flatMap((a, ai) => {
  const rng = seeded((ai + 1) * 6151);
  // Cap generated pieces so fixtures stay a sensible size.
  const n = Math.min(a.TOTALPCS, 12);
  const stored = hasReached(a.stage, "stored");
  const dispatched = hasReached(a.stage, "dispatched");

  return Array.from({ length: n }, (_, pi) => {
    const dims: Dimensions = {
      lengthCm: intBetween(rng, 60, 200),
      widthCm: intBetween(rng, 40, 120),
      heightCm: intBetween(rng, 40, 140),
      unit: "cm",
    };
    const kg = round2(a.TOTALWEIGHT / a.TOTALPCS);
    // One deliberately unreadable tag so the exception path has a case.
    const unreadable = ai === 3 && pi === 2;

    return {
      pieceId: `PC-${String(a.AWBId).padStart(2, "0")}${String(pi + 1).padStart(3, "0")}`,
      awbId: a.AWBId,
      AWBNO: a.AWBNO,
      rfidEpc: unreadable ? null : `E2003415020010801890${(0x54b0 + ai * 16 + pi).toString(16).toUpperCase()}`,
      barcode: `${a.AWBNO.replace(/-/g, "")}${String(pi + 1).padStart(3, "0")}`,
      dimensions: dims,
      weights: buildWeightSet(kg, dims),
      cargoClassId: a.CARGOCLASSID,
      cargoSubClassId: a.cargoSubClassId,
      locationId: a.locationId,
      scanState: unreadable
        ? "unreadable"
        : dispatched
          ? "dispatched"
          : hasReached(a.stage, "gate-pass")
            ? "picked"
            : stored
              ? "bound"
              : "unbound",
      lastMovementAt: daysAgo(Math.max(0, a.stage === "closed" ? 30 : 1), 10, 40 + pi),
      lastMovementBy: pick(rng, ["i.ali", "s.khan", "m.raza", "f.qureshi"]),
    } satisfies Piece;
  });
});

export function piecesFor(awbId: number): Piece[] {
  return PIECES.filter((p) => p.awbId === awbId);
}

/* ------------------------------------------------------------------ *
 * Location assignments — logical vs physical (BLK-08)
 * ------------------------------------------------------------------ */

export const AWB_LOCATIONS: AWBLocation[] = AWBS.filter((a) => a.locationId !== null).map((a, i) => {
  const logical = a.locationId!;
  // Two AWBs are deliberately diverged so the divergence queue is non-empty.
  const diverge = i === 2 || i === 7;
  const alt = STORAGE_LOCATIONS.find((l) => l.site === a.site && l.ID !== logical);
  const physical = diverge && alt ? alt.ID : logical;

  return {
    Id: i + 1,
    IGMNO: a.IGMNO,
    AWBNO: a.AWBNO,
    SEQUENCE: a.SEQUENCE,
    PCS: a.TOTALPCS,
    WEIGHT: a.TOTALWEIGHT,
    LOGICALCARGOSUBCLASSID: a.cargoSubClassId,
    LOGICALLOCATIONID: logical,
    PHYSICALCARGOSUBCLASSID: a.cargoSubClassId,
    PHYSICALLOCATIONID: physical,
    HWBNO: null,
    Cargoclassid: a.CARGOCLASSID,
    ConsolId: a.IsHwb ? 1 : null,
    DetendUniqueIdentification: a.DetendUniqueIdentification,
    SplitClassId: null,
    UniqueIdentification: `${a.AWBNO}-LOC`,
    DFLAG: null,
    CityId: a.CityId,
    divergedAt: diverge ? daysAgo(1, 13, 20) : null,
    divergenceReason: diverge ? "Moved to staging for customs examination" : null,
  } satisfies AWBLocation;
});

/* ------------------------------------------------------------------ *
 * Consolidation — house AWBs
 * ------------------------------------------------------------------ */

const CONSOL_AWB = AWBS.find((a) => a.IsHwb)!;

export const HOUSE_AWBS: HouseAWB[] = Array.from({ length: 4 }, (_, i) => {
  const rng = seeded((i + 1) * 8663);
  const consignee = PARTIES.filter((p) => p.role === "consignee")[i % 6];
  const shipper = PARTIES.filter((p) => p.role === "shipper")[i % 5];
  const pcs = Math.round(CONSOL_AWB.TOTALPCS / 4);
  const wt = round2(CONSOL_AWB.TOTALWEIGHT / 4);

  return {
    ...audit(10, "index.officer"),
    ...siteKeys(CONSOL_AWB.site),
    ConsolId: i + 1,
    IGMNO: CONSOL_AWB.IGMNO,
    AWBNO: CONSOL_AWB.AWBNO,
    HWB: `HAWB-${7780 + i}`,
    SUBINDEX: `${i + 1}`,
    PCS: pcs,
    WEIGHT: wt,
    CHARGEDWEIGH: round2(wt * 1.02),
    CARGOCLASSID: CONSOL_AWB.CARGOCLASSID,
    CARGOSUBCLASSID: CONSOL_AWB.cargoSubClassId,
    LOCATIONID: CONSOL_AWB.locationId!,
    SHIPPER1: shipper.NAME,
    SHIPPER2: shipper.CITY,
    SHIPPER3: shipper.COUNTRY,
    CONSIGNEE1: consignee.NAME,
    CONSIGNEE2: consignee.CITY,
    CONSIGNEE3: consignee.COUNTRY,
    AGENT1: PARTIES.find((p) => p.role === "agent")!.NAME,
    AGENT2: null,
    AGENT3: null,
    CONSIGNEEADD: consignee.ADDRESS,
    SHIPPERADD: shipper.ADDRESS,
    AGENTADD: PARTIES.find((p) => p.role === "agent")!.ADDRESS,
    CONTENTS: GOODS[i % GOODS.length],
    SUBDONO: i < 2 ? `SDO-${3200 + i}` : null,
    DELIVERED: i === 0 ? 1 : 0,
    PHYSICALSTATUS: "S",
    HOLDINGSTATUS: false,
    DFLAG: null,
    IsLock: false,
    UniqueIdentification: `${CONSOL_AWB.AWBNO}-H${i + 1}`,
    DetendIdentification: null,
  } satisfies HouseAWB;
});

/* ------------------------------------------------------------------ *
 * Detend — customs-detained sub-identity
 * ------------------------------------------------------------------ */

const DETEND_AWB = AWBS.find((a) => a.IsDetend)!;

export const DETENDS: DetendDetail[] = [
  {
    DetendId: 1,
    AwbId: DETEND_AWB.AWBId,
    UniqueIdentification: DETEND_AWB.DetendUniqueIdentification!,
    TotalPieces: 12,
    TotalWeight: round2(DETEND_AWB.TOTALWEIGHT * 0.3),
    TotalChargeWeight: round2(DETEND_AWB.TOTALCHRGWEIGHT * 0.3),
    GOODS: "Consumer electronics — pending valuation",
    detainedAt: daysAgo(11, 15, 20),
    detainedBy: "Customs Officer — A. Malik",
    reason: "Valuation query raised on invoice under-declaration",
    releasedAt: null,
    locationId: STORAGE_LOCATIONS.find((l) => l.site === DETEND_AWB.site && l.CLASSID === 16)!.ID,
  },
];

/* ------------------------------------------------------------------ *
 * Arrival advice / NOA
 * ------------------------------------------------------------------ */

export const ARRIVAL_ADVICES: ArrivalAdvice[] = AWBS.filter((a) => hasReached(a.stage, "notified")).map(
  (a, i) => ({
    AdviceNumber: 5200 + i,
    docNumber: {
      series: "ARRIVAL_ADVICE",
      value: `AA-${a.site}-2026-${String(5200 + i)}`,
      sequence: 5200 + i,
      year: 2026,
      cargoClassId: a.CARGOCLASSID,
      continuesFromCmts: 5187,
    },
    IGMNO: a.IGMNO,
    AWBNO: a.AWBNO,
    SEQUENCE: String(a.SEQUENCE),
    ADVICEDATE: daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - 1), 9, 0),
    SAPSNO: `SAPS-${a.site}-${String(1200 + i)}`,
    AIRLINENAME: a.AIRLINENAME,
    FLIGHT: a.FLIGHT,
    TOTALWEIGHT: a.TOTALWEIGHT,
    TOTALPCS: a.TOTALPCS,
    ConsigneeName: a.CONSIGNEE1,
    ConsigneeAdd: a.CONSIGNEE2 ?? "",
    Goods: GOODS[i % GOODS.length],
    ArrivalDate: a.arrivedAt,
    Cityid: a.CityId,
    dispatchedTo: [
      { partyId: 1, channel: "email", sentAt: daysAgo(1, 9, 5), deliveredAt: daysAgo(1, 9, 6), readAt: i % 3 === 0 ? daysAgo(1, 10, 12) : null },
      { partyId: 40, channel: "whatsapp", sentAt: daysAgo(1, 9, 5), deliveredAt: daysAgo(1, 9, 5), readAt: daysAgo(1, 9, 22) },
    ],
  }),
);

/* ------------------------------------------------------------------ *
 * Charges, godown rent, DO, invoices
 * ------------------------------------------------------------------ */

/**
 * One filtered list, shared by the calculator, the GR voucher and the GR
 * detail lines — not three separate `.filter()` calls that happen to agree.
 *
 * `CHARGECALCULATER.VOUCHERNO` only means anything if the number a quote
 * carries is the *same string* the voucher is later issued under. Three
 * independent filters produced that by coincidence of ordering; the first
 * seed row inserted out of order would have silently paired a calculation
 * with a different consignment's voucher, and nothing on screen would have
 * looked wrong. The list and the number formatter are therefore defined once.
 */
const CHARGED_AWBS = AWBS.filter((a) => hasReached(a.stage, "charged"));

/** GR voucher number — continues the CMTS series from 4419. */
const grVoucherNo = (i: number) => `GR-2026-${String(4420 + i).padStart(5, "0")}`;

export const CHARGE_CALCULATIONS = CHARGED_AWBS.map((a, i) => {
  const dims = { lengthCm: 120, widthCm: 80, heightCm: 90, unit: "cm" };
  return calculateCharges({
    awbId: a.AWBId,
    arrivalAt: a.arrivedAt,
    // The two endpoints, not a pre-computed day count. Handing the calculator a
    // `totalDays` measured from flight arrival is what billed the gap between
    // the aircraft landing and the cargo reaching the shed; the clock starts at
    // intake, and only the calculator gets to say how long it has run.
    intakeAt: a.intakeAt,
    asOf: DEMO_NOW,
    cargoClassId: a.CARGOCLASSID,
    cargoSubClassId: a.cargoSubClassId,
    actualKg: a.TOTALWEIGHT,
    volumetricKg: round2((dims.lengthCm * dims.widthCm * dims.heightCm) / 6000),
    calculatedAt: DEMO_NOW,
    // Every row here is an AWB that has already reached `charged`, so a GR
    // voucher exists for each and the number is known. The nullable case —
    // an uncommitted live quote with no voucher yet — is what a screen
    // calling `calculateCharges()` interactively produces; seeding a null
    // here instead would contradict the GODOWNRENT row sitting beside it.
    voucherNo: grVoucherNo(i),
  });
});

export function chargesFor(awbId: number) {
  return CHARGE_CALCULATIONS.find((c) => c.awbId === awbId);
}

export const GODOWN_RENTS: GodownRent[] = CHARGED_AWBS.map(
  (a, i) => {
    const calc = chargesFor(a.AWBId)!;
    const paid = hasReached(a.stage, "do-issued");
    const totalDays = daysBetween(a.arrivedAt, DEMO_NOW);
    const cls = cargoClass(a.CARGOCLASSID);
    const consigneeParty = PARTIES.find((p) => p.NAME === a.CONSIGNEE1);

    // The gate pass prints IGM, AWB, DO and GR as four number+date pairs and
    // an officer reads them top to bottom as the order the file moved in:
    // IGMNODATE <= AWBNODATE <= DODATE <= GRDATE. The GR voucher is raised
    // against a consignment the DO has already released, so it can never
    // predate its own DO. Deriving the GR day FROM the DO day rather than
    // from arrival independently is what keeps that ordering true — the
    // previous fixed "arrival + 2" landed a day BEFORE the "arrival + 3" DO
    // and printed a gate pass whose dates ran backwards.
    const doDaysAgo = a.DODATE ? daysBetween(a.DODATE, DEMO_NOW) : null;
    const grDaysAgo = doDaysAgo !== null ? Math.max(0, doDaysAgo - 1) : Math.max(0, totalDays - 2);

    return {
      ...audit(grDaysAgo, "finance.officer"),
      ...siteKeys(a.site),
      GodownId: i + 1,
      VOUCHERNO: grVoucherNo(i),
      docNumber: {
        series: "GR_VOUCHER",
        value: grVoucherNo(i),
        sequence: 4420 + i,
        year: 2026,
        cargoClassId: a.CARGOCLASSID,
        continuesFromCmts: 4419,
      },
      GRDATE: daysAgo(grDaysAgo, 11, 30),
      CHALLANNO: a.CHALLANNO,
      IGMNO: a.IGMNO,
      AWBNO: a.AWBNO,
      SUBAWBNO: null,
      INDEXNO: String(a.SEQUENCE),
      SUBINDEXNO: null,
      TOTALWEIGHT: a.TOTALWEIGHT,
      CHARGEABLEWEIGHT: a.TOTALCHRGWEIGHT,
      DONO: a.DONO,
      ARRIVALDATE: a.arrivedAt,
      DAYS: totalDays,
      FREE: cls.ABBREVATION === "HUM",
      BILLTYPE: "NORMAL",
      FROMDATE: a.arrivedAt,
      TODATE: DEMO_NOW,
      DELIVERYDATE: hasReached(a.stage, "delivered") ? daysAgo(1, 15, 0) : null,
      SUPPLIMENTDAYS: 0,
      GRREFERENCE: null,
      TOTALPIECES: a.TOTALPCS,

      HANDLING: calc.handlingAmount,
      DEMURRAGE: calc.storageAmount,
      DOCUMENTATION: calc.documentationCharges,
      DECONSOLIDATION: calc.deconsolidationCharges,
      MISCELLANEOUS: calc.miscellaneousCharges,
      SPECIALHANDLING: calc.specialHandlingCharges,
      TOTALAMOUNT: calc.total,
      NETPAYABLE: calc.total,

      sumTotalAmountWithoutTax: calc.subTotal,
      sumLocationChargesAmount: calc.locationChargesAmount,
      sumHandlingCharges: calc.handlingAmount,
      sumStorgeUnitCharges: calc.storageAmount,
      sumAFUAmount: cls.ABBREVATION === "AFU" ? calc.specialHandlingCharges : 0,
      sumMinimumCharges: calc.minimumCharges,
      sumTax: calc.taxAmount,

      WAIVEOFF: i === 1,
      WAIVEOFFPERCENT: i === 1 ? 20 : 0,
      WAIVEOFFAMOUNT: i === 1 ? round2(calc.total * 0.2) : 0,
      WAIVEOFFREASON: i === 1 ? "Customs hold — clearance delayed beyond consignee control" : null,
      WaivOfStorageOrAmount: i === 1 ? "STORAGE" : null,

      PAID: paid,
      CASH: paid && i % 3 === 0,
      CASHAMOUNT: paid && i % 3 === 0 ? calc.total : 0,
      PAYORDERNO: paid && i % 3 === 1 ? `PO-${String(88200 + i)}` : null,
      // Clamped to the voucher's own day so payment can never predate the
      // voucher it settles. On a same-day consignment `grDaysAgo` is 0 and a
      // flat "yesterday" would have stamped the payment before the GR existed.
      PAYORDERDATE: paid && i % 3 === 1 ? daysAgo(Math.min(1, grDaysAgo), 12, 0) : null,
      PAYORDERAMOUNT: paid && i % 3 === 1 ? calc.total : 0,
      PayOrder: paid && i % 3 === 1,
      Paymode: paid ? (i % 3 === 0 ? "CASH" : i % 3 === 1 ? "PAYORDER" : "GATEWAY") : null,
      CREDITCARD: null,
      MASTERCARD: null,
      ACCTITLE: paid && i % 3 === 1 ? "Sky Bridge Clearing Agency" : null,
      ACCNO: paid && i % 3 === 1 ? "PK36SCBL0000001123456702" : null,
      BANKNAME: paid && i % 3 === 1 ? "Bank Alfalah" : null,
      BANKBRANCHNAME: paid && i % 3 === 1 ? "Airport Branch, Karachi" : null,
      CHEQUENO: null,
      CHEQUEDATE: null,
      RECIEVEDBY: paid ? "finance.counter" : null,
      PAYDATE: paid ? daysAgo(Math.min(1, grDaysAgo), 12, 5) : null,
      OverPaidAmount: 0,

      DUPLICATECOUNT: i === 0 ? 1 : 0,
      NTN: consigneeParty?.NTN ?? null,
      STN: consigneeParty?.STN ?? null,
      GdUniqueIdentification: `${a.AWBNO}-GR`,
      DetendUniqueIdentification: a.DetendUniqueIdentification,
      clearingAgent: a.AGENT1,
      GDNum: null,
      site: a.site,
    } satisfies GodownRent;
  },
);

export const DELIVERY_ORDERS: DeliveryOrder[] = AWBS.filter((a) => hasReached(a.stage, "do-issued")).map(
  (a, i) => {
    const gr = GODOWN_RENTS.find((g) => g.AWBNO === a.AWBNO);
    const authLetterNo = `AL-2026-${String(1440 + i)}`;
    const issuedAt = a.DODATE;

    // FC-01 §22a — the CHA raises the request off the NOA, so the request is
    // anchored to the advice rather than invented. ARRIVAL_ADVICES puts the
    // notice at (dwell − 1) days at 09:00; the request follows it the same
    // morning and the terminal issues at 10:30, which keeps
    // advice -> request -> issue in that order for every seed, including the
    // one-day-old AWBs where all three land on the same date.
    const advice = ARRIVAL_ADVICES.find((ad) => ad.AWBNO === a.AWBNO) ?? null;
    const requestedAt = daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - 1), 9, 40);

    // FC-01 §22b — the conditions as they read at issuance, frozen. Evaluated
    // here rather than fetched from `releaseGateFor` for two reasons: that
    // helper reads HOLDS, which is declared further down this file and would be
    // in the temporal dead zone at module init; and it answers "is this cargo
    // releasable now", which is a different question from "what was true when
    // authority was granted". Screens must render this, not a live re-run.
    const gate = evaluateReleaseGate(a.AWBId, {
      oocIssued: true,
      oocRef: `OOC-${a.site}-2026-${String(9100 + a.AWBId)}`,
      oocVerifiedVsSd: true,
      oocMismatchCount: 0,
      oocVerifiedAt: daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - 1), 12, 5),
      oocVerifiedBy: "customs.liaison",
      authorityLetterNo: authLetterNo,
      chargesPaid: gr?.PAID ?? true,
      outstanding: gr && !gr.PAID ? gr.NETPAYABLE : 0,
      onHold: a.HOLDINGSTATUS,
      holdReason: null,
      cargoClassId: a.CARGOCLASSID,
      specialClearanceDone: true,
    });

    return {
    ...audit(2, "do.desk"),
    ...siteKeys(a.site),
    DoId: i + 1,
    IGMNO: a.IGMNO,
    AWBNO: a.AWBNO,
    HWBNO: null,
    DONO: a.DONO!,
    docNumber: {
      series: "DELIVERY_ORDER",
      value: a.DONO!,
      sequence: 3100 + i,
      year: 2026,
      cargoClassId: a.CARGOCLASSID,
      continuesFromCmts: 3099,
    },

    // Every seeded DO is past 22b — the filter is `do-issued` — so all of them
    // carry an issue timestamp and a gate snapshot. `collected` is the ones the
    // CHA has since picked up at the counter (FC-02 §33), which is any AWB that
    // went on to draw a gate pass.
    status: hasReached(a.stage, "gate-pass") ? "collected" : "issued",
    requestedAt,
    requestedBy: a.AGENT1 ?? a.CONSIGNEE1,
    requestedAgainstNoaAt: advice?.ADVICEDATE ?? null,
    issuedAt,
    issuedBy: "do.desk",
    gateEvaluatedAt: issuedAt,
    gateSnapshot: gate.conditions,

    DODATE: a.DODATE,
    DOTYPE: "NORMAL",
    DOCARGOCLASSID: a.CARGOCLASSID,
    AMOUNT: a.DOAMOUNT,
    Tax: 15,
    REMARKS: null,
    SHIFT: a.SHIFT,
    CHALLANNO: a.CHALLANNO,
    RECIEVEDBY: a.AGENT1 ?? a.CONSIGNEE1,
    NIC: a.NIC,
    PASSPORT: a.PASSPORT,
    AuthAgentName: "Imran Ali",
    AuthAgentCNIC: "42201-7788990-1",
    AuthAgentPhone: "+92 300 2244660",
    AuthAgentEmail: "imran@skybridge.pk",
    AuthLetterNo: authLetterNo,
    AuthAgentPic: `/mock/auth-agent-${(i % 3) + 1}.jpg`,
    NTN: PARTIES.find((p) => p.NAME === a.CONSIGNEE1)?.NTN ?? null,
    STN: PARTIES.find((p) => p.NAME === a.CONSIGNEE1)?.STN ?? null,
    FREE: a.DOFREE,
    FREECAUSE: a.DOFREE ? "Welfare / diplomatic — no DO charge" : null,
    IsDuplicate: false,
    DuplicateReason: null,
    Reason: null,
    FIRdate: null,
    IsLock: a.Lock,
    DetendIdentification: a.DetendUniqueIdentification,
    site: a.site,
    } satisfies DeliveryOrder;
  },
);

export const INVOICES: Invoice[] = GODOWN_RENTS.map((g, i) => ({
  id: i + 1,
  invoiceNo: `INV-2026-${String(7710 + i).padStart(5, "0")}`,
  docNumber: {
    series: "INVOICE",
    value: `INV-2026-${String(7710 + i).padStart(5, "0")}`,
    sequence: 7710 + i,
    year: 2026,
    cargoClassId: null,
    continuesFromCmts: 7709,
  },
  awbId: awbByNo(g.AWBNO)!.AWBId,
  IGMNO: g.IGMNO,
  AWBNO: g.AWBNO,
  issuedAt: g.GRDATE,
  dueAt: daysAgo(-7, 17, 0),
  subTotal: g.sumTotalAmountWithoutTax,
  taxAmount: g.sumTax,
  total: g.NETPAYABLE,
  paid: g.PAID ? g.NETPAYABLE : 0,
  outstanding: g.PAID ? 0 : g.NETPAYABLE,
  status: g.PAID ? "paid" : "issued",
  payerPartyId: PARTIES.find((p) => p.NAME === awbByNo(g.AWBNO)!.CONSIGNEE1)?.ID ?? 1,
  site: g.site,
}));

/**
 * GR detail lines — CMTS `GODOWNRENTDETAIL` (26 cols), gap G9.
 *
 * The voucher header carries `sum*` totals; this is what they are the sum
 * *of*. One line per class/subclass/location combination the consignment
 * occupied, because a consignment split across two zones is charged at two
 * location rates — which the header alone can never show.
 */
export const GODOWN_RENT_DETAILS: GodownRentDetail[] = GODOWN_RENTS.flatMap((g, gi) => {
  const awb = awbByNo(g.AWBNO)!;
  const calc = chargesFor(awb.AWBId)!;
  const loc = awb.locationId ?? STORAGE_LOCATIONS.find((l) => l.site === awb.site)!.ID;
  // Most consignments sit in one zone; a consolidation spans two.
  const zones = awb.IsHwb ? [loc, loc + 1] : [loc];

  // Every money column below is split from the header's own value rather than
  // recomputed from the calculator. Two different reasons, both about the
  // screen: (1) the voucher shows the `sum*` roll-up directly above the grid
  // these lines fill, so anything that re-derives the number from a second
  // source can disagree with it; (2) an equal `1/n` share rounded per line
  // loses up to half a paisa per line, and a total the grid beneath it does
  // not reach is worse than no total at all — it looks authoritative and is
  // wrong. `splitExact` gives the residue to the last line, which is how the
  // allocation is done on paper too.
  const split = (total: number) => splitExact(total, zones.length);

  const weightParts = split(g.CHARGEABLEWEIGHT);
  const withoutTaxParts = split(g.sumTotalAmountWithoutTax);
  const taxParts = split(g.sumTax);
  const handlingParts = split(g.sumHandlingCharges);
  const storageParts = split(g.sumStorgeUnitCharges);
  const locationParts = split(g.sumLocationChargesAmount);
  const minimumParts = split(g.sumMinimumCharges);
  const afuParts = split(g.sumAFUAmount);
  const specialParts = split(g.SPECIALHANDLING);
  const deconsolParts = split(g.DECONSOLIDATION);
  const docParts = split(g.DOCUMENTATION);

  return zones.map((locationId, li) => {
    const withoutTax = withoutTaxParts[li];
    const tax = taxParts[li];
    return {
      Id: gi * 10 + li + 1,
      GRNO: g.VOUCHERNO,
      CLASSID: awb.CARGOCLASSID,
      SUBCLASSID: awb.cargoSubClassId,
      LOCATIONID: locationId,
      INDEXNO: li + 1,
      DAYS: calc.chargeableDays,
      WEIGHT: weightParts[li],
      HandlingUnit: "PER KG",
      HandlingCharges: handlingParts[li],
      StorgeUnit: "PER KG / DAY",
      StorgeUnitCharges: storageParts[li],
      LocationUnit: "PER DAY",
      LocationCharges: locationParts[li],
      MinimumCharges: minimumParts[li],
      SpecialCharges: specialParts[li],
      Deconsolidation: deconsolParts[li],
      DocCharges: docParts[li],
      // Advance Freight Undertaking — carried per line in CMTS, and it is the
      // AFU-classed *slice of* `SpecialCharges` above, not a charge on top of
      // it. Non-zero only where the cargo class is AFU, which is exactly the
      // condition under which the header sets `sumAFUAmount`. A screen that
      // adds `SpecialCharges + AFUAmount` into a line total double-bills.
      AFUAmount: afuParts[li],
      Freedays: calc.freeDays,
      TaxPercentage: String(calc.taxPercent),
      Tax: tax,
      TaxAmount: tax,
      TotalAmountWithoutTax: withoutTax,
      TotalAmountWithTax: round2(withoutTax + tax),
      GodownId: g.GodownId,
    } satisfies GodownRentDetail;
  });
});

export function grDetailsFor(voucherNo: string): GodownRentDetail[] {
  return GODOWN_RENT_DETAILS.filter((d) => d.GRNO === voucherNo);
}

/**
 * Payments — CMTS spreads these across `GODOWNRENT` (PAYORDERNO/DATE/AMOUNT,
 * CASHNO, Paymode, CREDITCARD, ACCTITLE, BANKNAME, CHEQUENO…) with **0
 * occurrences in the pre-P0 demo**. The FC-07 amendment adds cash-less
 * payment via gateway with auto-reconciliation, so the fixture deliberately
 * spans both worlds: legacy instruments that need manual reconciliation, and
 * gateway transactions that reconcile themselves.
 */
export const PAYMENTS: PaymentRecord[] = INVOICES.filter((inv) => inv.paid > 0).map((inv, i) => {
  const rng = seeded((i + 1) * 8191);
  const mode = pick(rng, ["GATEWAY", "GATEWAY", "PAYORDER", "CHEQUE", "CASH", "BANK_TRANSFER"] as const);
  const gateway = mode === "GATEWAY";
  return {
    id: i + 1,
    invoiceNo: inv.invoiceNo,
    paidAt: inv.issuedAt,
    amount: inv.paid,
    mode,
    gatewayRef: gateway ? `PG-2026-${String(330000 + inv.id * 41)}` : null,
    // FC-07: gateway transactions auto-reconcile; legacy instruments do not.
    reconciled: gateway,
    challanNo: mode === "CASH" ? `CH-${String(90400 + i)}` : null,
    payOrderNo: mode === "PAYORDER" ? `PO-${String(55120 + i)}` : null,
    chequeNo: mode === "CHEQUE" ? 480900 + i : null,
    bankName: mode === "CHEQUE" || mode === "BANK_TRANSFER" ? pick(rng, ["Meezan Bank", "HBL", "Bank Alfalah", "UBL"]) : null,
    receivedBy: "finance.officer",
    site: inv.site,
  } satisfies PaymentRecord;
});

/**
 * GR duplicates — CMTS `GODOWNRENTDUPLICATE` (10 cols). A reprint is a
 * chargeable, sequenced event with its own reason, not a silent reprint.
 */
export const GR_DUPLICATES: GodownRentDuplicate[] = GODOWN_RENTS.slice(0, 3).map((g, i) => ({
  VOUCHERNO: g.VOUCHERNO,
  SEQUENCENO: i + 1,
  COMMENTS: pick(seeded((i + 1) * 613), [
    "Consignee lost the original voucher; reprint requested at the counter.",
    "CHA requires a second copy for the customs file.",
    "Original damaged during handling at the gate.",
  ]),
  DUPLICATEDATE: daysAgo(Math.max(1, i + 1), 11, 30),
  USERID: "finance.officer",
  CityId: g.CityId,
  DuplicateAmount: 500,
  DuplicateTax: 75,
  DuplicateTotalAmount: 575,
  DuplicateTaxPercen: 15,
}));

export const WAIVER_REQUESTS: WaiverRequest[] = GODOWN_RENTS.filter((g) => g.WAIVEOFF).map((g, i) => ({
  id: i + 1,
  voucherNo: g.VOUCHERNO,
  awbId: awbByNo(g.AWBNO)!.AWBId,
  requestedBy: "cha.skybridge",
  requestedAt: daysAgo(3, 10, 0),
  reason: "customs-hold",
  note: "Consignment held by customs for 9 days pending valuation query; delay outside consignee control.",
  mode: "percent",
  percent: g.WAIVEOFFPERCENT,
  amount: g.WAIVEOFFAMOUNT,
  scope: "STORAGE",
  originalTotal: g.TOTALAMOUNT,
  revisedTotal: round2(g.TOTALAMOUNT - g.WAIVEOFFAMOUNT),
  levels: [
    { level: 1, role: "Finance Officer", approver: "f.qureshi", decision: "approved", comment: "Hold confirmed against customs register.", decidedAt: daysAgo(2, 14, 10) },
    { level: 2, role: "Finance Manager", approver: "a.shaikh", decision: "approved", comment: "Approved at 20% on storage component only.", decidedAt: daysAgo(2, 16, 40) },
  ],
  status: "approved",
  creditNoteNo: `CN-2026-${String(220 + i)}`,
  site: g.site,
}));

/* ------------------------------------------------------------------ *
 * Release gates — evaluated live from the other fixtures
 * ------------------------------------------------------------------ */

export function releaseGateFor(awbId: number) {
  const a = awbById(awbId);
  if (!a) return null;
  const inv = INVOICES.find((x) => x.awbId === awbId);
  const hold = HOLDS.find((h) => h.AWBNo === a.AWBNO && !h.Release);

  // Read the actual Out-of-Charge record, not the lifecycle stage.
  //
  // Deriving this from `hasReached(a.stage, …)` was the original defect: the
  // stage says how far the consignment has travelled, which is not the same
  // question as whether anybody reconciled the OOC against the declaration it
  // discharges. A stage-derived answer cannot see a field mismatch at all, so
  // an OOC that disagrees with its SD would have read as verified purely by
  // having moved far enough down the flow.
  //
  // `oocVerified` / `oocMismatches` are the same helpers FC-06's clearance gate
  // uses (customs.ts), so both gates now answer from one record and cannot
  // disagree about the same AWB.
  const clearance = clearanceFor(awbId);
  const ooc = clearance?.ooc ?? null;
  const oocIssued = !!ooc;
  const verifiedVsSd = !!ooc && oocVerified(ooc);
  const mismatches = ooc ? oocMismatches(ooc) : [];

  return evaluateReleaseGate(awbId, {
    oocIssued,
    oocRef: ooc?.oocNo ?? null,
    oocVerifiedVsSd: verifiedVsSd,
    oocMismatchCount: mismatches.length,
    oocVerifiedAt: ooc?.verifiedAt ?? null,
    oocVerifiedBy: ooc?.verifiedBy ?? null,
    authorityLetterNo: hasReached(a.stage, "do-issued") ? `AL-2026-${String(1440 + awbId)}` : null,
    chargesPaid: inv?.status === "paid",
    outstanding: inv?.outstanding ?? 0,
    onHold: !!hold,
    holdReason: hold?.REMARKS ?? null,
    cargoClassId: a.CARGOCLASSID,
    specialClearanceDone: hasReached(a.stage, "do-issued"),
  });
}

/* ------------------------------------------------------------------ *
 * Dispatch — gate pass & POD
 * ------------------------------------------------------------------ */

export const GATE_PASSES: GatePass[] = AWBS.filter((a) => hasReached(a.stage, "gate-pass")).map(
  (a, i) => {
    const gr = GODOWN_RENTS.find((g) => g.AWBNO === a.AWBNO);
    return {
      ...audit(1, "gate.officer"),
      ...siteKeys(a.site),
      GATEPASSNO: 66100 + i,
      docNumber: {
        series: "GATE_PASS",
        value: `GP-${a.site}-2026-${String(66100 + i)}`,
        sequence: 66100 + i,
        year: 2026,
        cargoClassId: a.CARGOCLASSID,
        continuesFromCmts: 66099,
      },
      GATEPASSDATE: daysAgo(1, 13, 40),
      IGMNO: a.IGMNO,
      IGMNODate: a.CARGODATE,
      AWBNO: a.AWBNO,
      AWBNODate: a.CARGODATE,
      HWBNO: null,
      HWBNODate: null,
      DONo: a.DONO ?? "",
      DoDate: a.DODATE ?? "",
      GRNo: gr?.VOUCHERNO ?? "",
      GRDate: gr?.GRDATE ?? "",
      BDNo: null,
      BDDate: null,
      CASHNO: gr?.CASH ? `CN-${String(4400 + i)}` : null,
      CASHNODate: gr?.CASH ? gr.PAYDATE : null,
      ChallanNo: a.CHALLANNO,
      ARRIVALDATE: a.arrivedAt,
      INDEXNO: a.SEQUENCE,
      PIECES: a.TOTALPCS,
      WEIGHT: a.TOTALWEIGHT,
      CARGOCLASSID: a.CARGOCLASSID,
      CONSIGNEE: a.CONSIGNEE1,
      Agent: a.AGENT1,
      RecivingPerson: "Imran Ali",
      NICNO: "42201-7788990-1",
      CPNO: `CP-${String(3300 + i)}`,
      RcvngPersonPic: `/mock/receiver-${(i % 3) + 1}.jpg`,
      VehicleNo: `KHI-${2000 + i * 7}`,
      ClearingTime: "13:40",
      MarksNumber: `M/${a.AWBNO.slice(-4)}`,
      DeliveryDate: hasReached(a.stage, "delivered") ? daysAgo(1, 15, 0) : null,
      NAMEOFCUSTODIANSHED: `SAPS ${a.site} Import Shed`,
      SerialNo: 66100 + i,
      SerialNoWithYear: `${66100 + i}/2026`,
      DetendIdentification: a.DetendUniqueIdentification,
      site: a.site,
      scanCode: `GP${66100 + i}`,
      status: hasReached(a.stage, "delivered") ? "exited" : hasReached(a.stage, "dispatched") ? "loaded" : "issued",
    } satisfies GatePass;
  },
);

/**
 * Pick sessions — FC-08 §07–09. The RFID amendment is the point: the tag
 * bound at putaway (FC-03) is read again at retrieval, so the piece count
 * verifies itself instead of being typed.
 *
 * Coverage is deliberate — one session comes back short so the
 * "Piece Count Matched?" decision has a No branch to take.
 */
export const PICK_SESSIONS: PickSession[] = GATE_PASSES.map((gp, gi) => {
  const awb = awbByNo(gp.AWBNO)!;
  const pieces = PIECES.filter((p) => p.awbId === awb.AWBId);
  // The second gate pass is short by one piece; everything else reconciles.
  const shortOne = gi === 1 && pieces.length > 1;

  const lines: PickLine[] = pieces.map((p, li) => {
    const isMissing = shortOne && li === pieces.length - 1;
    return {
      id: gi * 100 + li + 1,
      gatePassNo: gp.GATEPASSNO,
      awbId: awb.AWBId,
      pieceId: p.pieceId,
      locationId: p.locationId ?? 0,
      expectedRfid: p.rfidEpc,
      scannedRfid: isMissing ? null : p.rfidEpc,
      outcome: isMissing ? "unavailable" : "retrieved",
      scannedAt: isMissing ? null : daysAgo(1, 8, 20 + li),
      scannedBy: isMissing ? null : "lifter.operator",
      note: isMissing ? "Not at the pick location; rack re-swept, tag not read." : null,
    } satisfies PickLine;
  });

  const scanned = lines.filter((l) => l.outcome === "retrieved").length;
  const countMatched = scanned === pieces.length;

  // FC-08 §09–10: a short pick routes to FC-04, it does not just stop. The
  // fixture asks the domain for the verdict instead of asserting one, so a
  // seeded session cannot claim a clean pick over lines that say otherwise.
  const trigger = pickSessionCdrTrigger({ countMatched, lines });

  return {
    gatePassNo: gp.GATEPASSNO,
    awbId: awb.AWBId,
    startedAt: daysAgo(1, 8, 15),
    completedAt: shortOne ? null : daysAgo(1, 8, 45),
    lines,
    expectedPieces: pieces.length,
    scannedPieces: scanned,
    countMatched,
    cdrRequired: trigger.required,
    cdrReason: trigger.reason,
    // CDRS mints this record further down the file, at sequence 323 against
    // this same AWB — see the dispatch-origin selection there. The number is
    // repeated rather than shared because the CDR pool is built after the pick
    // sessions it reads; if either end moves, both move.
    cdrRef: trigger.required ? `CDR-${awb.site}-2026-00323` : null,
  } satisfies PickSession;
});

/**
 * Gate-out verification — the FC-08 amendment's strongest claim: at exit the
 * tags are matched against the gate pass **and** the FC-07 release
 * conditions are re-evaluated. A release that was valid at issuance can have
 * gone stale by the time the vehicle reaches the gate.
 */
export const GATE_OUT_CHECKS: GateOutCheck[] = GATE_PASSES.map((gp, gi) => {
  const awb = awbByNo(gp.AWBNO)!;
  const session = PICK_SESSIONS.find((s) => s.gatePassNo === gp.GATEPASSNO)!;
  const expected = session.lines.map((l) => l.expectedRfid).filter((x): x is string => !!x);
  const scanned = session.lines
    .filter((l) => l.outcome === "retrieved")
    .map((l) => l.expectedRfid)
    .filter((x): x is string => !!x);

  // The third gate pass had a hold placed after the pass was issued.
  const staleRelease = gi === 2;
  const missing = expected.filter((t) => !scanned.includes(t));

  // The fourth pass is the damage route into FC-04 — every tag present and
  // correct, release still valid, and the cargo still not fit to leave. It sits
  // on its own pass deliberately: on top of the short pick or the stale release
  // it would prove nothing, because the exit was already blocked.
  const damagedPieceIds = gi === 3 ? session.lines.slice(0, 1).map((l) => l.pieceId) : [];
  const damageFound = damagedPieceIds.length > 0;
  const damageNote = damageFound
    ? "Forklift strike to the pallet base found on the loaded vehicle; shrink-wrap torn."
    : null;

  const check = {
    tagsMatched: missing.length === 0,
    extraTags: [] as string[],
    missingTags: missing,
    releaseStillValid: !staleRelease,
    newlyFailedConditions: staleRelease ? ["not-on-hold"] : [],
    damageFound,
    damageNote,
    damagedPieceIds,
  };

  return {
    gatePassNo: gp.GATEPASSNO,
    checkedAt: daysAgo(1, 9, 30),
    checkedBy: "gate.security",
    scannedTags: scanned,
    expectedTags: expected,
    ...check,
    // Composed by the domain helper rather than restated here. The fixture used
    // to carry its own copy of the rule, which is how a blocked exit could show
    // one reason on screen while a second — equally blocking — went unmentioned
    // and sent the vehicle back to the gate twice.
    ...gateOutOutcome(check),
    // Deliberately null on the damaged pass: this is the arm where the finding
    // exists and the CDR does not yet, which is the state the gate actually
    // sits in for the minutes between the inspection and the paperwork.
    // `gateOutOutcome` already blocks the exit over it and says a CDR is
    // required, so nothing leaves on an unraised discrepancy.
    cdrRef: null,
  } satisfies GateOutCheck;
});

export const PODS: ProofOfDelivery[] = AWBS.filter((a) => hasReached(a.stage, "delivered")).map(
  (a, i) => {
    const gp = GATE_PASSES.find((g) => g.AWBNO === a.AWBNO)!;
    const damageAtHandover = i === 1;
    const handoverCdrRef = `CDR-${a.site}-2026-${String(320).padStart(5, "0")}`;
    return {
      id: i + 1,
      awbId: a.AWBId,
      AWBNO: a.AWBNO,
      gatePassNo: gp.GATEPASSNO,
      capturedAt: daysAgo(1, 15, 12),
      capturedBy: "dispatch.officer",
      receiverSignature: "/mock/signature-1.png",
      receiverName: "Imran Ali",
      receiverCnic: "42201-7788990-1",
      cnicMatchesDo: true,
      piecesDelivered: a.TOTALPCS,
      piecesOnDo: a.TOTALPCS,
      photos: ["/mock/pod-1.jpg", "/mock/pod-2.jpg"],
      timestamp: daysAgo(1, 15, 12),
      geo: { lat: 24.9065, lng: 67.1608, accuracyM: 8 },
      // The second handover is the one that went wrong at the tailgate. It is
      // kept complete rather than left open because the CDR exists — that is
      // the whole shape of the rule in `podComplete`: damage does not stop a
      // POD closing, an unrecorded discrepancy does. A fixture that carried the
      // damage without the CDR would only ever exercise the failing branch.
      damageAtHandover: damageAtHandover,
      damageNote: damageAtHandover
        ? "Two cartons scuffed and one corner crushed; noted by the receiver before signing."
        : null,
      cdrRef: damageAtHandover ? handoverCdrRef : null,
      complete: true,
      partial: false,
      dlvSentAt: daysAgo(1, 15, 14),
      site: a.site,
    } satisfies ProofOfDelivery;
  },
);

/* ------------------------------------------------------------------ *
 * Exceptions
 * ------------------------------------------------------------------ */

export const HOLDS: HoldRecord[] = AWBS.filter((a) => a.HOLDINGSTATUS).map((a, i) => ({
  ...audit(3, "customs.liaison"),
  ...siteKeys(a.site),
  SEQUENCE: i + 1,
  AWBNo: a.AWBNO,
  IGMNO: a.IGMNO,
  HWBNo: null,
  CARGOCLASSID: a.CARGOCLASSID,
  STATUS: "HELD",
  type: "customs",
  HeldBy: "Pakistan Customs",
  NameOfPerson: "A. Malik",
  NIC: "61101-2233445-9",
  HoldingCompany: "Model Customs Collectorate",
  Designation: "Appraising Officer",
  Date: daysAgo(3, 11, 0),
  REMARKS: "DGR documentation query — NOTOC and shipper declaration under review",
  Release: false,
  ReleasePersonName: null,
  ReleaseCompany: null,
  ReleaseBy: null,
  ReleasePersonDesignation: null,
  ReleasePersonNic: null,
  ReleaseRemarks: null,
  ReleaseDateTime: null,
  site: a.site,
}));

// One released hold so the register shows both sides of the workflow.
HOLDS.push({
  ...audit(20, "customs.liaison"),
  ...siteKeys("KHI"),
  SEQUENCE: 99,
  AWBNo: AWBS[1].AWBNO,
  IGMNO: AWBS[1].IGMNO,
  HWBNo: null,
  CARGOCLASSID: AWBS[1].CARGOCLASSID,
  STATUS: "RELEASED",
  type: "discrepancy",
  HeldBy: "SAPS Operations",
  NameOfPerson: "S. Khan",
  NIC: "42101-1122334-5",
  HoldingCompany: "Shaheen Airport Services",
  Designation: "Duty Manager",
  Date: daysAgo(20, 9, 30),
  REMARKS: "Piece count variance pending reconciliation",
  Release: true,
  ReleasePersonName: "F. Qureshi",
  ReleaseCompany: "Shaheen Airport Services",
  ReleaseBy: "f.qureshi",
  ReleasePersonDesignation: "Operations Supervisor",
  ReleasePersonNic: "42101-9988776-3",
  ReleaseRemarks: "Count reconciled against FFM; variance resolved without CDR.",
  ReleaseDateTime: daysAgo(18, 14, 15),
  site: "KHI",
});

/* ------------------------------------------------------------------ *
 * CDR register — FC-04
 *
 * Previously a single hand-authored row. That was enough to render the
 * workbench but not to exercise it: the screen offers nine discrepancy
 * types and five final actions, and one CDR stuck at `awaiting-instruction`
 * demonstrated 1 of 9 and 0 of 5. A flow that looks built and covers one
 * node is worse than a visible gap.
 *
 * Now one CDR per discrepancy type, positioned at different points in the
 * flow so every branch has data behind it:
 *   • all 9 §02 types
 *   • all 5 §11 final actions (F1 wrong-weight, F2 overage, F3 misrouted,
 *     F4 damage, F5 pilferage)
 *   • the §10 escalation loop at 0, 1 and 2 rounds
 *   • one deliberately thin evidence pack (missing-documents) so the §12
 *     closure gate has something to refuse
 *
 * COMPROMISE, recorded rather than hidden: only one AWB carries
 * `branch === "cdr"`, so the other eight CDRs are attached to AWBs that
 * have an intake variance but are not flagged onto the CDR branch. The
 * alternative was nine near-identical rows on one AWB, which would not
 * exercise site scoping. Worth reconciling when the branch flags are
 * revisited.
 * ------------------------------------------------------------------ */

const CDR_AWB = AWBS.find((a) => a.branch === "cdr")!;

const CDR_SEED: Array<{
  type: DiscrepancyType;
  /**
   * Which decision raised it. Stated per row rather than inferred from `type`
   * or `auto`, because the inference does not exist: intake and picking both
   * raise `shortage`, and a damage CDR can come off the gate-out inspection or
   * off the receiver's signature. Guessing here is how the workbench would end
   * up filtering "raised at picking" and returning intake rows.
   */
  origin: CdrOrigin;
  status: CdrStatus;
  auto: boolean;
  /** §08 dispatch rounds; index 0 is the original send. */
  rounds: number;
  instructionOnRound: number | null;
  finalAction: CdrFinalAction | null;
  closed: boolean;
  customsNotified: boolean;
  /** Which of the six evidence kinds this pack captured. */
  evidence: EvidenceKind[];
  detail: string;
}> = [
  { type: "shortage", origin: "intake-variance", status: "awaiting-instruction", auto: true, rounds: 3, instructionOnRound: null, finalAction: null, closed: false, customsNotified: false,
    evidence: ["photo", "piece-count", "weight", "seal-condition", "package-condition", "remarks"],
    detail: "17 pieces received against 20 declared; shortage consistent with the FFM count." },
  { type: "overage", origin: "intake-variance", status: "closed", auto: true, rounds: 1, instructionOnRound: 1, finalAction: "F2-adjust-pieces-weight", closed: true, customsNotified: true,
    evidence: ["photo", "piece-count", "weight", "remarks"],
    detail: "2 pieces over manifest; airline confirmed a mis-split at origin." },
  { type: "damage", origin: "handover-damage", status: "action-selected", auto: false, rounds: 2, instructionOnRound: 2, finalAction: "F4-re-export", closed: false, customsNotified: true,
    evidence: ["photo", "package-condition", "weight", "piece-count", "remarks"],
    detail: "Water ingress through the outer carton; consignee refused acceptance." },
  { type: "leakage-wet", origin: "intake-variance", status: "on-hold", auto: false, rounds: 2, instructionOnRound: null, finalAction: null, closed: false, customsNotified: true,
    evidence: ["photo", "package-condition", "weight", "remarks"],
    detail: "Drum seepage detected in the bonded aisle; pallet isolated." },
  { type: "tampering", origin: "intake-variance", status: "notified", auto: false, rounds: 1, instructionOnRound: null, finalAction: null, closed: false, customsNotified: true,
    evidence: ["photo", "seal-condition", "piece-count", "remarks"],
    detail: "ULD seal number does not match the FFM; seal cut and re-applied." },
  { type: "pilferage", origin: "picking-count", status: "closed", auto: false, rounds: 2, instructionOnRound: 2, finalAction: "F5-claim-liability", closed: true, customsNotified: true,
    evidence: ["photo", "piece-count", "weight", "package-condition", "seal-condition", "remarks"],
    detail: "Carton opened and re-taped; 4 units missing against the packing list." },
  // Deliberately thin — two kinds, nothing measured. This is the CMTS
  // remarks-only pattern the FC-04 amendment exists to replace, so the
  // closure gate must refuse it.
  { type: "missing-documents", origin: "intake-variance", status: "evidence", auto: false, rounds: 0, instructionOnRound: null, finalAction: null, closed: false, customsNotified: false,
    evidence: ["photo", "remarks"],
    detail: "Shipper's invoice and fumigation certificate absent from the pouch." },
  { type: "wrong-weight", origin: "intake-variance", status: "closed", auto: true, rounds: 1, instructionOnRound: 1, finalAction: "F1-release-after-correction", closed: true, customsNotified: false,
    evidence: ["weight", "piece-count", "photo", "remarks"],
    detail: "Scale reads 132 kg over the declared gross; re-weighed and corrected." },
  { type: "misrouted", origin: "intake-variance", status: "action-selected", auto: false, rounds: 2, instructionOnRound: 2, finalAction: "F3-forward-mishandled", closed: false, customsNotified: true,
    evidence: ["photo", "piece-count", "remarks", "package-condition"],
    detail: "Offloaded at KHI against an LHE routing; onward carriage required." },
];

export const CDRS: CDR[] = (() => {
  // The cdr-branch AWB first, then other AWBs carrying an intake variance.
  const pool = [CDR_AWB, ...AWBS.filter((a) => a.intakeVariance && a.AWBId !== CDR_AWB.AWBId)];

  // A dispatch-origin CDR is attached to the AWB that actually holds the record
  // it disputes, rather than taking the next one off the variance pool. The
  // pool is assembled from AWBs with an intake variance, and most of those were
  // never picked or delivered — a picking CDR against cargo that was never
  // picked leaves `sourceRef` null, which is the exact state the pointer was
  // added to make impossible, and leaves the workbench with nothing to open.
  const pickCdrSession = PICK_SESSIONS.find((s) => s.cdrRequired) ?? null;
  const damagedPod = PODS.find((p) => p.damageAtHandover) ?? null;

  return CDR_SEED.map((seed, i) => {
    const dispatchAwb =
      seed.origin === "handover-damage"
        ? (damagedPod ? (awbById(damagedPod.awbId) ?? null) : null)
        : seed.origin === "intake-variance"
          ? null
          : (pickCdrSession ? (awbById(pickCdrSession.awbId) ?? null) : null);

    const awb = dispatchAwb ?? pool[i % pool.length];
    const raisedDaysAgo = 6 - Math.floor(i / 2);
    const seq = 318 + i;
    const ref = `CDR-${awb.site}-2026-${String(seq).padStart(5, "0")}`;
    const rng = seeded((i + 1) * 9311);

    const dispatches: CdrDispatch[] = Array.from({ length: seed.rounds }, (_, r) => {
      const round = r + 1;
      const gotInstruction = seed.instructionOnRound === round;
      return {
        round,
        disMessageRef: `DIS-${awb.site}-${String(74100 + i * 10 + r)}`,
        sentAt: daysAgo(raisedDaysAgo - r, 11 + r, 6 + r * 4),
        sentTo:
          round === 1
            ? `${awb.ABBREVATION} station representative`
            : round === 2
              ? `${awb.ABBREVATION} regional cargo manager`
              : `${awb.ABBREVATION} head office — cargo claims`,
        escalationReason:
          round === 1
            ? null
            : `No instruction within ${round === 2 ? 24 : 48}h of the previous DIS — escalated a level.`,
        instructionReceivedAt: gotInstruction ? daysAgo(raisedDaysAgo - r, 15, 20) : null,
        instructionText: gotInstruction
          ? seed.finalAction === "F1-release-after-correction"
            ? "Correct the weight against the scale ticket and release."
            : seed.finalAction === "F2-adjust-pieces-weight"
              ? "Adjust the manifest to the received count and proceed."
              : seed.finalAction === "F3-forward-mishandled"
                ? "Forward to LHE on the next available service; raise a corrective AWB."
                : seed.finalAction === "F4-re-export"
                  ? "Consignee has refused; return to origin under a re-export SD."
                  : "Hold pending the claims assessor; do not release."
          : null,
      };
    });

    const evidence: EvidenceItem[] = seed.evidence.map((kind, e) => ({
      id: e + 1,
      kind,
      value:
        kind === "piece-count"
          ? `${awb.TOTALPCS - intBetween(rng, 1, 3)} received against ${awb.TOTALPCS} declared`
          : kind === "weight"
            ? `${round2(awb.TOTALWEIGHT * 0.94)} kg received against ${round2(awb.TOTALWEIGHT)} kg declared`
            : kind === "photo"
              ? `${intBetween(rng, 2, 5)} angles, geo-tagged at the discrepancy bay`
              : kind === "seal-condition"
                ? i === 4 ? "Seal cut and re-applied — number mismatch" : "ULD seal intact on arrival"
                : kind === "package-condition"
                  ? `${intBetween(rng, 1, 4)} cartons affected, contents inspected`
                  : seed.detail,
      documentId: kind === "photo" ? `DOC-CDR-${seq}-0${e + 1}` : null,
      linkedAwbNo: awb.AWBNO,
      linkedRfid: kind === "photo" ? `E2003415020010801890${54 + i}C1` : null,
      capturedAt: daysAgo(raisedDaysAgo, 10, 30 + e * 2),
      capturedBy: e >= seed.evidence.length - 1 ? "s.khan" : "i.ali",
    }));

    const hold =
      STORAGE_LOCATIONS.find((l) => l.site === awb.site && l.CLASSID === 17) ??
      STORAGE_LOCATIONS.find((l) => l.CLASSID === 17) ??
      null;

    // An intake CDR's subject is the AWB itself, so it has nothing further to
    // point at. The three dispatch routes each dispute a specific record — the
    // gate pass that was picked against, the piece that was not on the rack,
    // the POD the receiver signed — and without that pointer the workbench can
    // only offer the AWB, which is the one screen that does not show what went
    // wrong. Resolved from the AWB's own dispatch records so the reference
    // cannot name a gate pass that belongs to different cargo.
    const pickSession = PICK_SESSIONS.find((s) => s.awbId === awb.AWBId);
    const pod = PODS.find((p) => p.awbId === awb.AWBId);
    const missingPieceId =
      pickSession?.lines.find((l) => l.outcome === "unavailable")?.pieceId ?? null;

    // The two picking routes are not interchangeable, and the session already
    // decided which one it is — `pickSessionCdrTrigger` ran over its own lines.
    // Reading that decision through PICK_CDR_ORIGIN rather than trusting the
    // seed's guess keeps the CDR's origin and the session's reason from
    // disagreeing about the same event.
    const origin: CdrOrigin =
      seed.origin === "intake-variance" || seed.origin === "handover-damage"
        ? seed.origin
        : pickSession?.cdrReason
          ? PICK_CDR_ORIGIN[pickSession.cdrReason]
          : "intake-variance";

    const sourceRef: CdrSourceRef | null =
      origin === "intake-variance"
        ? null
        : origin === "handover-damage"
          ? pod
            ? { gatePassNo: pod.gatePassNo, podId: pod.id }
            : null
          : pickSession
            ? {
                gatePassNo: pickSession.gatePassNo,
                ...(missingPieceId ? { pieceId: missingPieceId } : {}),
              }
            : null;

    return {
      ...audit(raisedDaysAgo, "warehouse.supervisor"),
      ...siteKeys(awb.site),
      id: i + 1,
      cdrRef: ref,
      docNumber: {
        series: "CDR",
        value: ref,
        sequence: seq,
        year: 2026,
        cargoClassId: awb.CARGOCLASSID,
        continuesFromCmts: 317,
      },
      awbId: awb.AWBId,
      IGMNO: awb.IGMNO,
      AWBNO: awb.AWBNO,
      HWBNO: null,
      type: seed.type,
      autoRaised: seed.auto,
      origin,
      sourceRef,
      variance: seed.auto ? (awb.intakeVariance?.pieces ?? null) : null,
      raisedAt: daysAgo(raisedDaysAgo, 10, 22),
      raisedBy: seed.auto ? "system (variance \u2265 tolerance)" : "i.ali",
      status: seed.status,
      evidence,
      airlineNotifiedAt: seed.rounds > 0 ? daysAgo(raisedDaysAgo, 11, 5) : null,
      customsNotifiedAt: seed.customsNotified ? daysAgo(raisedDaysAgo, 11, 40) : null,
      dispatches,
      holdLocationId: hold?.ID ?? null,
      finalAction: seed.finalAction,
      closedAt: seed.closed ? daysAgo(Math.max(0, raisedDaysAgo - 3), 16, 10) : null,
      site: awb.site,
    } satisfies CDR;
  });
})();

/* ------------------------------------------------------------------ *
 * Damage register — CMTS `DamageDetail` (8 cols)
 *
 * Two sources, deliberately:
 *   • rows derived from AWB_DETAILS where the intake recorded DAMAGEPCS,
 *     so the register and the AWB detail line can never disagree;
 *   • three hand-authored cases so the register exercises damage types
 *     that the CDR branch alone would never produce (wet, leakage,
 *     temperature excursion) and spans more than one site.
 * ------------------------------------------------------------------ */

export const DAMAGE_DETAILS: DamageDetail[] = (() => {
  const out: DamageDetail[] = [];
  let id = 1;

  // (a) derived — keeps DamageDetail consistent with AWBDetail
  for (const d of AWB_DETAILS) {
    if (d.DAMAGEPCS <= 0) continue;
    out.push({
      DamageId: id++,
      AWBId: d.AWBId,
      HWBId: null,
      TypeofPack: d.TYPEOFPACK ?? "Carton",
      TypeofDamage: d.TYPEOFDAM ?? "Crushed",
      DamagedPcs: d.DAMAGEPCS,
      DamageWeight: d.DAMAGEWEIGHT,
      Remarks: d.DEMAGEDETAIL,
      cdrRef: CDRS.find((c) => c.awbId === d.AWBId)?.cdrRef ?? null,
      photos: ["DOC-CDR-318-01"],
    });
  }

  // (b) hand-authored — damage types the CDR branch alone never yields
  const extras: Array<[LifecycleStage[], string, string, number, string, string[]]> = [
    [
      ["stored", "customs", "charged"],
      "Drum",
      "Leaking",
      2,
      "Two drums seeping at the seam; contents contained in absorbent tray, area cordoned.",
      ["DOC-DMG-0442-01", "DOC-DMG-0442-02"],
    ],
    [
      ["stored", "customs"],
      "Carton",
      "Wet",
      4,
      "Water staining on lower tier, consistent with ramp exposure before acceptance.",
      ["DOC-DMG-0451-01"],
    ],
    [
      ["stored", "charged", "do-issued"],
      "Pallet",
      "Temperature excursion",
      1,
      "Reefer logger shows 62 minutes above +8 °C in transit; pharma integrity referred to shipper.",
      ["DOC-DMG-0463-01"],
    ],
  ];

  for (const [stages, pack, dmgType, pcs, remarks, photos] of extras) {
    const candidate = AWBS.find(
      (a) =>
        stages.includes(a.stage) &&
        a.branch === null &&
        !out.some((o) => o.AWBId === a.AWBId),
    );
    if (!candidate) continue;
    out.push({
      DamageId: id++,
      AWBId: candidate.AWBId,
      HWBId: null,
      TypeofPack: pack,
      TypeofDamage: dmgType,
      DamagedPcs: pcs,
      DamageWeight: round2(
        (candidate.TOTALWEIGHT / Math.max(1, candidate.TOTALPCS)) * pcs,
      ),
      Remarks: remarks,
      // Not every damage finding becomes a CDR — FC-04 §01 only escalates
      // when the discrepancy is material. These sit unescalated on purpose.
      cdrRef: null,
      photos,
    });
  }

  return out;
})();

export function damageFor(awbId: number): DamageDetail[] {
  return DAMAGE_DETAILS.filter((d) => d.AWBId === awbId);
}

const MIS_AWB = AWBS.find((a) => a.branch === "mishandled")!;

export const MISHANDLED_CASES: MishandledCase[] = [
  {
    ...audit(7, "ops.supervisor"),
    ...siteKeys(MIS_AWB.site),
    id: 1,
    awbId: MIS_AWB.AWBId,
    AWBNO: MIS_AWB.AWBNO,
    IGMNO: MIS_AWB.IGMNO,
    stage: "A5-instruction-received",
    cdrRef: "CDR-LHE-2026-00121",
    identifiedAt: daysAgo(7, 8, 50),
    holdLocationId: STORAGE_LOCATIONS.find((l) => l.site === MIS_AWB.site && l.CLASSID === 18)!.ID,
    airlineNotifiedAt: daysAgo(7, 9, 30),
    instructionRef: "TK-RCV-2026-0442",
    instructionAt: daysAgo(5, 16, 10),
    instructionText: "Forward to KHI under original AWB; no corrective AWB required.",
    recoveryAction: null,
    correctiveAwbNo: null,
    endorsementRef: null,
    onwardRouting: null,
    reTenderedAt: null,
    reTenderCarrier: null,
    closedAt: null,
    ageDays: 7,
    site: MIS_AWB.site,
  },
];

const REX_AWB = AWBS.find((a) => a.branch === "re-export")!;

export const REEXPORT_CASES: ReExportCase[] = [
  {
    ...audit(22, "cha.skybridge"),
    ...siteKeys(REX_AWB.site),
    id: 1,
    awbId: REX_AWB.AWBId,
    AWBNO: REX_AWB.AWBNO,
    IGMNO: REX_AWB.IGMNO,
    stage: "B6-charges-settled",
    cause: "customs-rejected",
    raisedAt: daysAgo(18, 10, 0),
    holdLocationId: STORAGE_LOCATIONS.find((l) => l.site === REX_AWB.site && l.CLASSID === 19)!.ID,
    sdRef: "PSW-SD-2026-8841207",
    sdLodgedAt: daysAgo(12, 11, 20),
    permissionRef: "MCC-REX-2026-0338",
    permissionGrantedAt: daysAgo(6, 15, 45),
    outstandingCharges: 0,
    chargesSettledAt: daysAgo(2, 12, 30),
    reTenderedAt: null,
    exportAwbNo: null,
    closedAt: null,
    ageDays: 22,
    site: REX_AWB.site,
  },
];

const LS_AWB = AWBS.find((a) => a.branch === "long-stay")!;

/**
 * `AWBSECTION82.CONTENTS` is varchar(250) — one free-text description of the
 * whole lot, not one row per line. Joining the detail lines' goods (deduped)
 * is what an officer actually writes on the notice: the statutory notice has
 * to describe everything the case covers, and a consignment of two different
 * commodities named after only the first one is not a lawful description.
 */
const LS_CONTENTS = [...new Set(detailsFor(LS_AWB.AWBId).map((d) => d.GOODS))]
  .join(", ")
  .slice(0, 250) || "General cargo";

export const LONGSTAY_CASES: LongStayCase[] = [
  {
    ...audit(47, "compliance.officer"),
    ...siteKeys(LS_AWB.site),
    id: 1,
    awbId: LS_AWB.AWBId,
    AWBNO: LS_AWB.AWBNO,
    IGMNO: LS_AWB.IGMNO,
    HWBNo: null,
    stage: "C4-escalated-customs",
    arrivedAt: LS_AWB.arrivedAt,
    section82Days: SECTION_82_DAYS,
    ageDays: 47,
    daysToDeadline: SECTION_82_DAYS - 47,
    notices: [
      { id: 1, noticeNo: "S82-KHI-2026-0091", docNumber: { series: "SECTION_82_NOTICE", value: "S82-KHI-2026-0091", sequence: 91, year: 2026, cargoClassId: null, continuesFromCmts: 90 }, dueOffsetDays: 14, dueAt: daysAgo(31, 9, 0), recipients: ["consignee", "cha"], sentAt: daysAgo(31, 9, 5), status: "sent" },
      { id: 2, noticeNo: "S82-KHI-2026-0104", docNumber: { series: "SECTION_82_NOTICE", value: "S82-KHI-2026-0104", sequence: 104, year: 2026, cargoClassId: null, continuesFromCmts: 90 }, dueOffsetDays: 7, dueAt: daysAgo(24, 9, 0), recipients: ["consignee", "cha", "airline"], sentAt: daysAgo(24, 9, 8), status: "sent" },
      { id: 3, noticeNo: "S82-KHI-2026-0118", docNumber: { series: "SECTION_82_NOTICE", value: "S82-KHI-2026-0118", sequence: 118, year: 2026, cargoClassId: null, continuesFromCmts: 90 }, dueOffsetDays: 0, dueAt: daysAgo(17, 9, 0), recipients: ["consignee", "cha", "airline"], sentAt: null, status: "overdue" },
    ],
    escalatedToCustomsAt: daysAgo(15, 11, 0),

    // The consignment descriptors carried ON the Section 82 case, read off
    // AWBSECTION82 rather than derived from the AWB. They agree with the AWB
    // here because this case covers the whole consignment and nothing has been
    // released against it — but a screen must still read these columns, not
    // `AWB.TOTALPCS`. The moment a consignment is partly delivered or partly
    // seized, the AWB total overstates what the auction lot or the disposal
    // certificate actually covers, and the statutory paperwork has to quote
    // the smaller number. CARGODATE is the migrated legacy cargo date and is
    // NOT a second dwell clock: `arrivedAt` remains the only input to
    // `ageDays` / `daysToDeadline`, so no screen can quote a rival deadline.
    CARGODATE: LS_AWB.CARGODATE,
    CONTENTS: LS_CONTENTS,
    PCS: LS_AWB.TOTALPCS,

    Examiner: "A. Malik",
    ReceivingPerson: null,
    DCNumber: "DC-2026-00744",
    Sequences: String(LS_AWB.SEQUENCE),
    SubIndex: null,
    Lock: false,
    disposition: null,
    auctionLotNo: null,
    auctionReserve: null,
    auctionDate: null,
    auctionProceeds: null,
    disposalMethod: null,
    disposalAuthorisedBy: null,
    disposalCertificateNo: null,
    closedAt: null,
    site: LS_AWB.site,
  },
];

/**
 * FC-10 amendment — "an aging dashboard surfaces the exception queue"
 * across every hold state, not just long-stay.
 */
export const EXCEPTION_QUEUE: ExceptionQueueRow[] = [
  ...CDRS.map((c) => ({
    kind: "cdr" as const,
    ref: c.cdrRef,
    awbId: c.awbId,
    AWBNO: c.AWBNO,
    summary: `${c.type} — ${c.status}`,
    ageDays: daysBetween(c.raisedAt, DEMO_NOW),
    thresholdDays: EXCEPTION_THRESHOLD_DAYS.cdr,
    overThreshold: daysBetween(c.raisedAt, DEMO_NOW) > EXCEPTION_THRESHOLD_DAYS.cdr,
    locationId: c.holdLocationId,
    site: c.site,
    href: `/awb/${c.awbId}?tab=exceptions`,
  })),
  ...HOLDS.filter((h) => !h.Release).map((h) => ({
    kind: "hold" as const,
    ref: `HOLD-${h.SEQUENCE}`,
    awbId: awbByNo(h.AWBNo)?.AWBId ?? 0,
    AWBNO: h.AWBNo,
    summary: `${h.type} hold — ${h.HeldBy}`,
    ageDays: daysBetween(h.Date, DEMO_NOW),
    thresholdDays: EXCEPTION_THRESHOLD_DAYS.hold,
    overThreshold: daysBetween(h.Date, DEMO_NOW) > EXCEPTION_THRESHOLD_DAYS.hold,
    locationId: null,
    site: h.site,
    href: `/exceptions/holds`,
  })),
  ...MISHANDLED_CASES.map((m) => ({
    kind: "mishandled" as const,
    ref: `MSH-${m.id}`,
    awbId: m.awbId,
    AWBNO: m.AWBNO,
    summary: m.stage,
    ageDays: m.ageDays,
    thresholdDays: EXCEPTION_THRESHOLD_DAYS.mishandled,
    overThreshold: m.ageDays > EXCEPTION_THRESHOLD_DAYS.mishandled,
    locationId: m.holdLocationId,
    site: m.site,
    href: `/exceptions/mishandled`,
  })),
  ...REEXPORT_CASES.map((r) => ({
    kind: "re-export" as const,
    ref: `REX-${r.id}`,
    awbId: r.awbId,
    AWBNO: r.AWBNO,
    summary: r.stage,
    ageDays: r.ageDays,
    thresholdDays: EXCEPTION_THRESHOLD_DAYS["re-export"],
    overThreshold: r.ageDays > EXCEPTION_THRESHOLD_DAYS["re-export"],
    locationId: r.holdLocationId,
    site: r.site,
    href: `/exceptions/re-export`,
  })),
  ...LONGSTAY_CASES.map((l) => ({
    kind: "long-stay" as const,
    ref: `S82-${l.id}`,
    awbId: l.awbId,
    AWBNO: l.AWBNO,
    summary: `${l.stage} — ${Math.abs(l.daysToDeadline)}d past statutory deadline`,
    ageDays: l.ageDays,
    thresholdDays: l.section82Days,
    overThreshold: l.ageDays > l.section82Days,
    locationId: null,
    site: l.site,
    href: `/exceptions/long-stay`,
  })),
  ...DETENDS.filter((d) => !d.releasedAt).map((d) => ({
    kind: "detend" as const,
    ref: d.UniqueIdentification,
    awbId: d.AwbId,
    AWBNO: awbById(d.AwbId)?.AWBNO ?? "",
    summary: d.reason,
    ageDays: daysBetween(d.detainedAt, DEMO_NOW),
    thresholdDays: EXCEPTION_THRESHOLD_DAYS.detend,
    overThreshold: daysBetween(d.detainedAt, DEMO_NOW) > EXCEPTION_THRESHOLD_DAYS.detend,
    locationId: d.locationId,
    site: awbById(d.AwbId)?.site ?? "KHI",
    href: `/awb/${d.AwbId}?tab=customs`,
  })),
].sort((a, b) => b.ageDays - a.ageDays);

/**
 * AWB closure — FC-08 §17–20. The last gate in the whole system.
 *
 * CMTS has `Lock`, which flips a record read-only, but nothing that says
 * *why* it was safe to flip. The checklist is that reason, and it is
 * evaluated rather than asserted: an AWB with an open CDR or a live hold
 * cannot close, no matter that the cargo physically left.
 *
 * `Lock` propagates — to houses, splits, detends, the DO and the gate pass.
 * Closing a parent while a detained sub-identity is still open would strand
 * that portion with no way to bill or release it.
 */
export const CLOSURES: ClosureState[] = AWBS.filter((a) => hasReached(a.stage, "delivered")).map(
  (a) => {
    const pod = PODS.find((p) => p.awbId === a.AWBId) ?? null;
    const invoice = INVOICES.find((i) => i.awbId === a.AWBId) ?? null;
    const openCdr = CDRS.some((c) => c.awbId === a.AWBId && c.status !== "closed");
    const liveHold = HOLDS.some((h) => h.AWBNo === a.AWBNO && !h.Release);
    const closed = a.stage === "closed";

    const items: ClosureChecklistItem[] = [
      {
        code: "delivered",
        label: "Cargo delivered",
        pass: a.DELIVERED,
        detail: a.DELIVERED ? "Physical delivery recorded" : "Not yet delivered",
        href: "/dispatch/gate-out",
      },
      {
        code: "pod",
        label: "Proof of delivery complete",
        pass: !!pod && pod.complete,
        detail: !pod
          ? "No POD captured"
          : pod.complete
            ? `Captured ${formatDate(pod.capturedAt)} by ${pod.capturedBy}`
            : "POD captured but incomplete — missing evidence",
        // POD has no route of its own; it is the second tab of the gate-out
        // screen, because a POD is only ever captured against a gate pass
        // that has already been let out. Pointing this item at a standalone
        // /dispatch/pod would 404 — the tab is the surface.
        href: "/dispatch/gate-out",
      },
      {
        code: "charges",
        label: "Finance reconciled",
        pass: !!invoice && invoice.outstanding === 0,
        detail: !invoice
          ? "No invoice raised"
          : invoice.outstanding === 0
            ? `${invoice.invoiceNo} settled in full`
            : `${invoice.invoiceNo} outstanding`,
        href: "/billing/invoice",
      },
      {
        code: "no-open-cdr",
        label: "No open discrepancy",
        pass: !openCdr,
        detail: openCdr ? "A CDR is still open against this AWB" : "No open CDR",
        href: "/exceptions/cdr",
      },
      {
        code: "no-hold",
        label: "No live hold",
        pass: !liveHold,
        detail: liveHold ? "A hold is still live" : "No live hold",
        href: "/exceptions/holds",
      },
      {
        code: "archived",
        label: "Archive bundle generated",
        pass: closed,
        detail: closed
          ? "Documents, messages and audit trail bundled"
          : "Archive is generated at closure",
        href: null,
      },
    ];

    const canClose = items.filter((i) => i.code !== "archived").every((i) => i.pass);

    return {
      awbId: a.AWBId,
      items,
      canClose,
      closedAt: closed ? daysAgo(1, 17, 0) : null,
      closedBy: closed ? "ops.supervisor" : null,
      locked: a.Lock,
      archiveBundleId: closed ? `ARCH-${a.site}-2026-${String(3300 + a.AWBId)}` : null,
    } satisfies ClosureState;
  },
);

export function closureFor(awbId: number): ClosureState | null {
  return CLOSURES.find((c) => c.awbId === awbId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Export cargo (FC-11)
 *
 * Greenfield: only CARGOACCEPTANCE / ACCEPTENCEDETAIL / ExportGodownrent
 * exist in CMTS, so most of this is a proposal rather than a transcription.
 *
 * Five consignments. The first three each block the **ramp gate** a
 * different way; the last two exist because nothing in the original three
 * reaches E12 or E13, so the uplift decision and the closure gate had no
 * data to discriminate on:
 *   1. clean — screened, sealed, declaration cleared, build matches the PFM
 *   2. a **broken seal** at a custody handover → re-screen, and a customs
 *      **correction loop** (held → corrected → cleared on round 2)
 *   3. a **PFM mismatch** — one AWB built onto the wrong ULD → Discrepancy Note
 *   4. **special cargo (PER)** through the 08a handling branch, run all the
 *      way to E13 closed — the only row that exercises the closure gate
 *   5. **offloaded for payload** at E12 — the flow's No edge back to
 *      warehousing, which is the edge most easily left unmodelled
 * ------------------------------------------------------------------ */

const EXPORT_SEED = [
  // `houses` drives CARGOACCEPTANCEHWB. CMTS writes those rows only for a
  // consolidation, so 0 is a straight master and the empty array that results
  // means "not a consolidation" — it is an answer, not missing data.
  { awb: "618-44120935", dest: "DXB", carrier: "EK", goods: "Surgical instruments", pcs: 84, kg: 1240, houses: 0 },
  { awb: "618-44120946", dest: "LHR", carrier: "BA", goods: "Cotton garments", pcs: 210, kg: 3180, houses: 3 },
  { awb: "618-44120957", dest: "JFK", carrier: "QR", goods: "Sports goods", pcs: 156, kg: 2440, houses: 2 },
  { awb: "618-44120968", dest: "AMS", carrier: "KL", goods: "Chilled seafood", pcs: 64, kg: 980, houses: 0 },
  { awb: "618-44120979", dest: "IST", carrier: "TK", goods: "Machinery parts", pcs: 122, kg: 4260, houses: 0 },
];

export const EXPORT_CONSIGNMENTS: ExportConsignment[] = EXPORT_SEED.map((seed, i) => {
  const rng = seeded((i + 1) * 6737);
  const site: SiteCode = i === 1 ? "LHE" : "KHI";
  const brokenSeal = i === 1;
  const pfmMismatch = i === 2;
  const specialCargo = i === 3;
  const fullyClosed = i === 3;
  const offloaded = i === 4;
  // Explicit rather than `3 - i`, which went negative once the seed grew
  // past three rows and would have dated acceptance into the future.
  const acceptedDaysAgo = [3, 2, 1, 6, 4][i];

  const declaredKg = seed.kg;
  const grossKg = round2(declaredKg + 480 + intBetween(rng, 10, 40));
  const tareKg = 480;
  const palletKg = 120;
  const lashingKg = 18;
  const netKg = round2(grossKg - tareKg);
  const varianceKg = round2(netKg - declaredKg);

  const cargoId = `${site}${String(7100 + i).padStart(10, "0")}`;

  // Counter clock. TIMEOFWEIGHMENT / TIMEOFACCEPTENCE are CMTS varchar(5)
  // with no date attached, so nothing in the type can enforce "accepted at or
  // after weighed" — only the seeding can. Acceptance is therefore DERIVED
  // from weighment by a positive offset instead of drawn independently, and
  // the same two readings feed `weighedAt` and `CARGODATE` so the timestamp
  // and the text column can never disagree about the same consignment.
  //
  // Its own generator, not the row's `rng`: drawing these from `rng` would
  // have shifted every downstream `pick()` on the record — agent, shipper,
  // consignee — and quietly rewritten data that has nothing to do with the
  // clock. The window is also kept inside the morning (latest 09:15) because
  // screening is stamped at 10:05 and acceptance cannot follow it.
  const clockRng = seeded((i + 1) * 9187);
  const weighHour = 7 + intBetween(clockRng, 0, 1);
  const weighMin = intBetween(clockRng, 0, 40);
  const acceptMinutes = weighHour * 60 + weighMin + intBetween(clockRng, 10, 35);
  const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const acceptHour = Math.floor(acceptMinutes / 60);
  const acceptMin = acceptMinutes % 60;

  const acceptance: CargoAcceptance = {
    CARGODATE: daysAgo(acceptedDaysAgo, acceptHour, acceptMin),
    // varchar(13), station prefix + zero-padded counter — the reference the
    // operator reads off the consignment, not a generated key. Seeded in the
    // shape that breaks under a parse to int (leading zeros, alpha prefix) so
    // any future retype back to `number` fails loudly in the fixtures instead
    // of quietly on a screen.
    CARGOID: cargoId,
    REVENUECODE: `RC-${420 + i}`,
    CARGOGROUP: "GENERAL",
    CARGOTYPE: "EXPORT",
    PAYMENT: i === 0 ? "PP" : "CC",
    AWBCODE: seed.awb,
    BAGNO: null,
    LOADEDWEIGHT: grossKg,
    UNLOADEDWEIGHT: tareKg,
    TIMEOFWEIGHMENT: hhmm(weighHour, weighMin),
    TIMEOFACCEPTENCE: hhmm(acceptHour, acceptMin),
    VEHICALNO: `${site}-${String(4420 + i)}`,
    AGENTNAME: pick(rng, ["Al-Huda Clearing", "Pak Gulf CHA", "Swift Clear Agency"]),
    CARGOAGENTNAME: pick(rng, ["Skybridge Forwarding", "Indus Air Cargo", "Gulf Link Logistics"]),
    DESTINATION: seed.dest,
    ORIGIN: site,
    SHIPPERNAME: pick(rng, ["Sialkot Surgical Works", "Style Textile (Pvt) Ltd", "Anwar Sports Ind."]),
    SHIPPERADDRESS: `Industrial Estate, ${site === "LHE" ? "Lahore" : "Karachi"}, Pakistan`,
    SHIPPERPHONENO: `+92-3${intBetween(rng, 10, 49)}-${intBetween(rng, 1000000, 9999999)}`,
    CONSIGNEENAME: pick(rng, ["Gulf Medical Supplies FZE", "Northgate Apparel Ltd", "Atlantic Sports Inc"]),
    CONSIGNEEADDRESS: `${seed.dest} — consignee address on file`,
    CONSIGNEEPHONENO: "+971-4-0000000",
    REMARKS: null,
    STATUS: "ACCEPTED",
    PCSAWB: seed.pcs,
    WEIGHTAWB: declaredKg,
    DISCREPANCY: null,
    LEASHINGWEIGHT: lashingKg,
    PALLETWEIGHT: palletKg,
    AIRLINEABB: seed.carrier,
  };

  const lines: AcceptanceLine[] = Array.from({ length: 2 }, (_, li) => ({
    CARGODATE: acceptance.CARGODATE,
    CARGOID: acceptance.CARGOID,
    SEQUENCE: li + 1,
    NATUREOFGOODS: seed.goods,
    PCS: Math.round(seed.pcs / 2),
    WEIGHT: round2(declaredKg / 2),
    WIDTH: intBetween(rng, 60, 110),
    HEIGHT: intBetween(rng, 60, 140),
    LENGTH: intBetween(rng, 90, 180),
    UNIT: "cm",
  }));

  /**
   * CMTS `CARGOACCEPTANCEHWB` — the house breakdown, written only when the
   * accepted master covers several houses. Empty for a straight master.
   *
   * `CARGODATE` + `CARGOID` is the whole of the relation back to the header;
   * both are copied off `acceptance` rather than rebuilt from the seed so the
   * houses cannot drift onto a different acceptance if the header's clock or
   * reference changes.
   *
   * `CARGOGROUP` is int here and varchar on the header — CMTS really does
   * disagree with itself across the two tables, so the fixture seeds an int
   * code and does NOT try to echo the header's "GENERAL". The last house of
   * each consolidation carries null, because an ungrouped house is the normal
   * case a screen has to render (a blank cell, not a zero).
   */
  const hwb: AcceptanceHwb[] = Array.from({ length: seed.houses }, (_, hi) => ({
    HWBNO: `HWB-${seed.dest}-2026-${String(4810 + i * 10 + hi).padStart(6, "0")}`,
    CARGOGROUP: hi === seed.houses - 1 ? null : 30 + hi,
    CARGODATE: acceptance.CARGODATE,
  }));

  const weighment: Weighment = {
    scaleId: `SCALE-${site}-0${i + 1}`,
    weighedAt: daysAgo(acceptedDaysAgo, weighHour, weighMin),
    weighedBy: "export.counter",
    grossKg,
    tareKg,
    netKg,
    palletKg,
    lashingKg,
    declaredKg,
    varianceKg,
    varianceRatio: Math.abs(varianceKg) / declaredKg,
    withinTolerance: Math.abs(varianceKg) / declaredKg <= VARIANCE_TOLERANCE,
    autoCaptured: true,
  };

  const sealNo = `SEAL-${site}-2026-${String(3300 + i)}`;
  const screening: ScreeningRecord[] = [
    {
      id: 1,
      method: i === 2 ? "etd" : "x-ray",
      screenedAt: daysAgo(acceptedDaysAgo, 10, 5),
      screenerId: `SCR-${String(220 + i)}`,
      screenerName: pick(rng, ["A. Nadeem", "S. Bashir", "R. Qureshi"]),
      result: "pass",
      piecesScreened: seed.pcs,
      notes: null,
      sealNo,
      sealAppliedAt: daysAgo(acceptedDaysAgo, 10, 20),
      sealRfid: `E2003417${String(50000 + i * 7)}`,
    },
  ];

  const custodyChain: CustodyEvent[] = [
    {
      id: 1,
      at: daysAgo(acceptedDaysAgo, 8, 35),
      fromParty: acceptance.CARGOAGENTNAME,
      toParty: "SAPS export warehouse",
      location: `${site} export shed`,
      sealIntact: null,
      sealNo: null,
      signedBy: "export.counter",
      note: "Accepted at the export counter.",
    },
    {
      id: 2,
      at: daysAgo(acceptedDaysAgo, 10, 25),
      fromParty: "SAPS export warehouse",
      toParty: "SAPS screening point",
      location: `${site} screening`,
      sealIntact: true,
      sealNo,
      signedBy: "screening.lead",
      note: "Screened and sealed.",
    },
    {
      id: 3,
      at: daysAgo(Math.max(0, acceptedDaysAgo - 1), 6, 40),
      fromParty: "SAPS screening point",
      toParty: "SAPS build-up area",
      location: `${site} build-up`,
      sealIntact: !brokenSeal,
      sealNo,
      signedBy: "buildup.lead",
      note: brokenSeal
        ? "Seal found broken on handover to build-up. Consignment quarantined for re-screening."
        : "Seal verified intact on handover.",
    },
  ];

  // PFM: case 3 has an AWB built onto a ULD the load plan did not assign.
  const uld1 = `AKE${String(41200 + i)}${seed.carrier}`;
  const uld2 = `AKE${String(41300 + i)}${seed.carrier}`;
  const pfm: PfmLine[] = [
    {
      uldNo: uld1,
      uldType: "AKE",
      plannedAwbs: [seed.awb],
      plannedPieces: Math.round(seed.pcs * 0.6),
      plannedWeightKg: round2(declaredKg * 0.6),
      actualAwbs: [seed.awb],
      actualPieces: Math.round(seed.pcs * 0.6),
      actualWeightKg: round2(declaredKg * 0.6),
      builtAt: daysAgo(Math.max(0, acceptedDaysAgo - 1), 7, 30),
      builtBy: "buildup.lead",
    },
    {
      uldNo: uld2,
      uldType: "AKE",
      plannedAwbs: [seed.awb],
      plannedPieces: seed.pcs - Math.round(seed.pcs * 0.6),
      plannedWeightKg: round2(declaredKg * 0.4),
      actualAwbs: pfmMismatch ? [seed.awb, "618-44120968"] : [seed.awb],
      actualPieces: pfmMismatch
        ? seed.pcs - Math.round(seed.pcs * 0.6) + 12
        : seed.pcs - Math.round(seed.pcs * 0.6),
      actualWeightKg: round2(declaredKg * 0.4),
      builtAt: daysAgo(Math.max(0, acceptedDaysAgo - 1), 7, 55),
      builtBy: "buildup.lead",
    },
  ];

  const declaration: ExportDeclaration = {
    sdRef: `PSW-XSD-2026-${String(6600200 + i * 11)}`,
    sdLodgedAt: daysAgo(acceptedDaysAgo, 12, 0),
    formERef: `EFE-2026-${String(88400 + i)}`,
    formEBank: pick(rng, ["Meezan Bank", "HBL", "Bank Alfalah"]),
    formEValue: round2(declaredKg * 3200),
    formEExpiry: daysAgo(-90, 23, 59),
    pswAckRef: `PSWACK-${String(775000 + i)}`,
    pswAckAt: daysAgo(acceptedDaysAgo, 12, 18),
    clearedAt: daysAgo(Math.max(0, acceptedDaysAgo - 1), 9, 10),
    rejectionCode: null,
    rejectionText: null,
  };

  const stage: ExportStage = brokenSeal
    ? "E06-screened"
    : pfmMismatch
      ? "E09-built-up"
      : offloaded
        ? "E08-warehoused" //  came back off the aircraft — re-enters at E08
        : fullyClosed
          ? "E13-closed"
          : "E10-messages-sent";

  /* ---- E01 booking ---- */
  const booking: ExportBooking = {
    bookingRef: `BKG-${seed.carrier}-2026-${String(51200 + i)}`,
    channel: i === 2 ? "gsa" : i === 4 ? "forwarder" : "airline-direct",
    gsaName: i === 2 ? "Aviation Services (Pvt) Ltd" : null,
    bookedAt: daysAgo(acceptedDaysAgo + 2, 11, 5),
    // The allotment is what the airline sold; E12 measures against what the
    // aircraft can actually take, which is why 5 is over its allotment.
    allottedPieces: seed.pcs,
    allottedWeightKg: offloaded ? seed.kg - 900 : seed.kg,
    allottedVolumeM3: round2(seed.kg / 167),
    bookedFlightNo: `${seed.carrier}-${600 + i}`,
    bookedDeparture: daysAgo(-1, 4, 20),
    agreedRatePerKg: 26,
    shipperName: acceptance.SHIPPERNAME,
    commodity: seed.goods,
  };

  /* ---- E05 customs / ANF check, with the correction loop ---- */
  const clearanceRounds: ClearanceRound[] = [
    {
      round: 1,
      startedAt: daysAgo(acceptedDaysAgo, 11, 40),
      arms: ["inspection", "document-check"],
      inspectingOfficer: "Appraiser — Export Shed",
      documentsSignedBy: brokenSeal ? null : "Customs / ANF — export desk",
      anfRequired: specialCargo || i === 0,
      anfClearedAt: specialCargo || i === 0 ? daysAgo(acceptedDaysAgo, 12, 5) : null,
      // Consignment 2 fails the first round — the GD had not been signed.
      outcome: brokenSeal ? "held-for-correction" : "cleared",
      defect: brokenSeal ? "GD not signed by the export desk; packing list totals disagree with the AWB" : null,
      closedAt: daysAgo(acceptedDaysAgo, 12, 30),
    },
  ];
  if (brokenSeal) {
    clearanceRounds.push({
      round: 2,
      startedAt: daysAgo(acceptedDaysAgo - 1, 9, 15),
      arms: ["document-check"],
      inspectingOfficer: null,
      documentsSignedBy: "Customs / ANF — export desk",
      anfRequired: false,
      anfClearedAt: null,
      outcome: "cleared",
      defect: null,
      closedAt: daysAgo(acceptedDaysAgo - 1, 9, 50),
    });
  }
  const clearance: ExportClearance = {
    rounds: clearanceRounds,
    settledAs: "cleared",
    settledAt: clearanceRounds[clearanceRounds.length - 1].closedAt,
  };

  /* ---- E07 classification, 08a / 08b ---- */
  const classification: ExportClassification | null =
    stage === "E06-screened"
      ? null // not yet classified — it is still stuck at screening
      : {
          scc: specialCargo ? "PER" : null,
          isSpecial: specialCargo,
          codes: specialCargo ? ["PER", "COL"] : [],
          checks: specialCargo
            ? [
                {
                  code: "PER",
                  label: SPECIAL_HANDLING_LABEL.PER,
                  requiredDocument: "Perishable cargo declaration + pre-cooling certificate",
                  documentRef: `PER-2026-${String(3100 + i)}`,
                  verifiedBy: "s.malik",
                  verifiedAt: daysAgo(acceptedDaysAgo - 1, 10, 30),
                  pass: true,
                  note: "Pre-cooled to 2 °C at the shipper's facility",
                },
                {
                  code: "COL",
                  label: SPECIAL_HANDLING_LABEL.COL,
                  requiredDocument: "Cool-chain handover log",
                  documentRef: `COL-2026-${String(3100 + i)}`,
                  verifiedBy: "s.malik",
                  verifiedAt: daysAgo(acceptedDaysAgo - 1, 10, 40),
                  pass: true,
                  note: "Temperature-controlled ULD labelled per FC-11",
                },
              ]
            : [],
          classifiedBy: "e.acceptance",
          classifiedAt: daysAgo(acceptedDaysAgo - 1, 10, 15),
          route: specialCargo ? "08a-special-handling" : "08b-normal-storage",
        };

  /* ---- E08 warehousing ---- */
  const warehousing: ExportWarehousing | null =
    classification === null
      ? null
      : {
          locationCode: specialCargo ? `EXP-COOL-${String(12 + i)}` : `EXP-GEN-${String(40 + i)}`,
          zone: specialCargo ? "cool-chain" : "general",
          putawayAt: daysAgo(acceptedDaysAgo - 1, 11, 0),
          putawayBy: "lifter.operator",
          temperatureControlled: specialCargo,
          temperatureC: specialCargo ? 2 : null,
          returnedFromOffload: offloaded,
        };

  /* ---- E12 uplift — the payload decision ---- */
  const availablePayloadKg = offloaded ? seed.kg - 640 : seed.kg + 850;
  const uplift: UpliftRecord | null =
    offloaded || fullyClosed
      ? {
          availablePayloadKg,
          offeredWeightKg: seed.kg,
          assessedAt: daysAgo(Math.max(0, acceptedDaysAgo - 2), 5, 10),
          assessedBy: "ramp.coordinator",
          compatible: !offloaded,
          outcome: offloaded ? "offloaded" : "onboarded",
          onboardedAt: offloaded ? null : daysAgo(Math.max(0, acceptedDaysAgo - 2), 5, 40),
          offloadReason: offloaded
            ? "Load control reduced the payload after a fuel uplift revision"
            : null,
          rebookedFlightNo: offloaded ? `${seed.carrier}-${700 + i}` : null,
          rebookedDeparture: offloaded ? daysAgo(-2, 4, 20) : null,
        }
      : null;

  /* ---- E13 closure — invoice half parked under BLK-02 ---- */
  const closure: ExportClosure | null = fullyClosed
    ? {
        invoiceRef: `EXP-INV-${site}-2026-${String(2200 + i)}`,
        invoiceRaisedAt: daysAgo(Math.max(0, acceptedDaysAgo - 3), 14, 0),
        chargesSettled: true,
        fileClosedAt: daysAgo(Math.max(0, acceptedDaysAgo - 3), 16, 30),
        archivedAt: daysAgo(Math.max(0, acceptedDaysAgo - 3), 16, 45),
        archiveRef: `ARCH-EXP-${site}-2026-${String(880 + i)}`,
        closedBy: "export.supervisor",
      }
    : null;

  const messagesSentAt =
    stage === "E06-screened" || stage === "E09-built-up"
      ? null
      : daysAgo(Math.max(0, acceptedDaysAgo - 1), 15, 20);

  return {
    ...audit(acceptedDaysAgo, "export.counter"),
    ...siteKeys(site),
    id: i + 1,
    awbNo: seed.awb,
    stage,
    acceptance,
    lines,
    hwb,
    // Keyed at the acceptance counter off the shipper's paper. Consignment
    // i === 1 is the one whose invoice went in unverified — no supervisor
    // countersign — which is what the completeness gate picks up.
    capturedDocs: [
      {
        label: "Shipping bill",
        value: formEntry(`SB-2026-${String(44100 + i)}`, "Shipper pack — shipping bill", "e.acceptance", daysAgo(2, 9, 15), "s.malik"),
        documentId: `DOC-EXP-${i}-01`,
      },
      {
        label: "Commercial invoice",
        value: formEntry(`INV-EXP-${String(9900 + i)}`, "Shipper pack — commercial invoice", "e.acceptance", daysAgo(2, 9, 18), i === 1 ? undefined : "s.malik"),
        documentId: `DOC-EXP-${i}-02`,
      },
      {
        label: "Packing list",
        value: formEntry(`PL-${String(3300 + i)}`, "Shipper pack — packing list", "e.acceptance", daysAgo(2, 9, 21), "s.malik"),
        documentId: `DOC-EXP-${i}-03`,
      },
      {
        label: "Form-E",
        value: formEntry(declaration.formERef ?? "", "Bank Form-E / EFE advice", "e.acceptance", daysAgo(2, 9, 24), "s.malik"),
        documentId: `DOC-EXP-${i}-04`,
      },
    ],
    booking,
    weighment,
    clearance,
    screening,
    custodyRegime: i === 0 ? "known-consignor" : "ACC3",
    custodyChain,
    classification,
    warehousing,
    flightNo: `${seed.carrier}-${600 + i}`,
    scheduledDeparture: daysAgo(-1, 4, 20),
    pfm,
    discrepancyNoteNo: pfmMismatch ? `DN-${site}-2026-00${41 + i}` : null,
    discrepancyNote: pfmMismatch
      ? {
          series: "DISCREPANCY_NOTE",
          value: `DN-${site}-2026-00${41 + i}`,
          sequence: 41 + i,
          year: 2026,
          cargoClassId: null,
          continuesFromCmts: 40,
        }
      : null,
    messagesSentAt,
    declaration,
    uplift,
    closure,
    exportCharges: round2(declaredKg * 26),
    closedAt: closure?.fileClosedAt ?? null,
    site,
  } satisfies ExportConsignment;
});

/* ------------------------------------------------------------------ *
 * Transhipment (FC-09) — M15
 *
 * Coverage is deliberate. Three cases, each exercising a different way the
 * FC-09 §T10 re-tender gate can fail:
 *   1. clean — permit live, bond trail unbroken, onward flight confirmed
 *   2. a **lapsed permit** — cargo sat past the permit's validity
 *   3. an **inter-station handoff mid-flight**, where bond continuity is
 *      not yet verified, so the receiving site cannot accept custody
 * ------------------------------------------------------------------ */

/**
 * The Phase 0 seed table carries exactly one AWB per exception branch, which
 * is right for the branches that need one example. M15 needs three, because
 * the re-tender gate has three distinct failure modes and a single clean case
 * demonstrates none of them. The branch-marked AWB leads; two stored
 * consignments are added behind it so the gate has something to block on.
 */
const TRANSHIP_AWBS = [
  ...AWBS.filter((a) => a.branch === "transhipment"),
  ...AWBS.filter(
    (a) => a.branch === null && hasReached(a.stage, "stored") && !hasReached(a.stage, "charged"),
  ),
  ...AWBS.filter((a) => a.branch === null && hasReached(a.stage, "stored")),
].filter((a, i, arr) => arr.findIndex((x) => x.AWBId === a.AWBId) === i);

export const TRANSHIPMENT_CASES: TranshipmentCase[] = TRANSHIP_AWBS.slice(0, 3).map((a, i) => {
  const rng = seeded((i + 1) * 5711);
  const arrived = daysBetween(a.arrivedAt, DEMO_NOW);
  const airline = AIRLINES.find((x) => x.AIRLINEID === a.AIRLINECODE) ?? AIRLINES[0];
  const zone =
    STORAGE_LOCATIONS.find((l) => l.site === a.site && /transhipment|bonded/i.test(l.NAME)) ??
    STORAGE_LOCATIONS.find((l) => l.site === a.site)!;

  // Case 2 lapses; case 3 is the inter-station handoff.
  const lapsed = i === 1;
  const interStation = i === 2;
  const toSite: SiteCode = a.site === "KHI" ? "LHE" : "KHI";

  const transfer: AwbTransfer = {
    AWBTRANSID: 4400 + i,
    AirlineId: airline.AIRLINEID,
    AirlineName: airline.DESCRIPTION,
    AirlineAbb: airline.ABBREVATION,
    ArrivalDate: a.arrivedAt,
    ArrivalTime: a.CARGOTIME,
    FlightNo: a.FLIGHT,
    TotalWeight: a.TOTALWEIGHT,
    Destination: interStation ? toSite : a.DESTINATION,
    AirportName: interStation ? `${toSite} — SAPS station` : "Onward international",
    TransferTo: interStation ? `SAPS ${toSite}` : pick(rng, ["Emirates SkyCargo", "Qatar Airways Cargo", "Turkish Cargo"]),
    SerialNo: 1200 + i,
    AWBNo: a.AWBNO,
    Origin: a.ORIGIN,
    NoOfPackages: a.TOTALPCS,
    Weight: a.TOTALWEIGHT,
    Remarks: interStation ? "Onward leg served by another SAPS station — ownership handoff." : null,
    UniqueIdentification: `TR-${a.site}-2026-${String(880 + i)}`,
    IGMNO: a.IGMNO,
    TransferBy: "ops.supervisor",
    CreatedOn: daysAgo(arrived, 10, 5),
    Staff: "t.mahmood",
    TransferFlight: interStation ? `PK-${300 + i}` : `EK-${600 + i}`,
    HWBNO: null,
    CityId: a.CityId,
  };

  const permitValidDays = lapsed ? arrived - 2 : arrived + 10;
  const permit: TranshipmentPermit = {
    permitNo: `TP-${a.site}-2026-${String(510 + i)}`,
    issuedAt: daysAgo(Math.max(1, arrived - 1), 12, 0),
    issuedBy: "Deputy Collector — Transhipment",
    bondRef: `BOND-2026-${String(77100 + i)}`,
    bondAmount: round2(a.TOTALWEIGHT * 1800),
    validUntil: daysAgo(-permitValidDays + arrived, 23, 59),
    discharged: false,
    dischargedAt: null,
  };

  // Bond supervision: a clean trail, except case 2 where a sweep came up short.
  const supervision: SupervisionEvent[] = [
    {
      id: 1,
      kind: "seal-check",
      at: daysAgo(Math.max(1, arrived - 1), 14, 10),
      by: "bond.supervisor",
      customsOfficer: "Insp. F. Rahman",
      piecesExpected: a.TOTALPCS,
      piecesObserved: a.TOTALPCS,
      sealIntact: true,
      tagsRead: null,
      finding: "ULD seal intact on arrival into the bonded zone.",
      clean: true,
    },
    {
      id: 2,
      kind: "rfid-sweep",
      at: daysAgo(Math.max(0, arrived - 3), 9, 40),
      by: "system (zone reader)",
      customsOfficer: null,
      piecesExpected: a.TOTALPCS,
      piecesObserved: lapsed ? a.TOTALPCS - 1 : a.TOTALPCS,
      sealIntact: null,
      tagsRead: lapsed ? a.TOTALPCS - 1 : a.TOTALPCS,
      finding: lapsed
        ? "Zone sweep read one tag short; piece re-located behind a pallet on manual search but the gap is on the bond record."
        : "All tags accounted for in the bonded zone.",
      clean: !lapsed,
    },
    {
      id: 3,
      kind: "customs-visit",
      at: daysAgo(Math.max(0, arrived - 5), 11, 15),
      by: "bond.supervisor",
      customsOfficer: "Insp. F. Rahman",
      piecesExpected: a.TOTALPCS,
      piecesObserved: a.TOTALPCS,
      sealIntact: true,
      tagsRead: null,
      finding: "Routine bond supervision visit; count and seal verified.",
      clean: true,
    },
  ];

  const handoff: InterStationHandoff = interStation
    ? {
        fromSite: a.site,
        toSite,
        state: "in-transit",
        proposedAt: daysAgo(Math.max(0, arrived - 4), 10, 0),
        hqApprovedAt: daysAgo(Math.max(0, arrived - 4), 15, 30),
        hqApprovedBy: "hq.oversight",
        acceptedAt: null,
        acceptedBy: null,
        rejectedReason: null,
        bondContinuityRef: `BONDC-2026-${String(4400 + i)}`,
        // The point of the whole ticket: not yet verified, so custody cannot pass.
        bondContinuityVerified: false,
        syncOutboxId: `OUTBOX-${a.site}-${String(99120 + i)}`,
        syncedAt: daysAgo(Math.max(0, arrived - 4), 15, 32),
      }
    : {
        fromSite: a.site,
        toSite: a.site,
        state: "not-applicable",
        proposedAt: null,
        hqApprovedAt: null,
        hqApprovedBy: null,
        acceptedAt: null,
        acceptedBy: null,
        rejectedReason: null,
        bondContinuityRef: null,
        bondContinuityVerified: false,
        syncOutboxId: null,
        syncedAt: null,
      };

  const stage: TranshipmentStage = lapsed
    ? "T08-awaiting-flight"
    : interStation
      ? "T07-under-supervision"
      : "T09-charges-raised";

  return {
    ...audit(arrived, "ops.supervisor"),
    ...siteKeys(a.site),
    id: i + 1,
    awbId: a.AWBId,
    AWBNO: a.AWBNO,
    IGMNO: a.IGMNO,
    stage,
    transfer,
    permit,
    supervision,
    handoff,
    locationId: zone.ID,
    inboundFlight: a.FLIGHT,
    onwardFlight: lapsed ? null : transfer.TransferFlight,
    onwardCarrier: lapsed ? null : transfer.TransferTo,
    scheduledDeparture: lapsed ? null : daysAgo(-2, 6, 30),
    rctSentAt: daysAgo(Math.max(1, arrived - 1), 13, 0),
    tfdSentAt: null,
    depSentAt: null,
    storageCharges: round2(a.TOTALCHRGWEIGHT * 42 * Math.max(1, arrived - 3)),
    chargesRaisedAt: stage === "T09-charges-raised" ? daysAgo(1, 10, 0) : null,
    dwellDays: arrived,
    closedAt: null,
    site: a.site,
  } satisfies TranshipmentCase;
});

export function transhipmentFor(awbId: number): TranshipmentCase | null {
  return TRANSHIPMENT_CASES.find((c) => c.awbId === awbId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Customs (FC-06)
 *
 * Coverage is deliberate: every risk channel occupied, one open yellow
 * query, one red examination with sampling, one red discrepancy that feeds
 * the Detend register, one PSW/WeBOC divergence (BLK-04), and one OOC whose
 * scan disagrees with the SD (the verify-vs-SD control actually firing).
 * ------------------------------------------------------------------ */

export const CUSTOMS_IGMS: CustomsIgm[] = MANIFESTS.map((m, i) => ({
  ...audit(daysBetween(m.CARGODATE, DEMO_NOW), "customs.filing"),
  ...siteKeys(m.site),
  DOCUMENTNO: `CIGM-${m.site}-2026-${String(4400 + i)}`,
  PORT: m.site === "KHI" ? "PKKHI" : m.site === "LHE" ? "PKLHE" : "PKPEW",
  SHIPPINGAGENTNO: `SA-${String(70 + i)}`,
  FLIGHTNO: m.FLIGHT,
  VOYAGE: `V${String(1200 + i)}`,
  COUNTRY: "PK",
  ORIGIN: m.ORIGIN,
  CAPTAINNAME: pick(seeded(i * 97 + 5), ["Capt. R. Iqbal", "Capt. M. Farooq", "Capt. S. Ahmed"]),
  AIRPORTNAME:
    m.site === "KHI"
      ? "Jinnah International"
      : m.site === "LHE"
        ? "Allama Iqbal International"
        : "Bacha Khan International",
  SAMEBOTTOMCARGO: i % 4 === 0 ? "Y" : "N",
  IGMNO: m.IGMNO,
  IGMYEAR: 2026,
  TOTALCONSIGNMENTS: AWBS.filter((a) => a.ManifiestId === m.ManifiestId).length,
  INDEXNO: String(100 + i),
  ARRIVALDATE: m.CARGODATE,
  FILINGDATE: m.MANIFESTDATE,
  SHIPPINGCOMPANY: m.AIRLINENAME,
  manifestId: m.ManifiestId,
  site: m.site,
}));

const CUSTOMS_AWBS = AWBS.filter((a) => hasReached(a.stage, "customs"));

/** PCT headings that plausibly match the fixture goods descriptions. */
const PCT_BY_GOODS: Record<string, string> = {
  "Pharmaceutical preparations": "3004.9099",
  "Cotton fabric rolls": "5208.5200",
  "Automotive spare parts": "8708.9900",
  "Consumer electronics": "8517.6290",
  "Medical diagnostic kits": "3822.0000",
  "Fresh cut flowers": "0603.1900",
  "Lithium-ion battery packs": "8507.6000",
  "Industrial valves": "8481.8090",
  "Precision instruments": "9027.8990",
  "Frozen seafood": "0306.1700",
  "Aircraft hydraulic pumps": "8413.6090",
  "Laboratory reagents": "3822.0000",
};

export const AWB_INFORMATION: AwbInformation[] = CUSTOMS_AWBS.map((a, i) => {
  const rng = seeded((i + 1) * 4457);
  const goods = detailsFor(a.AWBId)[0]?.GOODS ?? GOODS[i % GOODS.length];
  const qty = intBetween(rng, 40, 900);
  const valuePerUnit = intBetween(rng, 900, 26000);
  const consignmentValue = round2(qty * valuePerUnit);

  return {
    DOCUMENTNO: `AWBINFO-${a.site}-2026-${String(6200 + i)}`,
    AIRWAYBILLNO: a.AWBNO,
    DESTINATIONPORT: a.DESTINATION,
    INDEXNO: String(100 + (i % MANIFESTS.length)),
    TYPE: "IMPORT",
    CARGOTYPE: cargoClass(a.CARGOCLASSID).ABBREVATION,
    TYPEBL: "AWB",
    LCNUMBER: i % 3 === 0 ? null : `LC-${String(2026000 + i * 17)}`,
    IMPORTLICENCENO: i % 4 === 0 ? `IL-2026-${String(880 + i)}` : null,
    NATIONALTAXNO: `${String(3100000 + i * 331)}-${i % 9}`,
    CONSIGNEE: a.CONSIGNEE1,
    IMPORTNAME: a.CONSIGNEE1,
    ADDRESS: [a.CONSIGNEE2, a.CONSIGNEE3].filter(Boolean).join(", ") || "Karachi, Pakistan",
    SHIPPERNAME: a.SHIPPER1,
    SHIPPERADDRESS: [a.SHIPPER2, a.SHIPPER3].filter(Boolean).join(", ") || a.ORIGIN,
    ORIGIN: a.ORIGIN,
    PORTDISCHARGE: a.site === "KHI" ? "PKKHI" : a.site === "LHE" ? "PKLHE" : "PKPEW",
    CONSIGNMENTVALUE: consignmentValue,
    INSURANCEAMOUNT: round2(consignmentValue * 0.011),
    WEIGHT: a.TOTALWEIGHT,
    NETWEIGHT: round2(a.TOTALWEIGHT * 0.93),
    REMARKS: null,
    PORTOFDELIVERY: a.DESTINATION,
    AMOUNTOFFREIGHT: round2(a.TOTALCHRGWEIGHT * intBetween(rng, 240, 420)),
    PORTOFSHIPMENT: a.ORIGIN,
    PCTCODE: PCT_BY_GOODS[goods] ?? "9999.0000",
    SERIALTYPE: "A",
    UNITOFMEASURE: "KG",
    QUANTITY: qty,
    VALUEPERUNIT: valuePerUnit,
    UNITOFPACKING: detailsFor(a.AWBId)[0]?.TYPEOFPACK ?? "Carton",
    NUMBEROFPACKS: a.TOTALPCS,
    COUNTRYOFORIGIN: a.ORIGIN.slice(0, 2).toUpperCase(),
    DESCRIPTION: goods,
    CASEMARKINGS: i % 3 === 0 ? `${a.CONSIGNEE1.slice(0, 12).toUpperCase()} / ${a.AWBNO}` : null,
    awbId: a.AWBId,
  } satisfies AwbInformation;
});

export const CUSTOMS_CLEARANCES: CustomsClearance[] = CUSTOMS_AWBS.map((a, i) => {
  const rng = seeded((i + 1) * 7919);
  const info = AWB_INFORMATION.find((x) => x.awbId === a.AWBId)!;
  const filedDaysAgo = Math.max(1, daysBetween(a.arrivedAt, DEMO_NOW) - 1);

  // Channel spread: deterministic, but chosen so all three appear and the
  // detained AWB lands on red.
  const channel: RiskChannel = a.IsDetend
    ? "red"
    : i % 5 === 0
      ? "red"
      : i % 3 === 0
        ? "yellow"
        : "green";

  const cha = pick(rng, [
    "Al-Huda Clearing",
    "Pak Gulf CHA",
    "Swift Clear Agency",
    "United Customs",
    "Al-Falah CHA",
  ]);

  // One AWB (index 4) shows PSW accepting while WeBOC rejects — the exact
  // parallel-run divergence BLK-04 exists to catch.
  const divergent = i === 4;
  const submissions: GatewaySubmission[] = [
    {
      provider: "psw",
      role: "primary",
      state: "accepted",
      reference: `PSW-SD-2026-${String(8800000 + a.AWBId * 13)}`,
      submittedAt: daysAgo(filedDaysAgo, 9, 20),
      acknowledgedAt: daysAgo(filedDaysAgo, 9, 24),
      errorCode: null,
      errorText: null,
    },
    {
      provider: "weboc",
      role: "parallel",
      state: divergent ? "rejected" : "accepted",
      reference: divergent ? null : `WBC-GD-2026-${String(44000 + a.AWBId)}`,
      submittedAt: daysAgo(filedDaysAgo, 9, 21),
      acknowledgedAt: daysAgo(filedDaysAgo, 9, 33),
      errorCode: divergent ? "E-4412" : null,
      errorText: divergent
        ? "Consignee NTN not registered against the declared PCT heading"
        : null,
    },
  ];

  // Yellow: one case keeps a query open, the rest are answered and closed.
  const queryOpen = channel === "yellow" && i % 6 === 3;
  const queries: CustomsQuery[] =
    channel === "yellow"
      ? [
          {
            id: 1,
            raisedAt: daysAgo(filedDaysAgo - 1, 11, 5),
            raisedBy: "Appraising Officer — Group II",
            subject: "Declared value below reference",
            detail:
              "Declared value per unit is below the valuation ruling for this PCT heading. Supply the commercial invoice and remittance evidence.",
            respondedAt: queryOpen ? null : daysAgo(filedDaysAgo - 2, 15, 40),
            responseBy: queryOpen ? null : cha,
            responseText: queryOpen
              ? null
              : "Commercial invoice and bank remittance advice uploaded; value supported.",
            closedAt: queryOpen ? null : daysAgo(filedDaysAgo - 2, 16, 20),
          },
        ]
      : [];

  // Red: the detained AWB is the one whose exam finds a discrepancy.
  const examDiscrepancy = a.IsDetend;
  const examination: ExaminationRecord | null =
    channel === "red"
      ? {
          scheduledAt: daysAgo(filedDaysAgo - 1, 8, 30),
          examinedAt: daysAgo(filedDaysAgo - 1, 13, 15),
          examiningOfficer: "Examiner A. Malik",
          packagesOpened: Math.max(1, Math.round(a.TOTALPCS * 0.2)),
          packagesTotal: a.TOTALPCS,
          sampleDrawn: true,
          sampleRef: `SMP-${a.site}-2026-${String(310 + i)}`,
          labReportRef: examDiscrepancy ? null : `LAB-2026-${String(770 + i)}`,
          labReportAt: examDiscrepancy ? null : daysAgo(filedDaysAgo - 3, 10, 0),
          findings: examDiscrepancy
            ? "Goods in 6 cartons do not match the declared description; consignment partially detained pending adjudication."
            : "Contents conform to declaration; sample drawn for record.",
          discrepancyFound: examDiscrepancy,
        }
      : null;

  // Duty is assessed for everything that got past its channel treatment.
  const channelDone =
    channel === "green" ||
    (channel === "yellow" && !queryOpen) ||
    (channel === "red" && !examDiscrepancy);

  const customsDuty = round2(info.CONSIGNMENTVALUE * 0.11);
  const salesTax = round2(info.CONSIGNMENTVALUE * 0.18);
  const fed = round2(info.CONSIGNMENTVALUE * 0.02);
  const wht = round2(info.CONSIGNMENTVALUE * 0.06);

  const duty: DutyAssessment | null = channelDone
    ? {
        assessedAt: daysAgo(filedDaysAgo - 2, 12, 10),
        assessingOfficer: "Principal Appraiser — Group II",
        assessedValue: info.CONSIGNMENTVALUE,
        customsDuty,
        salesTax,
        fed,
        wht,
        total: dutyTotal({
          assessedAt: null,
          assessingOfficer: null,
          assessedValue: info.CONSIGNMENTVALUE,
          customsDuty,
          salesTax,
          fed,
          wht,
          paidAt: null,
          paymentRef: null,
        }),
        paidAt: daysAgo(filedDaysAgo - 3, 10, 45),
        paymentRef: `PSID-2026-${String(551000 + a.AWBId * 7)}`,
      }
    : null;

  // ANF is required for pharma/chemical classes; ASF for everything.
  const cls = cargoClass(a.CARGOCLASSID);
  const anfRequired = /pharma|chemical|dangerous|valuable/i.test(cls.NAME);
  const agencies: AgencyClearance[] = [
    {
      agency: "ANF",
      required: anfRequired,
      clearedAt: anfRequired && channelDone ? daysAgo(filedDaysAgo - 3, 9, 5) : null,
      clearanceRef: anfRequired && channelDone ? `ANF-2026-${String(2200 + i)}` : null,
      officer: anfRequired && channelDone ? "ANF Insp. K. Shah" : null,
    },
    {
      agency: "ASF",
      required: true,
      clearedAt: channelDone ? daysAgo(filedDaysAgo - 3, 9, 20) : null,
      clearanceRef: channelDone ? `ASF-2026-${String(5100 + i)}` : null,
      officer: channelDone ? "ASF Sgt. B. Nawaz" : null,
    },
  ];

  const oocIssued = channelDone && duty?.paidAt != null;
  const sdRef = submissions[0].reference!;

  // One OOC (index 7) came in with the PSW gateway down, so it was keyed
  // off the OOC print — and the keyed package count disagrees with the SD.
  // That is the verify-vs-SD control doing its job, and it is why the
  // control has to be independent of how the value arrived.
  const keyedMismatch = oocIssued && i === 7;
  const declaredPacks = String(a.TOTALPCS);
  const keyedPacks = keyedMismatch ? String(a.TOTALPCS - 2) : declaredPacks;
  const oocSource = keyedMismatch ? "OOC print — counter copy" : "PSW gateway fetch";
  const oocKeyedAt = daysAgo(filedDaysAgo - 4, 11, 35);
  const capture = (v: string) =>
    keyedMismatch
      ? formEntry(v, oocSource, "a.qureshi", oocKeyedAt)
      : formEntry(v, oocSource, "psw.gateway", daysAgo(filedDaysAgo - 4, 11, 30), "n.hassan");

  const ooc: OutOfCharge | null = oocIssued
    ? {
        oocNo: `OOC-${a.site}-2026-${String(9100 + a.AWBId)}`,
        docNumber: {
          series: "OOC",
          value: `OOC-${a.site}-2026-${String(9100 + a.AWBId)}`,
          sequence: 9100 + a.AWBId,
          year: 2026,
          cargoClassId: a.CARGOCLASSID,
          continuesFromCmts: 9099,
        },
        source: keyedMismatch ? "keyed" : "psw-fetch",
        fetchedAt: keyedMismatch ? null : daysAgo(filedDaysAgo - 4, 11, 30),
        // Null on both routes these fixtures exercise: the gateway fetch never
        // touches a scanner, and the keyed-off-the-print case is the gateway
        // being down with no imaging either. A timestamp here would badge the
        // record as scanner-captured, which is a claim about provenance the
        // fixture cannot make.
        scannedAt: null,
        keyedAt: keyedMismatch ? oocKeyedAt : null,
        issuedAt: daysAgo(filedDaysAgo - 4, 11, 15),
        issuingOfficer: "Deputy Collector — Appraisement",
        documentId: `DOC-OOC-${a.AWBId}`,
        checks: [
          {
            field: "sdRef",
            label: "SD reference",
            captured: capture(sdRef),
            expected: sdRef,
            matches: true,
          },
          {
            field: "awbNo",
            label: "AWB number",
            captured: capture(a.AWBNO),
            expected: a.AWBNO,
            matches: true,
          },
          {
            field: "channel",
            label: "Risk channel",
            captured: capture(RISK_CHANNEL_LABEL[channel]),
            expected: RISK_CHANNEL_LABEL[channel],
            matches: true,
          },
          {
            field: "packages",
            label: "Number of packages",
            captured: capture(keyedPacks),
            expected: declaredPacks,
            matches: !keyedMismatch,
          },
          {
            field: "issuedAt",
            label: "Issue date",
            captured: capture(formatDate(daysAgo(filedDaysAgo - 4, 11, 15))),
            expected: formatDate(daysAgo(filedDaysAgo - 4, 11, 15)),
            matches: true,
          },
        ],
        verifiedAt: keyedMismatch ? null : daysAgo(filedDaysAgo - 4, 11, 40),
        verifiedBy: keyedMismatch ? null : "n.hassan",
      }
    : null;

  const status: SdStatus = !channelDone
    ? channel === "yellow"
      ? "query-raised"
      : "under-examination"
    : ooc
      ? hasReached(a.stage, "charged")
        ? "released"
        : "ooc-issued"
      : duty?.paidAt
        ? "agency-clearance"
        : "assessed";

  return {
    ...audit(filedDaysAgo, cha),
    ...siteKeys(a.site),
    id: i + 1,
    awbId: a.AWBId,
    AWBNO: a.AWBNO,
    IGMNO: a.IGMNO,
    INDEXNO: info.INDEXNO,
    sdRef,
    gdNo: divergent ? null : `GD-${a.site}-2026-${String(90 + i)}`,
    docNumber: {
      series: "SINGLE_DECLARATION",
      value: sdRef,
      sequence: 8800000 + a.AWBId * 13,
      year: 2026,
      cargoClassId: a.CARGOCLASSID,
      continuesFromCmts: null,
    },
    cha,
    status,
    filedAt: daysAgo(filedDaysAgo, 9, 20),
    channel,
    channelAssignedAt: daysAgo(filedDaysAgo, 9, 45),
    channelFetchedFrom: "psw",
    submissions,
    queries,
    examination,
    duty,
    agencies,
    ooc,
    site: a.site,
  } satisfies CustomsClearance;
});

export function clearanceFor(awbId: number): CustomsClearance | null {
  return CUSTOMS_CLEARANCES.find((c) => c.awbId === awbId) ?? null;
}

export function awbInformationFor(awbId: number): AwbInformation | null {
  return AWB_INFORMATION.find((x) => x.awbId === awbId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

export const IATA_MESSAGES: IataMessage[] = (() => {
  const out: IataMessage[] = [];
  let id = 1;

  for (const m of MANIFESTS) {
    for (const [type, receipt] of Object.entries(m.messages) as Array<
      ["FFM" | "FWB" | "FHL" | "NOTOC", { received: boolean; receivedAt: string | null }]
    >) {
      if (!receipt.received) continue;
      out.push({
        id: id++,
        type,
        direction: "inbound",
        awbId: null,
        AWBNO: null,
        IGMNO: m.IGMNO,
        FLIGHT: m.FLIGHT,
        raw: `${type}/8\n${m.FLIGHT}/${m.CARGODATE.slice(0, 10)}\n${m.ORIGIN}${m.DESTINATION}`,
        status: "received",
        timestamp: receipt.receivedAt!,
        trigger: null,
        manualSendBy: null,
        failureReason: null,
        site: m.site,
      });
    }
  }

  for (const a of AWBS) {
    const emit = (type: IataMessage["type"], stage: LifecycleStage, trigger: IataMessage["trigger"]) => {
      if (!hasReached(a.stage, stage)) return;
      out.push({
        id: id++,
        type,
        direction: "outbound",
        awbId: a.AWBId,
        AWBNO: a.AWBNO,
        IGMNO: a.IGMNO,
        FLIGHT: a.FLIGHT,
        raw: `${type}/4\n${a.AWBNO}\n${a.ORIGIN}${a.DESTINATION}/T${a.TOTALPCS}K${a.TOTALWEIGHT}`,
        status: "acknowledged",
        timestamp: daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - stageIndex(stage) / 4), 12, 0),
        trigger,
        manualSendBy: null,
        failureReason: null,
        site: a.site,
      });
    };
    emit("RCF", "acceptance", "cargo-received");
    emit("NFD", "stored", "cargo-warehoused");
    emit("DLV", "delivered", "pod-captured");
    if (a.cdrRaised) emit("DIS", "acceptance", "discrepancy-raised");
    if (a.branch === "transhipment") emit("RCT", "stored", "transfer-cargo-accepted");
  }

  // One failed message so the console has a real failure to show.
  out.push({
    id: id++,
    type: "NFD",
    direction: "outbound",
    awbId: AWBS[4].AWBId,
    AWBNO: AWBS[4].AWBNO,
    IGMNO: AWBS[4].IGMNO,
    FLIGHT: AWBS[4].FLIGHT,
    raw: `NFD/4\n${AWBS[4].AWBNO}`,
    status: "failed",
    timestamp: daysAgo(2, 9, 12),
    trigger: "cargo-warehoused",
    manualSendBy: null,
    failureReason: "SITA session timeout — queued for retry (attempt 2 of 3)",
    site: AWBS[4].site,
  });

  return out.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
})();

/**
 * Notification templates — the FC-05 amendment's "Email / SMS / WhatsApp
 * templates". CMTS has no template table at all; notifications were free
 * text typed per send, which is why no two NOAs ever read the same.
 *
 * Versioned deliberately: a template edit must not retroactively change
 * what a dispatch three months ago actually said, so a dispatch records
 * the TemplateId it used.
 */
export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = (() => {
  const out: NotificationTemplate[] = [];
  let id = 1;

  const COPY: Record<CustomerNotification, { subject: string; body: string; vars: string[] }> = {
    NOA: {
      subject: "Arrival Notice — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\nYour consignment on AWB {{awbNo}} ({{pieces}} pcs / {{weight}}) arrived at {{site}} on {{arrivalDate}} per flight {{flight}}.\n\nFree period expires {{freeExpiry}}. Storage charges accrue from that date.\n\nShaheen Airport Services",
      vars: ["recipientName", "awbNo", "pieces", "weight", "site", "arrivalDate", "flight", "freeExpiry"],
    },
    MISSING_DOCUMENT: {
      subject: "Documents required — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\nClearance of AWB {{awbNo}} is held pending: {{missingDocs}}.\n\nPlease submit to the SAPS documentation counter at {{site}}.",
      vars: ["recipientName", "awbNo", "missingDocs", "site"],
    },
    DO_READY: {
      subject: "Delivery Order ready — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\nDelivery Order {{doNo}} for AWB {{awbNo}} is ready for collection. Charges of {{amount}} are settled and out-of-charge is on file.\n\nBring original CNIC and the authority letter.",
      vars: ["recipientName", "awbNo", "doNo", "amount"],
    },
    DELIVERY_COMPLETED: {
      subject: "Delivery completed — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\n{{pieces}} pieces against AWB {{awbNo}} were delivered on {{deliveredAt}} and received by {{receiverName}}.\n\nProof of delivery is attached.",
      vars: ["recipientName", "awbNo", "pieces", "deliveredAt", "receiverName"],
    },
    FREE_PERIOD_EXPIRY: {
      subject: "Free period expiring — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\nThe free storage period for AWB {{awbNo}} expires on {{freeExpiry}}. Demurrage accrues at {{rate}} thereafter.",
      vars: ["recipientName", "awbNo", "freeExpiry", "rate"],
    },
    CUSTOMS_HOLD: {
      subject: "Customs hold placed — AWB {{awbNo}}",
      body: "Dear {{recipientName}},\n\nA customs hold has been placed on AWB {{awbNo}} on {{holdDate}}. Reason: {{holdReason}}.\n\nCargo cannot be released until the hold is lifted.",
      vars: ["recipientName", "awbNo", "holdDate", "holdReason"],
    },
    PAYMENT_DUE: {
      subject: "Payment due — invoice {{invoiceNo}}",
      body: "Dear {{recipientName}},\n\nInvoice {{invoiceNo}} against AWB {{awbNo}} shows {{outstanding}} outstanding, due {{dueDate}}.\n\nPay online or at the SAPS finance counter.",
      vars: ["recipientName", "invoiceNo", "awbNo", "outstanding", "dueDate"],
    },
  };

  const notifications = Object.keys(COPY) as CustomerNotification[];
  for (const n of notifications) {
    for (const channel of ["email", "sms", "whatsapp"] as Channel[]) {
      const c = COPY[n];
      // SMS is length-constrained — one line, no salutation.
      const body =
        channel === "sms"
          ? c.body.split("\n").filter(Boolean)[1] ?? c.body.split("\n")[0]
          : c.body;
      out.push({
        Id: id++,
        notification: n,
        channel,
        DisplayName: `${CUSTOMER_NOTIFICATION_LABEL[n]} — ${CHANNEL_LABEL[channel]}`,
        Subject: channel === "sms" ? null : c.subject,
        Body: body,
        IsHtml: channel === "email",
        variables: c.vars,
        version: 2,
        IsActive: true,
        IsDeleted: false,
      } satisfies NotificationTemplate);
    }
  }
  return out;
})();

export function templatesFor(notification: CustomerNotification) {
  return NOTIFICATION_TEMPLATES.filter((t) => t.notification === notification && t.IsActive);
}

export const NOTIFICATION_DISPATCHES: NotificationDispatch[] = (() => {
  const out: NotificationDispatch[] = [];
  let id = 1;

  for (const a of AWBS) {
    const consignee = PARTIES.find((p) => p.NAME === a.CONSIGNEE1);
    if (!consignee) continue;

    const push = (
      notification: NotificationDispatch["notification"],
      stage: LifecycleStage,
      trigger: NotificationDispatch["trigger"],
      dayOffset: number,
    ) => {
      if (!hasReached(a.stage, stage)) return;
      for (const channel of consignee.channels) {
        const sentAt = daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - dayOffset), 9, 30);
        const delivered = id % 9 !== 0;
        const read = delivered && id % 3 === 0;
        out.push({
          Id: id++,
          notification,
          channel,
          TemplateId: 1,
          awbId: a.AWBId,
          AWBNO: a.AWBNO,
          IGMNO: a.IGMNO,
          recipientPartyId: consignee.ID,
          recipientName: consignee.NAME,
          SenderName: "AirVault — SAPS",
          destination: channel === "email" ? consignee.EMAIL : consignee.PHONENO,
          status: !delivered ? "failed" : read ? "read" : "delivered",
          queuedAt: sentAt,
          sentAt,
          deliveredAt: delivered ? sentAt : null,
          readAt: read ? daysAgo(Math.max(0, daysBetween(a.arrivedAt, DEMO_NOW) - dayOffset), 11, 5) : null,
          NoOfTry: delivered ? 1 : 3,
          failureReason: delivered ? null : "Recipient mailbox full",
          trigger,
          site: a.site,
        });
      }
    };

    push("NOA", "notified", "cargo-warehoused", 1);
    push("DO_READY", "do-issued", "payment-ooc-do-ready", 2);
    push("DELIVERY_COMPLETED", "delivered", "pod-captured", 3);
  }

  return out.sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt));
})();

/* ------------------------------------------------------------------ *
 * Documents (M02)
 *
 * Generated from the records that own them, so the repository is
 * internally consistent with the rest of the fixture set rather than a
 * parallel invention.
 * ------------------------------------------------------------------ */

export const DOCUMENTS: StoredDocument[] = (() => {
  const out: StoredDocument[] = [];
  let n = 1;

  const add = (
    awb: AWB,
    type: DocumentType,
    source: DocumentSource,
    opts: Partial<StoredDocument> = {},
  ) => {
    const rng = seeded(n * 4271);
    const conf = source === "scanner" ? round2(0.86 + rng() * 0.13) : null;
    out.push({
      id: `DOC-${String(10_000 + n).padStart(5, "0")}`,
      type,
      source,
      title: `${type.replace(/_/g, " ")} — ${awb.AWBNO}`,
      awbId: awb.AWBId,
      AWBNO: awb.AWBNO,
      IGMNO: awb.IGMNO,
      cdrRef: null,
      pages: intBetween(rng, 1, 4),
      sizeKb: intBetween(rng, 120, 2400),
      uploadedAt: daysAgo(Math.max(0, daysBetween(awb.arrivedAt, DEMO_NOW)), 8, 30 + (n % 25)),
      uploadedBy: source === "generated" ? "system" : "import.docs",
      versions: [
        { version: 1, uploadedAt: daysAgo(Math.max(0, daysBetween(awb.arrivedAt, DEMO_NOW)), 8, 30), uploadedBy: "import.docs", superseded: false, note: null },
      ],
      ocrProcessed: source === "scanner",
      ocrMeanConfidence: conf,
      site: awb.site,
      archived: awb.stage === "closed",
      ...opts,
    });
    n++;
  };

  // "scanner" is reserved for the two OCR points — inbound MAWB/HAWB off
  // the flight pouch, and the receiver's authority letter at collection.
  // Everything else arrives by EDI, is keyed/uploaded at a counter, or is
  // system-generated. See the SCOPE note in `common.ts`.
  for (const a of AWBS) {
    // Intake documents exist from document verification onward.
    if (hasReached(a.stage, "doc-verification")) {
      add(a, "MAWB", "scanner");
      add(a, "MANIFEST", "edi");
      if (a.IsHwb) add(a, "HAWB", "scanner");
      // Handed over with the pouch and filed at the counter, not scanned.
      if (a.CARGOCLASSID === 5) add(a, "DGR_DECLARATION", "upload");
      if ([5, 6, 8].includes(a.CARGOCLASSID)) add(a, "NOTOC", "edi");
    }
    if (hasReached(a.stage, "notified")) add(a, "ARRIVAL_ADVICE", "generated");
    if (hasReached(a.stage, "customs")) {
      add(a, "GD_SD", "edi");
      // Fetched from the PSW gateway; keyed from the print only when it is down.
      if (a.branch !== "re-export") add(a, "OOC", "edi");
    }
    if (hasReached(a.stage, "charged")) {
      add(a, "GR_VOUCHER", "generated");
      add(a, "INVOICE", "generated");
    }
    if (hasReached(a.stage, "do-issued")) add(a, "AUTHORITY_LETTER", "scanner");
    if (hasReached(a.stage, "gate-pass")) add(a, "GATE_PASS", "generated");
    if (hasReached(a.stage, "delivered")) add(a, "POD", "generated");
  }

  // CDR evidence, linked to its CDR rather than only to the AWB.
  for (const c of CDRS) {
    const awb = awbById(c.awbId)!;
    add(awb, "CDR_EVIDENCE", "upload", {
      cdrRef: c.cdrRef,
      title: `CDR evidence — ${c.cdrRef}`,
      // Two versions so the history view has something to diff.
      versions: [
        { version: 1, uploadedAt: daysAgo(4, 10, 30), uploadedBy: "i.ali", superseded: true, note: "Initial photo set" },
        { version: 2, uploadedAt: daysAgo(4, 14, 10), uploadedBy: "s.khan", superseded: false, note: "Added seal condition photographs" },
      ],
    });
  }

  return out.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
})();

export function documentsFor(awbId: number): StoredDocument[] {
  return DOCUMENTS.filter((d) => d.awbId === awbId);
}

/* ------------------------------------------------------------------ *
 * Storage — tag bindings & bonded handovers (Phase 2)
 * ------------------------------------------------------------------ */

export const TAG_BINDINGS: TagBinding[] = PIECES.filter(
  (p) => p.locationId !== null && p.scanState !== "unbound",
).map((p, i) => {
  const awb = awbById(p.awbId)!;
  const unreadable = p.scanState === "unreadable";
  return {
    id: i + 1,
    pieceId: p.pieceId,
    awbId: p.awbId,
    AWBNO: p.AWBNO,
    tagValue: p.rfidEpc ?? p.barcode,
    method: unreadable ? "manual" : p.rfidEpc ? "rfid" : "barcode",
    locationId: p.locationId!,
    boundAt: p.lastMovementAt,
    boundBy: p.lastMovementBy,
    unboundAt: null,
    manualReason: unreadable ? "RFID tag unreadable on three attempts — barcode also damaged" : null,
    site: awb.site,
  } satisfies TagBinding;
});

export const BONDED_HANDOVERS: BondedHandover[] = AWBS.filter(
  (a) => a.CARGOCLASSID === 14 || a.CARGOCLASSID === 15 || a.branch === "transhipment",
).flatMap((a, i) => {
  const loc = STORAGE_LOCATIONS.find(
    (l) => l.site === a.site && (l.CLASSID === (a.branch === "transhipment" ? 15 : 14)),
  );
  if (!loc) return [];
  const days = daysBetween(a.arrivedAt, DEMO_NOW);
  return [
    {
      ...audit(days, "bonded.officer"),
      ...siteKeys(a.site),
      BoundedAreaId: i + 1,
      AWBId: a.AWBId,
      IGMNO: a.IGMNO,
      AWBNO: a.AWBNO,
      NameOfAirLineRepsntive: "K. Rahman",
      AirlineId: a.AIRLINECODE,
      GoodDescription: a.branch === "transhipment" ? "Transit cargo — onward carriage" : "Airline bonded stock",
      HandOverDate: daysAgo(days, 12, 15),
      HandOverTime: "12:15",
      Destination: a.branch === "transhipment" ? "LHE" : a.DESTINATION,
      DeliverBy: "SAPS Bonded Store",
      USERID: "bonded.officer",
      UniqueIdentification: `${a.AWBNO}-BND`,
      direction: "in" as const,
      locationId: loc.ID,
      site: a.site,
    },
  ];
});

/* ------------------------------------------------------------------ *
 * Coverage self-check — surfaced on the QA checklist screen so the
 * fixture guarantees are visible rather than assumed.
 * ------------------------------------------------------------------ */

export const FIXTURE_COVERAGE = {
  awbs: AWBS.length,
  sites: new Set(AWBS.map((a) => a.site)).size,
  cargoClassesCovered: new Set(AWBS.map((a) => a.CARGOCLASSID)).size,
  cargoClassesTotal: CARGO_CLASSES.length,
  lifecycleStagesCovered: new Set(AWBS.map((a) => a.stage)).size,
  lifecycleStagesTotal: LIFECYCLE_ORDER.length,
  branches: {
    cdr: AWBS.filter((a) => a.branch === "cdr").length,
    mishandled: AWBS.filter((a) => a.branch === "mishandled").length,
    reExport: AWBS.filter((a) => a.branch === "re-export").length,
    longStay: AWBS.filter((a) => a.branch === "long-stay").length,
    transhipment: AWBS.filter((a) => a.branch === "transhipment").length,
  },
  detends: DETENDS.length,
  houseAwbs: HOUSE_AWBS.length,
  holdsLive: HOLDS.filter((h) => !h.Release).length,
  holdsReleased: HOLDS.filter((h) => h.Release).length,
  divergedLocations: AWB_LOCATIONS.filter((l) => l.LOGICALLOCATIONID !== l.PHYSICALLOCATIONID).length,
  triggersMapped: TRIGGER_MAP.length,
  pieces: PIECES.length,
  iataMessages: IATA_MESSAGES.length,
  notifications: NOTIFICATION_DISPATCHES.length,
  documents: DOCUMENTS.length,
} as const;
