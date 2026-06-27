import { formatMoney, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { genererRapportPDF } from "../../lib/rapport";
import { fetchRapportJour } from "./api";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function RapportsPage() {
  const { t, i18n } = useTranslation(["rapports", "paiements"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const [date, setDate] = useState(todayISO());

  const { data, isLoading } = useQuery({
    queryKey: ["rapport", date],
    queryFn: () => fetchRapportJour(date),
  });

  const money = (n: number) => formatMoney(n, lang);

  const pdf = (action: "download" | "print") => {
    if (!data) return;
    genererRapportPDF(data, {
      title: t("rapports:daily"),
      date: t("rapports:date"),
      orders: t("rapports:ordersTable"),
      revenue: t("rapports:kpi.revenue"),
      collected: t("rapports:kpi.collected"),
      number: t("rapports:columns.number"),
      client: t("rapports:columns.client"),
      amount: t("rapports:columns.amount"),
      mode: t("rapports:columns.mode"),
      payments: t("rapports:paymentsTable"),
      modes: {
        ESPECES: t("paiements:modes.ESPECES"),
        MOBILE_MONEY: t("paiements:modes.MOBILE_MONEY"),
        VIREMENT: t("paiements:modes.VIREMENT"),
      },
    }, action);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("rapports:daily")}</h1>
            <p className="text-sm text-slate-400">{t("rapports:title")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            onClick={() => pdf("download")}
            disabled={!data}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={16} /> {t("rapports:download")}
          </button>
          <button
            onClick={() => pdf("print")}
            disabled={!data}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={16} /> {t("rapports:print")}
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="py-10 text-center text-slate-400">…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Kpi label={t("rapports:kpi.orders")} value={String(data.nbCommandes)} />
            <Kpi label={t("rapports:kpi.revenue")} value={money(data.totalCommandes)} />
            <Kpi
              label={t("rapports:kpi.collected")}
              value={money(data.totalPaiements)}
              valueClass="text-emerald-600"
            />
          </div>

          <div className="grid items-start gap-6 md:grid-cols-2">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 font-semibold">{t("rapports:ordersTable")}</h2>
              {data.commandes.length === 0 ? (
                <p className="text-sm text-slate-400">{t("rapports:noOrders")}</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">{t("rapports:columns.number")}</th>
                      <th className="py-2">{t("rapports:columns.client")}</th>
                      <th className="py-2 text-right">{t("rapports:columns.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commandes.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{c.numero}</td>
                        <td className="py-2 text-slate-600">{c.clientNom}</td>
                        <td className="py-2 text-right tabular-nums">{money(c.totalTTC)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 font-semibold">{t("rapports:paymentsTable")}</h2>
              {data.paiements.length === 0 ? (
                <p className="text-sm text-slate-400">{t("rapports:noPayments")}</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">{t("rapports:columns.client")}</th>
                      <th className="py-2 text-right">{t("rapports:columns.amount")}</th>
                      <th className="py-2 text-right">{t("rapports:columns.mode")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paiements.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 text-slate-600">{p.clientNom}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-600">
                          {money(p.montant)}
                        </td>
                        <td className="py-2 text-right text-xs text-slate-500">
                          {t(`paiements:modes.${p.mode}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {data.topProduits.length > 0 && (
            <section className="mt-6 rounded-xl border bg-white p-5">
              <h2 className="mb-3 font-semibold">{t("rapports:topProducts")}</h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">{t("rapports:columns.product")}</th>
                    <th className="py-2 text-right">{t("rapports:columns.qty")}</th>
                    <th className="py-2 text-right">{t("rapports:columns.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProduits.map((p) => (
                    <tr key={p.nom} className="border-b last:border-0">
                      <td className="py-2 font-medium">{p.nom}</td>
                      <td className="py-2 text-right tabular-nums">{p.quantite}</td>
                      <td className="py-2 text-right tabular-nums">{money(p.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  valueClass = "text-slate-800",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
