"use client";

/**
 * Site Register — FC-12 §02, with §01 read from above.
 *
 * §01 is "per-site node — KHI / LHE / PEW, each owning its cargo, storage and
 * finance data" and it hrefs /admin/settings, which is now the Warehouse
 * portal's per-site configuration. This screen is the same three nodes read
 * from the tier that CREATED them: their CMTS key triple, their sync state,
 * who administers them, and what each is carrying — side by side, which is the
 * one thing /admin/settings can never show, because it configures whichever
 * node the header switcher names.
 *
 * WHY THE KEY TRIPLE IS ON THE FACE OF IT. `CityId` / `Comp_Code` / `Off_Code`
 * are what a per-site write is actually addressed to — ~30 CMTS tables carry
 * CityId and ~20 carry the company/office pair. app/(admin)/layout.tsx already
 * renders them as the addressee of a site write; here they are the node's
 * identity, and they are what a new node would have to be issued.
 *
 * "CREATE SITE" IS DELIBERATELY NOT A BUTTON. `SITES` is a const. A control
 * that pushed a fourth node into React state and lost it on reload would be a
 * lie the moment it was presented as provisioning. What HQ can honestly do is
 * decide on a request to promote a station that is on the network footprint but
 * not on the terminal estate — ISB, MUX and UET, the exact list
 * components/admin/users/AccessRequestPanel.tsx already carries and already
 * explains. So the register below the nodes is a decision queue, and the
 * decision is the artefact.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  MapPinned,
  ServerCog,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { HqCard, Meter, SeverityPill, type Severity } from "@/components/hq/HqUi";
import { useDelegations } from "@/components/hq/DelegationStore";
import {
  SITES,
  formatDateTime,
  formatPkr,
  locationsForSite,
  portalKpis,
  type SiteCode,
} from "@/lib/domain";
import {
  PROVISIONING_STATUS_LABEL,
  SITE_PROVISIONING_REQUESTS,
  delegationsForSite,
  formatLag,
  nodeSyncStates,
  type ProvisioningStatus,
} from "@/lib/domain/access";

const SYNC_SEVERITY: Record<string, { severity: Severity; label: string }> = {
  "in-sync": { severity: "good", label: "In sync" },
  lagging: { severity: "warning", label: "Lagging" },
  stale: { severity: "critical", label: "Stale" },
};

const STATUS_SEVERITY: Record<ProvisioningStatus, Severity> = {
  requested: "neutral",
  "under-review": "warning",
  approved: "good",
  declined: "serious",
};

export default function SiteRegisterContent() {
  const { delegations } = useDelegations();
  const sync = nodeSyncStates();
  const [open, setOpen] = useState<SiteCode | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ProvisioningStatus>>({});
  const { addToast } = useToast();

  const decide = (id: string, station: string, status: ProvisioningStatus) => {
    setDecisions((prev) => ({ ...prev, [id]: status }));
    addToast(
      `${station} provisioning request marked "${PROVISIONING_STATUS_LABEL[status]}". Session-local — no node is created.`,
      "success",
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <HqCard
        title="Terminal nodes"
        icon={Building2}
        source="SITES · portalKpis(site) · nodeSyncStates() · delegationsForSite(site)"
        intro="The three nodes the platform runs, with the CMTS key triple each per-site write is addressed to. Open a node to read it from HQ without moving the header switcher."
      >
        <div className="flex flex-col gap-3">
          {SITES.map((s) => {
            const n = sync.find((x) => x.site === s.code)!;
            const tone = SYNC_SEVERITY[n.severity];
            const admins = delegationsForSite(s.code, true, delegations);
            const k = portalKpis(s.code);
            const isOpen = open === s.code;
            const zones = locationsForSite(s.code);
            const cap = zones.reduce((t, z) => t + z.capacityKg, 0);
            const occ = zones.reduce((t, z) => t + z.occupiedKg, 0);

            return (
              <div key={s.code} className="overflow-hidden rounded-[12px] border border-[#E2E8F0]">
                <button
                  onClick={() => setOpen(isOpen ? null : s.code)}
                  className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] px-4 py-3 text-left transition-colors hover:bg-[#F1F5F9]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white">
                      <ServerCog size={17} className="text-[#1B4F8B]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A]">
                        {s.code} · {s.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[#64748B]">
                        CityId {s.CityId} · Comp_Code {s.Comp_Code} · Off_Code {s.Off_Code}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityPill severity={tone.severity} label={tone.label} />
                    <SeverityPill
                      severity={admins.length === 0 ? "critical" : admins.length === 1 ? "warning" : "good"}
                      label={
                        admins.length === 0
                          ? "No administrator"
                          : `${admins.length} administrator${admins.length === 1 ? "" : "s"}`
                      }
                    />
                    <span className="text-[11px] text-[#64748B]">
                      {isOpen ? "Hide" : "Open node"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E2E8F0] bg-white px-4 py-4">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {[
                        ["AWBs on file", String(k.awbsTotal)],
                        ["In the warehouse", String(k.awbsInWarehouse)],
                        ["Open exceptions", `${k.exceptionsOpen} (${k.exceptionsOverThreshold} breaching)`],
                        ["Outstanding", formatPkr(k.outstandingAmount)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            {label}
                          </p>
                          <p className="mt-0.5 text-[15px] font-bold text-[#0F172A]">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold text-[#64748B]">
                          Storage · {zones.length} zones · {((occ / cap) * 100).toFixed(1)}% full
                        </p>
                        <div className="mt-1.5">
                          <Meter pct={(occ / cap) * 100} />
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
                          Storage locations are the only master data keyed per node — every other
                          store behind this site is estate-wide.
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#64748B]">
                          CDC / outbox — last push {formatDateTime(n.lastSyncAt)} (
                          {formatLag(n.minutesStale)})
                        </p>
                        <p className="mt-1 text-[12px] text-[#0F172A]">
                          {n.pendingOutbox} queued row{n.pendingOutbox === 1 ? "" : "s"} ·{" "}
                          {n.offlineCapable ? "offline-capable" : "online only"}
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
                          A node keeps serving cargo while it is off sync, which is why a stale
                          node looks healthy from inside itself.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-[#F1F5F9] pt-3">
                      <p className="text-[11px] font-semibold text-[#64748B]">
                        Active delegations at this node
                      </p>
                      {admins.length === 0 ? (
                        <p className="mt-1 text-[12px] font-semibold text-[#DC2626]">
                          None. Nobody can administer {s.code} —{" "}
                          <Link href="/hq/site-admins" className="underline">
                            delegate an administrator
                          </Link>
                          .
                        </p>
                      ) : (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {admins.map((d) => (
                            <li key={d.delegationId} className="text-[12px] text-[#475569]">
                              <span className="font-mono text-[11px] text-[#94A3B8]">
                                {d.delegationId}
                              </span>{" "}
                              — {d.name} ({d.username}) · {d.roles.join(", ")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <Link
                        href="/hq/site-admins"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                      >
                        Delegations for {s.code} <ArrowUpRight size={12} />
                      </Link>
                      <Link
                        href="/admin/settings"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                      >
                        Configure this node in the Warehouse portal <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </HqCard>

      <HqCard
        title="Network footprint — promotion requests"
        icon={MapPinned}
        source="SITE_PROVISIONING_REQUESTS · lib/domain/access.ts"
        intro="Stations SAPS is present at but does not run a terminal node for. Promoting one is HQ's decision and nobody else's — it issues a CityId, a storage master and a first delegation."
      >
        <div className="mb-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[12px] leading-relaxed text-[#92400E]">
            <span className="font-semibold">There is no Create Site button, deliberately. </span>
            SITES is a constant in the domain. A control that pushed a fourth node into component
            state would vanish on reload, and presenting that as provisioning would be the one kind
            of lie a demo cannot recover from. Deciding a request is real work HQ does; building the
            node is not something a browser can do.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {SITE_PROVISIONING_REQUESTS.map((r) => {
            const status = decisions[r.requestId] ?? r.status;
            return (
              <div
                key={r.requestId}
                className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#0F172A]">
                      {r.station} · {r.stationName}
                    </p>
                    <p className="font-mono text-[10px] text-[#94A3B8]">
                      {r.requestId} · raised by {r.requestedBy} on {formatDateTime(r.requestedAt)}
                    </p>
                  </div>
                  <SeverityPill
                    severity={STATUS_SEVERITY[status]}
                    label={PROVISIONING_STATUS_LABEL[status]}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">{r.note}</p>
                {r.decidedBy && !decisions[r.requestId] && (
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
                    Decided by {r.decidedBy} on {formatDateTime(r.decidedAt ?? r.requestedAt)}.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => decide(r.requestId, r.station, "approved")}
                    disabled={status === "approved"}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0B2545] px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
                  >
                    <CheckCircle2 size={14} /> Approve for build
                  </button>
                  <button
                    onClick={() => decide(r.requestId, r.station, "declined")}
                    disabled={status === "declined"}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-default disabled:opacity-40"
                  >
                    <XCircle size={14} /> Decline
                  </button>
                  <span className="text-[11px] text-[#94A3B8]">
                    A decision records intent; it does not create a node.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </HqCard>
    </div>
  );
}
