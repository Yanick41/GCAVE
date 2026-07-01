import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { fetchCommande } from "./api";

export function OrderDetailPage() {
  const { t, i18n } = useTranslation(["commandes", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const { id } = useParams();

  const { data: c, isLoading } = useQuery({
    queryKey: ["commande", id],
    queryFn: () => fetchCommande(id!),
    enabled: Boolean(id),
  });

  if (isLoading || !c)
    return <p className="text-slate-400">{t("common:common.loading")}</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <BackButton />
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{c.numero}</h1>
        <span className="text-sm text-slate-400">{formatDate(c.date, lang)}</span>
      </div>
      <p className="mb-6 text-slate-600">
        {t("commandes:client")} : {c.client?.nom ?? c.clientNomLibre ?? "—"}
      </p>

      <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">{t("commandes:product")}</th>
              <th className="px-4 py-2 text-right">{t("commandes:qty")}</th>
              <th className="px-4 py-2 text-right">{t("commandes:unitPrice")}</th>
              <th className="px-4 py-2 text-right">{t("commandes:lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {c.lignes.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{l.nomProduit}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantite)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatMoney(Number(l.prixUnitaire), lang)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatMoney(Number(l.totalLigne), lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto max-w-sm space-y-2 text-sm">
        <Line label={t("commandes:subtotal")} value={formatMoney(Number(c.sousTotal), lang)} />
        {Number(c.montantRemise) > 0 && (
          <Line
            label={t("commandes:discount")}
            value={`- ${formatMoney(Number(c.montantRemise), lang)}`}
          />
        )}
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold">{t("commandes:total")}</span>
          <span className="text-xl font-bold text-green-600">
            {formatMoney(Number(c.totalTTC), lang)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
