import {
  computeCommande,
  prixUnitaireDepuisTotal,
  type CommandeInput,
} from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { marquerConverti } from "../bons/api";
import { errorCode } from "../../lib/errors";
import type { FactureData } from "../../lib/facture";
import { ApercuImpression } from "../impression/ApercuImpression";
import { fetchClients } from "../clients/api";
import { useMoney } from "../privacy/mask";
import { createCommande, fetchCommande, updateCommande } from "./api";

interface LineDraft {
  nomProduit: string;
  quantite: string;
  prixUnitaire: string;
  /**
   * Saisie en cours dans la colonne Montant. Tampon volatil : le prix unitaire
   * reste la donnée de référence (total = quantité × prix unitaire), on le
   * recalcule à chaque frappe. Vidé au blur pour réafficher la valeur canonique.
   */
  montantSaisi?: string;
}

/** État de navigation lors d'une conversion depuis un bon de commande. */
interface BonPrefill {
  fromBonId?: string;
  clientId?: string;
  prefillLines?: { nomProduit: string; quantite: number }[];
}

const emptyLine = (): LineDraft => ({ nomProduit: "", quantite: "1", prixUnitaire: "" });
/** Une ligne est « renseignée » dès qu'elle porte un produit ou un prix.
 *  Les lignes encore vierges ne déclenchent aucune erreur de validation. */
const ligneRenseignee = (l: LineDraft) =>
  l.nomProduit.trim() !== "" || l.prixUnitaire.trim() !== "" || l.montantSaisi !== undefined;

