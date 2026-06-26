import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./lib/api";

interface Health {
  ok: boolean;
  db: "up" | "down";
  ts: string;
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const langs = ["fr", "en"] as const;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{t("common.language")}:</span>
      {langs.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded px-2 py-1 font-medium uppercase transition ${
            i18n.resolvedLanguage === lng
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        ok ? "bg-green-500" : "bg-red-500"
      }`}
    />
  );
}

export default function App() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get<Health>("/api/health")).data,
    refetchInterval: 10_000,
  });

  const apiUp = !isError && !isLoading && data?.ok === true;
  const dbUp = data?.db === "up";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
          <p className="text-sm text-slate-500">{t("app.tagline")}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
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
        <p className="mt-4 text-center text-xs text-slate-400">
          Sprint 0 — Setup &amp; architecture ✓
        </p>
      </main>
    </div>
  );
}
