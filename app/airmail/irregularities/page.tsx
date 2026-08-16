"use client";

/**
 * P9-6 · Airmail irregularities — M26, FC-18 §05. **New module.**
 *
 * FC-18 §04 asks whether gross and physical differ beyond tolerance. §05 is
 * what happens when the answer is yes, and this is the register of it.
 *
 * THE ARGUMENT THIS SCREEN MAKES
 * ------------------------------
 * CMTS records the answer in `IRREGULARITY varchar(40)` on the delivery bill.
 * Forty characters of free text cannot hold a status, cannot hold who was
 * notified or when, cannot hold the instruction that came back, and cannot
 * name which receptacles were implicated — so a terminal running on that
 * column can tell you a dispatch was irregular and nothing else. It cannot
 * report, it cannot chase, and it cannot show you what is still open.
 *
 * Here the irregularity is a **CN-43 verification note** — the real postal
 * instrument, what one administration raises against another — with a
 * lifecycle: raised, Post Office notified, carrier notified, awaiting
 * instruction, resolved. The legacy column is rendered beside it, derived
 * from the record and truncated to its real width, so the loss is visible
 * rather than argued about.
 *
 * The demo case is DXBAA-KHIAA-0421: 16.25 kg short of a 134.4 kg AV7 gross,
 * 12.09% against a 1.5% tolerance, two loose parcels never presented and a
 * bag torn along the base seam. It is open, awaiting instruction, and it is
 * holding the Peshawar leg shut on the transfer screen. That is the point of
 * making the irregularity a state instead of a label.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Scale } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StageRail, { type RailStep } from "@/components/exceptions/StageRail";
import { useSite } from "@/components/site/SiteContext";
import { formatDateTime, formatKg } from "@/lib/domain";
import {
  AIRMAIL_TOLERANCE_FLOOR_KG,
  AIRMAIL_WEIGHT_TOLERANCE,
  MAIL_IRREGULARITY_KIND_LABEL,
  MAIL_IRREGULARITY_STATUS_LABEL,
  legacyIrregularityText,
  listMailIrregularities,
  type IrregularityRow,
} from "@/lib/domain/airmail";
import AirmailNav, { AirmailProvenanceNote } from "../AirmailNav";
import { Card, Chip, DispatchLink, Field, IrregularityChip, Kpi } from "../ui";

/**
 * The note's timeline, built from its timestamps rather than from its status
 * enum. A status says where it is; the timestamps say how it got there, and
 * a verification note that has been sitting unanswered for three days is a
 * different problem from one raised this morning.
 */
function timeline(row: IrregularityRow): { steps: RailStep[]; currentKey: string } {
  const x = row.irregularity;
  const steps: RailStep[] = [
    {
      key: "raised",
      label: "CN-43 raised against the dispatch",
      detail: `${formatDateTime(x.raisedAt)} · ${x.raisedBy}`,
    },
    {
      key: "po-notified",
      label: "Office of exchange notified",
      detail: x.poNotifiedAt ? formatDateTime(x.poNotifiedAt) : "Not notified",
    },
    {
      key: "airline-notified",
      label: "Carrier notified",
      detail: x.airlineNotifiedAt ? formatDateTime(x.airlineNotifiedAt) : "Not notified",
    },
    {
      key: "instruction",
      label: "Instruction received",
      detail: x.instructionReceivedAt ? formatDateTime(x.instructionReceivedAt) : "Awaiting",
    },
    {
      key: "resolved",
      label: "Note closed",
      detail: x.resolvedAt ? `${formatDateTime(x.resolvedAt)} · ${x.resolvedBy}` : "Open",
    },
  ];

  const reached = [
    x.resolvedAt ? "resolved" : null,
    x.instructionReceivedAt ? "instruction" : null,
    x.airlineNotifiedAt ? "airline-notified" : null,
    x.poNotifiedAt ? "po-notified" : null,
    "raised",
  ].find((k): k is string => k !== null);

  return { steps, currentKey: reached ?? "raised" };
}

