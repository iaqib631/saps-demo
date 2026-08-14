/**
 * AirVault domain — messaging & notification spine (FC-05, M07 + M08).
 *
 * CMTS sources:
 *   `EmailTemplate` (7) / `EmailHistory` (9)
 *   `SMSTemplate` (5)   / `SmsHistory` (8)
 *   `CredentialIds` (6), `EventLog` (7), `ErrorLog` (10)
 *
 * AirVault adds: WhatsApp as a first-class channel, auto-trigger, and
 * delivery/read receipts. There is no IATA message table in CMTS.
 */

import type { SiteCode } from "./common";

/* ================================================================== *
 * FC-05 group A — pre-arrival (inbound)
 * ================================================================== */

export type PreArrivalMessage = "FFM" | "FWB" | "FHL" | "NOTOC";

/* ================================================================== *
 * FC-05 group B — operational status (outbound)
 * ================================================================== */

export type StatusMessage =
  | "RCF" //  Received from Flight
  | "NFD" //  Notified for Delivery
  | "AWD" //  Awaiting Documentation
  | "DIS" //  Discrepancy Raised
  | "DLV" //  Delivered
  | "RCT" //  Received for Transhipment
  | "TFD" //  Transferred to Carrier
  | "DEP" //  Departed Onward Sector
  | "TGC"; // Transferred to Ground Custody

export type IataMessageType = PreArrivalMessage | StatusMessage;

export const IATA_MESSAGE_LABEL: Record<IataMessageType, string> = {
  FFM: "FFM — Flight Manifest",
  FWB: "FWB — Master AWB Data",
  FHL: "FHL — House Manifest",
  NOTOC: "NOTOC — Special Cargo Notification",
  RCF: "RCF — Received from Flight",
  NFD: "NFD — Notified for Delivery",
  AWD: "AWD — Awaiting Documentation",
  DIS: "DIS — Discrepancy Raised",
  DLV: "DLV — Delivered",
  RCT: "RCT — Received for Transhipment",
  TFD: "TFD — Transferred to Carrier",
  DEP: "DEP — Departed Onward Sector",
  TGC: "TGC — Transferred to Ground Custody",
};

export const PRE_ARRIVAL_MESSAGES: PreArrivalMessage[] = ["FFM", "FWB", "FHL", "NOTOC"];
export const STATUS_MESSAGES: StatusMessage[] = [
  "RCF",
  "NFD",
  "AWD",
  "DIS",
  "DLV",
  "RCT",
  "TFD",
  "DEP",
  "TGC",
];

/* ================================================================== *
 * FC-05 group C — customer / CHA notifications
 * ================================================================== */

export type CustomerNotification =
  | "NOA"
  | "FREE_PERIOD_EXPIRY"
  | "MISSING_DOCUMENT"
  | "CUSTOMS_HOLD"
  | "PAYMENT_DUE"
  | "DO_READY"
  | "DELIVERY_COMPLETED";

export const CUSTOMER_NOTIFICATION_LABEL: Record<CustomerNotification, string> = {
  NOA: "Notice of Arrival",
  FREE_PERIOD_EXPIRY: "Free Period Expiry Alert",
  MISSING_DOCUMENT: "Missing Document Alert",
  CUSTOMS_HOLD: "Customs Hold Alert",
  PAYMENT_DUE: "Payment Due Alert",
  DO_READY: "DO Ready Alert",
  DELIVERY_COMPLETED: "Delivery Completed Alert",
};

/* ================================================================== *
 * FC-05 operational triggers — the wiring diagram of the whole spine
 *
 * The flow's own Operational Triggers section names nine events. Four
 * more exist here because the board declared messages and then gave them
 * nothing to fire them: TGC sat in STATUS_MESSAGES with no producer, and
 * FREE_PERIOD_EXPIRY / CUSTOMS_HOLD / PAYMENT_DUE sat in
 * CustomerNotification with no producer. A declared message type that
 * nothing emits is a gap in the spine, not a faithful reading of it.
 *
 * `noa-issued` is the fifth addition, and the one that corrects rather
 * than extends. The board hung NFD off `cargo-warehoused` alongside the
 * NOA, which declares the carrier "notified for delivery" at the same
 * instant the consignee is told the cargo landed — before the NOA has
 * actually gone out. NFD now hangs off the NOA's own issue event, so the
 * real order (warehoused → NOA → NFD) is what fires.
 *
 * Note the two triggers that fan out to both an IATA message and a
 * customer notification.
 * ================================================================== */

