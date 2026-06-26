import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { archiveClient, fetchClient } from "./api";

export function ClientDetailPage() {
  const { t, i18n } = useTranslation(["clients", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id!),
    enabled: Boolean(id),
  });

  const archive = useMutation({
    mutationFn: () => archiveClient(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      navigate("/clients", { replace: true });
    },
  });

  if (isLoading) return <p className="text-slate-400">{t("common:common.loading")}</p>;
  if (!client) return <p className="text-slate-400">{t("common:errors.NOT_FOUND")}</p>;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate("/clients")}
        className="mb-4 text-sm text-slate-500 hover:underline"
      >
        ← {t("clients:title")}
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.nom}</h1>
          <p className="text-sm text-slate-500">{t("clients:detail.title")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/clients/${client.id}/edit`)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common:actions.edit")}
          </button>
          <button
            onClick={() => {
              if (confirm(t("clients:detail.archiveConfirm"))) archive.mutate();
            }}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t("common:actions.delete")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-semibold">{t("clients:detail.info")}</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t("clients:columns.phone")} value={client.telephone} />
            <Row label={t("clients:columns.email")} value={client.email ?? "—"} />
            <Row label={t("clients:form.address")} value={client.adresse ?? "—"} />
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-semibold">{t("clients:detail.totalCumule")}</h2>
          <p className="text-3xl font-bold text-green-600">
            {formatMoney(client.totalCumule, lang)}
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold">{t("clients:detail.orders")}</h2>
        {client.commandes.length === 0 ? (
          <p className="text-sm text-slate-400">{t("clients:detail.noOrders")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {client.commandes.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span className="font-medium">{c.numero}</span>
                <span className="text-slate-500">{formatDate(c.date, lang)}</span>
                <span className="font-semibold">
                  {formatMoney(Number(c.totalTTC), lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