const num = (s: string) => {
  // Robuste : retire les espaces (séparateurs de milliers) avant de parser
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function OrderFormPage() {
  const { t } = useTranslation(["commandes", "paiements", "common"]);
  const money = useMoney();
  const { id: clientIdParam, orderId } = useParams();
  const isEdit = Boolean(orderId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Conversion depuis un bon de commande : pré-remplissage via l'état de navigation
  const bonPrefill = (location.state as BonPrefill | null) ?? null;

  const [clientId, setClientId] = useState(clientIdParam ?? bonPrefill?.clientId ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    bonPrefill?.prefillLines?.length
      ? bonPrefill.prefillLines.map((l) => ({
          nomProduit: l.nomProduit,
          quantite: String(l.quantite),
          prixUnitaire: "",
        }))
      : [emptyLine()],
  );
  const [montantPaye, setMontantPaye] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);

  // Navigation clavier type tableur (Entrée = case suivante / nouvelle ligne)
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);
  useEffect(() => {
    if (!focusCell) return;
    const el = inputRefs.current.get(`${focusCell.row}-${focusCell.col}`);
    el?.focus();
    el?.select?.();
    setFocusCell(null);
  }, [focusCell, lines]);

  // Entrée : Produit(0) -> Qté(1) -> Prix(2) -> Montant(3) -> ligne suivante
  const onCellEnter = (row: number, col: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (col < 3) {
      setFocusCell({ row, col: col + 1 });
    } else {
      if (row === lines.length - 1) setLines((prev) => [...prev, emptyLine()]);
      setFocusCell({ row: row + 1, col: 0 });
    }
  };

  const { data: clients } = useQuery({
    queryKey: ["clients", ""],
    queryFn: () => fetchClients(""),
  });

  // Édition : charger la commande et pré-remplir (une seule fois)
  const { data: order } = useQuery({
    queryKey: ["commande", orderId],
    queryFn: () => fetchCommande(orderId!),
    enabled: isEdit,
  });
  const prefilled = useRef(false);
  useEffect(() => {
    if (order && !prefilled.current) {
      prefilled.current = true;
      setClientId(order.clientId ?? "");
      setLines(
        order.lignes.length
          ? order.lignes.map((l) => ({
              nomProduit: l.nomProduit,
              quantite: String(Number(l.quantite)),
              prixUnitaire: String(Number(l.prixUnitaire)),
            }))
          : [emptyLine()],
      );
      // Le montant déjà encaissé alimente le champ, qui reste modifiable.
      setMontantPaye(String(Number(order.montantPaye)));
    }
  }, [order]);

  const selectedClient = clients?.find((c) => c.id === clientId);

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

  // CHAQUE FACTURE EST INDÉPENDANTE : le net à payer est le total de ses
  // propres lignes. Le solde du client n'est plus lu ni reporté ici — il reste
  // consultable sur sa fiche et dans le bilan imprimable.
  const sousTotal = calc.totalTTC;
  const netAPayer = sousTotal;

  // Le montant payé est saisissable partout. Sur une commande dont le suivi
  // est dérivé des règlements, le serveur répercute la saisie sur les
  // règlements rattachés eux-mêmes, pour que facture et solde client restent
  // d'accord (voir reconcilierPaiements côté serveur).
  const suiviParReglements = isEdit && order?.utiliseNouveauSuiviPaiement === true;
  const paye = Math.min(Math.max(num(montantPaye), 0), netAPayer);
  const reste = Math.max(netAPayer - paye, 0);

  const mutation = useMutation({
    mutationFn: (input: CommandeInput) =>
      isEdit ? updateCommande(orderId!, input) : createCommande(input),
    onSuccess: async (commande) => {
      // Conversion : marquer le bon d'origine comme « Converti »
      if (!isEdit && bonPrefill?.fromBonId) {
        try {
          await marquerConverti(bonPrefill.fromBonId, commande.id);
          queryClient.invalidateQueries({ queryKey: ["bons"] });
          queryClient.invalidateQueries({ queryKey: ["bon", bonPrefill.fromBonId] });
        } catch {
          // non bloquant : la commande est créée même si le marquage échoue
        }
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", commande.clientId] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["commande", commande.id] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(
        isEdit
          ? `/commandes/${commande.id}`
          : commande.clientId
            ? `/clients/${commande.clientId}`
            : "/commandes",
      );
    },
    onError: (err) => setServerError(t(`common:errors.${errorCode(err)}`)),
  });

  const validLines = lines.filter((l) => l.nomProduit.trim() && num(l.quantite) > 0);

  // Erreur par ligne (null = ligne correcte ou encore vierge). Bloque
  // l'enregistrement AVANT l'aller-retour serveur, qui renverrait un 422 opaque.
  const lineErrors = lines.map((l) => {
    if (!ligneRenseignee(l)) return null;
    if (!l.nomProduit.trim()) return t("commandes:errProduct");
    if (num(l.quantite) <= 0) return t("commandes:errQty");
    if (num(l.prixUnitaire) < 0) return t("commandes:errPrice");
    return null;
  });
  const hasLineError = lineErrors.some(Boolean);

  // Un client occasionnel (saisie libre) n'a pas de clientId : en édition, sa
  // commande doit rester enregistrable — c'est son nom libre qui l'identifie.
  const clientNomLibre = order?.clientNomLibre ?? null;
  const clientRenseigne = Boolean(clientId) || Boolean(clientNomLibre);
  const canSubmit = clientRenseigne && validLines.length > 0 && !hasLineError;

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  /** Saisie directe du Montant d'une ligne : on remonte au prix unitaire.
   *  Sans quantité valide la dérivation est impossible — on garde alors la
   *  frappe à l'écran et la ligne signale « quantité invalide ». */
  const onMontantChange = (i: number, valeur: string) => {
    const q = num(lines[i].quantite);
    updateLine(i, {
      montantSaisi: valeur,
      ...(q > 0 ? { prixUnitaire: String(prixUnitaireDepuisTotal(num(valeur), q)) } : {}),
    });
  };
  /** Fin de saisie : on relâche le tampon pour réafficher le montant calculé. */
  const onMontantBlur = (i: number) => updateLine(i, { montantSaisi: undefined });
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const submit = () => {
    setServerError(null);
    if (!canSubmit) {
      setServerError(t("commandes:noLines"));
      return;
    }
    mutation.mutate({
      clientId: clientId || undefined,
      clientNomLibre: clientId ? undefined : (clientNomLibre ?? undefined),
      lignes: validLines.map((l) => ({
        nomProduit: l.nomProduit.trim(),
        quantite: num(l.quantite),
        prixUnitaire: num(l.prixUnitaire),
      })),
      remiseType: "AUCUNE",
      remiseValeur: 0,
      // Toujours envoyé, y compris à 0 : c'est ainsi qu'on corrige un montant
      // saisi par erreur.
      montantPaye: paye,
    });
  };

  const selectedClientName = selectedClient?.nom ?? order?.client?.nom;
  const field = "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";

  // Données de la facture — l'aperçu est le SEUL point de sortie : le choix
  // du format se fait dans le modal, jamais par un PDF ouvert directement.
  const donneesFacture: FactureData = {
        numero: order?.numero,
        clientNom: selectedClientName ?? "—",
        clientTelephone: selectedClient?.telephone,
        clientAdresse: selectedClient?.adresse,
        clientCode: clientId,
        date: new Date(),
        lignes: calc.lignes
          .filter((l) => l.nomProduit.trim() && l.quantite > 0)
          .map((l) => ({
            nomProduit: l.nomProduit,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            totalLigne: l.totalLigne,
          })),
        total: sousTotal,
        // En édition, la facture reprend le détail des règlements déjà
        // encaissés sur la commande (date + mode + montant).
        paiements:
          isEdit && order?.utiliseNouveauSuiviPaiement
            ? (order.paiements ?? []).map((p) => ({
                date: p.date,
                montant: p.montant,
                mode: t(`paiements:modes.${p.mode}`, { ns: "paiements" }),
              }))
            : undefined,
    paye,
    reste,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <BackButton />
        {clientId && selectedClientName && (
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <User size={16} /> {selectedClientName}
          </button>
        )}
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        {isEdit
          ? `${t("commandes:editTitle")}${order ? ` — ${order.numero}` : ""}`
          : selectedClientName
            ? t("commandes:newFor", { name: selectedClientName })
            : t("commandes:new")}
      </h1>

      {/* Client — sélecteur masqué en fiche client ou en édition */}
      {!clientIdParam && !isEdit && (
        <div className="mb-4 rounded-xl border bg-white dark:bg-slate-900 p-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
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
      <div className="mb-4 rounded-xl border bg-white dark:bg-slate-900 p-4">
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
                ref={(el) => {
                  inputRefs.current.set(`${i}-0`, el);
                }}
                className={`${field} col-span-12 md:col-span-5`}
                placeholder={t("commandes:product")}
                value={line.nomProduit}
                onChange={(e) => updateLine(i, { nomProduit: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 0, e)}
              />
              <input
                ref={(el) => {
                  inputRefs.current.set(`${i}-1`, el);
                }}
                type="number"
                min="0"
                className={`${field} col-span-4 md:col-span-2`}
                value={line.quantite}
                onChange={(e) => updateLine(i, { quantite: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 1, e)}
              />
              <input
                ref={(el) => {
                  inputRefs.current.set(`${i}-2`, el);
                }}
                type="number"
                min="0"
                className={`${field} col-span-5 md:col-span-2`}
                placeholder="0"
                value={line.prixUnitaire}
                onChange={(e) => updateLine(i, { prixUnitaire: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 2, e)}
              />
              {/* Montant éditable : saisir le total d'une ligne est souvent plus
                  direct que d'en calculer le prix unitaire, qui est alors déduit. */}
              <input
                ref={(el) => {
                  inputRefs.current.set(`${i}-3`, el);
                }}
                type="number"
                min="0"
                step="any"
                title={t("commandes:amountHint")}
                className={`${field} col-span-4 text-right font-semibold tabular-nums md:col-span-2`}
                value={line.montantSaisi ?? String(calc.lignes[i]?.totalLigne ?? 0)}
                onChange={(e) => onMontantChange(i, e.target.value)}
                onBlur={() => onMontantBlur(i)}
                onKeyDown={(e) => onCellEnter(i, 3, e)}
              />
              <button
                onClick={() => removeLine(i)}
                className="col-span-1 flex justify-center text-slate-400 hover:text-red-600"
                title={t("common:actions.delete")}
              >
                <Trash2 size={16} />
              </button>
              {lineErrors[i] && (
                <p className="col-span-12 -mt-1 text-xs font-medium text-rose-600">
                  {lineErrors[i]}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:underline"
        >
          <Plus size={16} /> {t("commandes:addLine")}
        </button>
      </div>

      {/* Totaux + paiement optionnel */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-5">
        <div className="ml-auto max-w-sm space-y-3 text-sm">
          <Row label={t("commandes:subtotal")} value={money(sousTotal)} />

          <div className="flex items-center justify-between border-y py-3">
            <span className="text-base font-semibold">{t("commandes:netToPay")}</span>
            <span className="text-2xl font-bold text-green-600">{money(netAPayer)}</span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">
                {t("commandes:paid")}{" "}
                {!isEdit && (
                  <span className="text-xs text-slate-400">({t("commandes:optional")})</span>
                )}
              </span>
              <input
                type="number"
                min="0"
                max={netAPayer}
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                placeholder="0"
                className={`${field} w-32 py-1 text-right tabular-nums`}
              />
            </div>
            {/* La saisie agit sur les règlements de la commande : on le dit,
                plutôt que de laisser croire à une simple retouche d'affichage. */}
            {suiviParReglements && (
              <p className="mt-1 text-right text-xs text-slate-400">
                {t("commandes:paidAdjusts")}
              </p>
            )}
          </div>

          <Row
            label={t("commandes:remaining")}
            value={money(reste)}
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
            onClick={() => setApercu(true)}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={16} /> {t("commandes:downloadInvoice")}
          </button>
          <button
            onClick={() => setApercu(true)}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Printer size={16} /> {t("commandes:print")}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || mutation.isPending}
            className="rounded-lg bg-slate-800 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending
              ? t("commandes:saving")
              : isEdit
                ? t("common:actions.save")
                : t("commandes:validate")}
          </button>
        </div>
      </div>
      {apercu && (
        <ApercuImpression
          document={{ type: "FACTURE", data: donneesFacture }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-slate-800 dark:text-slate-100",
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
