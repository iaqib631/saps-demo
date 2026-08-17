/**
 * CMTS `Lookup` (5 cols) / `Setting` (2 cols) — runtime configuration,
 * modelled **key-agnostically**.
 *
 * ── Why there is no key list in this file ─────────────────────────────
 * Decision Q6 in CMTS_SCOPE_DECISIONS.md. The restored CMTS database is
 * schema-only, so the keys these two tables actually carry are not
 * recoverable — not by deciding, not by inference, not by asking (SAPS
 * confirmed no extract is coming). Any fixed key list written here would
 * be a guess that only fails at migration, silently, after the screen has
 * been demoed as if it worked.
 *
 * So nothing below branches on a key. Every behaviour is derived from the
 * **shape of the value**, from the **structure of the key string**, or
 * from what other rows in the same store happen to look like:
 *
 *   - grouping        → `detectSeparator` + `groupKey`, learned from the
 *                       key set present, not from a fixed prefix list
 *   - editor control  → `inferEditor`, from the value shape
 *   - enum options    → observed sibling vocabulary, never a whitelist
 *   - import          → unknown keys are ADDED, never rejected
 *
 * Swap the whole store for a SAPS extract and none of this needs a change.
 * That is the property the decision was bought for.
 *
 * ── What is NOT claimed here ──────────────────────────────────────────
 * The audit records the arity of the two legacy tables (`Lookup` 5 columns,
 * `Setting` 2) and nothing more — their COLUMN NAMES are not in the restored
 * schema dump we have. So this module deliberately does not invent uppercase
 * column identifiers for them. The parity token rendered on screen names the
 * legacy **table**, and `SETTING_PARITY_NOTE` states plainly that the column
 * mapping is still open. Inventing `LOOKUPKEY` / `SETTINGVALUE` here would
 * read as recovered parity to the next person and it is not.
 *
 * The `table` split below (`Setting` for global scalars, `Lookup` for one
 * member of a coded family) is likewise an AirVault inference from the column
 * counts, not a fact about SAPS's data. It is recorded as such.
 *
 * ── Provenance ────────────────────────────────────────────────────────
 * Every row carries `origin`. `demo-seeded` rows were lifted from constants
 * this prototype already hard-codes (see `note` — it names the constant and
 * the file). They are AirVault's own numbers and MUST NOT be read as SAPS
 * configuration. `migrated` rows are the ones that arrived from an extract.
 * The distinction is rendered on every row, not just totalled at the top.
 */

import { DEMO_NOW, MS_PER_DAY } from "./common";

/* ================================================================== *
 * Types
 * ================================================================== */

/** Which legacy key/value table a row is assigned to. */
export type SettingTable = "Lookup" | "Setting";

export type SettingOrigin = "demo-seeded" | "migrated";

/**
 * The five value shapes the editor can infer.
 *
 * Deliberately coarse. A finer set (money, percent, duration…) could only be
 * separated by reading the KEY, which is exactly what this module refuses to
 * do. Units are carried as display metadata instead — see `SettingRow.unit`.
 */
export type ValueShape = "boolean" | "number" | "date" | "enum" | "text";

export interface SettingRow {
  /** The key exactly as stored. Never parsed for meaning, only for structure. */
  key: string;
  /**
   * Always held as text. Both legacy tables are varchar key/value stores, so
   * typing happens on read (`inferEditor`) rather than in the column — which
   * is also what lets an unknown key round-trip without a schema for it.
   */
  value: string;
  /** AirVault inference from the legacy column counts — see the file header. */
  table: SettingTable;
  origin: SettingOrigin;
  /**
   * For `demo-seeded` rows: the constant and file this key was lifted from.
   * For `migrated` rows: whatever the extract said, or null.
   */
  note: string | null;
  /** Display-only suffix ("%", "days", "kg", "PKR"). Never drives the editor. */
  unit: string | null;
  /**
   * Explicit option list when the SOURCE supplied one. `null` means "infer" —
   * which is the normal case, because an extract rarely carries its domain.
   */
  options: string[] | null;
  /** ISO-8601. Derived from DEMO_NOW — deterministic, never Date.now(). */
  updatedAt: string;
  updatedBy: string;
}

/* ================================================================== *
 * Key structure — grouping without a prefix whitelist
 * ================================================================== */

/**
 * Separator candidates, most-structural first.
 *
 * Order matters only for the per-key fallback in `groupKey`: a key containing
 * both `.` and `_` is far more likely to be `a.b_c` than `a_b.c`.
 */
