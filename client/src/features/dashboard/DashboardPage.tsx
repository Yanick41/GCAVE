import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";

interface Health {
  ok: boolean;
  db: "up" | "down";
  ts: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
    />
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get<Health>("/api/health")).data,
    refetchInterval: 10_000,
  });

  const apiUp = !isError && !isLoading && data?.ok === true;
  const dbUp = data?.db === "up";

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">{t("nav.dashboard")}</h1>
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("health.title")}</h2>
        {isLoading ? (
          <p className="text-slate-500">{t("health.checking")}</p>
        ) : (
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <StatusDot ok={apiUp} />
              <span className="w-28 text-slate-600">{t("health.api")}</span>
              <span className="font-medium">
                {apiUp ? t("health.up") : t("health.down")}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <StatusDot ok={dbUp} />
              <span className="w-28 text-slate-600">{t("health.database")}</span>
              <span className="font-medium">
                {dbUp ? t("health.up") : t("health.down")}
              </span>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
