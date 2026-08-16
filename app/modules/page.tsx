"use client";

/**
 * P0-5 · Module view — FC-12's functional module map.
 *
 * The persona navigation stays as the default. This is the other lens:
 * all 26 modules in their FC-12 tiers with honest coverage, so a
 * stakeholder can see at a glance what exists, what is thin, and what is
 * missing entirely.
 *
 * This page also carries the CMTS absorption narrative, which used to live on
 * the retired CMTS-absorption hub. It belongs here rather than on an import screen
 * because it is an argument about the *map* — which modules are awarded scope
 * and which are the One-Window Vision delta — and there is nowhere else in the
 * app that a reader can see all 26 modules at once to have that argument
 * against.
 */

import Link from "next/link";
import { ArrowUpRight, Database } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import {
  COVERAGE_LABEL,
  COVERAGE_STYLE,
  FLOWS,
  MODULES,
  TIER_LABEL,
  TIER_ORDER,
  coverageSummary,
  modulesByTier,
} from "@/lib/architecture";

/**
 * The CMTS absorption ledger, ported from the retired CMTS-absorption hub.
 *
 * All five legacy modules now have a canonical AirVault screen, so the hub
 * itself is redundant — but the *attribution* is not. Each line names the CMTS
 * tables that module absorbed, and that lineage is the only evidence a reviewer
 * has that the legacy depth actually came across rather than being quietly
 * dropped. Without it, "we absorbed CMTS" is a claim with nothing behind it.
 *
 * Table names are kept in their CMTS spelling — IMPORTMANIFIEST, ACCEPTENCEDETAIL,
 * CARGOACCEPTANCEHWB. The misspellings are the legacy schema's own; correcting
 * them here would break the trace back to the table a migration engineer has to
 * actually read.
 *
 * A local const rather than a lib/domain fixture: this is documentation of a
 * migration, not operational data, and nothing else in the app consumes it.
 */
const CMTS_ABSORPTION: Array<{
  legacy: string;
  tables: string[];
  /** The AirVault module(s) that now own this ground. */
  module: string;
  screen: { label: string; href: string };
}> = [
  {
    legacy: "Manifest Reconciliation",
    tables: ["IMPORTMANIFIEST", "IMPORTAWB"],
    module: "M01 · M03",
    screen: { label: "Manifest & IGM", href: "/import/manifest" },
  },
  {
    legacy: "AWB Consolidation & Split",
    tables: ["AWBCONSOLE", "AWBSplit", "AWBTRANSFER"],
    module: "M03",
    screen: { label: "Consolidation & split", href: "/import/consolidation" },
  },
  {
    legacy: "Godown Rent History",
    tables: ["GODOWNRENT", "GODOWNRENTHistory", "GODOWNRENTDETAIL"],
    module: "M11",
    screen: { label: "Godown rent voucher", href: "/billing/godown-rent" },
  },
  {
    legacy: "Charges Calculator",
    tables: ["CHARGECALCULATER", "CHARGETYPE", "LOCATIONCHARGES"],
    module: "M10",
    screen: { label: "Charges calculator", href: "/billing/calculator" },
  },
  {
    legacy: "Cargo Acceptance Check-in",
    tables: ["CARGOACCEPTANCE", "ACCEPTENCEDETAIL", "CARGOACCEPTANCEHWB"],
    module: "M04",
    screen: { label: "Cargo acceptance", href: "/import/acceptance" },
  },
];

/** The three airmail tables, named so the unbuilt module is still traceable. */
const AIRMAIL_TABLES = ["AIRMAILDELIVERYBILL", "AIRMAILTRANSFERMANIFEST", "POMailType"];

