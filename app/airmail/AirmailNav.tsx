"use client";

/**
 * P9-6 · Shared header for the airmail route tree (M26 / FC-18).
 *
 * Five screens carry the same module badges, the same provenance caveat and
 * the same cross-links, so they live here rather than being re-typed — and,
 * more importantly, so the caveat cannot end up on four of the five.
 *
 * The tab strip lists four routes, not five. `/airmail/[dispatchId]` is the
 * fifth and is deliberately absent: it is an *entity*, reached by opening a
 * row, not a section of the module. It highlights the register tab instead,
 * because that is where the back button goes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";

const ROUTES = [
  { href: "/airmail", label: "Dispatch register", step: "§01–04" },
  { href: "/airmail/irregularities", label: "Irregularities (CN-43)", step: "§05" },
  { href: "/airmail/segregation", label: "Segregation & zones", step: "§06" },
  { href: "/airmail/transfer-manifest", label: "Transfer manifests", step: "§07–08" },
];

/** A dispatch detail page counts as being inside the register. */
const DISPATCH_ROUTE = /^\/airmail\/\d+$/;

export function AirmailBadges() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
        M26
      </span>
      <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
        FC-18 · AIRMAILDELIVERYBILL 25 · AIRMAILTRANSFERMANIFEST 19 · POMailType 3
      </span>
      <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
        NEW MODULE
      </span>
    </div>
  );
}

/**
 * The provenance caveat.
 *
 * Airmail has no rate card, so this is not the illustrative-tariff banner
 * from the tariff screens. It is the narrower — and in one respect sharper —
 * statement of what on these screens is AirVault's rather than SAPS's.
 *
 * The first paragraph is the one that matters and it used to be missing. An
 * earlier draft of this module ended "everything else on these screens is a
 * real CMTS column", which was not true and was the exact failure the scope
 * decisions warn about: an invention that gets mistaken for an extract. The
 * reports give airmail's column *counts* and seven named concepts; they do
 * not give the column names. So the names are stated as modelled, on screen,
 * on every field, rather than in a comment nobody opens.
 */
export function AirmailProvenanceNote() {
  return (
    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
      <Info size={15} className="text-[#D97706] flex-shrink-0 mt-0.5" />
      <div className="text-[11px] leading-relaxed text-[#92400E] flex flex-col gap-2">
        <p>
          <span className="font-semibold">
            Most of the CMTS column names on these screens are modelled, not read.
          </span>{" "}
          The restored database is schema-only and no report in this repo lists the columns of{" "}
          <span className="font-mono">AIRMAILDELIVERYBILL</span>,{" "}
          <span className="font-mono">AIRMAILTRANSFERMANIFEST</span> or{" "}
          <span className="font-mono">POMailType</span> — only their counts (25 / 19 / 3) and seven
          named concepts. Names carrying a trailing{" "}
          <span className="font-mono font-semibold">?</span> are AirVault&apos;s best model of what
          the column is called and are for SAPS to correct; names without one are cited. The counts
          match either way, so the shape is checkable even where a name is not.
        </p>
        <p>
          <span className="font-semibold">Three concepts here have no CMTS column at all.</span> The{" "}
          <span className="font-mono">1.5%</span> weight tolerance at §04 — CMTS has no tolerance
          column, only a free-text <span className="font-mono">IRREGULARITY</span> beside the two
          weights, so the threshold lived in an operator&apos;s head. The mail-type list —{" "}
          <span className="font-mono">POMailType</span> is empty, so the UPU categories are seeded and
          SAPS still own which ones Karachi handles. And the mail-type → zone rule —{" "}
          <span className="font-mono">CARGOSUBCLASSLOCATION</span> carries no postal rule, so FC-03
          cannot allocate airmail today.
        </p>
      </div>
    </div>
  );
}

export default function AirmailNav({
  title,
  subtitle,
  crumb,
}: {
  title: string;
  subtitle: React.ReactNode;
  crumb: string;
}) {
  const pathname = usePathname();
  const onDispatch = DISPATCH_ROUTE.test(pathname);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        items={
          onDispatch
            ? [{ label: "Airmail" }, { label: "Dispatch register", href: "/airmail" }, { label: crumb }]
            : [{ label: "Airmail" }, { label: crumb }]
        }
      />
      <div>
        <AirmailBadges />
        <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
          {title}
        </h1>
        <div className="text-[13px] text-[#64748B] mt-1 max-w-3xl">{subtitle}</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {ROUTES.map((r) => {
          const active = pathname === r.href || (onDispatch && r.href === "/airmail");
          return (
            <Link
              key={r.href}
              href={r.href}
              className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors no-underline inline-flex items-center gap-1.5"
              style={{
                backgroundColor: active ? "#0B2545" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#475569",
                borderColor: active ? "#0B2545" : "#E2E8F0",
              }}
            >
              <span className="font-mono text-[10px] opacity-70">{r.step}</span>
              {r.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
