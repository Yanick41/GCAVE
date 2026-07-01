import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { fetchCommandes } from "./api";

const statusStyle: Record<string, string> = {
  VALIDEE: "bg-emerald-100 text-emerald-700",
  BROUILLON: "bg-slate-100 text-slate-600",
  ANNULEE: "bg-rose-100 text-rose-700",
};

export function OrdersListPage() {
  const { t, i18n } = useTranslation(["commandes", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const navigate = useNavigate();

  const { data: commandes, isLoading } = useQuery({
    queryKey: ["commandes"],
    queryFn: () => fetchCommandes(),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
          <Package size={22} />
        </div>
        <h1 className="text-2xl font-bold">{t("commandes:title")}</h1>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">{t("commandes:columns.number")}</th>
              <th className="px-5 py-3">{t("commandes:columns.client")}</th>
              <th className="px-5 py-3">{t("commandes:columns.date")}</th>
              <th className="px-5 py-3 text-right">{t("commandes:columns.total")}</th>
              <th className="px-5 py-3 text-center">{t("commandes:columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("common:common.loading")}
                </td>
              </tr>
            ) : !commandes || commandes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("commandes:empty")}
                </td>
              </tr>
            ) : (
              commandes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/commandes/${c.id}`)}
                  className="cursor-pointer border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="px-5 py-3 font-medium">{c.numero}</td>
                  <td className="px-5 py-3">{c.client?.nom ?? c.clientNomLibre ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(c.date, lang)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(Number(c.totalTTC), lang)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[c.statut]}`}>
                      {t(`commandes:status.${c.statut}`)}
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
