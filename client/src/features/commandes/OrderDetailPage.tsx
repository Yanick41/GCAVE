import { creditRestant, formatDate, formatMoney, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { addPaiement, fetchCommande } from "./api";

export function OrderDetailPage() {
  const { t, i18n } = useTranslation(["commandes", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [montant, setMontant] = useState("");

  const { data: c, isLoading } = useQuery({
    queryKey: ["commande", id],
    queryFn: () => fetchCommande(id!),
    enabled: Boolean(id),
  });

  const pay = useMutation({
    mutationFn: (m: number) => addPaiement(id!, m),
    onSuccess: () => {
      setMontant("");
      queryClient.invalidateQueries({ queryKey: ["commande", id] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["client"] });
    },
  });

  if (isLoading || !c)
    return <p className="text-slate-400">{t("common:common.loading")}</p>;

  const credit = creditRestant(Number(c.totalTTC), Number(c.montantPaye));

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-slate-500 hover:underline"
      >
        ← {t("common:actions.back")}
      </button>

      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{c.numero}</h1>
        <span className="text-sm text-slate-400">{formatDate(c.date, lang)}</span>
      </div>
      <p className="mb-6 text-slate-600">
        {t("commandes:client")} : {c.client?.nom ?? c.clientNomLibre ?? "—"}
      </p>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
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
        <Line
          label={t("commandes:paid")}
          value={formatMoney(Number(c.montantPaye), lang)}
          valueClass="text-emerald-600"
        />
        <Line
          label={t("commandes:credit")}
          value={formatMoney(credit, lang)}
          valueClass={credit > 0 ? "text-rose-600 font-bold" : "text-slate-400"}
        />
      </div>

      {credit > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {t("commandes:paid")}
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            <button
              onClick={() => {
                const m = parseFloat(montant);
                if (m > 0) pay.mutate(m);
              }}
              disabled={pay.isPending || !(parseFloat(montant) > 0)}
              className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              + {t("commandes:paid")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
