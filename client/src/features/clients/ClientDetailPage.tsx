import { formatDate, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Wallet,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { avatarColor, initials } from "../../lib/avatar";
import { genererBilanPDF } from "../../lib/bilan";
import { genererFacturePDF } from "../../lib/facture";
import { genererRecuPDF } from "../../lib/recu";
import { fetchCommande } from "../commandes/api";
import { PaymentModal } from "../paiements/PaymentModal";
import { useMoney } from "../privacy/mask";
import { RappelItem } from "../rappels/RappelItem";
import { RappelModal } from "../rappels/RappelModal";
import { archiveClient, fetchClient, type HistoriqueOp } from "./api";

export function ClientDetailPage() {
  const { t, i18n } = useTranslation(["clients", "common", "paiements"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [showRappel, setShowRappel] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

  // Accès rapide aux lignes de produits d'une commande (pour l'affichage déplié)
  const commandeMap = new Map(client.commandes.map((c) => [c.id, c]));

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

  // Imprimer une opération de l'historique : facture (commande) ou reçu (paiement)
  const printOperation = async (op: HistoriqueOp) => {
    setPrintingId(op.id);
    try {
      if (op.type === "COMMANDE") {
        const cmd = await fetchCommande(op.id);
        genererFacturePDF(
          {
            clientNom: client.nom,
            date: new Date(cmd.date),
            numero: cmd.numero,
            lignes: cmd.lignes.map((l) => ({
              nomProduit: l.nomProduit,
              quantite: Number(l.quantite),
              prixUnitaire: Number(l.prixUnitaire),
              totalLigne: Number(l.totalLigne),
            })),
            total: Number(cmd.totalTTC),
            ancienSolde: Number(cmd.ancienSolde),
            paye: Number(cmd.montantPaye),
            reste:
              Number(cmd.totalTTC) + Number(cmd.ancienSolde) - Number(cmd.montantPaye),
          },
          lang,
          {
            title: t("commandes:invoice"),
            client: t("paiements:columns.client"),
            date: t("clients:detail.hist.date"),
            product: t("commandes:product"),
            qty: t("commandes:qty"),
            unitPrice: t("commandes:unitPrice"),
            lineTotal: t("commandes:lineTotal"),
            total: t("commandes:total"),
            subtotal: t("commandes:subtotal"),
            previousBalance: t("commandes:previousBalance"),
            grandTotal: t("commandes:grandTotal"),
            paid: t("commandes:paid"),
            remaining: t("commandes:remaining"),
            stamp: t("commandes:stamp"),
          },
          "print",
        );
      } else {
        genererRecuPDF(
          {
            clientNom: client.nom,
            date: new Date(op.date),
            montant: op.montant,
            mode: t(`paiements:modes.${op.mode}`),
            observation: op.observation,
          },
          lang,
          {
            title: t("paiements:receipt"),
            client: t("paiements:columns.client"),
            date: t("paiements:date"),
            amount: t("paiements:amount"),
            mode: t("paiements:mode"),
            observation: t("paiements:observation"),
          },
          "print",
        );
      }
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <BackButton to="/clients" label={t("clients:title")} />
      </div>

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
            onClick={() => setShowRappel(true)}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400"
          >
            <BellRing size={16} /> {t("rappels:new", { ns: "rappels" })}
          </button>
          <button
            onClick={printBilan}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Printer size={16} /> {t("clients:detail.printBalance")}
          </button>
          <button
            onClick={() => navigate(`/clients/${client.id}/edit`)}
            title={t("common:actions.edit")}
            className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
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

      {/* Infos (pleine largeur, compact) */}
      <section className="mb-6 rounded-xl border bg-white dark:bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold">{t("clients:detail.info")}</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Row label={t("clients:columns.phone")} value={client.telephone} />
          <Row label={t("clients:columns.email")} value={client.email ?? "—"} />
          <Row label={t("clients:columns.address")} value={client.adresse ?? "—"} />
          {client.soldeInitial !== 0 && (
            <Row label={t("clients:detail.openingBalance")} value={money(client.soldeInitial)} />
          )}
        </div>
      </section>

      {/* Rappels du client */}
      {client.rappels.length > 0 && (
        <section className="mb-6 rounded-xl border bg-white dark:bg-slate-900 p-5">
          <h2 className="mb-3 font-semibold">{t("rappels:title", { ns: "rappels" })}</h2>
          <div className="space-y-2">
            {client.rappels.map((r) => (
              <RappelItem key={r.id} rappel={r} />
            ))}
          </div>
        </section>
      )}

      {/* Historique (pleine largeur) */}
      <section className="rounded-xl border bg-white dark:bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold">{t("clients:detail.history")}</h2>
        {client.historique.length === 0 ? (
          <p className="text-sm text-slate-400">{t("clients:detail.noHistory")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-400">
                <tr>
                  <th className="w-10 py-2"></th>
                  <th className="py-2 whitespace-nowrap">{t("clients:detail.hist.date")}</th>
                  <th className="py-2">{t("clients:detail.hist.type")}</th>
                  <th className="py-2 text-right whitespace-nowrap">
                    {t("clients:detail.hist.amount")}
                  </th>
                  <th className="py-2 text-right whitespace-nowrap">
                    {t("clients:detail.hist.balanceAfter")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {client.historique.map((op) => {
                  const isOrder = op.type === "COMMANDE";
                  const cmd = isOrder ? commandeMap.get(op.id) : undefined;
                  const isOpen = expanded.has(op.id);
                  return (
                    <Fragment key={`${op.type}-${op.id}`}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => printOperation(op)}
                              disabled={printingId === op.id}
                              title={isOrder ? t("commandes:invoice") : t("paiements:receipt")}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <Printer size={15} />
                            </button>
                            {isOrder && (
                              <button
                                onClick={() => navigate(`/commandes/${op.id}/edit`)}
                                title={t("commandes:edit", { ns: "commandes" })}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 whitespace-nowrap text-slate-500">
                          {formatDate(op.date, lang)}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {isOrder && cmd && cmd.lignes.length > 0 && (
                              <button
                                onClick={() => toggleExpand(op.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title={t("commandes:lines")}
                              >
                                {isOpen ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${isOrder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}
                            >
                              {t(`clients:detail.hist.${op.type}`)}
                            </span>
                            {op.ref && (
                              <span className="text-xs text-slate-400">{op.ref}</span>
                            )}
                            {op.mode && (
                              <span className="text-xs text-slate-400">
                                {t(`paiements:modes.${op.mode}`)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums whitespace-nowrap ${isOrder ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {isOrder ? "+" : "−"}
                          {money(op.montant)}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums whitespace-nowrap">
                          {money(op.soldeApres)}
                        </td>
                      </tr>

                      {isOrder && isOpen && cmd && (
                        <tr className="border-b last:border-0">
                          <td colSpan={5} className="bg-slate-50 p-3 dark:bg-slate-800/40">
                            <table className="w-full text-xs">
                              <thead className="text-slate-400">
                                <tr>
                                  <th className="py-1 text-left">{t("commandes:product")}</th>
                                  <th className="py-1 text-right">{t("commandes:qty")}</th>
                                  <th className="py-1 text-right">{t("commandes:unitPrice")}</th>
                                  <th className="py-1 text-right">{t("commandes:lineTotal")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cmd.lignes.map((l) => (
                                  <tr key={l.id}>
                                    <td className="py-1">{l.nomProduit}</td>
                                    <td className="py-1 text-right tabular-nums">
                                      {Number(l.quantite)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">
                                      {money(Number(l.prixUnitaire))}
                                    </td>
                                    <td className="py-1 text-right font-medium tabular-nums">
                                      {money(Number(l.totalLigne))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t">
                                  <td colSpan={3} className="py-1 text-right font-semibold">
                                    {t("commandes:total")}
                                  </td>
                                  <td className="py-1 text-right font-bold tabular-nums text-green-600">
                                    {money(Number(cmd.totalTTC))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPayment && (
        <PaymentModal
          clientId={client.id}
          clientName={client.nom}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showRappel && (
        <RappelModal
          clientId={client.id}
          clientName={client.nom}
          onClose={() => setShowRappel(false)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-slate-800 dark:text-slate-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}
