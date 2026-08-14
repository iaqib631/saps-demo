"use client";

/**
 * P3-3 · Hold Register — full `HOLDINGSTATUS` (29 cols) parity, plus the
 * queue that works them.
 *
 * The audit half of this screen came first. CMTS carries **seven
 * release-side columns** — ReleasePersonName, ReleaseCompany, ReleaseBy,
 * ReleasePersonDesignation, ReleasePersonNic, ReleaseRemarks,
 * ReleaseDateTime — and the demo had never rendered any of them. A hold
 * you cannot see released is only half an audit trail, and the release
 * side is the half that matters in a dispute.
 *
 * The operational half was merged in afterwards, from the compliance-side
 * hold register that ran in parallel. Rendering seven release columns
 * that nothing could ever populate was a promise, not a control, so the
 * create path and the release path now live here — and with them the
 * things a duty officer actually sorts on: which agency, how urgent, whose
 * desk, and whether anyone has touched it.
 *
 * The taxonomy widened in the same move. ANF and ASF are separate hold
 * types rather than one "security" bucket, because they are two different
 * Pakistani agencies and only the one that placed a hold can lift it —
 * see the note on `HoldType` in `lib/domain/exceptions.ts`.
 *
 * Both parties are still fully attributed: name, NIC, company, designation
 * on the hold side and again on the release side. The create path is held
 * to the same standard, so a hold placed here is as attributable as one
 * migrated from CMTS.
 */

import { useMemo, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Eye,
  KeyRound,
  Lock,
  LockOpen,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AgingBadge, AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  DEMO_NOW,
  HOLD_TYPE_LABEL,
  awbByNo,
  cargoClass,
  daysBetween,
  formatDateTime,
  isHoldLive,
  site as siteMaster,
  type HoldType,
  type SiteCode,
} from "@/lib/domain";
import AddHoldDrawer from "./AddHoldDrawer";
import ReleaseHoldDrawer from "./ReleaseHoldDrawer";
import {
  DEFAULT_OWNER_FOR_TYPE,
  HOLD_OWNER_LABEL,
  HOLD_OWNER_ORDER,
  HOLD_PRIORITY_LABEL,
  HOLD_PRIORITY_ORDER,
  HOLD_PRIORITY_TONE,
  HOLD_TYPE_ORDER,
  HOLD_TYPE_TONE,
  HOLD_WORK_STATUS_LABEL,
  HOLD_WORK_STATUS_ORDER,
  HOLD_WORK_STATUS_TONE,
  ageLabel,
  buildHoldRegister,
  holdNoFor,
  type HoldOwnerQueue,
  type HoldPriority,
  type HoldView,
  type HoldWorkStatus,
  type NewHoldDraft,
  type ReleaseDraft,
} from "./model";

/** The seven CMTS release columns, in schema order. */
const RELEASE_COLUMNS = [
  "ReleasePersonName",
  "ReleaseCompany",
  "ReleaseBy",
  "ReleasePersonDesignation",
  "ReleasePersonNic",
  "ReleaseRemarks",
  "ReleaseDateTime",
] as const;

/**
 * Status filter. The canonical screen had an All / Live-only toggle; the
 * merged vocabulary is a strict refinement of that binary, so the two are
 * one selector rather than two controls over the same axis. `live` is kept
 * as its own option because it reads the `Release` column — the thing the
 * FC-07 release gate consults — and not the work status.
 */
type StatusFilter = "all" | "live" | HoldWorkStatus;

const CELL = "px-3.5 py-3 whitespace-nowrap";

