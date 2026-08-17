"use client";

/**
 * P9-6 · Airmail transfer manifests — M26, FC-18 §07–§08. **New module.**
 *
 * §07 asks whether an onward leg is required; §08 raises the transfer
 * manifest to the receiving carrier or station. FC-18's note on §07 is
 * explicit that the Yes edge is airmail's own path and **does not reuse the
 * FC-09 bonded transhipment register** — bonded cargo moves under a customs
 * permit against a bond, postal mail moves under the UPU convention against a
 * delivery bill, and the two have different instruments, different counters
 * and different failure modes.
 *
 * What they share is the shape of the question, so the gate below is
 * deliberately the same shape as FC-09's re-tender gate: a reviewer who has
 * read one should recognise the other. What it reads is different — every
 * receptacle on the scale, the irregularity closed or instructed, dutiable
 * items released, mail segregated, receiving carrier confirmed.
 *
 * DXBAA-KHIAA-0421 is the case worth opening: three of those five fail at
 * once, and the note holding it is the CN-43 from §05. That is what makes an
 * irregularity a state rather than a label — it stops something.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  PlaneTakeoff,
  Send,
  XCircle,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useSite } from "@/components/site/SiteContext";
import { formatDateTime, formatKg } from "@/lib/domain";
import {
  AIRMAIL_STAGE_LABEL,
  listAirmailTransfers,
} from "@/lib/domain/airmail";
import AirmailNav, { AirmailProvenanceNote } from "../AirmailNav";
import { Card, Chip, DispatchLink, Field, Kpi } from "../ui";

export default function AirmailTransferManifestPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listAirmailTransfers(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(null);
  const row = rows.find((r) => r.dispatch.id === selected) ?? rows[0] ?? null;

  const ready = rows.filter((r) => r.gate.canTransfer);
  const raised = rows.filter((r) => r.manifest !== null);

  return (
    <div className="flex flex-col gap-6">
      <AirmailNav
        crumb="Transfer manifests"
        title="Airmail onward leg & transfer manifest"
        subtitle={
          <>
            §07 decides whether the mail travels on; §08 raises the manifest to the receiving carrier
            or station. Airmail&apos;s own transfer path — not the FC-09 bonded register.
            {isHq ? " All sites." : ` ${scope} only.`}
          </>
        }
      />

      <AirmailProvenanceNote />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Onward legs"
          value={String(rows.length)}
          note="Dispatches where §07 answered Yes"
        />
        <Kpi
          label="Manifest raised"
          value={String(raised.length)}
          note={`${rows.length - raised.length} still to raise`}
        />
        <Kpi
          label="Gate clear"
          value={String(ready.length)}
          tone={ready.length === rows.length ? "#16A34A" : "#D97706"}
          note="All applicable conditions pass"
        />
        <Kpi
          label="Blocked"
          value={String(rows.length - ready.length)}
          tone={rows.length - ready.length > 0 ? "#DC2626" : "#0F172A"}
          note="Cannot be tendered onward yet"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Send size={28} className="text-[#94A3B8]" />}
          title="No onward legs at this site"
          description="Every dispatch in scope terminates here and goes to handover against the delivery bill instead. §07 answered No."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <Card title="Onward legs" icon={<PlaneTakeoff size={15} />} className="h-fit">
            <div className="max-h-[520px] overflow-y-auto">
              {rows.map((r) => {
                const active = row?.dispatch.id === r.dispatch.id;
                return (
                  <button
                    key={r.dispatch.id}
                    onClick={() => setSelected(r.dispatch.id)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: active ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {r.dispatch.dispatchNo}
                      </span>
                      <Chip
                        bg={r.gate.canTransfer ? "#DCFCE7" : "#FEE2E2"}
                        fg={r.gate.canTransfer ? "#16A34A" : "#DC2626"}
                      >
                        {r.gate.canTransfer ? "READY" : `${r.gate.blockedBy.length} BLOCK`}
                      </Chip>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                      → {r.dispatch.poDestination.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] text-[#94A3B8]">
                        {r.manifest ? r.manifest.TRANSFERNO : "no manifest"}
                      </span>
                      <Chip bg="#F1F5F9" fg="#64748B">
                        {r.dispatch.mailType.Abbreviation}
                      </Chip>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {row && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card
                title="§07 → §08 gate"
                icon={<Send size={15} />}
                subtitle={
                  <>
                    Dispatch{" "}
                    <DispatchLink
                      id={row.dispatch.id}
                      dispatchNo={row.dispatch.dispatchNo}
                      className="text-[11px]"
                    />{" "}
                    · {AIRMAIL_STAGE_LABEL[row.dispatch.stage]}
                  </>
                }
                right={
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={
                      row.gate.canTransfer
                        ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                        : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                    }
                  >
                    {row.gate.canTransfer ? "CAN TRANSFER" : "BLOCKED"}
                  </span>
                }
                footer="Same shape as FC-09's re-tender gate, on purpose — an onward leg on postal mail is the same class of act as re-tendering bonded cargo, and a reviewer who has read one should recognise the other. What it reads is different: receptacles and a CN-43, not pieces and a customs permit."
              >
                <div className="divide-y divide-[#F1F5F9]">
                  {row.gate.conditions.map((c) => (
                    <div key={c.code} className="px-5 py-3 flex items-start gap-2.5">
                      <span className="flex-shrink-0 mt-0.5">
                        {!c.applicable ? (
                          <span className="h-[15px] w-[15px] rounded-full bg-[#F1F5F9] inline-flex items-center justify-center text-[9px] font-bold text-[#94A3B8]">
                            –
                          </span>
                        ) : c.pass ? (
                          <CheckCircle2 size={15} className="text-[#16A34A]" />
                        ) : (
                          <XCircle size={15} className="text-[#DC2626]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-[13px] font-medium"
                          style={{ color: c.applicable ? "#0F172A" : "#94A3B8" }}
                        >
                          {c.label}
                        </p>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{
                            color: !c.applicable ? "#94A3B8" : c.pass ? "#64748B" : "#991B1B",
                          }}
                        >
                          {c.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {row.manifest ? (
                <Card
                  title={`Transfer manifest ${row.manifest.TRANSFERNO}`}
                  icon={<PlaneTakeoff size={15} />}
                  subtitle="AIRMAILTRANSFERMANIFEST · all 19 columns. No surrogate key is modelled — the record is keyed on the five-column business key an operator reads off the paper."
                  footer={
                    <>
                      Column names carrying <span className="font-mono font-semibold">?</span> are
                      modelled rather than cited; hover any token for its status. Note{" "}
                      <span className="font-mono">AV7NO</span>: it exists on this table and{" "}
                      <span className="font-semibold">nowhere else</span>, so a dispatch that
                      terminates at its destination has no AV7 number anywhere in CMTS even though
                      §01 receives the mail against that bill. AirVault carries the number on the
                      dispatch instead.
                    </>
                  }
                >
                  <div className="px-5 pt-5">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                      Business key — the five columns that identify the record
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                      <Field label="Transfer number" cmts="TRANSFERNO" value={row.manifest.TRANSFERNO} mono />
                      <Field
                        label="Transfer date"
                        cmts="TRANSFERDATE"
                        value={formatDateTime(row.manifest.TRANSFERDATE)}
                      />
                      <Field label="Dispatch number" cmts="DISPATCHNO" value={row.manifest.DISPATCHNO} mono />
                      <Field
                        label="Dispatch date"
                        cmts="DISPATCHDATE"
                        value={formatDateTime(row.manifest.DISPATCHDATE)}
                      />
                      <Field label="AV7 number" cmts="AV7NO" value={row.manifest.AV7NO} mono />
                    </div>
                  </div>

                  <div className="px-5 pt-5">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                      Arrived by
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                      <Field
                        label="Scheduled flight"
                        cmts="ARRIVEDBYSCHFLT"
                        value={row.manifest.ARRIVEDBYSCHFLT}
                        mono
                      />
                      <Field label="Flight" cmts="ARRIVEDBYFLTNO" value={row.manifest.ARRIVEDBYFLTNO} mono />
                      <Field
                        label="Airline code"
                        cmts="ARRIVEDBYAIRLINEID"
                        value={row.manifest.ARRIVEDBYAIRLINEID}
                        mono
                      />
                      <Field
                        label="Airline"
                        cmts="ARRIVEDBYAIRLINENAME"
                        value={row.manifest.ARRIVEDBYAIRLINENAME}
                      />
                      <Field
                        label="Airline abbreviation"
                        cmts="ARRIVEDBYAIRLINEABB"
                        value={row.manifest.ARRIVEDBYAIRLINEABB}
                        mono
                      />
                      <Field
                        label="Arrived"
                        cmts="ARRIVEDDATE"
                        value={row.manifest.ARRIVEDDATE ? formatDateTime(row.manifest.ARRIVEDDATE) : null}
                      />
                    </div>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                      Transferred to
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                      <Field
                        label="Scheduled flight"
                        cmts="TRANSFERTOSCHFLT"
                        value={row.manifest.TRANSFERTOSCHFLT}
                        mono
                      />
                      <Field label="Flight" cmts="TRANSFERTOFLTNO" value={row.manifest.TRANSFERTOFLTNO} mono />
                      <Field
                        label="Airline code"
                        cmts="TRANSFERTOAIRLINEID"
                        value={row.manifest.TRANSFERTOAIRLINEID}
                        mono
                      />
                      <Field
                        label="Airline"
                        cmts="TRANSFERTOAIRLINENAME"
                        value={row.manifest.TRANSFERTOAIRLINENAME}
                      />
                      <Field
                        label="Airline abbreviation"
                        cmts="TRANSFERTOAIRLINEABB"
                        value={row.manifest.TRANSFERTOAIRLINEABB}
                        mono
                      />
                      <Field label="Receiving station" cmts="TRANSFERTO" value={row.manifest.TRANSFERTO} />
                      <Field label="Origin" cmts="ORIGIN" value={row.manifest.ORIGIN} mono />
                      <Field label="Destination" cmts="DESTINATION" value={row.manifest.DESTINATION} mono />
                      <Field
                        label="On the manifest"
                        value={`${row.dispatch.receptacles.length} receptacles · ${formatKg(
                          row.dispatch.weights.physicalKg,
                        )}`}
                      />
                    </div>
                  </div>
                </Card>
              ) : (
                <Card
                  title="No transfer manifest raised"
                  icon={<Send size={15} />}
                  subtitle="§07 answered Yes, but §08 has not run."
                  footer="On the delivery bill this reads as TRANSFERSTATUS 0 with a null TRANSFERNO — the two columns that join a dispatch to its onward manifest."
                >
                  <div className="px-5 py-5 flex flex-col gap-3">
                    <p className="text-[12px] text-[#475569] leading-relaxed">
                      {row.gate.canTransfer
                        ? "The gate is clear — the manifest can be raised to the receiving carrier."
                        : `The gate is holding it. ${row.gate.blockedBy.length} condition(s) fail:`}
                    </p>
                    {!row.gate.canTransfer && (
                      <ul className="flex flex-col gap-1.5">
                        {row.gate.blockedBy.map((c) => (
                          <li key={c.code} className="text-[12px] text-[#991B1B] leading-relaxed">
                            <span className="font-semibold">{c.label}</span> — {c.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                    {row.dispatch.irregularity && (
                      <Link
                        href="/airmail/irregularities"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                      >
                        {row.dispatch.irregularity.cn43Ref} — the note holding this leg{" "}
                        <ArrowUpRight size={12} />
                      </Link>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
