"use client";

/**
 * Lookup & Setting Registry — CMTS decision Q6.
 *
 * A typed key/value editor that DOES NOT HARD-CODE ITS KEYS. The restored
 * CMTS database is schema-only and SAPS confirmed no extract is coming, so
 * the keys `Lookup` and `Setting` carry are not recoverable. A fixed form
 * would bake in a guess that only fails at migration.
 *
 * Everything on this screen is therefore derived from the store in front of
 * it: the group axis from the separator the key set actually uses, the
 * editor control from each value's shape, an enum's options from the
 * vocabulary sibling keys are observed to share. Point it at a real extract
 * and nothing here needs rewriting — which is the property the decision was
 * taken for.
 *
 * The one thing it asserts loudly is provenance. The seed rows are constants
 * this prototype hard-codes, lifted verbatim; they are AirVault's numbers,
 * not SAPS's, and every row says so.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Braces,
  Boxes,
  Database,
  FlaskConical,
  Info,
  KeyRound,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useToast } from "@/components/ToastContext";
import {
  SEEDED_SETTINGS,
  SETTING_PARITY_NOTE,
  SHAPE_LABEL,
  applyImport,
  detectSeparator,
  groupSettings,
  inferEditor,
  setSettingValue,
  settingStats,
  type ImportPlan,
  type SettingOrigin,
  type SettingRow,
  type SettingTable,
  type ValueShape,
} from "@/lib/domain/settings";
import RegistryGroup from "./RegistryGroup";
import ImportDialog from "./ImportDialog";

type OriginFilter = SettingOrigin | "all";
type TableFilter = SettingTable | "all";
type ShapeFilter = ValueShape | "all";

export default function LookupRegistryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<SettingRow[]>(SEEDED_SETTINGS);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [table, setTable] = useState<TableFilter>("all");
  const [shape, setShape] = useState<ShapeFilter>("all");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const stats = useMemo(() => settingStats(rows), [rows]);

  /* The group axis is computed from the WHOLE store, so filtering the table
     does not silently change what a prefix means. */
  const separator = useMemo(() => detectSeparator(rows.map((r) => r.key)), [rows]);
  const allGroups = useMemo(() => groupSettings(rows, separator), [rows, separator]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (origin !== "all" && row.origin !== origin) return false;
      if (table !== "all" && row.table !== table) return false;
      if (shape !== "all" && inferEditor(row, rows).shape !== shape) return false;
      if (!q) return true;
      return (
        row.key.toLowerCase().includes(q) ||
        row.value.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, origin, table, shape]);

  const visibleGroups = useMemo(() => {
    const groups = groupSettings(filtered, separator);
    return activeGroup === "all" ? groups : groups.filter((g) => g.prefix === activeGroup);
  }, [filtered, separator, activeGroup]);

  const handleCommit = (key: string, value: string) => {
    setRows((prev) => setSettingValue(prev, key, value));
    addToast(`${key} updated`, "success");
  };

  const handleApplyImport = (plan: ImportPlan) => {
    setRows((prev) => applyImport(prev, plan));
    setImportOpen(false);
    addToast(
      `${plan.added} key${plan.added === 1 ? "" : "s"} added, ${plan.updated} updated, ${
        plan.skipped.length
      } line${plan.skipped.length === 1 ? "" : "s"} skipped`,
      "success",
    );
  };

  const handleReset = () => {
    setRows(SEEDED_SETTINGS);
    setActiveGroup("all");
    addToast("Registry reset to the demo seed", "success");
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "System Settings", href: "/admin/settings" },
          { label: "Lookup & Setting Registry" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F172A]">Lookup &amp; Setting Registry</h1>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-[720px]">
            Key-agnostic configuration editor for CMTS{" "}
            <span className="font-mono text-[12px] text-[#1B4F8B]">Lookup</span> and{" "}
            <span className="font-mono text-[12px] text-[#1B4F8B]">Setting</span>. It renders
            whatever keys exist rather than a fixed form — no key set is assumed anywhere in this
            screen.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#64748B] bg-white hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
          >
            <RotateCcw size={14} /> Reset to seed
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[12px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: "#0B2545" }}
          >
            <Upload size={14} /> Import extract
          </button>
        </div>
      </div>

      {/* ---- provenance, stated before any number is read ---- */}
      <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
            <FlaskConical size={18} className="text-[#B45309]" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-bold text-[#0F172A]">
              {stats.seeded} of {stats.total} keys are demo-seeded. They are not SAPS configuration.
            </p>
            <p className="text-[12px] text-[#92400E] leading-[18px] max-w-[900px]">
              Seeded rows were lifted from constants this prototype already hard-codes — the{" "}
              <span className="font-mono">note</span> under each key names the constant and the file
              it still lives in. The call sites have deliberately not been repointed at this store,
              so editing a value here demonstrates the editor; it does not yet change the
              calculation. Rows marked <strong>Migrated</strong> are the ones that came from an
              extract.
            </p>
            <p className="text-[12px] text-[#92400E] leading-[18px] max-w-[900px]">{SETTING_PARITY_NOTE}</p>
          </div>
        </div>
      </div>

      {/* ---- what the screen derived, rather than what it was told ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<KeyRound size={16} />} label="Keys" value={String(stats.total)} tint="#DBEAFE" tone="#1B4F8B" />
        <Stat
          icon={<Boxes size={16} />}
          label="Prefix groups"
          value={String(stats.groups)}
          tint="#EDE9FE"
          tone="#7C3AED"
        />
        <Stat
          icon={<FlaskConical size={16} />}
          label="Demo-seeded"
          value={String(stats.seeded)}
          tint="#FEF3C7"
          tone="#B45309"
        />
        <Stat
          icon={<Database size={16} />}
          label="Migrated"
          value={String(stats.migrated)}
          tint="#DCFCE7"
          tone="#16A34A"
        />
        <Stat
          icon={<Braces size={16} />}
          label="Separator detected"
          value={stats.separator}
          mono
          tint="#F1F5F9"
          tone="#0F172A"
          footnote={`${stats.separatorSupport} of ${stats.total} keys carry it`}
        />
      </div>

      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-[#94A3B8] mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-[#64748B] leading-[18px]">
            Editor controls below are inferred from the <strong>value</strong>, never from the key.
            Hover any shape chip to read the sentence that decided it.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SHAPE_LABEL) as ValueShape[]).map((s) => (
            <button
              key={s}
              onClick={() => setShape(shape === s ? "all" : s)}
              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap"
              style={{
                backgroundColor: shape === s ? "#0B2545" : "white",
                color: shape === s ? "white" : "#64748B",
                borderColor: shape === s ? "#0B2545" : "#E2E8F0",
              }}
            >
              {SHAPE_LABEL[s]} · {stats.shapes[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ---- filters ---- */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[380px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key, value or source constant…"
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
          />
        </div>

        <Segmented
          value={origin}
          onChange={(v) => setOrigin(v as OriginFilter)}
          options={[
            { value: "all", label: "All provenance" },
            { value: "demo-seeded", label: "Demo-seeded" },
            { value: "migrated", label: "Migrated" },
          ]}
        />

        <Segmented
          value={table}
          onChange={(v) => setTable(v as TableFilter)}
          options={[
            { value: "all", label: "Both tables" },
            { value: "Lookup", label: "Lookup" },
            { value: "Setting", label: "Setting" },
          ]}
        />
      </div>

      {/* ---- group navigation, learned from the key set ---- */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveGroup("all")}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold border cursor-pointer transition-colors whitespace-nowrap"
          style={{
            backgroundColor: activeGroup === "all" ? "#0B2545" : "white",
            color: activeGroup === "all" ? "white" : "#64748B",
            borderColor: activeGroup === "all" ? "#0B2545" : "#E2E8F0",
          }}
        >
          All groups
        </button>
        {allGroups.map((g) => (
          <button
            key={g.prefix}
            onClick={() => setActiveGroup(g.prefix)}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold border cursor-pointer transition-colors whitespace-nowrap font-mono"
            style={{
              backgroundColor: activeGroup === g.prefix ? "#0B2545" : "white",
              color: activeGroup === g.prefix ? "white" : "#64748B",
              borderColor: activeGroup === g.prefix ? "#0B2545" : "#E2E8F0",
            }}
          >
            {g.prefix}
            <span className={activeGroup === g.prefix ? "text-[#94A3B8]" : "text-[#CBD5E1]"}>
              {" "}
              {g.rows.length}
            </span>
          </button>
        ))}
      </div>

      {/* ---- the store ---- */}
      {isLoading ? (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <LoadingSkeleton rows={8} columns={6} />
        </div>
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          title="No keys match"
          description="No key, value or source constant matches the current search and filters. Clear them to see the whole registry."
          actionLabel="Clear filters"
          onAction={() => {
            setQuery("");
            setOrigin("all");
            setTable("all");
            setShape("all");
            setActiveGroup("all");
          }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {visibleGroups.map((group) => (
            <RegistryGroup
              key={group.prefix}
              group={group}
              allRows={rows}
              separator={separator}
              onCommit={handleCommit}
            />
          ))}
        </div>
      )}

      {/* ---- where the neighbouring screens sit ---- */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="text-[13px] font-bold text-[#0F172A] mb-2">
          Configuration here, reference data next door
        </h2>
        <p className="text-[12px] text-[#64748B] leading-[18px] max-w-[860px] mb-3">
          This registry holds <strong>configuration</strong> — the tolerances, thresholds, day counts
          and percentages that tune how the terminal behaves, keyed by string. Coded{" "}
          <strong>reference data</strong> — airlines, airports, cargo classes, charge types, banks —
          are rows with their own columns and lifecycle, and belong in the Master Data Editor. The
          fixed System Settings form is the third case: a small, genuinely known set of company
          fields that has always had its own layout.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/master-data"
            className="h-9 px-3 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#1B4F8B] bg-white hover:bg-[#F8FAFC] transition-colors flex items-center whitespace-nowrap"
          >
            Master Data Editor →
          </Link>
          <Link
            href="/admin/settings"
            className="h-9 px-3 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#1B4F8B] bg-white hover:bg-[#F8FAFC] transition-colors flex items-center whitespace-nowrap"
          >
            System Settings →
          </Link>
        </div>
      </div>

      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        store={rows}
        onApply={handleApplyImport}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
  tone,
  mono,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  tone: string;
  mono?: boolean;
  footnote?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: tint, color: tone }}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
          {label}
        </span>
      </div>
      <span className={`text-[22px] font-bold text-[#0F172A] ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      {footnote && <p className="text-[10px] text-[#94A3B8] mt-1">{footnote}</p>}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#E2E8F0] overflow-hidden bg-white">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="h-10 px-3 text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap border-r border-[#E2E8F0] last:border-r-0"
          style={{
            backgroundColor: value === opt.value ? "#0B2545" : "white",
            color: value === opt.value ? "white" : "#64748B",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