export default function ModulesPage() {
  const summary = coverageSummary();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Module Map" }]} />
        <div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight">
            Functional Module Map
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            FC-12 — all {MODULES.length} modules across three tiers and two spines, running on the
            AirVault platform layer, against {FLOWS.length} flowcharts. Coverage is stated honestly:
            a module that does not exist shows as not started rather than being omitted.
          </p>
        </div>
      </div>

      {/* Coverage summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["built", "partial", "stub", "not-started"] as const).map((c) => (
          <div key={c} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {COVERAGE_LABEL[c]}
            </p>
            <p className="text-[28px] font-bold mt-1" style={{ color: COVERAGE_STYLE[c].fg }}>
              {summary[c]}
            </p>
            <p className="text-[11px] text-[#64748B]">of {MODULES.length} modules</p>
          </div>
        ))}
      </div>

      {/* Tiers */}
      {TIER_ORDER.map((tier) => (
        <div key={tier} className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold text-[#0F172A]">{TIER_LABEL[tier]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {modulesByTier(tier).map((m) => {
              const s = COVERAGE_STYLE[m.coverage];
              return (
                <div
                  key={m.code}
                  className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#94A3B8] font-mono">{m.code}</p>
                      <h3 className="text-[14px] font-semibold text-[#0F172A] leading-snug">
                        {m.name}
                      </h3>
                    </div>
                    <span
                      className="h-[22px] px-2 rounded-full text-[10px] font-bold inline-flex items-center flex-shrink-0"
                      style={{ backgroundColor: s.bg, color: s.fg }}
                    >
                      {COVERAGE_LABEL[m.coverage]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {m.flows.map((f) => (
                      <span
                        key={f}
                        className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono"
                      >
                        {f}
                      </span>
                    ))}
                    <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-semibold inline-flex items-center">
                      {m.phase}
                    </span>
                  </div>

                  {m.gap && <p className="text-[12px] text-[#64748B] leading-relaxed">{m.gap}</p>}

                  {m.screens.length > 0 ? (
                    <div className="flex flex-col gap-1 mt-auto pt-2 border-t border-[#F1F5F9]">
                      {m.screens.map((sc) => (
                        <Link
                          key={sc.href}
                          href={sc.href}
                          className="inline-flex items-center gap-1 text-[12px] text-[#1B4F8B] hover:text-[#0B2545] no-underline"
                        >
                          {sc.label}
                          <ArrowUpRight size={12} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#DC2626] mt-auto pt-2 border-t border-[#F1F5F9]">
                      No screens yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ------------------------------------------------------------------ *
       * CMTS absorption — the One-Window Vision delta.
       *
       * Sits below the tier grid deliberately: the reader should see the whole
       * map first, then be told which slice of it was never in the awarded
       * contract and why it is there anyway.
       * ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#0F172A]">
            CMTS absorption — the One-Window Vision delta
          </h2>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Five of the modules above exist to retire CMTS rather than run it alongside AirVault.
            They are the one slice of this map that was never in the awarded scope, so they are
            called out separately, with the legacy tables each of them absorbed.
          </p>
        </div>

        {/* The scope-delta argument itself. Amber is this codebase's
            extended-scope tone (see /finance-manager/erp-bridge-mapping), so a
            reader who has met that banner elsewhere reads the colour, not just
            the heading. */}
        <div className="rounded-[16px] border border-[#FDE68A] bg-[#FEF3C7]/30 p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
            <Database size={18} color="#D97706" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-[#0F172A] mb-1">
              Why this sits outside the awarded contract scope
            </h3>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              The awarded AirVault Annexure-G described a software backbone but did not detail the
              operational depth needed to fully retire the CMTS system. Absorbing CMTS — its
              manifest reconciliation, AWB split / consol, full godown-rent history, charges
              calculator and distinct cargo acceptance flow — is a One-Window Vision delta, not
              awarded scope. It is the difference between SAPS retiring CMTS and running it in
              parallel, which is why these five modules are on the map at all.
            </p>
          </div>
        </div>

        {/* Per-module source-table attribution. */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CMTS_ABSORPTION.map((a) => (
            <div
              key={a.legacy}
              className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-[#0F172A] leading-snug min-w-0">
                  {a.legacy}
                </h3>
                <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center flex-shrink-0 font-mono">
                  {a.module}
                </span>
              </div>

              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1px] text-[#94A3B8] mb-1.5">
                  CMTS source
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {a.tables.map((t) => (
                    <span
                      key={t}
                      className="h-[20px] px-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] text-[10px] inline-flex items-center font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-2 border-t border-[#F1F5F9]">
                <Link
                  href={a.screen.href}
                  className="inline-flex items-center gap-1 text-[12px] text-[#1B4F8B] hover:text-[#0B2545] no-underline"
                >
                  {a.screen.label}
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#64748B] mb-2">
              CMTS coverage summary
            </p>
            <p className="text-[13px] text-[#475569] leading-relaxed">
              5 absorption modules · ~30 CMTS tables represented · lookups and reference data
              covered by Admin → Master Data. HR / Payroll modules from CMTS are{" "}
              <strong>out of scope</strong> per the revised One-Window Vision — establishment data
              (CEmployee / CDepartment / SHIFT) is read for the planning roster and nothing else.
            </p>
          </div>

          {/* Airmail is the one line of the old CMTS summary that has gone
              stale, and it went stale in both directions at once — so it is
              corrected in full rather than quietly edited. Red matches M26's
              own not-started badge on the tier grid above, so the reader who
              spotted it there lands on the explanation. */}
          <div className="rounded-[16px] border border-[#FECACA] bg-[#FEE2E2]/30 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#DC2626] mb-2">
              Airmail — in scope, unbuilt
            </p>
            <p className="text-[13px] text-[#475569] leading-relaxed">
              The CMTS summary used to say airmail and international cargo would land in Phase 2 as
              a sub-module of manifest reconciliation. Both halves of that are now wrong. Airmail is
              in scope as <strong>FC-18 / M26</strong>, and it is a sub-module of nothing — M26
              stands in Tier 2 as a distinct cargo type processed end to end, borrowing M13 gate
              pass and M14 POD only at the tail. What remains true is that it is unbuilt: three CMTS
              tables, no route, no screen, coverage “not started”. Two questions block the build —
              BLK-01, there is no airmail rate in the tariff master; and postal items do not travel
              on a Single Declaration, so FC-06 does not apply. FC-18 is a specification until SAPS
              answer both.
            </p>
            <div className="mt-3 pt-3 border-t border-[#FECACA] flex items-center gap-1.5 flex-wrap">
              {AIRMAIL_TABLES.map((t) => (
                <span
                  key={t}
                  className="h-[20px] px-1.5 rounded bg-white border border-[#FECACA] text-[#B91C1C] text-[10px] inline-flex items-center font-mono"
                >
                  {t}
                </span>
              ))}
              <Link
                href="/flows/FC-18"
                className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#B91C1C] hover:text-[#7F1D1D] no-underline"
              >
                Walk FC-18
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Flow walkthroughs */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#0F172A]">Flow walkthroughs</h2>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Step through a flowchart screen by screen — FC-01 alone crosses eight portals, which is
            what makes the persona navigation hard to demo against.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FLOWS.map((f) => {
            const implemented = f.steps.filter((s) => s.href).length;
            return (
              <Link
                key={f.id}
                href={`/flows/${f.id}`}
                className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 hover:border-[#2E75B6] transition-colors no-underline"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#94A3B8] font-mono">{f.id}</p>
                  <span className="text-[10px] text-[#94A3B8]">{f.rev}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-[#0F172A] mt-1">{f.title}</h3>
                <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed">{f.subtitle}</p>
                <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[11px] text-[#64748B]">
                    {implemented} of {f.steps.length} steps reachable
                  </span>
                  <span className="text-[12px] font-semibold text-[#1B4F8B] inline-flex items-center gap-1">
                    Walk through <ArrowUpRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
