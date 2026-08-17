/**
 * Local fixture for the lifter-operator task pair — `/lifter-operator/tasks`
 * (the list) and `/lifter-operator/task-detail/[taskId]` (the drill-in).
 *
 * Mock-data only, and colocated with the parent list in the same way
 * `/customs/ooc-capture` keeps `candidates.ts` next to its screen: the typed
 * `lib/domain` fixtures model AWBs and pieces, not lifter work orders, so
 * there is nothing upstream to read. What matters is that the *list* and the
 * *detail* now read the same rows — before this file existed each screen
 * carried its own copy, and they disagreed: the list had T-2026-0041 assigned
 * by Imran Ali with handling code DGR and status Assigned, while the detail
 * screen's private copy said Warehouse Manager, AFU and In Progress. One
 * record, one set of values.
 *
 * The three fields below the list's own columns — `hawb`, `currentStatus` and
 * `lifterAsset` — exist because `PieceDetails` renders all twelve fields for
 * whichever task the slug names. They used to be present for exactly one
 * hard-coded task; every task carries them now.
 */

export interface LifterTask {
  /** The slug. `/lifter-operator/task-detail/T-2026-0041`. */
  id: string;
  type: string;
  priority: string;
  awb: string;
  hawb: string;
  pieceId: string;
  rfid: string;
  fromLocation: string;
  toLocation: string;
  cargoClass: string;
  weight: string;
  handlingCode: string;
  timeAssigned: string;
  slaRemaining: string;
  assignedBy: string;
  /** Work-order state — drives which primary action `Actions` offers. */
  status: string;
  /** Where the piece itself is in its lifecycle, not the task's. */
  currentStatus: string;
  lifterAsset: string;
}

export const TASKS: LifterTask[] = [
  {
    id: "T-2026-0041",
    type: "Putaway",
    priority: "High",
    awb: "214-45678901",
    hawb: "HBL-2091",
    pieceId: "P-21445678901-07",
    rfid: "EPC-3008-21445678901-0007",
    fromLocation: "Receiving Bay 02",
    toLocation: "AFU-R02-L1-B04",
    cargoClass: "AFU",
    weight: "52 kg",
    handlingCode: "DGR",
    timeAssigned: "31 May 2026 10:15",
    slaRemaining: "18 min",
    assignedBy: "Imran Ali",
    status: "Assigned",
    currentStatus: "Awaiting Putaway",
    lifterAsset: "FL-03",
  },
  {
    id: "T-2026-0042",
    type: "Pick",
    priority: "Urgent",
    awb: "157-90811223",
    hawb: "HBL-2104",
    pieceId: "P-15790811223-03",
    rfid: "EPC-3008-15790811223-0003",
    fromLocation: "Cold-COL-01",
    toLocation: "Vehicle Bay 03",
    cargoClass: "PER",
    weight: "41 kg",
    handlingCode: "PER",
    timeAssigned: "31 May 2026 10:20",
    slaRemaining: "12 min",
    assignedBy: "Sana Khan",
    status: "In Progress",
    currentStatus: "In Cold Storage",
    lifterAsset: "FL-01",
  },
  {
    id: "T-2026-0043",
    type: "Move",
    priority: "Normal",
    awb: "074-88219033",
    hawb: "HBL-1988",
    pieceId: "P-07488219033-09",
    rfid: "EPC-3008-07488219033-0009",
    fromLocation: "GCR-R05-L2-B01",
    toLocation: "Inspection Bay",
    cargoClass: "GCR",
    weight: "36 kg",
    handlingCode: "---",
    timeAssigned: "31 May 2026 10:30",
    slaRemaining: "45 min",
    assignedBy: "Ahmed Khan",
    status: "Assigned",
    currentStatus: "In Storage",
    lifterAsset: "FL-05",
  },
  {
    id: "T-2026-0044",
    type: "Putaway",
    priority: "Normal",
    awb: "176-33445566",
    hawb: "HBL-2117",
    pieceId: "P-17633445566-02",
    rfid: "EPC-3008-17633445566-0002",
    fromLocation: "Receiving Bay 05",
    toLocation: "GCR-R08-L2-B03",
    cargoClass: "GCR",
    weight: "28 kg",
    handlingCode: "---",
    timeAssigned: "31 May 2026 10:35",
    slaRemaining: "52 min",
    assignedBy: "Imran Ali",
    status: "Assigned",
    currentStatus: "Awaiting Putaway",
    lifterAsset: "FL-02",
  },
  {
    id: "T-2026-0045",
    type: "Charge",
    priority: "High",
    awb: "205-77889900",
    hawb: "HBL-2130",
    pieceId: "P-20577889900-01",
    rfid: "EPC-3008-20577889900-0001",
    fromLocation: "Charging Station A",
    toLocation: "Charging Station A",
    cargoClass: "VAL",
    weight: "85 kg",
    handlingCode: "VAL",
    timeAssigned: "31 May 2026 10:40",
    slaRemaining: "25 min",
    assignedBy: "Sana Khan",
    status: "In Progress",
    currentStatus: "On Charge",
    lifterAsset: "FL-04",
  },
  {
    id: "T-2026-0046",
    type: "Pick",
    priority: "Normal",
    awb: "118-22334455",
    hawb: "HBL-2142",
    pieceId: "P-11822334455-05",
    rfid: "EPC-3008-11822334455-0005",
    fromLocation: "AFU-R03-L1-B02",
    toLocation: "Dolly Bay 04",
    cargoClass: "AFU",
    weight: "63 kg",
    handlingCode: "AOG",
    timeAssigned: "31 May 2026 10:45",
    slaRemaining: "38 min",
    assignedBy: "Ahmed Khan",
    status: "Assigned",
    currentStatus: "In Storage",
    lifterAsset: "FL-01",
  },
  {
    id: "T-2026-0047",
    type: "Move",
    priority: "Urgent",
    awb: "089-55667788",
    hawb: "HBL-2155",
    pieceId: "P-08955667788-11",
    rfid: "EPC-3008-08955667788-0011",
    fromLocation: "Vault-V01",
    toLocation: "Cold-COL-02",
    cargoClass: "VAL",
    weight: "120 kg",
    handlingCode: "VAL",
    timeAssigned: "31 May 2026 10:50",
    slaRemaining: "8 min",
    assignedBy: "Imran Ali",
    status: "Assigned",
    currentStatus: "In Vault",
    lifterAsset: "FL-06",
  },
  {
    id: "T-2026-0048",
    type: "Putaway",
    priority: "Normal",
    awb: "132-99887766",
    hawb: "HBL-2168",
    pieceId: "P-13299887766-04",
    rfid: "EPC-3008-13299887766-0004",
    fromLocation: "Receiving Bay 01",
    toLocation: "PER-COL-03",
    cargoClass: "PER",
    weight: "19 kg",
    handlingCode: "PER",
    timeAssigned: "31 May 2026 10:55",
    slaRemaining: "60 min",
    assignedBy: "Sana Khan",
    status: "Assigned",
    currentStatus: "Awaiting Putaway",
    lifterAsset: "FL-02",
  },
];

/** The slug lookup. Returns null so the route can `notFound()` on a bad id. */
export function taskById(id: string): LifterTask | null {
  return TASKS.find((t) => t.id === id) ?? null;
}
