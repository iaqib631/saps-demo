/**
 * P9-6 · Airmail dispatch detail — M26, FC-18 §03, §04, §09, §11.
 *
 * The entity route. `/awb/[awbId]` is the precedent: one canonical record
 * every other screen in the module can link into, so that the irregularity
 * register, the segregation board and the transfer register all have
 * somewhere to point rather than each carrying their own copy of a dispatch.
 *
 * Server component by the same pattern as the AWB hub — the fixture lookup
 * and the 404 happen here, and the rendering is a client component below.
 */

import { notFound } from "next/navigation";
import { AIRMAIL_DISPATCHES, airmailDispatch } from "@/lib/domain/airmail";
import DispatchDetail from "./DispatchDetail";

export function generateStaticParams() {
  return AIRMAIL_DISPATCHES.map((d) => ({ dispatchId: String(d.id) }));
}

export default async function AirmailDispatchPage({
  params,
}: {
  params: Promise<{ dispatchId: string }>;
}) {
  const { dispatchId } = await params;
  const id = Number(dispatchId);
  if (!Number.isFinite(id)) notFound();

  const dispatch = airmailDispatch(id);
  if (!dispatch) notFound();

  return <DispatchDetail dispatch={dispatch} />;
}
