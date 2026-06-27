import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { avatarColor, initials } from "../../lib/avatar";
import { genererBilanPDF } from "../../lib/bilan";
import { PaymentModal } from "../paiements/PaymentModal";
import { archiveClient, fetchClient } from "./api";

export function ClientDetailPage() {
  const { t, i18n } = useTranslation(["clients", "common", "paiements"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);

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

  const money = (n: number) => formatMoney(n, lang);

  const printBilan = () =>
    genererBilanPDF(client, lang, {
      subtitle: t("clients:detail.bilan.subtitle"),
      client: t("paiements:columns.client"),
      phone: t("clients:columns.phone"),
      address: t("clients:columns.address"),
      since: t("clients:detail.createdAt"),
      orders: t("clients:detail.orders"),
      payments: t("paiements:title"),
      number: t("commandes:columns.number", { ns: "commandes" }),
      date: t("clients:detail.hist.date"),
      amount: t("clients:detail.hist.amount"),
      mode: t("paiements:columns.mode"),
      totalOrders: t("clients:detail.totalOrders"),
      totalPayments: t("clients:detail.totalPayments"),
      balance: t("clients:detail.currentBalance"),
      clientSignature: t("clients:detail.bilan.clientSignature"),
      managerSignature: t("clients:detail.bilan.managerSignature"),
      modes: {
        ESPECES: t("paiements:modes.ESPECES"),
        MOBILE_MONEY: t("paiements:modes.MOBILE_MONEY"),
        VIREMENT: t("paiements:modes.VIREMENT"),
      },
    });

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate("/clients")}
        className="mb-4 text-sm text-slate-500 hover:underline"
      >
        ← {t("clients:title")}
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${avatarColor(client.nom)}`}
          >
            {initials(client.nom)}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{client.nom}</h1>
            <p className="text-sm text-slate-400">
              {t("clients:detail.createdAt")} {formatDate(client.createdAt, lang)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/clients/${client.id}/commandes/new`)}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus size={16} /> {t("clients:detail.newOrder")}
          </button>
          <button
            onClick={() => setShowPayment(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Wallet size={16} /> {t("clients:detail.newPayment")}
          </button>
          <button
            onClick={printBilan}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer size={16} /> {t("clients:detail.printBalance")}
          </button>
          <button
            onClick={() => navigate(`/clients/${client.id}/edit`)}
            title={t("common:actions.edit")}
            className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm(t("clients:detail.archiveConfirm"))) archive.mutate();
            }}
            title={t("common:actions.delete")}
            className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("clients:detail.currentBalance")}
          value={money(client.solde)}
          valueClass={client.solde > 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <Stat label={t("clients:detail.totalOrders")} value={money(client.totalCommandes)} />
        <Stat label={t("clients:detail.totalPayments")} value={money(client.totalPaiements)} />
        <Stat label={t("clients:detail.orders")} value={String(client.nbCommandes)} />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-3">
        {/* Infos */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">{t("clients:detail.info")}</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t("clients:columns.phone")} value={client.telephone} />
            <Row label={t("clients:columns.email")} value={client.email ?? "—"} />
            <Row label={t("clients:columns.address")} value={client.adresse ?? "—"} />
          </dl>
        </section>

        {/* Historique */}
        <section className="rounded-xl border bg-white p-5 md:col-span-2">
          <h2 className="mb-3 font-semibold">{t("clients:detail.history")}</h2>
          {client.historique.length === 0 ? (
            <p className="text-sm text-slate-400">{t("clients:detail.noHistory")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">{t("clients:detail.hist.date")}</th>
                  <th className="py-2">{t("clients:detail.hist.type")}</th>
                  <th className="py-2 text-right">{t("clients:detail.hist.amount")}</th>
                  <th className="py-2 text-right">{t("clients:detail.hist.balanceAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {client.historique.map((op) => {
                  const isOrder = op.type === "COMMANDE";
                  return (
                    <tr key={`${op.type}-${op.id}`} className="border-b last:border-0">
                      <td className="py-2 text-slate-500">{formatDate(op.date, lang)}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${isOrder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}
                        >
                          {t(`clients:detail.hist.${op.type}`)}
                        </span>
                        {op.ref && <span className="ml-2 text-xs text-slate-400">{op.ref}</span>}
                        {op.mode && (
                          <span className="ml-2 text-xs text-slate-400">
                            {t(`paiements:modes.${op.mode}`)}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${isOrder ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {isOrder ? "+" : "−"}
                        {money(op.montant)}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {money(op.soldeApres)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {showPayment && (
        <PaymentModal
          clientId={client.id}
          clientName={client.nom}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-slate-800",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
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