export default function AirmailIrregularitiesPage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listMailIrregularities(scope), [scope]);

  // Open notes first, then oldest first — the chase order, not the file order.
  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.open === b.open ? b.ageDays - a.ageDays : a.open ? -1 : 1,
      ),
    [rows],
  );

  const [selected, setSelected] = useState<number | null>(null);
  const row = ordered.find((r) => r.dispatch.id === selected) ?? ordered[0] ?? null;
  const track = row ? timeline(row) : null;

  const open = ordered.filter((r) => r.open);
  const oldest = open.length ? Math.max(...open.map((r) => r.ageDays)) : 0;
  const shortKg = open.reduce(
    (n, r) => (r.check.direction === "short" ? n + Math.abs(r.check.measure.delta) : n),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <AirmailNav
        crumb="Irregularities"
        title="Airmail irregularities — CN-43"
        subtitle={
          <>
            A verification note raised against a dispatch when it arrives irregular. A record with a
            lifecycle, not the forty characters of free text CMTS reduced it to.
            {isHq ? " All sites." : ` ${scope} only.`}
          </>
        }
      />

      <AirmailProvenanceNote />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Open notes"
          value={String(open.length)}
          tone={open.length > 0 ? "#DC2626" : "#16A34A"}
          note={`${ordered.length - open.length} closed`}
        />
        <Kpi
          label="Oldest open"
          value={open.length ? `${oldest}d` : "—"}
          tone={oldest >= 3 ? "#D97706" : "#0F172A"}
          note="Days since the note was raised"
        />
        <Kpi
          label="Unaccounted weight"
          value={shortKg > 0 ? formatKg(shortKg) : "0.00 kg"}
          tone={shortKg > 0 ? "#DC2626" : "#0F172A"}
          note="Physical under gross, open notes only"
        />
        <Kpi
          label="Tolerance in force"
          value={`${(AIRMAIL_WEIGHT_TOLERANCE * 100).toFixed(1)}%`}
          note={`Floored at ${AIRMAIL_TOLERANCE_FLOOR_KG.toFixed(2)} kg · AirVault's number, not SAPS's`}
        />
      </div>

      <Card
        title="§04 — the rule that produces these notes"
        icon={<Scale size={15} />}
        subtitle="Stated here because in CMTS it was never stated anywhere."
      >
        <div className="px-5 py-4">
          <p className="text-[12px] text-[#475569] leading-relaxed">
            A note is raised when the difference between the AV7 gross and the scale clears{" "}
            <span className="font-semibold">both</span> a{" "}
            {(AIRMAIL_WEIGHT_TOLERANCE * 100).toFixed(1)}% relative tolerance{" "}
            <span className="font-semibold">and</span> a {AIRMAIL_TOLERANCE_FLOOR_KG.toFixed(2)} kg
            absolute floor. Both conditions, not either: the percentage alone would raise a note
            every time a 6 kg tray drifted 200 g, and the floor alone would let a heavy dispatch lose
            several kilos unremarked.
          </p>
          <p className="text-[12px] text-[#475569] leading-relaxed mt-2">
            The figure is deliberately tighter than FC-01&apos;s 2% declared-versus-physical
            tolerance, because a postal dispatch is weighed receptacle by receptacle against tags
            written at the despatching office — a much closer measurement than a declared AWB gross.{" "}
            <span className="font-semibold">
              CMTS has no tolerance column at all, so SAPS have never had to state this number.
            </span>{" "}
            It is one constant in <span className="font-mono">lib/domain/airmail.ts</span>; if they
            state a different one, that constant is the whole change.
          </p>
        </div>
      </Card>

      {ordered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={28} className="text-[#94A3B8]" />}
          title="No irregularities at this site"
          description="Every dispatch in scope reconciled inside tolerance, and no seal, damage or routing note was raised."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <Card title="Verification notes" icon={<AlertTriangle size={15} />} className="h-fit">
            <div className="max-h-[560px] overflow-y-auto">
              {ordered.map((r) => {
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
                        {r.irregularity.cn43Ref}
                      </span>
                      <IrregularityChip open={r.open} />
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                      {MAIL_IRREGULARITY_KIND_LABEL[r.irregularity.kind]} ·{" "}
                      {r.dispatch.dispatchNo}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] text-[#94A3B8]">
                        {r.ageDays}d {r.open ? "open" : "to close"}
                      </span>
                      <Chip
                        bg={r.open ? "#FEF3C7" : "#F1F5F9"}
                        fg={r.open ? "#D97706" : "#64748B"}
                      >
                        {MAIL_IRREGULARITY_STATUS_LABEL[r.irregularity.status].toUpperCase()}
                      </Chip>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {row && track && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card
                title={`${row.irregularity.cn43Ref} — ${MAIL_IRREGULARITY_KIND_LABEL[row.irregularity.kind]}`}
                icon={<AlertTriangle size={15} />}
                subtitle={
                  <>
                    Raised against dispatch{" "}
                    <DispatchLink
                      id={row.dispatch.id}
                      dispatchNo={row.dispatch.dispatchNo}
                      className="text-[11px]"
                    />{" "}
                    · {row.dispatch.poOrigin.name} → {row.dispatch.poDestination.name}
                  </>
                }
                right={<IrregularityChip open={row.open} />}
              >
                <div className="p-5 flex flex-col gap-4">
                  <p className="text-[12px] text-[#334155] leading-relaxed">
                    {row.irregularity.narrative}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3">
                    <Field
                      label="Status"
                      value={MAIL_IRREGULARITY_STATUS_LABEL[row.irregularity.status]}
                      tone={row.open ? "warn" : "ok"}
                    />
                    <Field label="Age" value={`${row.ageDays} days`} />
                    <Field
                      label="Gross at raising"
                      cmts="LOOSEPARCELSGROSSWT"
                      value={formatKg(row.irregularity.observedGrossKg)}
                      mono
                    />
                    <Field
                      label="Physical at raising"
                      cmts="LOOSEPARCELSPHYSICALWT"
                      value={formatKg(row.irregularity.observedPhysicalKg)}
                      mono
                    />
                    <Field
                      label="Variance"
                      value={`${row.irregularity.varianceKg.toFixed(2)} kg · ${(
                        row.irregularity.varianceRatio * 100
                      ).toFixed(2)}%`}
                      mono
                      tone={row.irregularity.kind === "weight-variance" ? "bad" : "default"}
                    />
                    <Field
                      label="Tolerance applied"
                      value={`${(row.irregularity.toleranceApplied * 100).toFixed(1)}%`}
                      mono
                    />
                    <Field label="Mail type" value={row.dispatch.mailType.Abbreviation} mono />
                    <Field label="Flight" value={row.dispatch.arrivedFlight} mono />
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    The weights above are frozen at the moment the note was raised, not read live.
                    A note is a statement about what was observed on a date; re-deriving it from
                    today&apos;s record would quietly rewrite history every time the dispatch was
                    touched.
                  </p>

                  <div>
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                      Receptacles implicated
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {row.irregularity.receptaclesAffected.map((n) => (
                        <span
                          key={n}
                          className="font-mono text-[11px] px-2 py-1 rounded bg-[#FEF2F2] text-[#991B1B]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>

                  {row.irregularity.instructionText && (
                    <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
                      <p className="text-[11px] font-semibold text-[#166534] uppercase tracking-wider">
                        Instruction from the office of exchange
                      </p>
                      <p className="text-[12px] text-[#166534] mt-1 leading-relaxed">
                        {row.irregularity.instructionText}
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        The same note, as CMTS would store it
                      </span>
                      <span className="text-[9px] font-mono text-[#94A3B8]">
                        IRREGULARITY varchar(40)
                      </span>
                    </div>
                    <p className="font-mono text-[12px] text-[#0F172A] mt-1.5 px-3 py-2 rounded-lg bg-white border border-[#E2E8F0] inline-block">
                      {legacyIrregularityText(row.irregularity)}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
                      That string is <em>derived</em> from the record above and truncated to the
                      column&apos;s real width — it is what the migration would actually write back.
                      Everything else on this card is what forty characters cannot hold. Which is the
                      whole argument: the record is the source, the column is its shadow, and the
                      shadow is not something you can chase a foreign postal administration with.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                <StageRail
                  steps={track.steps}
                  currentKey={track.currentKey}
                  title="Note lifecycle"
                  tone="#DC2626"
                  note="Both notifications go out on the same finding — the office of exchange owns the mail, the carrier owns the leg it went missing on, and neither can be told later that they were told."
                />

                <Card
                  title="What this note is holding up"
                  icon={<ArrowUpRight size={15} />}
                  subtitle="An irregularity that blocks nothing is a label. This one is a state."
                >
                  <div className="px-5 py-4 flex flex-col gap-2.5">
                    <p className="text-[12px] text-[#475569] leading-relaxed">
                      {row.open
                        ? row.dispatch.onwardLegRequired
                          ? `${row.dispatch.dispatchNo} has an onward leg to ${row.dispatch.poDestination.name}, and the §07 gate reads this note directly: while it is open the transfer manifest cannot be raised. The dispatch is stopped at ${row.dispatch.site}, and the register says why.`
                          : `${row.dispatch.dispatchNo} terminates at ${row.dispatch.site}, so no transfer is blocked — but the note stays open against the dispatch and the handover at §11 carries it.`
                        : `Closed. The dispatch moved on: the §07 gate reads a resolved note as satisfied, which is why ${row.dispatch.dispatchNo} was able to complete.`}
                    </p>
                    <Link
                      href={`/airmail/${row.dispatch.id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                    >
                      Open the dispatch <ArrowUpRight size={12} />
                    </Link>
                    <Link
                      href="/airmail/transfer-manifest"
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                    >
                      §07–08 transfer gate <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
