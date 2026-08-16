import { redirect } from "next/navigation";

/**
 * `/customs/channel-detail` with no declaration in the URL.
 *
 * The workbench works one declaration, so with no id there is nothing to
 * work — which is what the old empty state said in words: "Select an AWB to
 * view channel detail. Navigate to the Customs Queue and select an AWB to
 * review its channel-specific workflow." `/customs/channels` is that picker,
 * so the bare route sends you there instead of rendering the instruction.
 *
 * Kept rather than deleted because inbound links to the bare path live
 * outside this route's ownership — `lib/architecture.ts` points FC-06 §05-G,
 * §05-Y and §05-R at it. Those have to land on something real.
 */
export default function ChannelDetailIndexPage() {
  redirect("/customs/channels");
}
