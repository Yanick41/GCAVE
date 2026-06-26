import { formatMoney, type Lang } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Package, TrendingUp, Wallet, WalletCards } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { avatarColor, initials } from "../../lib/avatar";
import { fetchDashboard } from "./api";

export function DashboardPage() {
  const { t, i18n } = useTranslation(["dashboard", "commandes"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading || !data)
    return <p className="text-slate-400">{t("dashboard:title")}…</p>;

  const fmt = (n: number) => formatMoney(n, lang);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold">{t("dashboard:title")}</h1>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<TrendingUp size={20} />}
          color="bg-blue-100 text-blue-700"
          label={t("dashboard:kpi.revenue")}
          value={fmt(data.chiffreAffaires)}
          sub={`${fmt(data.caJour)} ${t("dashboard:kpi.today")}`}
        />
        <Kpi
          icon={<Wallet size={20} />}
          color="bg-emerald-100 text-emerald-700"
          label={t("dashboard:kpi.creditPaid")}
          value={fmt(data.creditPaye)}
        />
        <Kpi
          icon={<WalletCards size={20} />}
          color="bg-rose-100 text-rose-700"
          label={t("dashboard:kpi.creditDue")}
          value={fmt(data.creditRestant)}
        />
        <Kpi
          icon={<Package size={20} />}
          color="bg-violet-100 text-violet-700"
          label={t("dashboard:kpi.orders")}
          value={String(data.nbCommandes)}
          sub={`+${data.nbCommandesJour} ${t("dashboard:kpi.today")}`}
        />
      </div>

      {/* Performance de vente */}
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-4 font-semibold">{t("dashboard:salesPerformance")}</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.tendance}>
              <defs>
                <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                width={40}
              />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => l} />
              <Area
                type="monotone"
                dataKey="ca"
                stroke="#16a34a"
                fill="url(#ca)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Meilleurs clients payeurs */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">{t("dashboard:topClients")}</h2>
          <p className="mb-4 text-xs text-slate-400">{t("dashboard:topClientsHint")}</p>
          {data.topClients.length === 0 ? (
            <p className="text-sm text-slate-400">{t("dashboard:noData")}</p>
          ) : (
            <ul className="space-y-3">
              {data.topClients.map((c, i) => (
                <li key={c.clientId} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-bold text-slate-400">{i + 1}</span>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(c.nom)}`}
                  >
                    {initials(c.nom)}
                  </span>
                  <span className="flex-1 truncate font-medium">{c.nom}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      {fmt(c.paye)}
                    </p>
                    {c.restant > 0 && (
                      <p className="text-xs text-rose-500">
                        {fmt(c.restant)} {t("dashboard:due")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top produits */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 font-semibold">{t("dashboard:topProducts")}</h2>
          {data.topProduits.length === 0 ? (
            <p className="text-sm text-slate-400">{t("dashboard:noData")}</p>
          ) : (
            <ul className="space-y-3">
              {data.topProduits.map((p, i) => (
                <li key={p.nom} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-bold text-slate-400">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{p.nom}</span>
                  <span className="text-sm font-semibold">{fmt(p.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${color}`}>{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
