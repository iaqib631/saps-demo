"use client";

/**
 * P9-6 · Airmail segregation & zones — M26, FC-18 §06. **New module.**
 *
 * FC-18 §06 is "mail segregated and stored by mail type", and its own note in
 * `lib/architecture.ts` says why it has never been buildable:
 *
 *     "No mail-type → zone rule exists in CARGOSUBCLASSLOCATION, so FC-03
 *      cannot allocate airmail today."
 *
 * That is the gap this screen fills, and it fills it by *stating a rule*
 * rather than by hiding one. The mail-type → zone mapping below is
 * AirVault's; there is no CMTS column behind any of it. It is on screen, in
 * one table, so SAPS can correct six rows rather than discover a hidden
 * allocation policy at go-live.
 *
 * Why segregation is per mail type and not per dispatch: a single dispatch
 * routinely mixes categories across its receptacles — DXBAA-KHIAA-0421 is
 * five CP receptacles and one AO M-bag, and they do not go to the same place.
 * Storing by dispatch would put an M-bag of printed papers in the parcels
 * lane, and storing EMS anywhere but the secure cage is how EMS goes missing.
 */

import { useMemo } from "react";
import { Boxes, Lock, PackageOpen } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useSite } from "@/components/site/SiteContext";
import { formatDateTime, formatKg } from "@/lib/domain";
import {
  MAIL_TYPE_ZONES,
  PO_MAIL_TYPES,
  airmailSegregationBoard,
  listAirmailDispatches,
  poMailType,
} from "@/lib/domain/airmail";
import AirmailNav, { AirmailProvenanceNote } from "../AirmailNav";
import { Card, Chip, DispatchLink, Kpi } from "../ui";