export type OperationalTrigger =
  | "cargo-received"
  | "cargo-warehoused"
  | "noa-issued"
  | "docs-missing"
  | "discrepancy-raised"
  | "payment-ooc-do-ready"
  | "pod-captured"
  | "transfer-cargo-accepted"
  | "transfer-to-carrier"
  | "onward-flight-departed"
  | "ground-custody-transferred"
  | "free-period-expiring"
  | "customs-hold-placed"
  | "invoice-issued";

export interface TriggerMapping {
  trigger: OperationalTrigger;
  label: string;
  iata: IataMessageType[];
  customer: CustomerNotification[];
  /** Which module raises this event. */
  source: string;
  enabled: boolean;
}

/**
 * FC-05's fourteen triggers — the board's nine plus the five P7-3 added.
 *
 * ARRAY ORDER IS LOAD-BEARING. The notifications screen renders this map
 * top-to-bottom as the flow's running order, and the house rule is that a
 * downstream event sits below the event it depends on. `noa-issued` must
 * therefore stay immediately under `cargo-warehoused` (the NOA fires
 * there, the NFD acknowledging it fires here), and `invoice-issued` must
 * stay below `free-period-expiring` because the charge only becomes
 * payable once the free period has run out. Re-sorting this array
 * alphabetically, or appending a new row anywhere convenient, silently
 * rewrites the sequence the screen presents as the flow.
 */
export const TRIGGER_MAP: TriggerMapping[] = [
  { trigger: "cargo-received", label: "Cargo received", iata: ["RCF"], customer: [], source: "M04 Cargo Receipt", enabled: true },
  { trigger: "cargo-warehoused", label: "Cargo warehoused", iata: [], customer: ["NOA"], source: "M05 Storage", enabled: true },
  { trigger: "noa-issued", label: "NOA issued", iata: ["NFD"], customer: [], source: "M08 Notification", enabled: true },
  { trigger: "docs-missing", label: "Docs missing", iata: ["AWD"], customer: ["MISSING_DOCUMENT"], source: "M02 Document Mgmt", enabled: true },
  { trigger: "discrepancy-raised", label: "Discrepancy raised", iata: ["DIS"], customer: [], source: "M06 CDR", enabled: true },
  { trigger: "payment-ooc-do-ready", label: "Payment + OOC + DO ready", iata: [], customer: ["DO_READY"], source: "M12 Delivery Order", enabled: true },
  { trigger: "pod-captured", label: "POD captured", iata: ["DLV"], customer: ["DELIVERY_COMPLETED"], source: "M14 POD", enabled: true },
  { trigger: "transfer-cargo-accepted", label: "Transfer cargo accepted", iata: ["RCT"], customer: [], source: "M15 Transhipment", enabled: true },
  { trigger: "transfer-to-carrier", label: "Transfer to carrier", iata: ["TFD"], customer: [], source: "M15 Transhipment", enabled: true },
  { trigger: "onward-flight-departed", label: "Onward flight departed", iata: ["DEP"], customer: [], source: "M15 Transhipment", enabled: true },
  { trigger: "ground-custody-transferred", label: "Transferred to ground custody", iata: ["TGC"], customer: [], source: "M01 Flight / M04 Cargo Receipt", enabled: true },
  { trigger: "free-period-expiring", label: "Free period expiring", iata: [], customer: ["FREE_PERIOD_EXPIRY"], source: "M10 dwell clock (FC-07 §02–03)", enabled: true },
  { trigger: "customs-hold-placed", label: "Customs hold placed", iata: [], customer: ["CUSTOMS_HOLD"], source: "M06 hold register (HOLDINGSTATUS)", enabled: true },
  { trigger: "invoice-issued", label: "Invoice issued", iata: [], customer: ["PAYMENT_DUE"], source: "M11 invoicing", enabled: true },
];

/**
 * Retained as an empty array, deliberately.
 *
 * This once held FREE_PERIOD_EXPIRY, CUSTOMS_HOLD and PAYMENT_DUE —
 * declared notifications with no trigger behind them. All three are now
 * wired in TRIGGER_MAP, so there is nothing left to list. The export
 * stays so that consumers still reading it render an empty section
 * rather than crashing on an undefined import; the correct end state is
 * for those consumers to drop the reference, after which this can go.
 */
