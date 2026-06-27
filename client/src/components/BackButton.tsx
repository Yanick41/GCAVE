import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function BackButton({ to, label }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <ArrowLeft size={16} /> {label ?? t("actions.back")}
    </button>
  );
}