export const SETTING_KEY_SEPARATORS = [".", "/", ":", "|", "_", "-"] as const;

/** Rows with no separator at all land here rather than being hidden. */
export const UNGROUPED = "(ungrouped)";

/**
 * Pick the separator this key set actually uses, by counting.
 *
 * A SAPS extract might use `GR_FREE_DAYS`, `billing.tax.rate`, `Billing/Tax` —
 * nobody knows which. Rather than assume, the store is asked. Consensus is
 * used for the group axis so the grouping is stable across the whole screen;
 * `groupKey` still falls back per key so an odd-one-out is not stranded.
 */
export function detectSeparator(keys: string[]): string {
  let best = SETTING_KEY_SEPARATORS[0] as string;
  let bestCount = -1;
  for (const sep of SETTING_KEY_SEPARATORS) {
    const count = keys.filter((k) => k.includes(sep)).length;
    if (count > bestCount) {
      best = sep;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : (SETTING_KEY_SEPARATORS[0] as string);
}

/** How many keys back the detected separator — shown so the guess is visible. */
export function separatorSupport(keys: string[], sep: string): number {
  return keys.filter((k) => k.includes(sep)).length;
}

/**
 * The group a key belongs to: everything before its first separator.
 *
 * Falls back through the other candidates for keys that do not carry the
 * consensus one, so a mixed extract still groups rather than collapsing into
 * one undifferentiated bucket.
 */
export function groupKey(key: string, sep: string): string {
  const at = key.indexOf(sep);
  if (at > 0) return key.slice(0, at);
  for (const alt of SETTING_KEY_SEPARATORS) {
    const i = key.indexOf(alt);
    if (i > 0) return key.slice(0, i);
  }
  return UNGROUPED;
}

/**
 * The last segment of a key, split on ANY separator.
 *
 * This is the enum signal. `billing.tax.rounding.mode` and a legacy
 * `GR_ROUNDING_MODE` share the leaf `mode`, which is the only evidence an
 * empty database can offer that two keys draw on the same vocabulary.
 */
export function leafSegment(key: string): string {
  const cached = LEAF_CACHE.get(key);
  if (cached !== undefined) return cached;
  let last = key;
  for (const sep of SETTING_KEY_SEPARATORS) {
    const i = last.lastIndexOf(sep);
    if (i >= 0 && i < last.length - 1) last = last.slice(i + 1);
  }
  const leaf = last.toLowerCase();
  LEAF_CACHE.set(key, leaf);
  return leaf;
}

/**
 * Enum inference is O(store²) — every row scans every other row for its leaf.
 * That is fine at a few hundred keys only because the split itself is cached;
 * keys are immutable strings, so the cache can never go stale.
 */
const LEAF_CACHE = new Map<string, string>();

export interface SettingGroup {
  prefix: string;
  rows: SettingRow[];
  seeded: number;
  migrated: number;
}

/**
 * Group rows by key prefix so a few hundred keys stay navigable.
 *
 * Groups are sorted by size then name: with an unknown key set, the biggest
 * cluster is the most likely place to start reading.
 */
export function groupSettings(rows: SettingRow[], sep?: string): SettingGroup[] {
  const separator = sep ?? detectSeparator(rows.map((r) => r.key));
  const buckets = new Map<string, SettingRow[]>();
  for (const row of rows) {
    const g = groupKey(row.key, separator);
    const list = buckets.get(g);
    if (list) list.push(row);
    else buckets.set(g, [row]);
  }
  return [...buckets.entries()]
    .map(([prefix, groupRows]) => ({
      prefix,
      rows: [...groupRows].sort((a, b) => a.key.localeCompare(b.key)),
      seeded: groupRows.filter((r) => r.origin === "demo-seeded").length,
      migrated: groupRows.filter((r) => r.origin === "migrated").length,
    }))
    .sort((a, b) => b.rows.length - a.rows.length || a.prefix.localeCompare(b.prefix));
}

/* ================================================================== *
 * Value shape inference — the editor comes from the VALUE, not the key
 * ================================================================== */

const TRUE_TOKENS = ["true", "yes", "y", "on", "enabled"];
const FALSE_TOKENS = ["false", "no", "n", "off", "disabled"];

/**
 * `"1"` / `"0"` are deliberately NOT boolean tokens.
 *
 * They are indistinguishable from a numeric setting, and reading a count of
 * one as `true` is the sort of quiet type error this whole module exists to
 * avoid. A legacy store that uses 1/0 flags will show them as numbers, which
 * is honest — an operator can still edit them, and nothing has been guessed.
 */
export function parseBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (TRUE_TOKENS.includes(v)) return true;
  if (FALSE_TOKENS.includes(v)) return false;
  return null;
}

/**
 * The true/false pair a boolean control should write, in the store's own
 * vocabulary and casing.
 *
 * A store that says `yes` / `no` must still say `yes` / `no` after an edit.
 * Normalising to `true` / `false` on a click would be a UI interaction quietly
 * rewriting data — and on an unknown key set, the vocabulary is the only clue
 * anyone has about what the legacy application expected to read back.
 * `TRUE_TOKENS` and `FALSE_TOKENS` are index-paired for exactly this.
 */
export function booleanTokens(value: string): { trueToken: string; falseToken: string } {
  const v = value.trim().toLowerCase();
  const i = TRUE_TOKENS.indexOf(v) >= 0 ? TRUE_TOKENS.indexOf(v) : FALSE_TOKENS.indexOf(v);
  const pair = i >= 0 ? { trueToken: TRUE_TOKENS[i], falseToken: FALSE_TOKENS[i] } : { trueToken: "true", falseToken: "false" };
  const upper = value === value.toUpperCase() && value !== value.toLowerCase();
  return upper
    ? { trueToken: pair.trueToken.toUpperCase(), falseToken: pair.falseToken.toUpperCase() }
    : pair;
}

export function isNumeric(value: string): boolean {
  const v = value.trim();
  if (v === "") return false;
  return /^-?\d+(\.\d+)?$/.test(v);
}

export type DatePrecision = "date" | "datetime";

/** ISO-8601 only. A locale-formatted date is text until somebody says otherwise. */
export function isoDatePrecision(value: string): DatePrecision | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return Number.isNaN(Date.parse(v)) ? null : "date";
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(v)) {
    return Number.isNaN(Date.parse(v)) ? null : "datetime";
  }
  return null;
}