export default function AirmailSegregationPage() {
  const { scope, isHq } = useSite();

  const board = useMemo(() => airmailSegregationBoard(scope), [scope]);
  const dispatches = useMemo(() => listAirmailDispatches(scope), [scope]);

  /**
   * Zones, not mail types. Two categories share Postal B — AO and M-bags are
   * both bulk printed matter — so a per-type view would report that zone's
   * capacity twice and make it look half as full as it is.
   */
  const zones = useMemo(() => {
    const codes = [...new Set(MAIL_TYPE_ZONES.map((z) => z.zoneCode))];
    return codes.map((code) => {
      const zone = MAIL_TYPE_ZONES.find((z) => z.zoneCode === code)!;
      const cells = board.filter((c) => c.zone.zoneCode === code);
      return {
        zone,
        cells,
        receptacles: cells.reduce((n, c) => n + c.receptacleCount, 0),
        weightKg: cells.reduce((n, c) => n + c.weightKg, 0),
      };
    });
  }, [board]);

  const totalReceptacles = zones.reduce((n, z) => n + z.receptacles, 0);
  const unsegregated = dispatches.filter(
    (d) => d.segregation.length === 0 && d.stage !== "AM11-closed",
  );

  return (
    <div className="flex flex-col gap-6">
      <AirmailNav
        crumb="Segregation & zones"
        title="Airmail segregation & zones"
        subtitle={
          <>
            Mail stored by UPU category across the postal zones. The mail-type → zone rule is
            AirVault&apos;s — CMTS has none, which is precisely why FC-03 cannot allocate airmail.
            {isHq ? " All sites." : ` ${scope} only.`}
          </>
        }
      />

      <AirmailProvenanceNote />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Receptacles stored"
          value={String(totalReceptacles)}
          note={`Across ${zones.length} postal zones`}
        />
        <Kpi
          label="Weight in zones"
          value={formatKg(zones.reduce((n, z) => n + z.weightKg, 0))}
          note="Scale weight where taken, tag weight otherwise"
        />
        <Kpi
          label="Awaiting segregation"
          value={String(unsegregated.length)}
          tone={unsegregated.length > 0 ? "#D97706" : "#0F172A"}
          note="Open dispatches not yet put away"
        />
        <Kpi
          label="Secured zones"
          value={String(zones.filter((z) => z.zone.secured).length)}
          note="EMS and anything dutiable"
        />
      </div>

      {totalReceptacles === 0 && unsegregated.length === 0 ? (
        <EmptyState
          icon={<Boxes size={28} className="text-[#94A3B8]" />}
          title="No mail in the postal zones"
          description="Nothing has reached §06 at this site. Segregation happens after the receptacles are weighed and the §04 variance decision is taken."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {zones.map((z) => {
            const pct =
              z.zone.capacityReceptacles === 0
                ? 0
                : Math.min(100, (z.receptacles / z.zone.capacityReceptacles) * 100);
            return (
              <Card
                key={z.zone.zoneCode}
                title={z.zone.zoneName}
                icon={z.zone.secured ? <Lock size={15} /> : <PackageOpen size={15} />}
                subtitle={
                  <>
                    Zone <span className="font-mono">{z.zone.zoneCode}</span> ·{" "}
                    {z.cells.map((c) => c.mailType.Abbreviation).join(" + ")}
                  </>
                }
                right={
                  z.zone.secured ? (
                    <Chip bg="#F5F3FF" fg="#7C3AED">
                      SECURE CAGE
                    </Chip>
                  ) : undefined
                }
              >
                <div className="px-5 py-4 flex flex-col gap-3">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[20px] font-bold text-[#0F172A]">{z.receptacles}</span>
                      <span className="text-[11px] text-[#94A3B8]">
                        of {z.zone.capacityReceptacles} receptacles
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct > 85 ? "#DC2626" : pct > 60 ? "#D97706" : "#16A34A",
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1">{formatKg(z.weightKg)} held</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {z.cells.flatMap((c) =>
                      c.dispatches.map((x) => (
                        <div
                          key={`${c.mailType.Abbreviation}-${x.id}`}
                          className="flex items-start justify-between gap-2 flex-wrap"
                        >
                          <div className="min-w-0">
                            <DispatchLink id={x.id} dispatchNo={x.dispatchNo} />
                            <p className="text-[11px] text-[#94A3B8] leading-snug">
                              {x.receptacleCount} × {c.mailType.Abbreviation}
                              {c.mailType.priority ? " · priority" : ""}
                            </p>
                          </div>
                          <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                            {x.storedAt ? formatDateTime(x.storedAt) : "not stored"}
                          </span>
                        </div>
                      )),
                    )}
                    {z.receptacles === 0 && (
                      <p className="text-[12px] text-[#94A3B8]">Empty at this scope.</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {unsegregated.length > 0 && (
        <Card
          title="Not yet segregated"
          icon={<Boxes size={15} />}
          subtitle="Open dispatches that have not reached §06."
        >
          <div className="divide-y divide-[#F1F5F9]">
            {unsegregated.map((d) => (
              <div
                key={d.id}
                className="px-5 py-3 flex items-start justify-between gap-3 flex-wrap"
              >
                <div>
                  <DispatchLink id={d.id} dispatchNo={d.dispatchNo} />
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {d.receptacles.length} receptacle(s) · {d.mailType.Abbreviation} → zone{" "}
                    <span className="font-mono">
                      {MAIL_TYPE_ZONES.find((z) => z.mailTypeAbb === d.mailType.Abbreviation)
                        ?.zoneCode ?? "—"}
                    </span>
                  </p>
                </div>
                <span className="text-[11px] text-[#94A3B8]">{d.arrivedFlight}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="The mail-type → zone rule"
        icon={<Boxes size={15} />}
        subtitle="Six rows. All six are AirVault's — there is no CMTS column behind any of them."
        footer="POMailType is a three-column lookup and the restored table is empty, so the categories themselves are seeded from the UPU set printed on a CN-38. SAPS own which of them Karachi actually handles, and what integer key each carries. The demo keys on Abbreviation — business identity — rather than on the surrogate, so a corrected key list changes one fixture and nothing else."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-white border-b border-[#E2E8F0]">
                {["UPU code", "Mail type", "Zone", "Secured", "Capacity", "Worked first"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3 whitespace-nowrap text-[#0B2545]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAIL_TYPE_ZONES.map((z) => {
                const mt = poMailType(z.mailTypeAbb);
                return (
                  <tr key={z.mailTypeAbb} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A]">
                      {z.mailTypeAbb}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#475569]">{mt.MailType}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#475569]">
                      <span className="font-mono">{z.zoneCode}</span> · {z.zoneName}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#475569]">
                      {z.secured ? (
                        <Chip bg="#F5F3FF" fg="#7C3AED">
                          YES
                        </Chip>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#475569]">
                      {z.capacityReceptacles}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#475569]">
                      {mt.priority ? (
                        <Chip bg="#EEF2FF" fg="#4338CA">
                          PRIORITY
                        </Chip>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <h3 className="text-[14px] font-semibold text-[#0F172A]">
          Why &ldquo;worked first&rdquo; is a column at all
        </h3>
        <p className="text-[12px] text-[#475569] mt-1.5 leading-relaxed">
          Letters, cards and EMS are priority mail and come off the ramp before parcels and surface
          air lifted. CMTS has no column for that anywhere, so the working order was tribal knowledge
          — which means it was correct while the people who knew it were on shift and arbitrary
          otherwise. It is modelled here as{" "}
          <span className="font-mono">PoMailType.priority</span> and marked as an AirVault addition,
          because a rule that only exists in a person is not a rule the migration can carry.{" "}
          {PO_MAIL_TYPES.filter((m) => m.priority).length} of {PO_MAIL_TYPES.length} categories carry
          it.
        </p>
      </div>
    </div>
  );
}
