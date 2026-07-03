import type { StatutRappel } from "@gca/shared";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchRappels } from "./api";
import { RappelItem } from "./RappelItem";

export function RappelsPage() {
  const { t } = useTranslation(["rappels", "common"]);
  const [filter, setFilter] = useState<StatutRappel>("EN_COURS");

  const { data: rappels, isLoading } = useQuery({
    queryKey: ["rappels", filter],
    queryFn: () => fetchRappels(filter),
  });

  const tab = (value: StatutRappel, label: string) => (
    <button
      onClick={() => setFilter(value)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        filter === value
          ? "bg-slate-800 text-white dark:bg-slate-700"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
          <BellRing size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("rappels:title")}</h1>
          <p className="text-sm text-slate-400">{t("rappels:subtitle")}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {tab("EN_COURS", t("rappels:filter.current"))}
        {tab("TERMINE", t("rappels:filter.done"))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-slate-400">{t("common:common.loading")}</p>
      ) : !rappels || rappels.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white py-12 text-center text-slate-400 dark:bg-slate-900">
          {filter === "TERMINE" ? t("rappels:emptyDone") : t("rappels:empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {rappels.map((r) => (
            <RappelItem key={r.id} rappel={r} showClient />
          ))}
        </div>
      )}
    </div>
  );
}
