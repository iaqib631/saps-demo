"use client";

/**
 * `(hq)` — the headquarters route group. The exact inverse of `(admin)`.
 *
 * WHY A ROUTE GROUP. Same reason as app/(admin): the parentheses are invisible
 * to the router, so every URL below is plain /hq, /hq/sites, /hq/handoffs,
 * /hq/site-admins, /hq/rights — and the group buys this file, one banner held
 * once instead of pasted onto five pages that then drift apart.
 *
 * WHY THE BANNER SAYS THE OPPOSITE THING TO (admin)'s.
 * app/(admin)/layout.tsx warns when the header switcher is on "HQ", because a
 * per-site configuration screen cannot serve "all sites" — a grant across sites
 * is the HQ tier's decision, not the node's. This area IS that tier, so the
 * warning inverts: these screens read every node no matter what the switcher
 * says, and the switcher does not narrow them.
 *
 * That is not a cosmetic difference, it is the whole split. `SiteScope`
 * (lib/domain/common.ts) admits a site code or the literal "HQ", and ~45 domain
 * functions take it; every ordinary screen answers HQ by widening its query.
 * These five do the reverse — they are ALWAYS at HQ scope, because the facts
 * they carry only exist across nodes: which node has not synced, which
 * consignment is between two nodes right now, which node has nobody
 * administering it, and which grants span more than one.
 *
 * So the header switcher is left alone rather than hidden. It still owns the
 * session's scope for every other portal, and a second switcher here — or an
 * "impersonate site" mode — would be a second source of truth for the same
 * setting. The band simply states that these screens ignore it, and the site
 * register at /hq/sites is where a single node is read from HQ instead.
 *
 * NO SUB-NAV. The rail renders the block's leaves whenever one is active, the
 * same reason (admin) gives.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2 } from "lucide-react";
import { useSite } from "@/components/site/SiteContext";
import { DelegationStoreProvider } from "@/components/hq/DelegationStore";
import { HQ, SITES } from "@/lib/domain";

export default function HqAreaLayout({ children }: { children: React.ReactNode }) {
  const { scope, isHq } = useSite();
  const pathname = usePathname();

  return (
    <DelegationStoreProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white">
              <Globe2 size={17} className="text-[#1B4F8B]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1B4F8B]">
                {HQ.name} · headquarters tier
              </p>
              <p className="text-[13px] font-semibold text-[#0F172A]">
                Reading all {SITES.length} nodes — {SITES.map((s) => s.code).join(" · ")}
              </p>
            </div>
          </div>
          <p className="max-w-[46ch] text-[11px] leading-relaxed text-[#475569]">
            {isHq ? (
              <>
                The header switcher is on <strong>HQ</strong>, which matches. These screens read every
                node either way — the switcher does not narrow them.
              </>
            ) : (
              <>
                The header switcher is on <strong>{scope}</strong>, and these screens still read every
                node. Site scope filters the Warehouse portal; it does not filter the tier that
                oversees all of it.
              </>
            )}{" "}
            To read one node from here, open it in the{" "}
            {pathname === "/hq/sites" ? (
              <span className="font-semibold">site register</span>
            ) : (
              <Link href="/hq/sites" className="font-semibold text-[#1B4F8B] no-underline hover:underline">
                site register
              </Link>
            )}
            .
          </p>
        </div>

        {children}
      </div>
    </DelegationStoreProvider>
  );
}
