import { intBetween, pick, seeded } from "./domain/common";

interface RackLevel {
  level: number;
  status: "available" | "partial" | "full" | "blocked";
  occupancy: number;
}

export interface Rack {
  id: string;
  row: number;
  rack: number;
  levels: RackLevel[];
  awbs: string[];
  handlingClass: string;
}

const rackStatuses = ["available", "partial", "full", "blocked"] as const;

type RackStatus = (typeof rackStatuses)[number];

/**
 * PHR (Pharmaceuticals, cargo class 13) was missing from this list while DGR
 * was in it, so the heat-map could paint a rack "DGR" but had no way to show
 * where pharma sits — the visual half of the pharma → DGR contradiction FC-03
 * forbids. The masters give class 13 its own preferred zone, PHR-STORE at
 * +2 to +8 C under the Cold Chain Officer (lib/domain/masters.ts).
 */
const handlingClasses = ["GCR", "PER", "VAL", "DGR", "COL", "AVI", "HEA", "PHR"];

/**
 * The grid used to be built from Math.random(), which meant the server render
 * and the client render disagreed — the hydration mismatch called out in
 * lib/domain/common.ts — and a rack changed class and occupancy on every
 * refresh, so nothing on the heat-map could be pointed at twice in a demo.
 * One fixed seed through the shared mulberry32 gives the same 144 racks every
 * time, on both sides of the render.
 */
const RACK_SEED = 20260131;

function getOccupancy(status: RackStatus, rng: () => number) {
  if (status === "available") return 0;
  if (status === "partial") return intBetween(rng, 20, 79);
  if (status === "full") return 100;
  return 0;
}

export function generateRacks(): Rack[] {
  const rng = seeded(RACK_SEED);
  return Array.from({ length: 144 }, (_, i) => {
    const row = Math.floor(i / 12) + 1;
    const rack = (i % 12) + 1;
    const baseStatus = pick(rng, rackStatuses);
    const baseOccupancy = getOccupancy(baseStatus, rng);
    return {
      id: `R${String(row).padStart(2, "0")}-${String(rack).padStart(2, "0")}`,
      row,
      rack,
      levels: [
        { level: 1, status: baseStatus, occupancy: baseOccupancy },
        { level: 2, status: rng() > 0.3 ? baseStatus : pick(rng, rackStatuses), occupancy: baseOccupancy },
        { level: 3, status: rng() > 0.5 ? baseStatus : pick(rng, rackStatuses), occupancy: baseOccupancy },
      ],
      awbs: baseStatus !== "available" && baseStatus !== "blocked"
        ? Array.from({ length: intBetween(rng, 1, 3) }, () =>
            `${intBetween(rng, 100, 999)}-${intBetween(rng, 10000000, 99999999)}`
          )
        : [],
      handlingClass: pick(rng, handlingClasses),
    };
  });
}