/** A bare code-like value: no whitespace, starts with a letter, short. */
export function isTokenShaped(value: string): boolean {
  const v = value.trim();
  return /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/.test(v);
}

export interface EditorSpec {
  shape: ValueShape;
  /**
   * Why this shape was chosen, in one sentence, rendered as a tooltip.
   *
   * The reason is part of the contract: an operator looking at a checkbox
   * must be able to see that a VALUE made it a checkbox, so nobody concludes
   * the app has a hard-coded list of boolean keys.
   */
  reason: string;
  /** Populated for `enum` only. */
  options: string[];
  /** For `number` — whether every observed value parses as a whole number. */
  integer: boolean;
  /** For `date` — which control to render. */
  precision: DatePrecision | null;
}

/**
 * Infer the editor for one row, using the rest of the store as context.
 *
 * Order is deliberate and each step is a stronger claim than the one after:
 *
 *   1. the SOURCE supplied an option list          → enum   (stated)
 *   2. the value is a boolean literal              → boolean(unambiguous)
 *   3. the value is an ISO date                    → date   (unambiguous)
 *   4. the value is numeric                        → number (unambiguous)
 *   5. sibling keys share a token vocabulary       → enum   (inferred)
 *   6. otherwise                                   → text   (no claim)
 *
 * Steps 2–4 sit above the enum inference on purpose: `true` and `2026-06-01`
 * are token-shaped too, and an enum of {true, false} would be a worse control
 * than a checkbox for the same data.
 */
export function inferEditor(row: SettingRow, all: SettingRow[]): EditorSpec {
  if (row.options && row.options.length > 0) {
    return {
      shape: "enum",
      reason: `The source supplied an option list (${row.options.length} values); no key was consulted.`,
      options: [...row.options],
      integer: false,
      precision: null,
    };
  }

  if (parseBoolean(row.value) !== null) {
    return {
      shape: "boolean",
      reason: `Value "${row.value}" is a boolean literal.`,
      options: [],
      integer: false,
      precision: null,
    };
  }

  const precision = isoDatePrecision(row.value);
  if (precision) {
    return {
      shape: "date",
      reason: `Value "${row.value}" parses as an ISO-8601 ${precision}.`,
      options: [],
      integer: false,
      precision,
    };
  }

  if (isNumeric(row.value)) {
    return {
      shape: "number",
      reason: `Value "${row.value}" parses as a number.`,
      options: [],
      integer: Number.isInteger(Number(row.value)),
      precision: null,
    };
  }

  const vocabulary = siblingVocabulary(row, all);
  if (vocabulary.length >= 2) {
    return {
      shape: "enum",
      reason: `${vocabulary.length} distinct token values share the key leaf "${leafSegment(
        row.key,
      )}" — treated as one vocabulary.`,
      options: vocabulary,
      integer: false,
      precision: null,
    };
  }

  return {
    shape: "text",
    reason: "No shape could be established from the value — free text, edited as-is.",
    options: [],
    integer: false,
    precision: null,
  };
}

