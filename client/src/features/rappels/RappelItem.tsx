import { formatDate, type Lang } from "@gca/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { deleteRappel, estEnRetard, reporterRappel, terminerRappel, type Rappel } from "./api";

const prioriteStyle: Record<string, string> = {
  FAIBLE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NORMALE: "bg-blue-100 text-blue-700",
  URGENTE: "bg-rose-100 text-rose-700",
};

export function RappelItem({ rappel, showClient }: { rappel: Rappel; showClient?: boolean }) {
  const { t, i18n } = useTranslation(["rappels", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["rappels"] });
    queryClient.invalidateQueries({ queryKey: ["rappels-alertes"] });
    if (rappel.clientId)
      queryClient.invalidateQueries({ queryKey: ["client", rappel.clientId] });
  };

  const terminer = useMutation({ mutationFn: () => terminerRappel(rappel.id), onSuccess: invalidate });
  const supprimer = useMutation({ mutationFn: () => deleteRappel(rappel.id), onSuccess: invalidate });
  const reporter = useMutation({
    mutationFn: (d: string) => reporterRappel(rappel.id, d),
    onSuccess: invalidate,
  });

  const overdue = estEnRetard(rappel);
  const done = rappel.statut === "TERMINE";

  const onReporter = () => {
    const d = window.prompt(t("rappels:postponePrompt"), rappel.echeance.slice(0, 10));
    if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) reporter.mutate(d);
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        overdue ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20" : ""
      } ${done ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${prioriteStyle[rappel.priorite]}`}
          >
            {t(`rappels:priorities.${rappel.priorite}`)}
          </span>
          {overdue && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
              {t("rappels:overdue")}
            </span>
          )}
          {showClient && rappel.client && (
            <Link
              to={`/clients/${rappel.client.id}`}
              className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
            >
              {rappel.client.nom}
            </Link>
          )}
          <span className={`text-xs ${overdue ? "font-semibold text-rose-600" : "text-slate-400"}`}>
            {formatDate(rappel.echeance, lang)}
          </span>
        </div>
        <p className={`text-sm ${done ? "line-through" : ""}`}>{rappel.note}</p>
      </div>

      <div className="flex shrink-0 gap-1">
        {!done && (
          <button
            onClick={() => terminer.mutate()}
            title={t("rappels:done")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800"
          >
            <Check size={16} />
          </button>
        )}
        <button
          onClick={onReporter}
          title={t("rappels:postpone")}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
        >
          <CalendarClock size={16} />
        </button>
        <button
          onClick={() => window.confirm(t("rappels:deleteConfirm")) && supprimer.mutate()}
          title={t("rappels:delete")}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
