"use client";

/**
 * HQ Console — FC-12 §02, "Islamabad HQ tier — scope HQ means all sites;
 * CDC / outbox sync".
 *
 * §02 hrefs /integration-status today, which is the gateway health board: nine
 * connectors, no site dimension, nothing about the HQ tier. So §02 has never
 * had a screen. This is it.
 *
 * THE TEST EVERY TILE HAD TO PASS: could a screen inside one site render this?
 * If yes it belongs in the Warehouse portal, not here. What survives is
 *
 *   · which node has stopped pushing its outbox      — SITES, cross-node
 *   · which node nobody is administering             — delegations, cross-node
 *   · that the per-node columns sum to the estate    — needs all four scopes
 *   · which node is carrying the breaches            — a distribution
 *   · cargo that is between two nodes right now      — belongs to neither
 *   · a zone that is tight at every node at once     — a pattern, not a value
 *
 * ORDER IS BY WHAT A CLIENT SHOULD SEE FIRST, not by lane: node state, then the
 * roll-up that proves the numbers are real, then the breaches, then the leg in
 * transit, then capacity and money, then the honest gaps. The gaps card is last
 * because it is read as a footnote and first in importance — every other card
 * on this page prints the domain function it came from, and that card is why
 * that habit is worth anything.
 *
 * NO NUMBER ON THIS PAGE IS WRITTEN DOWN. Every figure is computed from
 * lib/domain at render, so a fixture change moves the console with it.
 */

import Breadcrumb from "@/components/Breadcrumb";
import { HqScreenHeader } from "@/components/hq/HqUi";
import { AdministratorCoverage, NodeSyncHealth } from "@/components/hq/console/EstateHealth";
import { EstateRollup, ExposureBySite } from "@/components/hq/console/EstateRollup";
import BreachBoard from "@/components/hq/console/BreachBoard";
import CrossSiteCargo from "@/components/hq/console/CrossSiteCargo";
import { OpenCaseRegisters, StoragePressure } from "@/components/hq/console/EstatePressure";
import NotFed from "@/components/hq/console/NotFed";

export default function HqConsolePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Headquarters" }, { label: "HQ Console" }]} />
        <HqScreenHeader
          module="M20"
          flow="FC-12 §02"
          title="HQ Console"
          lede="Islamabad headquarters, reading all three terminal nodes at once. Everything here is a fact about the estate rather than about a site — a node that has stopped syncing, a node nobody administers, cargo between two nodes, and a breach distribution that is not even."
        />
      </div>

      <NodeSyncHealth />
      <AdministratorCoverage />
      <EstateRollup />
      <BreachBoard />
      <CrossSiteCargo />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StoragePressure />
        <ExposureBySite />
      </div>

      <OpenCaseRegisters />
      <NotFed />
    </div>
  );
}
