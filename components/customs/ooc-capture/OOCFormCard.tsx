"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { FileText, Upload, Save, X, ArrowRight, Eye, Paperclip } from "lucide-react";

interface AwbSummary {
  awb: string;
  gd: string;
  channel: string;
  cha: string;
  consignee: string;
  cargoClass: string;
  pieces: string;
  weight: string;
  status: string;
  holdStatus: string;
}

interface OOCFormCardProps {
  awb: AwbSummary;
  onRecordOOC: () => void;
  onSaveDraft: () => void;
}

export default function OOCFormCard({ awb, onRecordOOC, onSaveDraft }: OOCFormCardProps) {
  const { addToast } = useToast();
  const [oocRef, setOocRef] = useState("");
  const [oocIssuedAt, setOocIssuedAt] = useState("");
  const [oocPdf, setOocPdf] = useState("");
  const [dutyPaid, setDutyPaid] = useState("");
  const [taxPaid, setTaxPaid] = useState("");
  const [fed, setFed] = useState("");
  const [wht, setWht] = useState("");
  const [anfRef, setAnfRef] = useState("");
  const [asfRef, setAsfRef] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!oocRef.trim()) newErrors.oocRef = "OOC reference is required";
    if (!oocIssuedAt.trim()) newErrors.oocIssuedAt = "OOC issued date/time is required";
    if (!oocPdf.trim()) newErrors.oocPdf = "OOC PDF is required";
    if (!dutyPaid.trim()) newErrors.dutyPaid = "Duty paid is required";
    if (!taxPaid.trim()) newErrors.taxPaid = "Tax paid is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRecordOOC = () => {
    if (validate()) {
      onRecordOOC();
    } else {
      addToast("Please fill in all required fields", "error");
    }
  };

  const handleUploadPDF = () => {
    setOocPdf("OOC-214-45678901-20260531.pdf");
    addToast("OOC PDF attached", "success");
  };

  const requiredDot = (
    <span className="text-[#DC2626] ml-0.5">*</span>
  );

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="text-[15px] font-bold text-[#0F172A]">OOC Details</h2>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              AWB #{requiredDot}
            </label>
            <input
              type="text"
              value={awb.awb}
              readOnly
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#64748B] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              GD #{requiredDot}
            </label>
            <input
              type="text"
              value={awb.gd}
              readOnly
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#64748B] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              OOC reference #{requiredDot}
            </label>
            <input
              type="text"
              value={oocRef}
              onChange={(e) => {
                setOocRef(e.target.value);
                setErrors((prev) => ({ ...prev, oocRef: "" }));
              }}
              placeholder="Enter OOC reference number"
              className={`w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
                errors.oocRef ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
              }`}
            />
            {errors.oocRef && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.oocRef}</p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              OOC issued at{requiredDot}
            </label>
            <input
              type="datetime-local"
              value={oocIssuedAt}
              onChange={(e) => {
                setOocIssuedAt(e.target.value);
                setErrors((prev) => ({ ...prev, oocIssuedAt: "" }));
              }}
              className={`w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
                errors.oocIssuedAt ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
              }`}
            />
            {errors.oocIssuedAt && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.oocIssuedAt}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              OOC PDF{requiredDot}
            </label>
            <div className="flex items-center gap-3">
              {oocPdf ? (
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[#DCFCE7] bg-[#DCFCE7] text-[#16A34A] text-[13px] font-medium">
                    <FileText size={16} />
                    {oocPdf}
                  </div>
                  <button
                    onClick={() => setOocPdf("")}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleUploadPDF}
                  className={`flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed text-[13px] cursor-pointer transition-colors ${
                    errors.oocPdf
                      ? "border-[#DC2626] text-[#DC2626] bg-[#FEE2E2]/20"
                      : "border-[#CBD5E1] text-[#64748B] hover:border-[#1B4F8B] hover:text-[#1B4F8B]"
                  }`}
                >
                  <Upload size={16} />
                  Upload OOC PDF
                </button>
              )}
            </div>
            {errors.oocPdf && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.oocPdf}</p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Duty paid PKR{requiredDot}
            </label>
            <input
              type="number"
              value={dutyPaid}
              onChange={(e) => {
                setDutyPaid(e.target.value);
                setErrors((prev) => ({ ...prev, dutyPaid: "" }));
              }}
              placeholder="0.00"
              className={`w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
                errors.dutyPaid ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
              }`}
            />
            {errors.dutyPaid && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.dutyPaid}</p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Tax paid PKR{requiredDot}
            </label>
            <input
              type="number"
              value={taxPaid}
              onChange={(e) => {
                setTaxPaid(e.target.value);
                setErrors((prev) => ({ ...prev, taxPaid: "" }));
              }}
              placeholder="0.00"
              className={`w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
                errors.taxPaid ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
              }`}
            />
            {errors.taxPaid && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.taxPaid}</p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              FED PKR
            </label>
            <input
              type="number"
              value={fed}
              onChange={(e) => setFed(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              WHT PKR
            </label>
            <input
              type="number"
              value={wht}
              onChange={(e) => setWht(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              ANF clearance ref
            </label>
            <input
              type="text"
              value={anfRef}
              onChange={(e) => setAnfRef(e.target.value)}
              placeholder="Enter ANF clearance reference"
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              ASF clearance ref
            </label>
            <input
              type="text"
              value={asfRef}
              onChange={(e) => setAsfRef(e.target.value)}
              placeholder="Enter ASF clearance reference"
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes or remarks"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={handleRecordOOC}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#16A34A" }}
          >
            <ArrowRight size={16} />
            Record OOC & Release
          </button>
          <button
            onClick={() => {
              onSaveDraft();
            }}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <Save size={16} />
            Save Draft
          </button>
          <button
            onClick={handleUploadPDF}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <Paperclip size={16} />
            Attach OOC PDF
          </button>
          <button
            onClick={() => addToast("Viewing AWB detail", "success")}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <Eye size={16} />
            View AWB Detail
          </button>
          <button
            onClick={() => addToast("OOC capture cancelled", "success")}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}