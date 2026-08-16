"use client";

/**
 * P9-2 · The operator capture set at the export counter — `CARGOACCEPTANCE`.
 *
 * The acceptance tab proved CMTS parity by dumping all 31 columns as one flat
 * key/value grid. That shows the columns exist; it does not show the *form*.
 * A clerk at the counter does not work down an alphabetical column list — she
 * works three blocks in order: what this consignment is called, what the scale
 * and the clock said, and who handed it over to whom. Fourteen of the 31
 * columns are exactly that capture set, and they were only ever legible here
 * as raw `SHIPPERPHONENO: +92-…` pairs.
 *
 * So the set is split into three cards that read the way the counter works,
 * and the columns that are *not* operator capture — status flags, the derived
 * weights, the routing — stay behind in `AcceptanceOtherColumns` so the
 * screen's "all 31" claim survives the split. Nothing is dropped and nothing
 * is shown twice: `SURFACED_COLUMNS` is the single list of what has a home of
 * its own, and the residual card is computed as everything else. A column
 * added to `CargoAcceptance` tomorrow therefore appears on this screen by
 * default rather than vanishing from it — the failure mode of a hand-listed
 * residual grid is a field that silently stops being rendered.
 */

import { Clock, Package, Timer, Users, Table2 } from "lucide-react";
import { formatDate, formatDateTime, formatKg, type CargoAcceptance } from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * Field — label, CMTS column marker, boxed value
 *
 * Deliberately a local copy of the same control the AWB hub uses. The house
 * copy lives inside `components/awb/AwbTabs.tsx` and is not re-exported
 * through `components/primitives`, so the only way to share it today is for
 * the export counter to import from the AWB hub's own screen module — which
 * couples two unrelated screens for the sake of thirty lines. When `Field`
 * graduates into `components/primitives`, delete this and import that one.
 * ------------------------------------------------------------------ */