export const UNWIRED_NOTIFICATIONS: Array<{
  notification: CustomerNotification;
  proposedSource: string;
  note: string;
}> = [];

/* ================================================================== *
 * Channels, templates & receipts
 * ================================================================== */

export type Channel = "email" | "sms" | "whatsapp";

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/** CMTS `EmailTemplate` / `SMSTemplate`. WhatsApp is the AirVault addition. */
export interface NotificationTemplate {
  Id: number;
  notification: CustomerNotification;
  channel: Channel;
  DisplayName: string;
  Subject: string | null;
  Body: string;
  IsHtml: boolean;
  /** Template variables available, e.g. {{awbNo}}. */
  variables: string[];
  version: number;
  IsActive: boolean;
  IsDeleted: boolean;
}

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

/** CMTS `EmailHistory` / `SmsHistory`, plus AirVault receipts. */
export interface NotificationDispatch {
  Id: number;
  notification: CustomerNotification;
  channel: Channel;
  TemplateId: number;
  awbId: number | null;
  AWBNO: string | null;
  IGMNO: string | null;
  recipientPartyId: number;
  recipientName: string;
  /** CMTS `SenderEmail` / `SenderNumber`. */
  SenderName: string;
  destination: string;
  status: DeliveryStatus;
  queuedAt: string;
  sentAt: string | null;
  /** AirVault addition. */
  deliveredAt: string | null;
  /** AirVault addition. */
  readAt: string | null;
  /** CMTS `NoOfTry`. */
  NoOfTry: number;
  failureReason: string | null;
  /** Which trigger produced this — provenance for the trigger map. */
  trigger: OperationalTrigger | null;
  site: SiteCode;
}

/** Outbound/inbound IATA Cargo-IMP message. */
export interface IataMessage {
  id: number;
  type: IataMessageType;
  direction: "inbound" | "outbound";
  awbId: number | null;
  AWBNO: string | null;
  IGMNO: string | null;
  FLIGHT: string | null;
  /** Raw Cargo-IMP payload. */
  raw: string;
  status: "queued" | "sent" | "acknowledged" | "failed" | "received";
  timestamp: string;
  /** Outbound only — which event produced it. */
  trigger: OperationalTrigger | null;
  /** Set when a human sent it manually — the amendment says auto is the norm. */
  manualSendBy: string | null;
  failureReason: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * Integration gateways — FC-12 "Integration gateways: PSW customs ·
 * SITA (IATA) · Payment · RFID/HW · Notify"
 * ================================================================== */

export type GatewayCode = "psw" | "weboc" | "sita" | "payment" | "rfid" | "notify";

export interface GatewayState {
  code: GatewayCode;
  label: string;
  /** FC-06 amendment — provider-abstracted, PSW primary / WeBOC parallel. */
  role: "primary" | "parallel" | "single";
  status: "healthy" | "degraded" | "down";
  lastSyncAt: string;
  queueDepth: number;
  note: string | null;
}

export const GATEWAYS: GatewayState[] = [
  { code: "psw", label: "PSW — Pakistan Single Window", role: "primary", status: "healthy", lastSyncAt: "2026-08-03T14:30:00+05:00", queueDepth: 2, note: "Single Declaration, risk channel & OOC via EDI" },
  { code: "weboc", label: "WeBOC (legacy)", role: "parallel", status: "healthy", lastSyncAt: "2026-08-03T14:22:00+05:00", queueDepth: 0, note: "Parallel-run during phased rollout — see BLK-04" },
  { code: "sita", label: "SITA — IATA Cargo-IMP", role: "single", status: "healthy", lastSyncAt: "2026-08-03T14:31:00+05:00", queueDepth: 5, note: null },
  { code: "payment", label: "Payment gateway", role: "single", status: "healthy", lastSyncAt: "2026-08-03T14:29:00+05:00", queueDepth: 0, note: "Cash-less card / bank / online" },
  { code: "rfid", label: "RFID & hardware", role: "single", status: "degraded", lastSyncAt: "2026-08-03T14:11:00+05:00", queueDepth: 14, note: "PEW handheld reader #3 offline" },
  { code: "notify", label: "Notification — Email / SMS / WhatsApp", role: "single", status: "healthy", lastSyncAt: "2026-08-03T14:32:00+05:00", queueDepth: 1, note: null },
];
