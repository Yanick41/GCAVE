import { formatDate, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, Download, Pencil, Printer, Trash2, Truck, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { genererBonPDF } from "../../lib/bon";
import { useMoney } from "../privacy/mask";
import { AllerRetourBadge, bonStatusStyle } from "./BonsListPage";
import { deleteBon, fetchBon, setBonStatut, type StatutBon } from "./api";

// Statut suivant dans le flux aller-retour : Brouillon→Envoyé→Livré→Payé
const NEXT_AR: Partial<Record<StatutBon, StatutBon>> = {
  BROUILLON: "ENVOYE",
  ENVOYE: "LIVRE",
  LIVRE: "PAYE",
};

export function BonDetailPage() {
  const { t, i18n } = useTranslation(["bons", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bon, isLoading } = useQuery({
    queryKey: ["bon", id],
    queryFn: () => fetchBon(id!),
    enabled: Boolean(id),
  });

  const remove = useMutation({
    mutationFn: () => deleteBon(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bons"] });
      if (bon?.clientId) queryClient.invalidateQueries({ queryKey: ["client", bon.clientId] });
      navigate("/bons", { replace: true });
    },
  });

  const changeStatut = useMutation({
    mutationFn: (s: StatutBon) => setBonStatut(id!, s),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["bon", id] });
      queryClient.invalidateQueries({ queryKey: ["bons"] });
      // Le solde du client dépend des bons livrés → rafraîchir
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (updated.clientId) queryClient.invalidateQueries({ queryKey: ["client", updated.clientId] });
    },
  });

  if (isLoading) return <p className="text-slate-400">{t("common:common.loading")}</p>;
  if (!bon) return <p className="text-slate-400">{t("common:errors.NOT_FOUND")}</p>;

  const clientNom = bon.client?.nom ?? bon.clientNomLibre ?? "—";
  const totalQuantite = bon.lignes.reduce((s, l) => s + Number(l.quantite), 0);
  const isConverted = bon.statut === "CONVERTI";
  const montant = Number(bon.montant);
  // Prochaine étape du flux aller-retour (Marquer envoyé / livré / payé)
  const nextAR = bon.allerRetour ? NEXT_AR[bon.statut] : undefined;
  const NextIcon = nextAR === "PAYE" ? Check : nextAR === "LIVRE" ? Truck : ArrowRightLeft;

  const pdf = (action: "download" | "print") =>
    genererBonPDF(
      {
        numero: bon.numero,
        clientNom,
        date: new Date(bon.date),
        telephone: bon.telephone,
        adresseLivraison: bon.adresseLivraison,
        lignes: bon.lignes.map((l) => ({
          designation: l.designation,
          quantite: Number(l.quantite),
          servi: l.servi,
        })),
        totalQuantite,
        notes: bon.notes,
      },
      lang,
      {
        title: t("bons:detailTitle"),
        client: t("bons:client"),
        date: t("bons:columns.date"),
        phone: t("bons:phone"),
        deliveryAddress: t("bons:deliveryAddress"),
        designation: t("bons:designation"),
        qty: t("bons:qty"),
        served: t("bons:served"),
        totalQty: t("bons:totalQty"),
        notes: t("bons:notes"),
        clientSignature: t("bons:clientSignature"),
        managerSignature: t("bons:managerSignature"),
      },
      action,
    );

  // Conversion : pré-remplit une commande avec désignations + quantités (prix saisis là-bas)
  const convert = () =>
    navigate("/commandes/new", {
      state: {
        fromBonId: bon.id,
        clientId: bon.clientId ?? undefined,
        prefillLines: bon.lignes.map((l) => ({
          nomProduit: l.designation,
          quantite: Number(l.quantite),
        })),
      },
    });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <BackButton to="/bons" label={t("bons:title")} />
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{bon.numero}</h1>
            {bon.allerRetour && <AllerRetourBadge label={t("bons:allerRetour")} />}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${bonStatusStyle[bon.statut]}`}
            >
              {t(`bons:statuses.${bon.statut}`)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{formatDate(bon.date, lang)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => pdf("download")}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={16} /> {t("bons:download")}
          </button>
          <button
            onClick={() => pdf("print")}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer size={16} /> {t("bons:print")}
          </button>
          {nextAR && (
            <button
              onClick={() => changeStatut.mutate(nextAR)}
              disabled={changeStatut.isPending}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
            >
              <NextIcon size={16} /> {t(`bons:mark.${nextAR}`)}
            </button>
          )}
          {!isConverted && (
            <button
              onClick={() => navigate(`/bons/${bon.id}/edit`)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil size={16} /> {t("common:actions.edit")}
            </button>
          )}
          {!isConverted && (
            <button
              onClick={convert}
              title={t("bons:convertHint")}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <ArrowRightLeft size={16} /> {t("bons:convert")}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(t("bons:deleteConfirm"))) remove.mutate();
            }}
            title={t("bons:delete")}
            className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isConverted && (
        <p className="mb-4 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
          {t("bons:convertedNotice")}
        </p>
      )}

      {/* En-tête client / livraison */}
      <section className="mb-6 rounded-xl border bg-white p-5 dark:bg-slate-900">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Row
            label={t("bons:client")}
            value={
              bon.clientId ? (
                <button
                  onClick={() => navigate(`/clients/${bon.clientId}`)}
                  className="inline-flex items-center gap-1 font-medium text-slate-800 hover:underline dark:text-slate-100"
                >
                  <User size={14} /> {clientNom}
                </button>
              ) : (
                clientNom
              )
            }
          />
          <Row label={t("bons:phone")} value={bon.telephone ?? "—"} />
          <Row label={t("bons:deliveryAddress")} value={bon.adresseLivraison ?? "—"} />
          {bon.allerRetour && (
            <Row
              label={t("bons:montant")}
              value={
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {money(montant)}
                </span>
              }
            />
          )}
        </div>
        {bon.allerRetour && bon.statut === "LIVRE" && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {t("bons:creanceNotice", { montant: money(montant) })}
          </p>
        )}
      </section>

      {/* Lignes produits */}
      <section className="mb-6 rounded-xl border bg-white p-5 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">{t("bons:lines")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">{t("bons:designation")}</th>
                <th className="py-2 text-right">{t("bons:qty")}</th>
                <th className="py-2 text-right">{t("bons:served")}</th>
              </tr>
            </thead>
            <tbody>
              {bon.lignes.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">{l.designation}</td>
                  <td className="py-2 text-right tabular-nums">{Number(l.quantite)}</td>
                  <td className="py-2 text-right tabular-nums">{l.servi ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="py-2 text-right font-semibold" colSpan={1}>
                  {t("bons:totalQty")}
                </td>
                <td className="py-2 text-right font-bold tabular-nums text-green-600">
                  {totalQuantite}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Notes */}
      {bon.notes && bon.notes.trim() && (
        <section className="rounded-xl border bg-white p-5 dark:bg-slate-900">
          <h2 className="mb-2 font-semibold">{t("bons:notes")}</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {bon.notes}
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}
