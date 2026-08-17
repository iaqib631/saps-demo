"use client";

/**
 * The tiles a client will ask for that no fixture can answer.
 *
 * This card is the load-bearing one on the console, even though it contains no
 * numbers. The failure mode for an HQ dashboard is not a missing tile, it is a
 * plausible tile: "184 active users", "87% integration health", "1,247 audit
 * events" all currently render on /admin as literals, and the first thing a
 * client does with a number is ask to drill into it. Every other card on this
 * page names its source function; this one names the four things that have no
 * source and says why, which is what makes the rest of the page trustworthy.
 *
 * Each entry states the concrete blocker — a missing column, a missing store, a
 * missing time dimension — so it reads as a scoping fact rather than an excuse,
 * and so the fix is obvious if the client wants to pay for it.
 */

import Link from "next/link";
import { EyeOff } from "lucide-react";
import { HqCard, NotAvailable } from "@/components/hq/HqUi";
import { DEMO_NOW, formatDateTime } from "@/lib/domain";
import { ESTATE_WIDE_STORES, PER_SITE_STORE } from "@/lib/domain/access";

export default function NotFed() {
  return (
    <HqCard
      title="Not shown, and why"
      icon={EyeOff}
      source="no fixture — stated rather than estimated"
      intro="Four things an HQ console is normally expected to carry. None of them has data behind it in this build, so none of them is drawn."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <NotAvailable
          title="Active users, logins, locked accounts and failed authentication per node"
          reason="There is no session or authentication store anywhere in the demo, and identity is held four times over in component-local arrays — 12 users on /admin/users whose only site hint is a free-text group string, a different 7 on the RBAC snapshot with no site column at all, 17 role slugs on /admin/roles, and 4 requestable role names. No shared key joins them, so any 'active users by site' number would be assembled from lists that do not agree."
          nearest="The delegation register below it answers a narrower question honestly: who has been granted authority over each node, and by whom."
        />
        <NotAvailable
          title="Configuration drift between nodes"
          reason="'KHI runs 2% tolerance, LHE runs 5%' is unrepresentable — there is one value. SettingRow carries key, value, table, origin, unit, options and updatedBy, and no site column; the same is true of cargo classes, charge types, tariff slabs and the lookup registry. A per-node comparison would imply an override that does not exist."
        />
        <NotAvailable
          title="Gateway health per node"
          reason="The integration health board holds nine connectors with no site field — its scope marker is the demo's include/exclude flag, not a station. PSW, SITA, the RFID estate and the payment gateway are single estate-wide connections, so splitting them three ways would be invention."
          nearest="One estate-wide board already exists at /integration-status (FC-12 §12); it is deep-linked rather than copied here."
        />
        <NotAvailable
          title="Trends, sparklines and percentage change"
          reason={`Every fixture in this demo is a single snapshot at ${formatDateTime(DEMO_NOW)}. There is no time series, so there is no yesterday to compare against and no arrow that could point anywhere. Nothing on this console carries one.`}
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#0F172A]">
          Configuration is estate-wide — one store behind all three nodes
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ESTATE_WIDE_STORES.map((s) => (
            <li key={s.label} className="text-[11px] leading-relaxed text-[#64748B]">
              <Link
                href={s.href}
                className="font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                {s.label}
              </Link>{" "}
              — {s.detail}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] leading-relaxed text-[#475569]">
          <span className="font-semibold">The one exception: </span>
          <Link
            href={PER_SITE_STORE.href}
            className="font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            {PER_SITE_STORE.label}
          </Link>{" "}
          — {PER_SITE_STORE.detail}
        </p>
      </div>
    </HqCard>
  );
}
