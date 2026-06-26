import {
  computeCommande,
  creditRestant,
  formatMoney,
  type Lang,
  type RemiseType,
} from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { errorCode } from "../../lib/errors";
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
  const [remiseType, setRemiseType] = useState<RemiseType>("AUCUNE");
  const [remiseValeur, setRemiseValeur] = useState("0");
  const [montantPaye, setMontantPaye] = useState("0");
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
        remiseType,
        remiseValeur: num(remiseValeur),
      }),
    [lines, remiseType, remiseValeur],
  );
  const credit = creditRestant(calc.totalTTC, num(montantPaye));

  const mutation = useMutation({
    mutationFn: createCommande,
    onSuccess: (commande) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
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
      remiseType,
      remiseValeur: num(remiseValeur),
      montantPaye: num(montantPaye),
    });
  };

  const selectedClientName = clients?.find((c) => c.id === clientId)?.nom;
  const field = "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-slate-500 hover:underline"
      >
        ← {t("common:actions.back")}
      </button>

      <h1 className="mb-6 text-2xl font-bold">
        {selectedClientName
          ? t("commandes:newFor", { name: selectedClientName })
          : t("commandes:new")}
      </h1>

      {/* Client */}
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

      {/* Totaux */}
      <div className="rounded-xl border bg-white p-5">
        <div className="ml-auto max-w-sm space-y-3 text-sm">
          <Row label={t("commandes:subtotal")} value={formatMoney(calc.sousTotal, lang)} />

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{t("commandes:discount")}</span>
            <div className="flex gap-2">
              <select
                value={remiseType}
                onChange={(e) => setRemiseType(e.target.value as RemiseType)}
                className={`${field} py-1 text-sm`}
              >
                <option value="AUCUNE">{t("commandes:discountNone")}</option>
                <option value="POURCENTAGE">{t("commandes:discountPct")}</option>
                <option value="MONTANT">{t("commandes:discountAmount")}</option>
              </select>
              {remiseType !== "AUCUNE" && (
                <input
                  type="number"
                  min="0"
                  value={remiseValeur}
                  onChange={(e) => setRemiseValeur(e.target.value)}
                  className={`${field} w-24 py-1 text-sm`}
                />
              )}
            </div>
          </div>

          {calc.montantRemise > 0 && (
            <Row
              label="—"
              value={`- ${formatMoney(calc.montantRemise, lang)}`}
              muted
            />
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-base font-semibold">{t("commandes:total")}</span>
            <span className="text-2xl font-bold text-green-600">
              {formatMoney(calc.totalTTC, lang)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{t("commandes:paid")}</span>
            <input
              type="number"
              min="0"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              className={`${field} w-32 py-1 text-right`}
            />
          </div>

          <Row
            label={t("commandes:credit")}
            value={formatMoney(credit, lang)}
            strong
            danger={credit > 0}
          />
        </div>

        {serverError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
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
  muted,
  strong,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-300" : "text-slate-500"}>{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-lg font-bold" : "font-medium"} ${
          danger ? "text-red-600" : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
