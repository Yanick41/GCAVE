import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { fetchAlertes } from "./api";

export function useAlertes() {
  return useQuery({
    queryKey: ["rappels-alertes"],
    queryFn: fetchAlertes,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Bannière d'alerte (notification à la connexion + tableau de bord). */
export function RappelsAlertBanner() {
  const { t } = useTranslation("rappels");
  const { data } = useAlertes();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !data || data.total === 0) return null;

  const nbRetard = data.enRetard.length;
  const nbSoon = data.aVenir.length;

  const parts: string[] = [];
  if (nbRetard > 0) parts.push(t("alert.overdue", { count: nbRetard }));
  if (nbSoon > 0) parts.push(t("alert.soon", { count: nbSoon }));

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/30">
      <AlertTriangle size={20} className="shrink-0 text-rose-600" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-rose-700 dark:text-rose-300">
          {t("alert.title")}
        </p>
        <p className="text-rose-600 dark:text-rose-400">{parts.join(" · ")}</p>
      </div>
      <Link
        to="/rappels"
        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
      >
        {t("alert.view")}
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"
      >
        <X size={18} />
      </button>
    </div>
  );
}
