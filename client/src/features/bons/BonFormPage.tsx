import { analyserQuantite, type BonCommandeInput } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { SelecteurClient } from "../../components/SelecteurClient";
import type { BonData } from "../../lib/bon";
import { ApercuImpression } from "../impression/ApercuImpression";
import { errorCode } from "../../lib/errors";
import { fetchClients } from "../clients/api";
import { createBon, fetchBon, updateBon } from "./api";

interface LineDraft {
  designation: string;
  quantite: string;
  servi: string;
}

const emptyLine = (): LineDraft => ({ designation: "", quantite: "1", servi: "" });
/** Quantité d'une ligne : accepte « 1/2 » autant qu'un entier. */
const qte = (l: { quantite: string }) => analyserQuantite(l.quantite).valeur;

const num = (s: string) => {
  // Robuste : retire les espaces (séparateurs de milliers) avant de parser
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function BonFormPage() {
  const { t } = useTranslation(["bons", "common"]);
  const { id: clientIdParam, bonId } = useParams();
  const isEdit = Boolean(bonId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState(clientIdParam ?? "");
  const [clientNomLibre, setClientNomLibre] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [apercu, setApercu] = useState(false);
  const [montant, setMontant] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  // Registre de focus : en-tête ("tel", "adresse"…), cases du tableau
  // ("ligne-colonne") et pied ("montant", "notes") partagent la même mécanique,
  // ce qui permet à Entrée de parcourir TOUT le formulaire.
  const champs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [focusCle, setFocusCle] = useState<string | null>(null);
  /** Enregistre un champ sous une clé, pour pouvoir lui rendre le focus. */
  const refChamp = (cle: string) => (el: HTMLElement | null) => {
    champs.current.set(cle, el);
  };
  /** Entrée dans un champ simple : passe au champ suivant, sans envoyer. */
  const entreeVers = (cle: string) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setFocusCle(cle);
  };

  const { data: clients } = useQuery({
    queryKey: ["clients", ""],
    queryFn: () => fetchClients(""),
  });

  // Édition : charger le bon et pré-remplir (une seule fois)
  const { data: bon } = useQuery({
    queryKey: ["bon", bonId],
    queryFn: () => fetchBon(bonId!),
    enabled: isEdit,
  });
  const prefilled = useRef(false);
  useEffect(() => {
    if (bon && !prefilled.current) {
      prefilled.current = true;
      setClientId(bon.clientId ?? "");
      setClientNomLibre(bon.clientNomLibre ?? "");
      setTelephone(bon.telephone ?? "");
      setAdresseLivraison(bon.adresseLivraison ?? "");
      setNotes(bon.notes ?? "");
      setMontant(Number(bon.montant) ? String(Number(bon.montant)) : "");
      setLines(
        bon.lignes.length
          ? bon.lignes.map((l) => ({
              designation: l.designation,
              quantite: String(Number(l.quantite)),
              servi: l.servi ?? "",
            }))
          : [emptyLine()],
      );
    }
  }, [bon]);

  // Applique le focus demandé après le rendu (nouvelle ligne insérée notamment)
  useEffect(() => {
    if (!focusCle) return;
    const el = champs.current.get(focusCle);
    el?.focus();
    (el as HTMLInputElement | null)?.select?.();
    setFocusCle(null);
  }, [focusCle, lines]);

  const selectedClient = clients?.find((c) => c.id === clientId);

  // Sélection d'un client existant -> pré-remplir tél. + adresse de livraison
  const onSelectClient = (id: string) => {
    setClientId(id);
    // Client ponctuel : on enchaîne sur son nom ; client existant : sur le
    // téléphone, déjà pré-rempli mais souvent à ajuster.
    setFocusCle(id ? "tel" : "nomLibre");
    if (id) {
      const c = clients?.find((cl) => cl.id === id);
      setTelephone(c?.telephone ?? "");
      setAdresseLivraison(c?.adresse ?? "");
      setClientNomLibre("");
    }
  };

  const totalQuantite = lines.reduce(
    (s, l) => (l.designation.trim() ? s + qte(l) : s),
    0,
  );

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    setFocusCle(`${lines.length}-0`);
  };

  // Entrée dans le tableau : Désignation -> Quantité -> Servi, puis ligne
  // suivante. Une nouvelle ligne n'est créée que depuis la DERNIÈRE ligne, et
  // seulement si elle est renseignée — sinon Entrée sort vers « Montant »,
  // faute de quoi on ne pourrait jamais atteindre la fin du formulaire.
  const onCellEnter = (row: number, col: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (col < 2) {
      setFocusCle(`${row}-${col + 1}`);
      return;
    }
    if (row < lines.length - 1) {
      setFocusCle(`${row + 1}-0`);
      return;
    }
    const ligne = lines[row];
    if (ligne.designation.trim() !== "") {
      setLines((prev) => [...prev, emptyLine()]);
      setFocusCle(`${row + 1}-0`);
    } else {
      setFocusCle("montant");
    }
  };

  const validLines = lines.filter((l) => l.designation.trim() && qte(l) > 0);
  
  // Erreur par ligne : bloque l'enregistrement AVANT l'aller-retour serveur.
  const lineErrors = lines.map((l) => {
  if (l.designation.trim() === "" && l.quantite.trim() === "") return null;
  const q = analyserQuantite(l.quantite);
  if (!q.valide) {
  if (q.motif === "DIVISION_ZERO") return t("bons:errQtyZero");
  if (q.motif === "FORMAT") return t("bons:errQtyFormat");
  return t("bons:errQty");
  }
  return null;
  });
  const hasLineError = lineErrors.some(Boolean);
  const hasClient = Boolean(clientId) || Boolean(clientNomLibre.trim());
  const canSubmit = hasClient && validLines.length > 0 && !hasLineError;

  const mutation = useMutation({
    mutationFn: (input: BonCommandeInput) =>
      isEdit ? updateBon(bonId!, input) : createBon(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bons"] });
      queryClient.invalidateQueries({ queryKey: ["bon", saved.id] });
      if (saved.clientId) queryClient.invalidateQueries({ queryKey: ["client", saved.clientId] });
      navigate(`/bons/${saved.id}`);
    },
    onError: (err) => setServerError(t(`common:errors.${errorCode(err)}`)),
  });

  const buildInput = (): BonCommandeInput => ({
    clientId: clientId || undefined,
    clientNomLibre: clientId ? undefined : clientNomLibre.trim() || undefined,
    telephone: telephone.trim() || undefined,
    adresseLivraison: adresseLivraison.trim() || undefined,
    notes: notes.trim() || undefined,
    // Création → LIVRE ; en édition on préserve le statut existant (Livré/Payé)
    statut: isEdit ? undefined : "LIVRE",
    montant: num(montant),
    lignes: validLines.map((l) => ({
      designation: l.designation.trim(),
      quantite: qte(l),
      quantiteSaisie: l.quantite.trim() || undefined,
      servi: l.servi.trim() || undefined,
    })),
  });

  const submit = () => {
    setServerError(null);
    if (!canSubmit) {
      setServerError(t("bons:noLines"));
      return;
    }
    mutation.mutate(buildInput());
  };

  const selectedClientName = selectedClient?.nom ?? bon?.client?.nom ?? clientNomLibre;

  // Données du bon — sortie unique par le modal d'aperçu.
  const donneesBon: BonData = {
        numero: bon?.numero ?? "—",
        clientNom: selectedClientName || "—",
        date: bon ? new Date(bon.date) : new Date(),
        telephone: telephone || null,
        adresseLivraison: adresseLivraison || null,
        lignes: validLines.map((l) => ({
          designation: l.designation.trim(),
          quantite: qte(l),
          quantiteAffichee: l.quantite.trim() || undefined,
          servi: l.servi.trim() || null,
        })),
        totalQuantite,
        montant: num(montant),
        statut: bon?.statut ?? "LIVRE",
    notes: notes || null,
  };

  const field =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <BackButton to="/bons" label={t("bons:title")} />
        {clientId && selectedClientName && (
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <User size={16} /> {selectedClientName}
          </button>
        )}
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        {isEdit
          ? `${t("bons:editTitle")}${bon ? ` — ${bon.numero}` : ""}`
          : selectedClientName
            ? t("bons:createFor", { name: selectedClientName })
            : t("bons:new")}
      </h1>

      {/* En-tête du bon */}
      <div className="mb-4 rounded-xl border bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">{t("bons:header")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Client — masqué si on vient d'une fiche client */}
          {!clientIdParam && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("bons:client")}
              </label>
              <SelecteurClient
                clients={clients ?? []}
                valeur={clientId}
                onChange={onSelectClient}
                libelleLibre={t("bons:occasionalClient")}
                placeholder={t("common:clientSearch.placeholder")}
                aucunResultat={t("common:clientSearch.empty")}
                champRef={refChamp("client")}
              />
            </div>
          )}

          {/* Nom du client ponctuel (si aucun client sélectionné) */}
          {!clientId && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("bons:clientNameFree")}
              </label>
              <input
                ref={refChamp("nomLibre")}
                value={clientNomLibre}
                onChange={(e) => setClientNomLibre(e.target.value)}
                onKeyDown={entreeVers("tel")}
                className={`${field} w-full`}
                placeholder={t("bons:clientNameFree")}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("bons:phone")}
            </label>
            <input
              ref={refChamp("tel")}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              onKeyDown={entreeVers("adresse")}
              className={`${field} w-full`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("bons:deliveryAddress")}
            </label>
            <input
              ref={refChamp("adresse")}
              value={adresseLivraison}
              onChange={(e) => setAdresseLivraison(e.target.value)}
              onKeyDown={entreeVers("0-0")}
              className={`${field} w-full`}
            />
          </div>
        </div>
      </div>

      {/* Lignes produits (tableur) */}
      <div className="mb-4 rounded-xl border bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-1 font-semibold">{t("bons:lines")}</h2>
        <p className="mb-3 text-xs text-slate-400">{t("bons:enterHint")}</p>
        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-2 px-1 text-xs uppercase text-slate-400 md:grid">
            <span className="col-span-6">{t("bons:designation")}</span>
            <span className="col-span-3">{t("bons:qty")}</span>
            <span className="col-span-2">{t("bons:served")}</span>
            <span className="col-span-1" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <input
                ref={refChamp(`${i}-0`)}
                className={`${field} col-span-12 md:col-span-6`}
                placeholder={t("bons:designation")}
                value={line.designation}
                onChange={(e) => updateLine(i, { designation: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 0, e)}
              />
              <input
                ref={refChamp(`${i}-1`)}
                type="text"
                inputMode="text"
                placeholder={t("bons:qtyPlaceholder")}
                className={`${field} col-span-6 md:col-span-3`}
                value={line.quantite}
                onChange={(e) => updateLine(i, { quantite: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 1, e)}
              />
              <input
                ref={refChamp(`${i}-2`)}
                className={`${field} col-span-5 md:col-span-2`}
                placeholder="—"
                value={line.servi}
                onChange={(e) => updateLine(i, { servi: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 2, e)}
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
          onClick={addLine}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
        >
          <Plus size={16} /> {t("bons:addLine")}
        </button>
      </div>

      {/* Pied : montant (créance) + total + notes */}
      <div className="rounded-xl border bg-white p-5 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("bons:montant")}
            </label>
            <input
              ref={refChamp("montant")}
              type="number"
              min="0"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              onKeyDown={entreeVers("notes")}
              placeholder="0"
              className={`${field} w-44 text-right`}
            />
            <p className="mt-1 text-xs text-slate-400">{t("bons:montantHint")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">{t("bons:totalQty")}</p>
            <p className="text-2xl font-bold tabular-nums text-green-600">{totalQuantite}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("bons:notes")}
          </label>
          {/* Fin de la chaîne : Entrée insère un retour à la ligne. */}
          <textarea
            ref={refChamp("notes")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t("bons:notesPlaceholder")}
            className={`${field} w-full resize-y`}
          />
        </div>

        {serverError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => setApercu(true)}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={16} /> {t("bons:download")}
          </button>
          <button
            onClick={() => setApercu(true)}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer size={16} /> {t("bons:print")}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || mutation.isPending}
            className="rounded-lg bg-slate-800 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700"
          >
            {mutation.isPending ? t("bons:saving") : t("bons:save")}
          </button>
        </div>
      </div>
      {apercu && (
        <ApercuImpression
          document={{ type: "BON", data: donneesBon }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