function Field({
  label,
  value,
  cmts,
  mono,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  /** The CMTS column this maps to — parity is checkable on screen. */
  cmts: string;
  mono?: boolean;
  tone?: "default" | "muted" | "warn";
}) {
  const colour = tone === "muted" ? "#94A3B8" : tone === "warn" ? "#D97706" : "#0F172A";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
          {cmts}
        </span>
      </div>
      <div
        className={`min-h-9 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center text-[13px] font-medium break-words ${
          mono ? "font-mono" : ""
        }`}
        style={{ color: colour }}
      >
        {value === null || value === undefined || value === "" ? (
          <span className="text-[#CBD5E1]">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The counter clock — TIMEOFWEIGHMENT / TIMEOFACCEPTENCE
 *
 * Both are CMTS `varchar(5)`, `HH:MM`, with no date attached (see the note on
 * `CargoAcceptance`). They are parsed here, at the point of display, and never
 * folded into `CARGODATE` — the domain forbids that transform because it is
 * not reversible.
 *
 * Two states a naive parse gets wrong, and both are real at a counter:
 *
 *   • **Blank.** An empty varchar(5) means the step was not recorded, which is
 *     not the same as 00:00. It must not render as midnight, and it must not
 *     produce a gap.
 *   • **Crossing midnight.** A night shift weighs at 23:40 and accepts at
 *     00:05. Read as plain numbers that is a gap of minus twenty-three hours.
 *     The gap is computed the long way round and *labelled* as crossing
 *     midnight rather than silently having a day added, because on a day shift
 *     the same shape means the two times were keyed the wrong way round and
 *     the clerk needs to see that rather than have it smoothed over.
 * ------------------------------------------------------------------ */

const MINUTES_PER_DAY = 24 * 60;

function parseClock(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatGap(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} m`;
}

/** One of the two clock readings, as a tile the eye can compare across. */
function ClockTile({ label, cmts, value }: { label: string; cmts: string; value: string }) {
  const parsed = parseClock(value);
  return (
    <div className="flex-1 min-w-[130px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</p>
        <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
          {cmts}
        </span>
      </div>
      <p
        className="text-[20px] font-bold mt-0.5 font-mono"
        style={{ color: parsed === null ? "#CBD5E1" : "#0F172A" }}
      >
        {parsed === null ? "—" : value}
      </p>
      <p className="text-[10px] text-[#94A3B8] mt-0.5">
        {parsed === null ? "Not recorded at the counter" : "24-hour, as keyed"}
      </p>
    </div>
  );
}

function CounterClock({ a }: { a: CargoAcceptance }) {
  const weighed = parseClock(a.TIMEOFWEIGHMENT);
  const accepted = parseClock(a.TIMEOFACCEPTENCE);
  const crossesMidnight = weighed !== null && accepted !== null && accepted < weighed;
  const gap =
    weighed === null || accepted === null
      ? null
      : crossesMidnight
        ? accepted + MINUTES_PER_DAY - weighed
        : accepted - weighed;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-3 flex-wrap">
        <ClockTile label="Weighed at" cmts="TIMEOFWEIGHMENT" value={a.TIMEOFWEIGHMENT} />
        <div className="flex flex-col items-center justify-center px-1 min-w-[104px]">
          <Clock size={14} className={gap === null ? "text-[#CBD5E1]" : "text-[#64748B]"} />
          <span
            className="text-[13px] font-bold mt-1 whitespace-nowrap"
            style={{ color: gap === null ? "#CBD5E1" : crossesMidnight ? "#D97706" : "#1B4F8B" }}
          >
            {gap === null ? "—" : formatGap(gap)}
          </span>
          <span className="text-[10px] text-[#94A3B8]">on the floor</span>
        </div>
        <ClockTile label="Accepted at" cmts="TIMEOFACCEPTENCE" value={a.TIMEOFACCEPTENCE} />
      </div>
      {gap === null ? (
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          One of the two readings is blank. A blank <span className="font-mono">varchar(5)</span> is
          a step that was not recorded, not a time of 00:00 — so no interval is shown rather than an
          interval computed off a zero nobody entered.
        </p>
      ) : crossesMidnight ? (
        <p className="text-[11px] text-[#D97706] leading-relaxed">
          Acceptance reads earlier in the day than weighment. On a night shift that is a genuine
          crossing of midnight and the interval above is measured the long way round; on a day shift
          it means the two columns were keyed the wrong way round. Neither column carries a date, so
          only the counter can say which.
        </p>
      ) : (
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          The interval between the scale reading and formal acceptance — how long the consignment sat
          on the floor between the two. <span className="font-mono">CARGODATE</span> stamps the same
          acceptance as a timestamp: {formatDateTime(a.CARGODATE)}.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The three capture cards
 * ------------------------------------------------------------------ */

/**
 * Columns that have a dedicated home — the three cards below, plus the cargo
 * class card on the page, which already renders CARGOGROUP / CARGOTYPE /
 * REVENUECODE against the counter's class picker.
 *
 * ORIGIN / DESTINATION / PAYMENT are deliberately NOT in this list even
 * though the consignment header prints them. There they are prose context
 * ("KHI → DXB"), carrying no CMTS marker, so the residual card is where those
 * three are actually tagged and parity stays checkable.
 */
const SURFACED_COLUMNS: ReadonlySet<string> = new Set<keyof CargoAcceptance>([
  "CARGOID",
  "AWBCODE",
  "BAGNO",
  "CARGODATE",
  "TIMEOFWEIGHMENT",
  "TIMEOFACCEPTENCE",
  "WEIGHTAWB",
  "VEHICALNO",
  "SHIPPERNAME",
  "SHIPPERADDRESS",
  "SHIPPERPHONENO",
  "CONSIGNEENAME",
  "CONSIGNEEADDRESS",
  "CONSIGNEEPHONENO",
  "AGENTNAME",
  "CARGOAGENTNAME",
  "CARGOGROUP",
  "CARGOTYPE",
  "REVENUECODE",
]);

/**
 * The tail of the WEIGHTAWB sentence. `WEIGHTAWB` is the declared figure the
 * weighment tab measures the scale against, so showing the two together is the
 * whole point of the column — but the variance and its tolerance stay owned by
 * that tab, and this only states the two numbers.
 */
function declaredAgainstScale(declared: number, scaleNetKg: number | null): string {
  if (scaleNetKg === null) return " once the consignment has been weighed.";
  const delta = Math.round((scaleNetKg - declared) * 100) / 100;
  if (delta === 0) return ` — it read ${formatKg(scaleNetKg)} net, exactly as declared.`;
  return ` — it read ${formatKg(scaleNetKg)} net, ${
    delta > 0 ? "over" : "under"
  } the declaration by ${formatKg(Math.abs(delta))}.`;
}

export default function AcceptanceCaptureCards({
  acceptance,
  scaleNetKg,
}: {
  acceptance: CargoAcceptance;
  /**
   * What the scale actually read, when the consignment has been weighed. Only
   * passed so the declared figure can be shown against it — the weighment tab
   * remains the owner of the variance and its tolerance.
   */
  scaleNetKg: number | null;
}) {
  const a = acceptance;

  return (
    <>
      <Card
        icon={<Package size={15} className="text-[#64748B]" />}
        title="Consignment identity"
        subtitle="What this consignment is called on paper. CARGODATE + CARGOID is the whole of the relation back to its detail lines — CMTS has no other join column, which is why both stay operator-visible."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
          <Field label="Cargo reference" value={a.CARGOID} cmts="CARGOID" mono />
          <Field label="AWB code" value={a.AWBCODE} cmts="AWBCODE" mono />
          <Field
            label="Bag number"
            value={a.BAGNO}
            cmts="BAGNO"
            mono
            tone={a.BAGNO === null ? "muted" : "default"}
          />
          <Field label="Cargo date" value={formatDate(a.CARGODATE)} cmts="CARGODATE" />
        </div>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          <span className="font-mono">BAGNO</span> is a <span className="font-mono">varchar(11)</span>{" "}
          the counter fills only for cargo tendered in numbered bags; it is null on every consignment
          in the demo set. Shown rather than hidden — an empty capture field the clerk chose not to
          fill and a field the screen never offered look identical once one of them is dropped.
        </p>
      </Card>

      <Card
        icon={<Timer size={15} className="text-[#64748B]" />}
        title="Weighment and acceptance"
        subtitle="The scale, the clock and the vehicle they were taken on — the counter's own record, before the scale-integration amendment adds provenance to it."
      >
        <CounterClock a={a} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Declared AWB weight" value={formatKg(a.WEIGHTAWB)} cmts="WEIGHTAWB" mono />
          <Field label="Vehicle" value={a.VEHICALNO} cmts="VEHICALNO" mono />
        </div>

        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          <span className="font-mono">VEHICALNO</span> belongs with the weights rather than with the
          parties: tare is that vehicle&apos;s own weight, so a gross reading means nothing without
          knowing which vehicle it was taken on — vehicle in minus vehicle out is the net.{" "}
          <span className="font-mono">WEIGHTAWB</span> is the shipper&apos;s declared figure, which is
          the number the Weighment tab measures the scale against
          {declaredAgainstScale(a.WEIGHTAWB, scaleNetKg)}
        </p>
      </Card>

      <Card
        icon={<Users size={15} className="text-[#64748B]" />}
        title="Parties"
        subtitle="Who sent it, who receives it, and the two agents CMTS keeps apart. Address and phone are the counter's only contact route once cargo is on the floor and the AWB is queried."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/*
           * Name, address and phone stay stacked inside each party rather than
           * being spread across a grid: a varchar(60) address wraps to two
           * lines in a half-width column, and the address is the field the
           * counter actually reads back to the caller.
           */}
          <div className="rounded-xl border border-[#E2E8F0] px-4 py-4 flex flex-col gap-4">
            <p className="text-[12px] font-semibold text-[#0F172A]">Shipper</p>
            <Field label="Name" value={a.SHIPPERNAME} cmts="SHIPPERNAME" />
            <Field label="Address" value={a.SHIPPERADDRESS} cmts="SHIPPERADDRESS" />
            <Field label="Phone" value={a.SHIPPERPHONENO} cmts="SHIPPERPHONENO" mono />
          </div>
          <div className="rounded-xl border border-[#E2E8F0] px-4 py-4 flex flex-col gap-4">
            <p className="text-[12px] font-semibold text-[#0F172A]">Consignee</p>
            <Field label="Name" value={a.CONSIGNEENAME} cmts="CONSIGNEENAME" />
            <Field label="Address" value={a.CONSIGNEEADDRESS} cmts="CONSIGNEEADDRESS" />
            <Field label="Phone" value={a.CONSIGNEEPHONENO} cmts="CONSIGNEEPHONENO" mono />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Clearing agent" value={a.AGENTNAME} cmts="AGENTNAME" />
          <Field label="Cargo agent" value={a.CARGOAGENTNAME} cmts="CARGOAGENTNAME" />
        </div>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Two agent columns, two different companies, and collapsing them loses the party that
          matters at the counter. <span className="font-mono">AGENTNAME</span> is the clearing agent
          on the declaration; <span className="font-mono">CARGOAGENTNAME</span> is the cargo agent who
          physically tendered the consignment — which is why the chain of custody opens with{" "}
          <span className="font-mono">CARGOAGENTNAME</span> as the handing-over party on the Screening
          &amp; custody tab, not with the clearing agent.
        </p>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Everything the capture cards do not own
 * ------------------------------------------------------------------ */

/**
 * The parity dump, minus the columns that now have a card of their own. Kept
 * as a raw key/value grid on purpose: these are status flags, routing and the
 * derived weights, and their value here is that a migration reviewer can read
 * the column name and the stored value side by side without a label
 * interpreting either. Counting the rows off the record rather than hard-coding
 * "the other 12" keeps the heading honest if the interface grows.
 */
export function AcceptanceOtherColumns({ acceptance }: { acceptance: CargoAcceptance }) {
  const rest = (Object.entries(acceptance) as Array<[string, unknown]>).filter(
    ([k]) => !SURFACED_COLUMNS.has(k),
  );
  const total = Object.keys(acceptance).length;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-2">
        <Table2 size={15} className="text-[#64748B] mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            CARGOACCEPTANCE — the remaining {rest.length} of {total} columns
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
            Status, routing and the derived weights. The other {total - rest.length} are the operator
            capture set and the class picker above; nothing on this table is rendered twice and
            nothing is left off.
          </p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
        {rest.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
            <span
              className="text-[12px] font-medium break-words"
              style={{ color: v === null || v === "" ? "#CBD5E1" : "#0F172A" }}
            >
              {v === null || v === "" ? "null" : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
