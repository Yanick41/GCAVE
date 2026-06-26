import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { fetchPaiements } from "./api";

const modeStyle: Record<string, string> = {
  ESPECES: "bg-amber-100 text-amber-700",
  MOBILE_MONEY: "bg-violet-100 text-violet-700",
  VIREMENT: "bg-cyan-100 text-cyan-700",
};

export function PaiementsListPage() {
  const { t, i18n } = useTranslation(["paiements", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const navigate = useNavigate();

  const { data: paiements, isLoading } = useQuery({
    queryKey: ["paiements"],
    queryFn: fetchPaiements,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Wallet size={22} />
        </div>
        <h1 className="text-2xl font-bold">{t("paiements:title")}</h1>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">{t("paiements:columns.date")}</th>
              <th className="px-5 py-3">{t("paiements:columns.client")}</th>
              <th className="px-5 py-3 text-right">{t("paiements:columns.amount")}</th>
              <th className="px-5 py-3 text-center">{t("paiements:columns.mode")}</th>
              <th className="px-5 py-3">{t("paiements:columns.observation")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("common:common.loading")}
                </td>
              </tr>
            ) : !paiements || paiements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("paiements:empty")}
                </td>
              </tr>
            ) : (
              paiements.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => p.client && navigate(`/clients/${p.client.id}`)}
                  className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 text-slate-500">{formatDate(p.date, lang)}</td>
                  <td className="px-5 py-3 font-medium">{p.client?.nom ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-600">
                    {formatMoney(Number(p.montant), lang)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${modeStyle[p.mode]}`}>
                      {t(`paiements:modes.${p.mode}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{p.observation ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
