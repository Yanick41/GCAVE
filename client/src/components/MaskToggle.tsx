import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMask } from "../features/privacy/mask";

export function MaskToggle() {
  const { masked, toggle } = useMask();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={toggle}
      title={masked ? t("privacy.show") : t("privacy.hide")}
      aria-label={masked ? t("privacy.show") : t("privacy.hide")}
      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {masked ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
