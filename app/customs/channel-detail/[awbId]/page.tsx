import { notFound } from "next/navigation";
import {
  CUSTOMS_CLEARANCES,
  DEMO_NOW,
  RISK_CHANNEL_LABEL,
  awbById,
  cargoClass,
  clearanceFor,
  formatDateTime,
  formatKg,
  type SdStatus,
} from "@/lib/domain";
import ChannelDetailContent, { type SummaryData } from "./ChannelDetailContent";

/**
 * FC-06 §04–08 · Channel detail — a drill-in, not a destination.
 *
 * The screen works one declaration, so the declaration belongs in the URL.
 * Until now it had no inbound link from anywhere in the product and no way to
 * say which record it was showing: the summary was a hard-coded const and the
 * only nod to selection was an empty state reading "Select an AWB to view
 * channel detail". `/customs/channels` is the list; this is its detail.
 *
 * The slug is `awbId`, not the clearance's own `id`, for two reasons:
 *   1. `clearanceFor(awbId)` is the lookup the rest of the product already
 *      uses — `clearanceGateFor`, the AWB hub's customs tab and FC-07's
 *      release gate all key customs off the AWB, and there is no
 *      `clearanceById`. Adding one to carry a second identifier for the same
 *      record would give customs two ids.
 *   2. It matches `/awb/[awbId]`, so the same number identifies the same
 *      shipment in both URLs.
 *
 * Shaped after that route throughout: a server page resolving the slug and
 * prerendering one page per fixture record, over a client component that does
 * the interaction.
 */

export function generateStaticParams() {
  return CUSTOMS_CLEARANCES.map((c) => ({ awbId: String(c.awbId) }));
}

/**
 * `SummaryCard` and `TimelineCard` speak a short chip vocabulary
 * ("Under Review", "Query", "Examined"…) that predates the typed `SdStatus`
 * union, whose labels are sentences. This is that seam, keyed as a Record so
 * a new lifecycle state cannot be added without deciding what chip it shows.
 * States with no chip of their own fall through to the neutral grey styling,
 * which is the honest default for them.
 */
const STATUS_CHIP: Record<SdStatus, string> = {
  draft: "Draft",
  filed: "Filed",
  "channel-assigned": "Under Review",
  "under-scrutiny": "Under Review",
  "query-raised": "Query",
  "under-examination": "Exam Scheduled",
  assessed: "Assessed",
  "duty-paid": "Duty Paid",
  "agency-clearance": "Agency Clearance",
  "ooc-issued": "OOC Issued",
  "ooc-verified": "OOC Verified",
  released: "Released",
};

/**
 * Age in queue, measured against the demo's fixed clock rather than
 * `Date.now()` so the prerendered value and the hydrated one agree.
 */
function ageInQueue(filedAt: string | null): string {
  if (!filedAt) return "—";
  const ms = Date.parse(DEMO_NOW) - Date.parse(filedAt);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
}

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ awbId: string }>;
}) {
  const { awbId } = await params;
  const id = Number(awbId);
  if (!Number.isFinite(id)) notFound();

  const clearance = clearanceFor(id);
  const awb = awbById(id);
  if (!clearance || !awb) notFound();

  const summary: SummaryData = {
    awb: clearance.AWBNO,
    gd: clearance.gdNo ?? clearance.sdRef ?? "—",
    channel: clearance.channel ? RISK_CHANNEL_LABEL[clearance.channel] : "Unassigned",
    cha: clearance.cha,
    consignee: awb.CONSIGNEE1,
    filedAt: clearance.filedAt ? formatDateTime(clearance.filedAt) : "—",
    status: STATUS_CHIP[clearance.status],
    age: ageInQueue(clearance.filedAt),
    cargoClass: cargoClass(awb.CARGOCLASSID).NAME,
    pieces: String(awb.TOTALPCS),
    weight: formatKg(awb.TOTALWEIGHT),
  };

  return (
    <ChannelDetailContent
      summary={summary}
      awbId={clearance.awbId}
      initialTab={clearance.channel ?? "yellow"}
    />
  );
}
