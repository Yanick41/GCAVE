import { formatDate, type Lang, type StatutPaiement } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Download, Pencil, Printer, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { genererFacturePDF, type FactureData } from "../../lib/facture";
import { ApercuImpression } from "../impression/ApercuImpression";
import { deletePaiement } from "../paiements/api";
import { PaymentModal } from "../paiements/PaymentModal";
import { useMoney } from "../privacy/mask";
import { convertirEnBon, fetchCommande } from "./api";
import { reglementDe } from "./reglement";

/** Pastille d'état de règlement (non payée / partielle / payée). */
export const paiementStatusStyle: Record<StatutPaiement, string> = {
  NON_PAYEE: "bg-rose-100 text-rose-700",
  PARTIELLE: "bg-amber-100 text-amber-700",
  PAYEE: "bg-emerald-100 text-emerald-700",
};

export function OrderDetailPage() {
  const { t, i18n } = useTranslation(["commandes", "paiements", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [apercu, setApercu] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ["commande", id],
    queryFn: () => fetchCommande(id!),
    enabled: Boolean(id),
  });

  const removePaiement = useMutation({
    mutationFn: (paiementId: string) => deletePaiement(paiementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commande", id] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (c?.clientId) queryClient.invalidateQueries({ queryKey: ["client", c.clientId] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
    },
  });

  // Conversion en bon de commande : document séparé, sans prix. La commande
  // reste intacte ; on ouvre le bon généré, prêt à imprimer.
  const enBon = useMutation({
    mutationFn: () => convertirEnBon(id!),
    onSuccess: (bon) => {
      queryClient.invalidateQueries({ queryKey: ["bons"] });
      if (bon.clientId) queryClient.invalidateQueries({ queryKey: ["client", bon.clientId] });
      navigate(`/bons/${bon.id}`);
    },
  });

  if (isLoading || !c)
    return <p className="text-slate-400">{t("common:common.loading")}</p>;

  const reglement = reglementDe(c);
  const paiements = c.paiements ?? [];
  const clientNom = c.client?.nom ?? c.clientNomLibre ?? "—";
  // Commandes antérieures au déploiement : le « payé » reste l'acompte figé,
  // on n'affiche donc pas de détail de règlements qui contredirait les totaux.
  const suiviDetaille = c.utiliseNouveauSuiviPaiement ?? false;

  // Facture : le détail des règlements rattachés à la commande y figure,
  // avec le total payé et le reste à payer.
  // Données de la facture, partagées par l'aperçu et l'impression directe.
  const donneesFacture: FactureData = {
    clientNom,
    clientTelephone: c.client?.telephone,
    clientAdresse: c.client?.adresse,
    clientCode: c.clientId,
    date: new Date(c.date),
    numero: c.numero,
    lignes: c.lignes.map((l) => ({
      nomProduit: l.nomProduit,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      totalLigne: Number(l.totalLigne),
    })),
    total: Number(c.totalTTC),
    ancienSolde: Number(c.ancienSolde),
    paiements: suiviDetaille
      ? paiements.map((p) => ({
          date: p.date,
          montant: p.montant,
          mode: t(`paiements:modes.${p.mode}`),
        }))
      : undefined,
    paye: reglement.totalPaye,
    reste: reglement.reste,
  };

  const facture = (action: "download" | "print") =>
    genererFacturePDF(donneesFacture, lang, action);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <BackButton />
        <div className="flex flex-wrap gap-2">
          {c.clientId && c.statut !== "ANNULEE" && suiviDetaille && (
            <button
              onClick={() => setShowPayment(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Wallet size={16} /> {t("commandes:addPayment")}
            </button>
          )}
          <button
            onClick={() => enBon.mutate()}
            disabled={enBon.isPending}
            title={t("commandes:convertToBonHint")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ClipboardList size={16} />{" "}
            {enBon.isPending ? t("commandes:converting") : t("commandes:convertToBon")}
          </button>
          <button
            onClick={() => facture("print")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Printer size={16} /> {t("commandes:print")}
          </button>
          <button
            onClick={() => facture("download")}
            title={t("commandes:downloadInvoice")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download size={16} />
          </button>
          <Link
            to={`/commandes/${c.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Pencil size={16} /> {t("commandes:edit")}
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{c.numero}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${paiementStatusStyle[reglement.statut]}`}
          >
            {t(`commandes:paymentStatus.${reglement.statut}`)}
          </span>
        </div>
        <span className="text-sm text-slate-400">{formatDate(c.date, lang)}</span>
      </div>
      <p className="mb-6 text-slate-600">
        {t("commandes:client")} : {clientNom}
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
                  {money(Number(l.prixUnitaire))}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {money(Number(l.totalLigne))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto max-w-sm space-y-2 text-sm">
        <Line label={t("commandes:subtotal")} value={money(Number(c.sousTotal))} />
        {Number(c.montantRemise) > 0 && (
          <Line
            label={t("commandes:discount")}
            value={`- ${money(Number(c.montantRemise))}`}
          />
        )}
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold">{t("commandes:total")}</span>
          <span className="text-xl font-bold text-green-600">
            {money(Number(c.totalTTC))}
          </span>
        </div>
        {Number(c.ancienSolde) > 0 && (
          <>
            <Line
              label={t("commandes:previousBalance")}
              value={money(Number(c.ancienSolde))}
            />
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">{t("commandes:grandTotal")}</span>
              <span className="font-bold tabular-nums">{money(reglement.totalDu)}</span>
            </div>
          </>
        )}
        <Line
          label={t("commandes:paid")}
          value={money(reglement.totalPaye)}
          valueClass="text-emerald-600 font-semibold"
        />
        {reglement.tropPercu > 0 ? (
          <Line
            label={t("commandes:overpaid")}
            value={money(reglement.tropPercu)}
            valueClass="text-amber-600 font-bold"
          />
        ) : (
          <Line
            label={t("commandes:remaining")}
            value={money(reglement.reste)}
            valueClass={reglement.reste > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}
          />
        )}
      </div>

      {/* Règlements rattachés à la commande */}
      <section className="mt-6 rounded-xl border bg-white dark:bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold">{t("commandes:payments")}</h2>
        {!suiviDetaille ? (
          <p className="text-sm text-slate-400">{t("commandes:legacyTracking")}</p>
        ) : paiements.length === 0 ? (
          <p className="text-sm text-slate-400">{t("commandes:noPayments")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">{t("paiements:columns.date")}</th>
                <th className="py-2">{t("paiements:columns.mode")}</th>
                <th className="py-2">{t("paiements:columns.observation")}</th>
                <th className="py-2 text-right">{t("paiements:columns.amount")}</th>
                <th className="w-10 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 text-slate-500">{formatDate(p.date, lang)}</td>
                  <td className="py-2">{t(`paiements:modes.${p.mode}`)}</td>
                  <td className="py-2 text-slate-500">{p.observation ?? "—"}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-emerald-600">
                    {money(p.montant)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(t("paiements:deleteConfirm"))) removePaiement.mutate(p.id);
                      }}
                      disabled={removePaiement.isPending}
                      title={t("common:actions.delete")}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-slate-800"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {apercu && (
        <ApercuImpression
          document={{ type: "FACTURE", data: donneesFacture }}
          onClose={() => setApercu(false)}
        />
      )}
      {showPayment && c.clientId && (
        <PaymentModal
          clientId={c.clientId}
          clientName={clientNom}
          commandes={[{ id: c.id, numero: c.numero, date: c.date, reste: reglement.reste }]}
          defaultCommandeId={c.id}
          lockCommande
          onClose={() => setShowPayment(false)}
        />
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
