"use client";

import { useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { REQUESTED_ROLE_NAMES, type RequestedRole } from "@/components/admin/roles/requestedRoles";

/**
 * Access requests — ported from the retired /uld-message-builder/register.
 *
 * That screen was the only self-service access request in the product, and it
 * sat on a public route where nobody could act on it. The identity it captures
 * (station, substation, organization, requested role) is administrator data, so
 * the form belongs here, next to the user directory it eventually writes into
 * and next to the queue that approves it.
 *
 * The pending register below is the half the original never had: it submitted a
 * request into nothing. Provisioning is a two-sided act — somebody asks, and
 * somebody grants — and a screen that only shows the asking looks finished when
 * it is not.
 */

/**
 * The station list a requester picks from.
 *
 * Wider than SiteCode in lib/domain/common.ts, which is the three terminals
 * AirVault actually operates (KHI / LHE / PEW). A person can legitimately ask
 * for access from a station the platform does not run yet — ISB, MUX and UET are
 * on the network footprint but not on the terminal estate — so narrowing this to
 * SiteCode would reject exactly the requests provisioning exists to handle.
 * Carried over verbatim from the register screen.
 */
const STATIONS = ["LHE", "KHI", "ISB", "PEW", "MUX", "UET"];

interface AccessRequestForm {
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  station: string;
  substation: string;
  organization: string;
  role: RequestedRole | "";
}

const EMPTY_FORM: AccessRequestForm = {
  fullName: "",
  username: "",
  email: "",
  mobile: "",
  station: "",
  substation: "",
  organization: "",
  role: "",
};

type RequestStatus = "Pending approval" | "Approved" | "Rejected";

// Omit + redeclare rather than a plain extend: the form allows an unpicked role
// ("") because that is a legal intermediate state while typing, but a submitted
// request without a role is not a thing — validate() will not let one through.
interface PendingRequest extends Omit<AccessRequestForm, "role"> {
  role: RequestedRole;
  requestId: string;
  submittedAt: string;
  status: RequestStatus;
}

const statusConfig: Record<RequestStatus, { bg: string; text: string; dot: string }> = {
  "Pending approval": { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  Approved: { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
  Rejected: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
};

const mockRequests: PendingRequest[] = [
  {
    requestId: "REQ-2026-0041",
    fullName: "Imran Sethi",
    username: "imran.sethi",
    email: "imran@shaheen-airport.com",
    mobile: "+92 300 7788991",
    station: "LHE",
    substation: "LAHORE",
    organization: "Shaheen Airport Services",
    role: "Message Builder User",
    submittedAt: "Today 08:12",
    status: "Pending approval",
  },
  {
    requestId: "REQ-2026-0040",
    fullName: "Rabia Noor",
    username: "rabia.noor",
    email: "rabia@pakgulf-cha.com",
    mobile: "+92 321 4455667",
    station: "KHI",
    substation: "JIAP CARGO",
    organization: "Pak Gulf CHA",
    role: "Read-only User",
    submittedAt: "Yesterday 16:47",
    status: "Pending approval",
  },
  {
    requestId: "REQ-2026-0038",
    fullName: "Zeeshan Anwar",
    username: "zeeshan.anwar",
    email: "zeeshan@shaheen-airport.com",
    mobile: "+92 333 1029384",
    station: "ISB",
    substation: "ISLAMABAD",
    organization: "Shaheen Airport Services",
    role: "Message Reviewer",
    submittedAt: "2 days ago",
    status: "Approved",
  },
];

export default function AccessRequestPanel() {
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AccessRequestForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [requests, setRequests] = useState<PendingRequest[]>(mockRequests);
  const { addToast } = useToast();

  const pendingCount = requests.filter((r) => r.status === "Pending approval").length;

  // `field: string` rather than `keyof AccessRequestForm` on purpose: a computed
  // key typed as a union of literals makes the spread below widen in a way TS
  // rejects against the union-valued `role`. This is the same signature the
  // register screen used, and it type-checks.
  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /*
   * Per-field validation carried across from the register screen, minus the
   * password rules.
   *
   * There are no password fields here on purpose. On the original screen the
   * requester chose a password before anyone had approved them, which meant a
   * credential existed for an account that did not. The request now carries
   * identity and intent only; the credential is issued after approval through
   * the Add User drawer, which already has the temporary-password and
   * force-reset controls for exactly that moment.
   */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.username.trim()) errs.username = "Username is required.";
    else if (form.username.trim().length < 4) errs.username = "Username must be at least 4 characters.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (!form.mobile.trim()) errs.mobile = "Mobile number is required.";
    if (!form.station) errs.station = "Station is required.";
    if (!form.substation.trim()) errs.substation = "Substation is required.";
    if (!form.organization.trim()) errs.organization = "Organization is required.";
    if (!form.role) errs.role = "Requested role is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    // Mock-data prototype: the request lands in local state, not a backend.
    await new Promise((r) => setTimeout(r, 700));

    const nextId = `REQ-2026-${String(42 + requests.length - mockRequests.length).padStart(4, "0")}`;
    setRequests((prev) => [
      {
        ...form,
        role: form.role as RequestedRole,
        requestId: nextId,
        submittedAt: "Just now",
        status: "Pending approval",
      },
      ...prev,
    ]);
    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  const decide = (requestId: string, status: RequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.requestId === requestId ? { ...r, status } : r)));
    addToast(
      status === "Approved"
        ? `${requestId} approved — issue credentials from Add User`
        : `${requestId} rejected`,
      status === "Approved" ? "success" : "error"
    );
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitSuccess(false);
  };

  const inputClass = (field: string) =>
    `w-full h-10 px-3 rounded-xl border bg-white text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-colors ${
      errors[field] ? "border-[#DC2626]" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
    }`;

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EBF0F7" }}>
            <UserPlus size={18} className="text-[#1B4F8B]" />
          </div>
          {/*
            Spans, not an <h2> and a <p>: a <button> may only contain phrasing
            content, and the whole header is the click target here rather than a
            chevron the size of a fingernail.
          */}
          <span className="block">
            <span className="block text-[15px] font-bold text-[#0F172A]">Access requests</span>
            <span className="block text-[12px] text-[#64748B] mt-0.5">
              Raise a provisioning request and approve the ones waiting. Approved requests become users through Add
              User — this queue does not create the credential.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {pendingCount > 0 && (
            <span
              className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
            >
              {pendingCount} pending
            </span>
          )}
          {expanded ? <ChevronUp size={18} className="text-[#94A3B8]" /> : <ChevronDown size={18} className="text-[#94A3B8]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#E2E8F0] p-5 space-y-5">
          {/*
            The "Registration Request Submitted" state, kept as its own view
            rather than a toast. A pending approval is a status the requester
            has to live with for a while, so it is worth a screen that says so.
          */}
          {submitSuccess ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-[#16A34A]" />
              </div>
              <h3 className="text-[16px] font-bold text-[#0F172A] mb-2">Registration Request Submitted</h3>
              <p className="text-[13px] text-[#64748B] leading-relaxed max-w-[440px] mx-auto mb-5">
                The request has been recorded and is waiting for approval. The requester is notified by email once
                it is granted; credentials are issued afterwards, from Add User.
              </p>
              <button
                onClick={resetForm}
                className="h-10 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: "#0B2545" }}
              >
                Raise another request
              </button>
            </div>
          ) : formOpen ? (
            <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-bold text-[#0F172A]">New access request</h3>
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); resetForm(); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#E2E8F0] cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className={inputClass("fullName")}
                    placeholder="Ahmed Shaikh"
                  />
                  {errors.fullName && <p className="text-[11px] text-[#DC2626] mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Username</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.username}
                    onChange={(e) => updateField("username", e.target.value)}
                    className={inputClass("username")}
                    placeholder="ahmed.shaikh"
                  />
                  {errors.username && <p className="text-[11px] text-[#DC2626] mt-1">{errors.username}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Email</label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={inputClass("email")}
                    placeholder="ahmed@shaheen-airport.com"
                  />
                  {errors.email && <p className="text-[11px] text-[#DC2626] mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Mobile</label>
                  <input
                    type="tel"
                    autoComplete="off"
                    value={form.mobile}
                    onChange={(e) => updateField("mobile", e.target.value)}
                    className={inputClass("mobile")}
                    placeholder="+92 300 1234567"
                  />
                  {errors.mobile && <p className="text-[11px] text-[#DC2626] mt-1">{errors.mobile}</p>}
                </div>

                <div>
                  {/*
                    A native <select> where the register screen hand-rolled a
                    dropdown that toggled a class on a hard-coded element id.
                    That version could not survive two instances on one page and
                    reached around React to do it; the platform control is
                    keyboard-accessible for free.
                  */}
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Station</label>
                  <select
                    value={form.station}
                    onChange={(e) => updateField("station", e.target.value)}
                    className={`${inputClass("station")} cursor-pointer`}
                  >
                    <option value="">Select station</option>
                    {STATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.station && <p className="text-[11px] text-[#DC2626] mt-1">{errors.station}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Substation</label>
                  <input
                    type="text"
                    value={form.substation}
                    onChange={(e) => updateField("substation", e.target.value)}
                    className={inputClass("substation")}
                    placeholder="LAHORE"
                  />
                  {errors.substation && <p className="text-[11px] text-[#DC2626] mt-1">{errors.substation}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Organization</label>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={(e) => updateField("organization", e.target.value)}
                    className={inputClass("organization")}
                    placeholder="Shaheen Airport Services"
                  />
                  {errors.organization && <p className="text-[11px] text-[#DC2626] mt-1">{errors.organization}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1.5">Requested Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => updateField("role", e.target.value)}
                    className={`${inputClass("role")} cursor-pointer`}
                  >
                    <option value="">Select role</option>
                    {REQUESTED_ROLE_NAMES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {errors.role && <p className="text-[11px] text-[#DC2626] mt-1">{errors.role}</p>}
                </div>
              </div>

              <p className="text-[11px] text-[#64748B] leading-relaxed mt-4">
                The four requested roles and what each resolves to are defined on Roles &amp; Permissions. No
                password is captured here — the credential is issued after approval.
              </p>

              <div className="flex items-center gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); resetForm(); }}
                  className="h-9 px-4 rounded-xl text-[13px] font-semibold text-[#64748B] border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] cursor-pointer transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ backgroundColor: "#0B2545" }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Registration Request"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[12px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: "#0B2545" }}
            >
              <UserPlus size={14} /> Raise Access Request
            </button>
          )}

          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ backgroundColor: "#0B2545" }}>
                    {["Request #", "Name", "Username", "Email", "Station", "Organization", "Requested Role", "Submitted", "Status", "Decision"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-bold uppercase tracking-wider text-white px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, idx) => {
                    const sc = statusConfig[r.status];
                    return (
                      <tr
                        key={r.requestId}
                        className="border-b border-[#E2E8F0] last:border-b-0"
                        style={{ backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "white" }}
                      >
                        <td className="px-4 py-2.5 text-[13px] font-medium text-[#0F172A] whitespace-nowrap">{r.requestId}</td>
                        <td className="px-4 py-2.5 text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">{r.fullName}</td>
                        <td className="px-4 py-2.5 text-[13px] font-semibold text-[#1B4F8B] whitespace-nowrap">{r.username}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#64748B] whitespace-nowrap">{r.email}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#64748B] whitespace-nowrap">
                          {r.station} · {r.substation}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[#64748B] whitespace-nowrap">{r.organization}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#64748B] whitespace-nowrap">{r.role}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#64748B] whitespace-nowrap">{r.submittedAt}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                            style={{ backgroundColor: sc.bg, color: sc.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {r.status === "Pending approval" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => decide(r.requestId, "Approved")}
                                className="text-[12px] font-semibold text-[#16A34A] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => decide(r.requestId, "Rejected")}
                                className="text-[12px] font-semibold text-[#DC2626] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[12px] text-[#94A3B8]">Decided</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
