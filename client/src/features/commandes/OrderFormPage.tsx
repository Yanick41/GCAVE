import { computeCommande, formatMoney, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer, Trash2, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { errorCode } from "../../lib/errors";
import { genererFacturePDF } from "../../lib/facture";
import { fetchClients } from "../clients/api";
import { createCommande } from "./api";

interface LineDraft {
  nomProduit: string;
  quantite: string;
  prixUnitaire: string;
}

const emptyLine = (): LineDraft => ({ nomProduit: "", quantite: "1", prixUnitaire: "" });
const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function OrderFormPage() {
  const { t, i18n } = useTranslation(["commandes", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const { id: clientIdParam } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState(clientIdParam ?? "");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [montantPaye, setMontantPaye] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients", ""],
    queryFn: () => fetchClients(""),
  });

  // Calcul TEMPS RÉEL (en mémoire, < 50 ms) via le moteur partagé
  const calc = useMemo(
    () =>
      computeCommande({
        lignes: lines.map((l) => ({
          nomProduit: l.nomProduit,
          quantite: num(l.quantite),
          prixUnitaire: num(l.prixUnitaire),
        })),
        remiseType: "AUCUNE",
        remiseValeur: 0,
      }),
    [lines],
  );

  const paye = Math.min(num(montantPaye), calc.totalTTC);
  const reste = Math.max(calc.totalTTC - paye, 0);

  const mutation = useMutation({
    mutationFn: createCommande,
    onSuccess: (commande) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(commande.clientId ? `/clients/${commande.clientId}` : "/commandes");
    },
    onError: (err) => setServerError(t(`common:errors.${errorCode(err)}`)),
  });

  const validLines = lines.filter((l) => l.nomProduit.trim() && num(l.quantite) > 0);
  const canSubmit = Boolean(clientId) && validLines.length > 0;

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const submit = () => {
    setServerError(null);
    if (!canSubmit) {
      setServerError(t("commandes:noLines"));
      return;
    }
    mutation.mutate({
      clientId,
      lignes: validLines.map((l) => ({
        nomProduit: l.nomProduit.trim(),
        quantite: num(l.quantite),
        prixUnitaire: num(l.prixUnitaire),
      })),
      remiseType: "AUCUNE",
      remiseValeur: 0,
      montantPaye: paye > 0 ? paye : undefined,
    });
  };

  const selectedClientName = clients?.find((c) => c.id === clientId)?.nom;
  const field = "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";

  const facture = (action: "download" | "print") => {
    genererFacturePDF(
      {
        clientNom: selectedClientName ?? "—",
        date: new Date(),
        lignes: calc.lignes
          .filter((l) => l.nomProduit.trim() && l.quantite > 0)
          .map((l) => ({
            nomProduit: l.nomProduit,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            totalLigne: l.totalLigne,
          })),
        total: calc.totalTTC,
        paye,
        reste,
      },
      lang,
      {
        title: t("commandes:invoice"),
        client: t("commandes:client"),
        date: t("commandes:date"),
        product: t("commandes:product"),
        qty: t("commandes:qty"),
        unitPrice: t("commandes:unitPrice"),
        lineTotal: t("commandes:lineTotal"),
        total: t("commandes:total"),
        paid: t("commandes:paid"),
        remaining: t("commandes:remaining"),
      },
      action,
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <BackButton />
        {clientId && selectedClientName && (
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <User size={16} /> {selectedClientName}
          </button>
        )}
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        {selectedClientName
          ? t("commandes:newFor", { name: selectedClientName })
          : t("commandes:new")}
      </h1>

      {/* Client — sélecteur masqué si on est déjà dans la fiche d'un client */}
      {!clientIdParam && (
        <div className="mb-4 rounded-xl border bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("commandes:client")}
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={`${field} w-full max-w-md`}
          >
            <option value="">{t("commandes:selectClient")}</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} · {c.telephone}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lignes */}
      <div className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">{t("commandes:lines")}</h2>
        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-2 px-1 text-xs uppercase text-slate-400 md:grid">
            <span className="col-span-5">{t("commandes:product")}</span>
            <span className="col-span-2">{t("commandes:qty")}</span>
            <span className="col-span-2">{t("commandes:unitPrice")}</span>
            <span className="col-span-2 text-right">{t("commandes:lineTotal")}</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <input
                className={`${field} col-span-12 md:col-span-5`}
                placeholder={t("commandes:product")}
                value={line.nomProduit}
                onChange={(e) => updateLine(i, { nomProduit: e.target.value })}
              />
              <input
                type="number"
                min="0"
                className={`${field} col-span-4 md:col-span-2`}
                value={line.quantite}
                onChange={(e) => updateLine(i, { quantite: e.target.value })}
              />
              <input
                type="number"
                min="0"
                className={`${field} col-span-5 md:col-span-2`}
                placeholder="0"
                value={line.prixUnitaire}
                onChange={(e) => updateLine(i, { prixUnitaire: e.target.value })}
              />
              <span className="col-span-2 text-right text-sm font-semibold tabular-nums md:col-span-2">
                {formatMoney(calc.lignes[i]?.totalLigne ?? 0, lang)}
              </span>
              <button
                onClick={() => removeLine(i)}
                className="col-span-1 flex justify-center text-slate-400 hover:text-red-600"
                title={t("common:actions.delete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-700 hover:underline"
        >
          <Plus size={16} /> {t("commandes:addLine")}
        </button>
      </div>

      {/* Totaux + paiement optionnel */}
      <div className="rounded-xl border bg-white p-5">
        <div className="ml-auto max-w-sm space-y-3 text-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-base font-semibold">{t("commandes:total")}</span>
            <span className="text-2xl font-bold text-green-600">
              {formatMoney(calc.totalTTC, lang)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">
              {t("commandes:paid")}{" "}
              <span className="text-xs text-slate-400">({t("commandes:optional")})</span>
            </span>
            <input
              type="number"
              min="0"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              placeholder="0"
              className={`${field} w-32 py-1 text-right`}
            />
          </div>

          <Row
            label={t("commandes:remaining")}
            value={formatMoney(reste, lang)}
            valueClass={reste > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}
          />
        </div>

        {serverError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => facture("download")}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={16} /> {t("commandes:downloadInvoice")}
          </button>
          <button
            onClick={() => facture("print")}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={16} /> {t("commandes:print")}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || mutation.isPending}
            className="rounded-lg bg-slate-800 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending ? t("commandes:saving") : t("commandes:validate")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-slate-800",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
