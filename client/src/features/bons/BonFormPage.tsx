import type { BonCommandeInput, Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { genererBonPDF } from "../../lib/bon";
import { errorCode } from "../../lib/errors";
import { fetchClients } from "../clients/api";
import { createBon, fetchBon, updateBon, type StatutBon } from "./api";

interface LineDraft {
  designation: string;
  quantite: string;
  servi: string;
}

const emptyLine = (): LineDraft => ({ designation: "", quantite: "1", servi: "" });
const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Statuts proposés selon le mode : aller-retour = Brouillon→Envoyé→Livré→Payé
const STATUTS_AR: StatutBon[] = ["BROUILLON", "ENVOYE", "LIVRE", "PAYE"];
const STATUTS_NORMAL: StatutBon[] = ["BROUILLON", "ENVOYE", "VALIDE"];

export function BonFormPage() {
  const { t, i18n } = useTranslation(["bons", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
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
  const [statut, setStatut] = useState<StatutBon>("BROUILLON");
  const [allerRetour, setAllerRetour] = useState(false);
  const [montant, setMontant] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  // Gestion du focus type tableur (Entrée -> ligne suivante / nouvelle ligne)
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);

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
      setStatut(bon.statut);
      setAllerRetour(bon.allerRetour);
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
    if (!focusCell) return;
    const el = inputRefs.current.get(`${focusCell.row}-${focusCell.col}`);
    el?.focus();
    el?.select?.();
    setFocusCell(null);
  }, [focusCell, lines]);

  const selectedClient = clients?.find((c) => c.id === clientId);

  // Sélection d'un client existant -> pré-remplir tél. + adresse de livraison
  const onSelectClient = (id: string) => {
    setClientId(id);
    if (id) {
      const c = clients?.find((cl) => cl.id === id);
      setTelephone(c?.telephone ?? "");
      setAdresseLivraison(c?.adresse ?? "");
      setClientNomLibre("");
    }
  };

  const totalQuantite = lines.reduce(
    (s, l) => (l.designation.trim() ? s + num(l.quantite) : s),
    0,
  );

  // Options de statut selon le mode ; on garde CONVERTI si le bon l'est déjà
  const statutOptions: StatutBon[] = allerRetour ? STATUTS_AR : STATUTS_NORMAL;
  const allStatuts = statut === "CONVERTI" ? [...statutOptions, "CONVERTI" as StatutBon] : statutOptions;

  // Bascule aller-retour : réaligne le statut si le courant n'est plus valide
  const onToggleAllerRetour = (on: boolean) => {
    setAllerRetour(on);
    const allowed = on ? STATUTS_AR : STATUTS_NORMAL;
    if (statut !== "CONVERTI" && !allowed.includes(statut)) setStatut("BROUILLON");
  };

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    setFocusCell({ row: lines.length, col: 0 });
  };

  // Comportement tableur : Entrée dans la dernière ligne -> nouvelle ligne + focus ;
  // Entrée sur une ligne intermédiaire -> ligne suivante (même colonne).
  const onCellEnter = (row: number, col: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (row === lines.length - 1) {
      setLines((prev) => [...prev, emptyLine()]);
      setFocusCell({ row: row + 1, col: 0 });
    } else {
      setFocusCell({ row: row + 1, col });
    }
  };

  const validLines = lines.filter((l) => l.designation.trim() && num(l.quantite) > 0);
  const hasClient = Boolean(clientId) || Boolean(clientNomLibre.trim());
  const canSubmit = hasClient && validLines.length > 0;

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
    statut,
    allerRetour,
    montant: allerRetour ? num(montant) : 0,
    lignes: validLines.map((l) => ({
      designation: l.designation.trim(),
      quantite: num(l.quantite),
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

  const pdf = (action: "download" | "print") => {
    genererBonPDF(
      {
        numero: bon?.numero ?? "—",
        clientNom: selectedClientName || "—",
        date: bon ? new Date(bon.date) : new Date(),
        telephone: telephone || null,
        adresseLivraison: adresseLivraison || null,
        lignes: validLines.map((l) => ({
          designation: l.designation.trim(),
          quantite: num(l.quantite),
          servi: l.servi.trim() || null,
        })),
        totalQuantite,
        notes: notes || null,
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
              <select
                value={clientId}
                onChange={(e) => onSelectClient(e.target.value)}
                className={`${field} w-full`}
              >
                <option value="">{t("bons:occasionalClient")}</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} · {c.telephone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nom du client ponctuel (si aucun client sélectionné) */}
          {!clientId && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("bons:clientNameFree")}
              </label>
              <input
                value={clientNomLibre}
                onChange={(e) => setClientNomLibre(e.target.value)}
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
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className={`${field} w-full`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("bons:deliveryAddress")}
            </label>
            <input
              value={adresseLivraison}
              onChange={(e) => setAdresseLivraison(e.target.value)}
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
                ref={(el) => {
                  inputRefs.current.set(`${i}-0`, el);
                }}
                className={`${field} col-span-12 md:col-span-6`}
                placeholder={t("bons:designation")}
                value={line.designation}
                onChange={(e) => updateLine(i, { designation: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 0, e)}
              />
              <input
                ref={(el) => {
                  inputRefs.current.set(`${i}-1`, el);
                }}
                type="number"
                min="0"
                className={`${field} col-span-6 md:col-span-3`}
                value={line.quantite}
                onChange={(e) => updateLine(i, { quantite: e.target.value })}
                onKeyDown={(e) => onCellEnter(i, 1, e)}
              />
              <input
                ref={(el) => {
                  inputRefs.current.set(`${i}-2`, el);
                }}
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

      {/* Pied : aller-retour + statut + total + notes */}
      <div className="rounded-xl border bg-white p-5 dark:bg-slate-900">
        {/* Mode aller-retour (livraison puis paiement) */}
        <div className="mb-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={allerRetour}
              onChange={(e) => onToggleAllerRetour(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-amber-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t("bons:allerRetour")}
              </span>
              <span className="block text-xs text-slate-400">{t("bons:allerRetourHint")}</span>
            </span>
          </label>
          {allerRetour && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t("bons:montant")}
              </span>
              <input
                type="number"
                min="0"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
                className={`${field} w-40 text-right`}
              />
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("bons:status")}
            </label>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutBon)}
              className={`${field}`}
            >
              {allStatuts.map((s) => (
                <option key={s} value={s}>
                  {t(`bons:statuses.${s}`)}
                </option>
              ))}
            </select>
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
          <textarea
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
            onClick={() => pdf("download")}
            disabled={validLines.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={16} /> {t("bons:download")}
          </button>
          <button
            onClick={() => pdf("print")}
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
    </div>
  );
}