/**
 * Distinct token values across every row sharing this row's key leaf.
 *
 * Returns `[]` unless EVERY sibling is token-shaped: one free-text sibling is
 * enough to say the leaf is a label rather than a code, and offering a
 * dropdown there would quietly truncate what an operator can type.
 */
export function siblingVocabulary(row: SettingRow, all: SettingRow[]): string[] {
  const leaf = leafSegment(row.key);
  const siblings = all.filter((r) => leafSegment(r.key) === leaf);
  if (siblings.length < 2) return [];
  if (!siblings.every((r) => isTokenShaped(r.value))) return [];
  const distinct = [...new Set(siblings.map((r) => r.value.trim()))];
  return distinct.sort((a, b) => a.localeCompare(b));
}

export const SHAPE_LABEL: Record<ValueShape, string> = {
  boolean: "Boolean",
  number: "Number",
  date: "Date",
  enum: "Enum",
  text: "Text",
};

export interface ValidationResult {
  /** Blocks the save. */
  error: string | null;
  /** Does not block the save — see the enum case. */
  warning: string | null;
}

/**
 * Validate an edit against the inferred shape.
 *
 * Applies to EDITING only. Import never validates — see `planImport`.
 *
 * A value outside an INFERRED enum's vocabulary is a warning, not an error.
 * The vocabulary was observed, not declared: refusing a value because this
 * store has not seen it before would be the key whitelist coming back in
 * through the value side. An explicitly supplied option list is different —
 * that one was stated by the source, so it is enforced.
 */
export function validateValue(editor: EditorSpec, next: string, explicit = false): ValidationResult {
  const v = next.trim();
  if (v === "") return { error: "Value cannot be empty — delete the key instead.", warning: null };
  switch (editor.shape) {
    case "boolean":
      return parseBoolean(v) === null
        ? { error: "Expected a boolean literal (true / false).", warning: null }
        : { error: null, warning: null };
    case "number":
      return isNumeric(v) ? { error: null, warning: null } : { error: "Expected a number.", warning: null };
    case "date":
      return isoDatePrecision(v)
        ? { error: null, warning: null }
        : { error: "Expected an ISO-8601 date (YYYY-MM-DD).", warning: null };
    case "enum": {
      if (editor.options.includes(v)) return { error: null, warning: null };
      const msg = `"${v}" is outside the observed vocabulary (${editor.options.join(", ")}).`;
      return explicit
        ? { error: `${msg} This option list was supplied by the source, so it is enforced.`, warning: null }
        : { error: null, warning: `${msg} Saving widens the vocabulary.` };
    }
    case "text":
      return { error: null, warning: null };
  }
}

/* ================================================================== *
 * Import — unknown keys are the point, not the error case
 * ================================================================== */

export interface ParsedImportLine {
  /** 1-indexed line number in the pasted text. */
  line: number;
  raw: string;
  key: string | null;
  value: string | null;
  /** Set only when the LINE could not be split into a pair. Never set for an unknown key. */
  problem: string | null;
}

/**
 * Parse a pasted extract into key/value pairs.
 *
 * Tolerant by construction: `=`, `:`, tab and comma all separate a pair, `#`
 * and `--` start a comment, blank lines are skipped, and surrounding quotes
 * are stripped. Whatever SAPS eventually exports, the odds are it is one of
 * these, and a rejected paste is a worse outcome than a row an operator has
 * to correct.
 *
 * The ONLY thing that can fail here is a line with no separator at all —
 * which is a malformed line, not an unrecognised key.
 */
export function parseSettingImport(text: string): ParsedImportLine[] {
  const out: ParsedImportLine[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("--")) continue;

    const at = firstSeparatorIndex(trimmed);
    if (at < 0) {
      out.push({
        line: i + 1,
        raw: trimmed,
        key: null,
        value: null,
        problem: "No key/value separator on this line (expected = : tab or comma).",
      });
      continue;
    }

    const key = trimmed.slice(0, at).trim();
    const value = unquote(trimmed.slice(at + 1).trim());
    if (key === "") {
      out.push({ line: i + 1, raw: trimmed, key: null, value: null, problem: "Empty key." });
      continue;
    }
    out.push({ line: i + 1, raw: trimmed, key, value, problem: null });
  }
  return out;
}

