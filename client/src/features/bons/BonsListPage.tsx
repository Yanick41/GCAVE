import { formatDate, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { fetchBons, type StatutBon } from "./api";

export const bonStatusStyle: Record<StatutBon, string> = {
  BROUILLON: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
  ENVOYE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  VALIDE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CONVERTI: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

export function BonsListPage() {
  const { t, i18n } = useTranslation(["bons", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const navigate = useNavigate();

  const { data: bons, isLoading } = useQuery({
    queryKey: ["bons"],
    queryFn: () => fetchBons(),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700">
            <ClipboardList size={22} />
          </div>
          <h1 className="text-2xl font-bold">{t("bons:title")}</h1>
        </div>
        <button
          onClick={() => navigate("/bons/new")}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700"
        >
          <Plus size={18} /> {t("bons:newShort")}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-5 py-3">{t("bons:columns.number")}</th>
              <th className="px-5 py-3">{t("bons:columns.client")}</th>
              <th className="px-5 py-3">{t("bons:columns.date")}</th>
              <th className="px-5 py-3 text-right">{t("bons:columns.items")}</th>
              <th className="px-5 py-3 text-center">{t("bons:columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("common:common.loading")}
                </td>
              </tr>
            ) : !bons || bons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("bons:empty")}
                </td>
              </tr>
            ) : (
              bons.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bons/${b.id}`)}
                  className="cursor-pointer border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="px-5 py-3 font-medium">{b.numero}</td>
                  <td className="px-5 py-3">{b.client?.nom ?? b.clientNomLibre ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(b.date, lang)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{b.lignes.length}</td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${bonStatusStyle[b.statut]}`}
                    >
                      {t(`bons:statuses.${b.statut}`)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