export default function HoldRegisterPage() {
  const { scope, isHq } = useSite();

  const seeded = useMemo(() => buildHoldRegister(scope), [scope]);

  /**
   * Holds placed on this screen, and edits made to seeded rows, are kept
   * beside the register rather than inside it. The register is rebuilt
   * whenever the site selector moves, and a copy of the fixture list held
   * in state would go stale the moment it did. Patches are keyed on the
   * hold number — the business key — so they survive that rebuild.
   */
  const [created, setCreated] = useState<HoldView[]>([]);
  const [patches, setPatches] = useState<Record<string, Partial<HoldView>>>({});

  const rows = useMemo(() => {
    const mine = created.filter((h) => scope === "HQ" || h.site === scope);
    return [...mine, ...seeded].map((h) => (patches[h.holdNo] ? { ...h, ...patches[h.holdNo] } : h));
  }, [created, seeded, patches, scope]);

  // ---- filters ----
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<HoldType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<HoldPriority | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<HoldOwnerQueue | "all">("all");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [classFilter, setClassFilter] = useState<number | "all">("all");

  const [selectedHoldNo, setSelectedHoldNo] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<HoldView | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((h) => {
        if (typeFilter !== "all" && h.type !== typeFilter) return false;
        if (statusFilter === "live" && !isHoldLive(h)) return false;
        if (statusFilter !== "all" && statusFilter !== "live" && h.workStatus !== statusFilter)
          return false;
        if (priorityFilter !== "all" && h.priority !== priorityFilter) return false;
        if (ownerFilter !== "all" && h.owner !== ownerFilter) return false;
        if (classFilter !== "all" && h.CARGOCLASSID !== classFilter) return false;
        if (
          createdByFilter.trim() &&
          !h.CreatedBy.toLowerCase().includes(createdByFilter.trim().toLowerCase())
        )
          return false;
        if (q) {
          const hay = [h.holdNo, h.AWBNo, h.HWBNo ?? "", h.reason, h.NameOfPerson, h.HeldBy]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      // Live holds first, then by priority, then newest — the order a duty
      // officer would work the list in. A released hold is history and
      // belongs at the bottom however urgent it once was.
      .sort((a, b) => {
        if (isHoldLive(a) !== isHoldLive(b)) return isHoldLive(a) ? -1 : 1;
        const byPriority =
          HOLD_PRIORITY_ORDER.indexOf(a.priority) - HOLD_PRIORITY_ORDER.indexOf(b.priority);
        if (byPriority !== 0) return byPriority;
        return Date.parse(b.Date) - Date.parse(a.Date);
      });
  }, [rows, query, typeFilter, statusFilter, priorityFilter, ownerFilter, classFilter, createdByFilter]);

  const sel = filtered.find((h) => h.holdNo === selectedHoldNo) ?? filtered[0] ?? null;

  const live = rows.filter(isHoldLive);
  const released = rows.filter((h) => h.Release);
  /**
   * The rows that make the interim statuses worth having: work is done,
   * but the release has not been recorded. `isHoldLive()` reads the
   * `Release` column, so every one of these still blocks the FC-07
   * release gate — a green chip on the register must not be read as
   * "the cargo can move".
   */
  const resolvedNotReleased = rows.filter((h) => h.workStatus === "resolved" && !h.Release);

  const countByType = useMemo(() => {
    const out = {} as Record<HoldType, number>;
    for (const t of HOLD_TYPE_ORDER) out[t] = 0;
    for (const h of rows) out[h.type] += 1;
    return out;
  }, [rows]);

  const classOptions = useMemo(() => {
    const ids = Array.from(new Set(rows.map((h) => h.CARGOCLASSID)));
    return ids
      .map((id) => ({ id, label: cargoClass(id).NAME }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const createdByOptions = useMemo(
    () => Array.from(new Set(rows.map((h) => h.CreatedBy))).sort(),
    [rows],
  );

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: `All holds · ${rows.length}` },
    { value: "live", label: `Live only · ${live.length}` },
    ...HOLD_WORK_STATUS_ORDER.map((s) => ({
      value: s as StatusFilter,
      label: HOLD_WORK_STATUS_LABEL[s],
    })),
  ];

  /** Continues the register's own sequence rather than restarting it. */
  const nextSequence = rows.reduce((max, h) => Math.max(max, h.SEQUENCE), 0) + 1;
  const nextHoldNo = holdNoFor({ SEQUENCE: nextSequence, Date: DEMO_NOW });

  const patch = (holdNo: string, change: Partial<HoldView>) =>
    setPatches((p) => ({
      ...p,
      [holdNo]: {
        ...p[holdNo],
        ...change,
        UpdatedBy: "current.user",
        UpdatedDate: DEMO_NOW,
      },
    }));

  const advance = (h: HoldView, next: HoldWorkStatus) => patch(h.holdNo, { workStatus: next });

  const handleAddHold = (draft: NewHoldDraft) => {
    /**
     * An agency can stop cargo the terminal has not indexed yet — that is
     * the normal case for an ASF hold placed at the screening point — so
     * an AWB number this demo has no record of is accepted rather than
     * rejected. Where the AWB *is* known, its IGM, cargo class and site
     * keys come from the same fixtures every other screen reads, so the
     * new row scopes and links exactly like a migrated one.
     */
    const awb = awbByNo(draft.AWBNo);
    const siteCode: SiteCode = awb?.site ?? (scope === "HQ" ? "KHI" : scope);
    const keys = siteMaster(siteCode);

    const record: HoldView = {
      CreatedBy: "current.user",
      UpdatedBy: null,
      CreatedDate: DEMO_NOW,
      UpdatedDate: null,
      IsActive: true,
      IsDeleted: false,
      CityId: keys.CityId,
      Comp_Code: keys.Comp_Code,
      Off_Code: keys.Off_Code,

      SEQUENCE: nextSequence,
      AWBNo: draft.AWBNo,
      IGMNO: awb?.IGMNO ?? "—",
      HWBNo: draft.HWBNo || null,
      // General Cargo until indexation says otherwise — see above.
      CARGOCLASSID: awb?.CARGOCLASSID ?? 1,
      STATUS: "HELD",
      type: draft.type,

      HeldBy: draft.HeldBy,
      NameOfPerson: draft.NameOfPerson,
      NIC: draft.NIC,
      HoldingCompany: draft.HeldBy,
      Designation: draft.Designation,
      Date: DEMO_NOW,
      REMARKS: draft.notes ? `${draft.description} — ${draft.notes}` : draft.description,

      Release: false,
      ReleasePersonName: null,
      ReleaseCompany: null,
      ReleaseBy: null,
      ReleasePersonDesignation: null,
      ReleasePersonNic: null,
      ReleaseRemarks: null,
      ReleaseDateTime: null,

      site: siteCode,

      holdNo: nextHoldNo,
      reason: draft.reason,
      priority: draft.priority,
      owner: draft.owner,
      workStatus: "active",
      documents: draft.documents,
      releaseDocument: null,
    };

    setCreated((c) => [record, ...c]);
    setSelectedHoldNo(record.holdNo);
    setAddOpen(false);
  };

  const handleRelease = (draft: ReleaseDraft) => {
    if (!releaseTarget) return;
    // All seven columns land in one write, together with the CMTS STATUS
    // flip — a release that sets some of them is the half-record this
    // screen exists to stop.
    patch(releaseTarget.holdNo, {
      STATUS: "RELEASED",
      Release: true,
      ReleasePersonName: draft.ReleasePersonName,
      ReleaseCompany: draft.ReleaseCompany,
      ReleaseBy: draft.ReleaseBy,
      ReleasePersonDesignation: draft.ReleasePersonDesignation,
      ReleasePersonNic: draft.ReleasePersonNic,
      ReleaseRemarks: draft.ReleaseRemarks,
      ReleaseDateTime: DEMO_NOW,
      workStatus: "released",
      releaseDocument: draft.releaseDocument,
    });
    setSelectedHoldNo(releaseTarget.holdNo);
    setReleaseTarget(null);
  };

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setOwnerFilter("all");
    setCreatedByFilter("");
    setClassFilter("all");
  };

  const filtersActive =
    query.trim() !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    ownerFilter !== "all" ||
    createdByFilter.trim() !== "" ||
    classFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Exceptions" }, { label: "Hold Register" }]} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M06
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                CMTS HOLDINGSTATUS · 29 cols
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
              Hold Register
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1 max-w-[68ch]">
              Both sides of every hold, fully attributed — including the seven CMTS release columns —
              and the queue that works them: which agency, how urgent, whose desk.
              {isHq ? " All sites." : ` ${scope} only.`}
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            <Plus size={16} />
            Place hold
          </button>
        </div>
      </div>

      {/* ---- KPI: the register at a glance ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Live holds", value: live.length, tone: "#DC2626" },
          { label: "Released", value: released.length, tone: "#16A34A" },
          {
            label: "Longest live hold",
            value: live.length
              ? `${Math.max(...live.map((h) => daysBetween(h.Date, DEMO_NOW)))}d`
              : "—",
            tone: "#D97706",
          },
          {
            label: "Critical priority",
            value: live.filter((h) => h.priority === "critical").length,
            tone: "#0B2545",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[24px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ---- Per-type counts, doubling as the type filter ---- *
        * The counts are the KPI and the chip is the filter, because a
        * count you cannot click is a number you then have to go and find.
        * ANF and ASF appear as their own tiles here — the single reason
        * the taxonomy was widened. */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Holds by type
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button
            onClick={() => setTypeFilter("all")}
            className="h-9 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
            style={{
              backgroundColor: typeFilter === "all" ? "#0B2545" : "#FFFFFF",
              color: typeFilter === "all" ? "#FFFFFF" : "#475569",
              borderColor: typeFilter === "all" ? "#0B2545" : "#E2E8F0",
            }}
          >
            All types · {rows.length}
          </button>
          {HOLD_TYPE_ORDER.map((t) => {
            const tone = HOLD_TYPE_TONE[t];
            const on = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(on ? "all" : t)}
                className="h-9 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                style={{
                  backgroundColor: on ? tone.bg : "#FFFFFF",
                  color: on ? tone.fg : "#475569",
                  borderColor: on ? tone.fg : "#E2E8F0",
                }}
              >
                {HOLD_TYPE_LABEL[t]} · {countByType[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-[420px] h-10 px-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#1B4F8B] transition-colors">
            <Search size={16} className="text-[#94A3B8] flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hold #, AWB, HAWB, reason or officer"
              className="flex-1 bg-transparent text-[13px] text-[#0F172A] outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E2E8F0] text-[#94A3B8] cursor-pointer"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {statusOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className="h-9 px-3 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
              style={{
                backgroundColor: statusFilter === value ? "#0B2545" : "#FFFFFF",
                color: statusFilter === value ? "#FFFFFF" : "#475569",
                borderColor: statusFilter === value ? "#0B2545" : "#E2E8F0",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as HoldPriority | "all")}
              className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors cursor-pointer"
            >
              <option value="all">Any priority</option>
              {HOLD_PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {HOLD_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Owner queue
            </label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value as HoldOwnerQueue | "all")}
              className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors cursor-pointer"
            >
              <option value="all">Any owner</option>
              {HOLD_OWNER_ORDER.map((o) => (
                <option key={o} value={o}>
                  {HOLD_OWNER_LABEL[o]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Created by
            </label>
            <input
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              list="hold-created-by"
              placeholder="Any user"
              className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
            />
            <datalist id="hold-created-by">
              {createdByOptions.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Cargo class
            </label>
            <select
              value={classFilter}
              onChange={(e) =>
                setClassFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors cursor-pointer"
            >
              <option value="all">Any class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtersActive && (
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#64748B]">
              {filtered.length} of {rows.length} holds
            </span>
            <button
              onClick={clearFilters}
              className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {resolvedNotReleased.length > 0 && (
        <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 flex items-start gap-3">
          <ShieldCheck size={16} className="text-[#D97706] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[#B45309]">
              {resolvedNotReleased.length} hold
              {resolvedNotReleased.length === 1 ? " is" : "s are"} marked Resolved with no release
              recorded
            </p>
            <p className="text-[12px] text-[#92400E] mt-0.5">
              The work is done but the seven release columns are still null, so the FC-07 release
              gate still reads these as live and the cargo cannot move. Record the release —{" "}
              {resolvedNotReleased.map((h) => h.holdNo).join(", ")}.
            </p>
          </div>
        </div>
      )}

      {/* ---- Register ---- */}
      {filtered.length === 0 ? (
        <EmptyState
          title={filtersActive ? "No holds match these filters" : "No holds at this site"}
          description={
            filtersActive
              ? "Clear the filters to see the whole register."
              : "Holds arrive from customs (FC-06), a CDR (FC-04), ANF or ASF screening, or an unpaid balance at the FC-07 release gate."
          }
        />
      ) : (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
            <Lock size={15} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">Register</h3>
            <span className="text-[12px] text-[#94A3B8]">{filtered.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {[
                    "Hold #",
                    "AWB #",
                    "HAWB #",
                    "Type",
                    "Priority",
                    "Reason",
                    "Class",
                    "Placed",
                    "Created by",
                    "Owner",
                    "Status",
                    "Age",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-3.5 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const typeTone = HOLD_TYPE_TONE[h.type];
                  const priorityTone = HOLD_PRIORITY_TONE[h.priority];
                  const statusTone = HOLD_WORK_STATUS_TONE[h.workStatus];
                  const selected = sel?.holdNo === h.holdNo;
                  return (
                    <tr
                      key={h.holdNo}
                      onClick={() => setSelectedHoldNo(h.holdNo)}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      style={{ backgroundColor: selected ? "#EBF0F7" : undefined }}
                    >
                      <td className={CELL}>
                        <span className="font-mono text-[12px] font-semibold text-[#0B2545]">
                          {h.holdNo}
                        </span>
                      </td>
                      <td className={CELL}>
                        <AwbLink awbNo={h.AWBNo} />
                      </td>
                      <td className={CELL}>
                        <span className="font-mono text-[12px] text-[#475569]">
                          {h.HWBNo ?? "—"}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span
                          className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                          style={{ backgroundColor: typeTone.bg, color: typeTone.fg }}
                        >
                          {HOLD_TYPE_LABEL[h.type]}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span
                          className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center"
                          style={{ backgroundColor: priorityTone.bg, color: priorityTone.fg }}
                        >
                          {HOLD_PRIORITY_LABEL[h.priority]}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="text-[12px] text-[#475569] block max-w-[260px] truncate">
                          {h.reason}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span className="text-[12px] font-mono text-[#64748B]">
                          {cargoClass(h.CARGOCLASSID).ABBREVATION}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span className="text-[12px] text-[#475569]">{formatDateTime(h.Date)}</span>
                      </td>
                      <td className={CELL}>
                        <span className="text-[12px] font-mono text-[#475569]">{h.CreatedBy}</span>
                      </td>
                      <td className={CELL}>
                        <span className="text-[12px] text-[#475569]">
                          {HOLD_OWNER_LABEL[h.owner]}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span
                          className="h-[20px] px-2 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                          style={{ backgroundColor: statusTone.bg, color: statusTone.fg }}
                        >
                          {h.Release ? <LockOpen size={9} /> : <Lock size={9} />}
                          {HOLD_WORK_STATUS_LABEL[h.workStatus]}
                        </span>
                      </td>
                      <td className={CELL}>
                        <span className="text-[12px] font-semibold text-[#475569]">
                          {ageLabel(h.Date, h.ReleaseDateTime ?? DEMO_NOW)}
                        </span>
                      </td>
                      <td className={CELL} onClick={(e) => e.stopPropagation()}>
                        {h.Release ? (
                          <span className="text-[11px] text-[#94A3B8]">Closed</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => advance(h, "under-review")}
                              title="Mark under review"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#D97706] cursor-pointer transition-colors"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => advance(h, "escalated")}
                              title="Escalate"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1B4F8B] cursor-pointer transition-colors"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              onClick={() => advance(h, "resolved")}
                              title="Mark resolved — does not release the cargo"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#16A34A] cursor-pointer transition-colors"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              onClick={() => setReleaseTarget(h)}
                              title="Record release"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#DCFCE7] text-[#64748B] hover:text-[#16A34A] cursor-pointer transition-colors"
                            >
                              <LockOpen size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Detail — the 29-column parity half ---- */}
      {sel && (
        <div className="flex flex-col gap-5">
          {/* AWB context */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-semibold text-[#0B2545]">
                    {sel.holdNo}
                  </span>
                  <AwbLink awbNo={sel.AWBNo} awbId={awbByNo(sel.AWBNo)?.AWBId} />
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                    style={{
                      backgroundColor: HOLD_TYPE_TONE[sel.type].bg,
                      color: HOLD_TYPE_TONE[sel.type].fg,
                    }}
                  >
                    {HOLD_TYPE_LABEL[sel.type]}
                  </span>
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                    style={{
                      backgroundColor: HOLD_PRIORITY_TONE[sel.priority].bg,
                      color: HOLD_PRIORITY_TONE[sel.priority].fg,
                    }}
                  >
                    {HOLD_PRIORITY_LABEL[sel.priority]}
                  </span>
                </div>
                <p className="text-[12px] text-[#64748B] mt-1.5">
                  IGM {sel.IGMNO} · {cargoClass(sel.CARGOCLASSID).ABBREVATION}
                  {sel.HWBNo ? ` · HAWB ${sel.HWBNo}` : ""} · sequence {sel.SEQUENCE}
                </p>
              </div>
              <AgingBadge
                totalDays={daysBetween(sel.Date, sel.ReleaseDateTime ?? DEMO_NOW)}
                freeDays={cargoClass(sel.CARGOCLASSID).freeDays}
              />
            </div>
          </div>

          {/* Queue — the merge-added layer, kept visually apart from the
              CMTS columns below so parity stays legible. */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Queue</h3>
              <p className="text-[11px] text-[#94A3B8]">
                AirVault additions — no CMTS column stands behind these
              </p>
            </div>
            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-[#CBD5E1]">OWNER QUEUE</span>
                <span className="text-[13px] font-medium text-[#0F172A]">
                  {HOLD_OWNER_LABEL[sel.owner]}
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  default for {HOLD_TYPE_LABEL[sel.type].toLowerCase()} is{" "}
                  {HOLD_OWNER_LABEL[DEFAULT_OWNER_FOR_TYPE[sel.type]]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-[#CBD5E1]">WORK STATUS</span>
                <span className="text-[13px] font-medium text-[#0F172A]">
                  {HOLD_WORK_STATUS_LABEL[sel.workStatus]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-[#CBD5E1]">AGE</span>
                <span className="text-[13px] font-medium text-[#0F172A]">
                  {ageLabel(sel.Date, sel.ReleaseDateTime ?? DEMO_NOW)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-[#CBD5E1]">REASON</span>
                <span className="text-[13px] font-medium text-[#0F172A] break-words">
                  {sel.reason}
                </span>
              </div>
              <div className="col-span-2 lg:col-span-4 flex flex-col gap-1.5">
                <span className="text-[9px] font-mono text-[#CBD5E1]">SUPPORTING DOCUMENTS</span>
                {sel.documents.length === 0 && !sel.releaseDocument ? (
                  <span className="text-[12px] text-[#94A3B8]">
                    None attached. CMTS `HOLDINGSTATUS` has no document column — a hold argued on
                    remarks alone is a hold argued on somebody&apos;s memory.
                  </span>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {sel.documents.map((d) => (
                      <span
                        key={d}
                        className="h-[26px] px-2.5 rounded-lg bg-[#F1F5F9] text-[#475569] text-[11px] font-medium inline-flex items-center gap-1.5"
                      >
                        <Paperclip size={11} />
                        {d}
                      </span>
                    ))}
                    {sel.releaseDocument && (
                      <span className="h-[26px] px-2.5 rounded-lg bg-[#DCFCE7] text-[#16A34A] text-[11px] font-medium inline-flex items-center gap-1.5">
                        <Paperclip size={11} />
                        {sel.releaseDocument} · release side
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Hold side */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#FEF2F2] flex items-center gap-2">
                <Lock size={15} className="text-[#DC2626]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">Hold side</h3>
                  <p className="text-[11px] text-[#94A3B8]">Who placed it, and on what basis</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
                {(
                  [
                    ["HeldBy", sel.HeldBy],
                    ["NameOfPerson", sel.NameOfPerson],
                    ["NIC", sel.NIC],
                    ["HoldingCompany", sel.HoldingCompany],
                    ["Designation", sel.Designation],
                    ["Date", formatDateTime(sel.Date)],
                    ["STATUS", sel.STATUS],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                    <span className="text-[13px] font-medium text-[#0F172A] break-words">{v}</span>
                  </div>
                ))}
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-[#CBD5E1]">REMARKS</span>
                  <span className="text-[13px] text-[#475569]">{sel.REMARKS}</span>
                </div>
              </div>
            </div>

            {/* Release side — the seven columns */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
              <div
                className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2"
                style={{ backgroundColor: sel.Release ? "#F0FDF4" : "#F8FAFC" }}
              >
                {sel.Release ? (
                  <LockOpen size={15} className="text-[#16A34A]" />
                ) : (
                  <KeyRound size={15} className="text-[#94A3B8]" />
                )}
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">Release side</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Seven CMTS columns — and the action that fills them
                  </p>
                </div>
              </div>

              {sel.Release ? (
                <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
                  {RELEASE_COLUMNS.map((k) => {
                    const raw = sel[k];
                    const v = k === "ReleaseDateTime" && raw ? formatDateTime(raw as string) : raw;
                    return (
                      <div
                        key={k}
                        className={
                          k === "ReleaseRemarks"
                            ? "col-span-2 flex flex-col gap-1"
                            : "flex flex-col gap-1"
                        }
                      >
                        <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                        <span className="text-[13px] font-medium text-[#0F172A] break-words">
                          {v ?? "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5">
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-5 text-center">
                    <ShieldCheck size={20} className="text-[#94A3B8] mx-auto" />
                    <p className="text-[13px] font-semibold text-[#475569] mt-2">
                      Hold is live — release side empty
                    </p>
                    <p className="text-[12px] text-[#94A3B8] mt-1">
                      All seven columns stay null until a release is recorded. Releasing requires a
                      named person, NIC, company and designation — the same attribution the hold
                      side demands.
                    </p>
                    <button
                      onClick={() => setReleaseTarget(sel)}
                      className="mt-3.5 inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[12px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
                      style={{ backgroundColor: "#16A34A" }}
                    >
                      <LockOpen size={14} />
                      Record release
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {RELEASE_COLUMNS.map((k) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-mono text-[#94A3B8]">{k}</span>
                        <span className="text-[11px] text-[#CBD5E1]">null</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {sel.Release && sel.ReleaseDateTime && (
            <div className="rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 flex items-start gap-3">
              <UserCheck size={16} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-[#16A34A]">
                  Released after {daysBetween(sel.Date, sel.ReleaseDateTime)} days
                </p>
                <p className="text-[12px] text-[#15803D] mt-0.5">
                  {sel.ReleasePersonName} ({sel.ReleasePersonDesignation}, {sel.ReleaseCompany}) on{" "}
                  {formatDateTime(sel.ReleaseDateTime)}. Both parties are attributable by NIC — this
                  is the pair of records a dispute is settled on.
                </p>
              </div>
            </div>
          )}

          <AuditStrip record={sel} />
        </div>
      )}

      <AddHoldDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddHold}
        nextHoldNo={nextHoldNo}
      />

      <ReleaseHoldDrawer
        open={releaseTarget !== null}
        hold={releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onSubmit={handleRelease}
      />
    </div>
  );
}