function firstSeparatorIndex(line: string): number {
  const candidates = ["=", "\t", ":", ","]
    .map((c) => line.indexOf(c))
    .filter((i) => i > 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function unquote(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

export type ImportAction = "add" | "update" | "unchanged";

export interface ImportPlanRow {
  key: string;
  incoming: string;
  existing: SettingRow | null;
  action: ImportAction;
}

export interface ImportPlan {
  rows: ImportPlanRow[];
  /** Lines that could not be split into a pair. Unknown KEYS never appear here. */
  skipped: ParsedImportLine[];
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Work out what an import would do, without doing it.
 *
 * A key the store has never seen is planned as `add`, not as an error. That
 * single behaviour is the whole of decision Q6: an editor that rejects
 * unknown keys is an editor that has assumed a key set, and this one has not.
 */
export function planImport(store: SettingRow[], parsed: ParsedImportLine[]): ImportPlan {
  const byKey = new Map(store.map((r) => [r.key, r]));
  const rows: ImportPlanRow[] = [];
  const skipped: ParsedImportLine[] = [];

  for (const line of parsed) {
    if (line.problem || line.key === null || line.value === null) {
      skipped.push(line);
      continue;
    }
    const existing = byKey.get(line.key) ?? null;
    const action: ImportAction = !existing
      ? "add"
      : existing.value === line.value
        ? "unchanged"
        : "update";
    rows.push({ key: line.key, incoming: line.value, existing, action });
  }

  return {
    rows,
    skipped,
    added: rows.filter((r) => r.action === "add").length,
    updated: rows.filter((r) => r.action === "update").length,
    unchanged: rows.filter((r) => r.action === "unchanged").length,
  };
}

/**
 * Apply a plan, returning a new store.
 *
 * An imported row is `migrated` even when it lands on a key this demo seeded:
 * once a real extract has spoken for a key, the seeded value is no longer
 * what is in play, and leaving the badge on `demo-seeded` would misreport
 * where the number came from. Unchanged rows keep their existing provenance —
 * an extract that agrees with a seed has not replaced it.
 *
 * A brand-new key defaults to `Lookup` rather than `Setting` because `Lookup`
 * is the wider of the two legacy tables (5 columns against 2) and so the less
 * lossy landing place for a row whose real home nobody can check. The
 * assignment is editable and is labelled an inference wherever it renders.
 */
export function applyImport(
  store: SettingRow[],
  plan: ImportPlan,
  at: string = DEMO_NOW,
  by = "cmts-extract",
): SettingRow[] {
  const next = new Map(store.map((r) => [r.key, r]));

  for (const row of plan.rows) {
    if (row.action === "unchanged") continue;
    const existing = row.existing;
    next.set(row.key, {
      key: row.key,
      value: row.incoming,
      table: existing?.table ?? "Lookup",
      origin: "migrated",
      note: existing?.note ?? null,
      unit: existing?.unit ?? null,
      options: existing?.options ?? null,
      updatedAt: at,
      updatedBy: by,
    });
  }

  return [...next.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Edit one value in place, keeping provenance and stamping the clock. */
export function setSettingValue(
  store: SettingRow[],
  key: string,
  value: string,
  at: string = DEMO_NOW,
  by = "admin",
): SettingRow[] {
  return store.map((r) => (r.key === key ? { ...r, value, updatedAt: at, updatedBy: by } : r));
}

/* ================================================================== *
 * Aggregates
 * ================================================================== */

export interface SettingStats {
  total: number;
  groups: number;
  seeded: number;
  migrated: number;
  shapes: Record<ValueShape, number>;
  separator: string;
  separatorSupport: number;
}

export function settingStats(rows: SettingRow[]): SettingStats {
  const keys = rows.map((r) => r.key);
  const separator = detectSeparator(keys);
  const shapes: Record<ValueShape, number> = { boolean: 0, number: 0, date: 0, enum: 0, text: 0 };
  for (const row of rows) shapes[inferEditor(row, rows).shape] += 1;
  return {
    total: rows.length,
    groups: groupSettings(rows, separator).length,
    seeded: rows.filter((r) => r.origin === "demo-seeded").length,
    migrated: rows.filter((r) => r.origin === "migrated").length,
    shapes,
    separator,
    separatorSupport: separatorSupport(keys, separator),
  };
}

/* ================================================================== *
 * Seed — the keys THIS DEMO already hard-codes
 *
 * Not a guess at SAPS's key set. Every row below was found by grepping this
 * repo for an operational constant that is really configuration, and `note`
 * names the constant and the file it still lives in. The call sites have
 * deliberately NOT been refactored to read from here (prototype, large blast
 * radius) — so this screen configures things that are real, while the numbers
 * beside them are still the ones the code uses.
 * ================================================================== */

const NOW_MS = Date.parse(DEMO_NOW);

/** Deterministic — pure UTC arithmetic off DEMO_NOW, no Date.now(), no locale. */
function seededAt(daysBefore: number): string {
  return new Date(NOW_MS - daysBefore * MS_PER_DAY).toISOString();
}

interface SeedSpec {
  key: string;
  value: string;
  table: SettingTable;
  note: string;
  unit?: string;
  options?: string[];
  /** Days before DEMO_NOW this row was last touched. */
  age: number;
}

const SEED_SPECS: SeedSpec[] = [
  /* ---- company — the same values the fixed System Settings form holds ---- */
  { key: "company.legal_name", value: "Shaheen Airport Services (Pvt) Ltd.", table: "Setting", note: "companyInfo.name — components/admin/settings/SettingsContent.tsx", age: 96 },
  { key: "company.short_name", value: "SAPS", table: "Setting", note: "companyInfo.shortName — components/admin/settings/SettingsContent.tsx", age: 96 },
  { key: "company.ntn", value: "1234567-8", table: "Setting", note: "taxIds.ntn — components/admin/settings/SettingsContent.tsx", age: 96 },

  /* ---- ui / localisation ---- */
  { key: "ui.locale.number", value: "en-PK", table: "Setting", note: "formatPkr / formatKg — lib/domain/common.ts", age: 84 },
  { key: "ui.locale.date", value: "en-GB", table: "Setting", note: "formatDate / formatDateTime — lib/domain/common.ts", age: 84 },
  { key: "ui.timezone", value: "Asia/Karachi", table: "Setting", note: "localization.timezone — components/admin/settings/SettingsContent.tsx", age: 84 },
  { key: "ui.currency_code", value: "PKR", table: "Setting", note: "Amount — lib/domain/common.ts (\"All amounts are PKR in this demo\")", age: 84 },
  { key: "ui.table.rows_per_page", value: "10", table: "Setting", note: "rowsPerPage — components/DataTable.tsx", unit: "rows", age: 61 },
  { key: "ui.parity_markers.visible", value: "true", table: "Setting", note: "CMTS parity tokens rendered beside legacy-backed fields — build rule 4", age: 61 },

  /* ---- demo harness ---- */
  { key: "demo.now", value: "2026-08-03T14:32:00+05:00", table: "Setting", note: "DEMO_NOW — lib/domain/common.ts. Fixed so dwell clocks are reproducible.", age: 30 },
  { key: "demo.rack.seed", value: "20260131", table: "Setting", note: "RACK_SEED — lib/rackData.ts", age: 30 },
  { key: "demo.site.default_scope", value: "HQ", table: "Setting", note: "SiteScope default — lib/domain/index.ts. Option list is the SiteScope union.", options: ["HQ", "KHI", "LHE", "PEW"], age: 30 },

  /* ---- weight ---- */
  { key: "weight.volumetric.divisor_cm", value: "6000", table: "Lookup", note: "VOLUMETRIC_DIVISORS.cm — lib/domain/common.ts", age: 72 },
  { key: "weight.volumetric.divisor_in", value: "366", table: "Lookup", note: "VOLUMETRIC_DIVISORS.in — lib/domain/common.ts. Unit-dependent; FC-07 §05 says 6000 flat, which is a billing defect.", age: 72 },
  { key: "weight.chargeable.round_up_step_kg", value: "0.5", table: "Setting", note: "roundUpHalfKg — lib/domain/common.ts. IATA rounds up to the next 0.5 kg.", unit: "kg", age: 72 },
  { key: "weight.chargeable.rounding.mode", value: "CEIL", table: "Setting", note: "roundUpHalfKg uses Math.ceil — lib/domain/common.ts", age: 72 },

  /* ---- billing ---- */
  { key: "billing.tax.default_percent", value: "15", table: "Setting", note: "taxPercent fallback (input.taxPercent ?? 15) — lib/domain/finance.ts", unit: "%", age: 45 },
  { key: "billing.tax.rounding.mode", value: "HALF_UP", table: "Setting", note: "round2 uses Math.round — lib/domain/common.ts", age: 45 },
  { key: "billing.handling.rate_per_kg", value: "12", table: "Setting", note: "HANDLING_RATE_PER_KG — lib/domain/grcharges.ts", unit: "PKR/kg", age: 45 },
  { key: "billing.location.flat_daily_amount", value: "1200", table: "Setting", note: "LOCATION_CHARGES.AMOUNT — lib/domain/masters.ts (hold-zone flat daily fee)", unit: "PKR/day", age: 45 },
  { key: "billing.reconciliation.epsilon", value: "0.005", table: "Setting", note: "EPSILON — components/billing/godown-rent/voucherReconciliation.ts and lib/domain/exportbilling.ts. Paisa resolution, one order below the smallest stored unit.", unit: "PKR", age: 21 },
  { key: "billing.supplementary_run.days", value: "4", table: "Setting", note: "SUPPLEMENT_DAYS — lib/domain/grcharges.ts", unit: "days", age: 21 },
  { key: "billing.rate_band.open_ended_dayto", value: "9999", table: "Lookup", note: "OPEN_BAND_DAYTO — lib/domain/grcharges.ts. Sentinel for an open-ended DAYTO band.", unit: "days", age: 21 },
  { key: "billing.timezone.pkt_offset_hours", value: "5", table: "Setting", note: "PKT_OFFSET_MS — lib/domain/grcharges.ts", unit: "hours", age: 21 },
  { key: "billing.tariff.effective_from", value: "2026-06-01", table: "Setting", note: "currentVersion.effectiveFrom — app/finance-manager/tariff-master-editor/page.tsx", age: 21 },
  // Nonuseabel is the real CMTS spelling on CHARGETYPE — deliberate, do not correct it.
  { key: "billing.chargetype.exclude_nonuseabel", value: "true", table: "Setting", note: "Decision Q7 — a CHARGETYPE row carrying Nonuseabel is excluded from new calculations and still rendered on historical vouchers. Spelling is the legacy column's, deliberately preserved.", age: 14 },

  /* ---- tax (CMTS TaxType rows) ---- */
  { key: "tax.percent.sales_tax_services", value: "15", table: "Lookup", note: "TAX_TYPES[1].Amount — lib/domain/masters.ts", unit: "%", age: 45 },
  { key: "tax.percent.withholding", value: "4", table: "Lookup", note: "TAX_TYPES[2].Amount — lib/domain/masters.ts", unit: "%", age: 45 },
  { key: "tax.percent.do_processing", value: "15", table: "Lookup", note: "TAX_TYPES[3].Amount — lib/domain/masters.ts (IsDo)", unit: "%", age: 45 },

  /* ---- surcharge (CMTS CATEGORY_SURCHARGES percents) ---- */
  { key: "surcharge.percent.dgr", value: "40", table: "Lookup", note: "CATEGORY_SURCHARGES DGR — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.per", value: "25", table: "Lookup", note: "CATEGORY_SURCHARGES PER — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.val", value: "60", table: "Lookup", note: "CATEGORY_SURCHARGES VAL — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.avi", value: "45", table: "Lookup", note: "CATEGORY_SURCHARGES AVI — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.aog", value: "20", table: "Lookup", note: "CATEGORY_SURCHARGES AOG — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.hum", value: "0", table: "Lookup", note: "CATEGORY_SURCHARGES HUM — lib/domain/masters.ts. Zero is a policy, not a missing rate.", unit: "%", age: 52 },
  { key: "surcharge.percent.cold", value: "30", table: "Lookup", note: "CATEGORY_SURCHARGES COLD — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.vault", value: "35", table: "Lookup", note: "CATEGORY_SURCHARGES VAULT — lib/domain/masters.ts", unit: "%", age: 52 },
  { key: "surcharge.percent.special", value: "25", table: "Lookup", note: "CATEGORY_SURCHARGES SPECIAL — lib/domain/masters.ts", unit: "%", age: 52 },

  /* ---- cargo / statutory ---- */
  { key: "cargo.free_days.fallback", value: "3", table: "Setting", note: "CARGO_CLASSES[GCR].freeDays — lib/domain/masters.ts. Per-class free days are master DATA on CARGOCLASS; this is only the fallback.", unit: "days", age: 52 },
  { key: "cargo.section82.days", value: "30", table: "Setting", note: "SECTION_82_DAYS — lib/domain/masters.ts. CMTS Section82Days is a single row (Id, Days).", unit: "days", age: 52 },

  /* ---- intake tolerances ---- */
  { key: "variance.tolerance_ratio", value: "0.02", table: "Setting", note: "VARIANCE_TOLERANCE — lib/domain/common.ts. Above this, FC-04 auto-raises a CDR.", age: 38 },
  { key: "ocr.confidence.threshold", value: "0.9", table: "Setting", note: "OCR_CONFIDENCE_THRESHOLD — lib/domain/common.ts. Below this the operator reviews the item (FC-01 05d).", age: 38 },

  /* ---- exception escalation ---- */
  { key: "exception.threshold_days.cdr", value: "3", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS.cdr — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.threshold_days.hold", value: "7", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS.hold — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.threshold_days.mishandled", value: "5", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS.mishandled — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.threshold_days.re_export", value: "14", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS[\"re-export\"] — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.threshold_days.long_stay", value: "30", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS[\"long-stay\"] — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.threshold_days.detend", value: "10", table: "Lookup", note: "EXCEPTION_THRESHOLD_DAYS.detend — lib/domain/exceptions.ts", unit: "days", age: 38 },
  { key: "exception.cdr.sla_hours", value: "6", table: "Setting", note: "CDR_SLA_HOURS — components/exceptions/cdr/queueLayer.ts. Target to pick a CDR up, not to close it.", unit: "hours", age: 12 },
  { key: "exception.cdr.trend_window_days", value: "3", table: "Setting", note: "TREND_WINDOW_DAYS — components/exceptions/cdr/queueLayer.ts", unit: "days", age: 12 },

  /* ---- customs ---- */
  { key: "customs.free_period.sla_window_hours", value: "4", table: "Setting", note: "SLA_WINDOW_HOURS — app/customs/page.tsx", unit: "hours", age: 12 },
  { key: "customs.watch_list.rows", value: "6", table: "Setting", note: "WATCH_ROWS — app/customs/page.tsx", unit: "rows", age: 12 },
];

export const SEEDED_SETTINGS: SettingRow[] = SEED_SPECS.map((s) => ({
  key: s.key,
  value: s.value,
  table: s.table,
  origin: "demo-seeded" as const,
  note: s.note,
  unit: s.unit ?? null,
  options: s.options ?? null,
  updatedAt: seededAt(s.age),
  updatedBy: "build-team",
})).sort((a, b) => a.key.localeCompare(b.key));

/**
 * A paste-ready sample standing in for a CMTS `Lookup` / `Setting` extract.
 *
 * Written to exercise the tolerance rather than to look tidy:
 *
 *   - UPPER_SNAKE keys, a different separator convention from the seed —
 *     they still group, because `groupKey` falls back per key;
 *   - keys nothing in this repo has ever heard of — they are ADDED;
 *   - `GR_ROUNDING_MODE` picks up an enum editor purely because it shares the
 *     leaf `MODE` with two seeded keys, which is inference from data;
 *   - one collision with a seeded key, so the demo-seeded → migrated flip is
 *     visible on a row rather than only in a total;
 *   - one line that is not a pair at all, which is skipped WITH a reason and
 *     does not fail the import.
 *
 * Values are round and obviously synthetic. This is not SAPS data.
 */
export const SAMPLE_CMTS_EXTRACT = `# CMTS Lookup / Setting — illustrative extract, NOT supplied by SAPS
GR_FREE_DAYS=3
GR_MIN_CHARGE=1200
GR_ROUNDING_MODE=HALF_UP
DO_PRINT_COPIES=2
DO_VALID_DAYS=7
SEC82_NOTICE_DAYS=21
SEC82_AUCTION_ENABLED=false
XRAY_MANDATORY=true
EXPORT_CUTOFF_MINUTES=180
MANIFEST_CUTOFF_DATE=2026-09-01
LOOKUP_9931=?
billing.tax.default_percent=16
THIS LINE IS NOT A KEY VALUE PAIR`;

/**
 * Rendered on the screen. Says the two things a reader must not have to infer:
 * the legacy column names were not recovered, and the seed is ours.
 */
export const SETTING_PARITY_NOTE =
  "CMTS Lookup (5 columns) and Setting (2 columns) are the legacy key/value tables. " +
  "Their column NAMES are not in the restored schema — only the counts are — so the parity token " +
  "on each row names the table, not a column, and the Lookup/Setting split is an AirVault " +
  "inference from those counts rather than recovered mapping.";
