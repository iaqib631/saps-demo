"use client";

/**
 * `(admin)` — the site-administration route group.
 *
 * WHY A ROUTE GROUP AT ALL. The parentheses are invisible to the router, so
 * every URL under here is byte-identical to what it was before the move:
 * /admin, /admin/users, /admin/roles, /admin/master-data, /admin/settings,
 * /admin/settings/lookup-registry, /admin/integrations, /admin/audit-trail,
 * /admin/event-log. That is the whole point — the rail, nine flow-step hrefs in
 * lib/architecture.ts (FC-12 §01, §04, §05, §07, §13, §14, §15 and FC-14 §14)
 * and two in-page links (`/storage/master`, `/admin/settings`) all name those
 * paths, and none of them had to change. What the group buys is this file.
 *
 * WHY THIS LAYOUT EARNS ITS PLACE — it states the thing the move is FOR.
 * These nine screens moved out of the Superadmin portal and into the Warehouse
 * portal because administration here is PER SITE: FC-12 §01 is "per-site node —
 * KHI / LHE / PEW, each owning its cargo, storage and finance data", and it
 * hrefs /admin/settings. The HQ tier above it (§02) is a different job on a
 * different portal. Nothing on the nine screens said which of the two they
 * were, and none of them read the active scope at all — the writes they
 * describe simply had no stated addressee.
 *
 * So the band below is the addressee, held once for the whole area rather than
 * pasted onto nine pages that would then drift apart. It is deliberately NOT a
 * second site switcher: the header already owns switching (components/site/
 * SiteSwitcher.tsx). This says which site the configuration under it lands on,
 * which is a claim about the SCREENS, not about the session.
 *
 * AND IT CARRIES THE HQ CASE, which is the one state these screens cannot
 * honestly serve. `SiteScope` admits the literal "HQ", meaning all sites; a
 * user in that scope reading Users or Master Data is looking at configuration
 * with no single owner. Every other site-scoped screen in the demo answers HQ
 * by widening its query — `listAirmailDispatches(scope)` simply returns more
 * rows. Administration cannot do that, because a role granted "at all sites" is
 * a cross-site grant and that is the HQ tier's decision to make, not this
 * area's. Saying so is more useful than silently showing KHI's configuration
 * under an "All sites" header.
 *
 * NO SUB-NAV, deliberately. The rail already renders all nine leaves under the
 * Administration block whenever one of them is active (components/Sidebar.tsx,
 * `renderBlock`), so a second copy in the content column would be the same list
 * twice on the same screen.
 */

import { Building2, TriangleAlert } from "lucide-react";
import { useSite } from "@/components/site/SiteContext";

export default function AdminAreaLayout({ children }: { children: React.ReactNode }) {
  const { site, isHq } = useSite();

  return (
    <div className="flex flex-col gap-6">
      {isHq ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0 text-[#D97706]" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0F172A]">
              Scope is HQ — all sites. Site administration configures one site at a time.
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#64748B]">
              The screens below are the Warehouse portal&apos;s per-site configuration (FC-12 §01):
              one site&apos;s users, roles, master data, settings, connectors and audit trail. Pick
              KHI, LHE or PEW in the header switcher to name the site they write to. Creating sites
              and their site administrators, and granting rights that span sites, is the HQ tier
              (FC-12 §02) and belongs to the Superadmin portal.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E2E8F0] bg-white px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#EBF0F7]">
              <Building2 size={17} className="text-[#1B4F8B]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                Site administration
              </p>
              <p className="truncate text-[13px] font-semibold text-[#0F172A]">
                {site ? `${site.code} · ${site.name}` : "No site selected"}
              </p>
            </div>
          </div>
          {site && (
            <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
              {/* CMTS keys, spelled as the site record spells them (lib/domain/common.ts
                  `SiteKeys`). They are here because they are what a per-site write is
                  actually keyed on — ~20 CMTS tables carry Comp_Code / Off_Code. */}
              <span className="font-mono">
                CityId {site.CityId} · Comp_Code {site.Comp_Code} · Off_Code {site.Off_Code}
              </span>
              <span className="hidden sm:inline text-[#94A3B8]">
                Changes apply to this site only
              </span>
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
