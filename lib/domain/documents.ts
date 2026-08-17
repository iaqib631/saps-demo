/**
 * AirVault domain — document management (M02).
 *
 * CMTS has **no document table**. It stores paths and blobs inline on the
 * records that need them: `AWBDELEIVERYORDER.AuthAgentPic`,
 * `GATEPASS.RcvngPersonPic`, `CCompany.CompLogo`, `CEmployee.PicPath`.
 * Those become document references here.
 *
 * M02 is a Tier 1 module in FC-12 feeding M03, and three amendments depend
 * on it: FC-04 attaches the CDR evidence pack "to the CDR (doc mgmt M02)",
 * FC-08 auto-attaches the digital POD, and FC-01/FC-11 store OCR source
 * scans. Flag as an AirVault addition at sign-off.
 */

import type { SiteCode } from "./common";

export type DocumentType =
  | "MAWB"
  | "HAWB"
  | "MANIFEST"
  | "NOTOC"
  | "DGR_DECLARATION"
  | "GD_SD"
  | "OOC"
  | "AUTHORITY_LETTER"
  | "CDR_EVIDENCE"
  | "POD"
  | "INVOICE"
  | "GR_VOUCHER"
  | "GATE_PASS"
  | "PACKING_LIST"
  | "COMMERCIAL_INVOICE"
  | "ARRIVAL_ADVICE";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  MAWB: "Master Air Waybill",
  HAWB: "House Air Waybill",
  MANIFEST: "Flight Manifest",
  NOTOC: "NOTOC — Special Cargo Notification",
  DGR_DECLARATION: "DGR Shipper's Declaration",
  GD_SD: "Goods Declaration / Single Declaration",
  OOC: "Out-of-Charge",
  AUTHORITY_LETTER: "Authority Letter",
  CDR_EVIDENCE: "CDR Evidence",
  POD: "Proof of Delivery",
  INVOICE: "Tax Invoice",
  GR_VOUCHER: "Godown Rent Voucher",
  GATE_PASS: "Gate Pass",
  PACKING_LIST: "Packing List",
  COMMERCIAL_INVOICE: "Commercial Invoice",
  ARRIVAL_ADVICE: "Arrival Advice",
};

/**
 * Where the document came from — drives whether OCR applies.
 *
 * `scanner` is reserved for the two OCR points: inbound MAWB/HAWB off the
 * flight pouch, and the receiver's documents at collection. A document
 * marked `scanner` anywhere else is a bug, not a preference — see the
 * SCOPE note in `common.ts`.
 */
export type DocumentSource = "scanner" | "upload" | "generated" | "edi";

export const DOCUMENT_SOURCE_LABEL: Record<DocumentSource, string> = {
  scanner: "Scanned",
  upload: "Uploaded",
  generated: "System-generated",
  edi: "Received via EDI",
};

export interface DocumentVersion {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  /** Superseded versions are marked, never deleted — IsDeleted semantics. */
  superseded: boolean;
  note: string | null;
}

export interface StoredDocument {
  id: string;
  type: DocumentType;
  source: DocumentSource;
  title: string;
  /** Linkage — a document is only useful if it resolves to its record. */
  awbId: number | null;
  AWBNO: string | null;
  IGMNO: string | null;
  /** For evidence packs and CDR attachments. */
  cdrRef: string | null;
  pages: number;
  sizeKb: number;
  uploadedAt: string;
  uploadedBy: string;
  versions: DocumentVersion[];
  /** True where OCR extraction ran against this document. */
  ocrProcessed: boolean;
  /** Mean confidence across extracted items, where OCR ran. */
  ocrMeanConfidence: number | null;
  site: SiteCode;
  /** Archived as part of AWB closure (FC-08 §16). */
  archived: boolean;
}

export function documentTypesForStage(): DocumentType[] {
  return Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[];
}
