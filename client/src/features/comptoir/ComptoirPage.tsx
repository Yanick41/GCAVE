/**
 * Caisse comptoir — ticket pour un client de passage.
 *
 * Écran VOLONTAIREMENT distinct du formulaire de commande : au comptoir, le
 * client attend. Pas de fiche à créer, pas de recherche de client, pas de
 * remise ni de statut à choisir — on saisit les articles, on encaisse, on
 * imprime. Tout le reste est du temps pris au client suivant.
 *
 * La vente produit une commande ordinaire (`clientId` nul), qui rejoint donc
 * la liste des commandes, la page Paiements et le rapport du jour comme
 * n'importe quelle autre. Rien n'est stocké à part.
 */
import {
  analyserQuantite,
  computeCommande,
  prixUnitaireDepuisTotal,
} from "@gca/shared";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, Printer, Store, Trash2, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode } from "../../lib/errors";
import type { FactureData } from "../../lib/facture";
import { createCommande, type Commande } from "../commandes/api";
import { ApercuImpression } from "../impression/ApercuImpression";
import { useMoney } from "../privacy/mask";

interface Ligne {
  designation: string;
  quantite: string;
  prixUnitaire: string;
  /** Montant en cours de frappe ; libéré à la sortie du champ. */
  montantSaisi?: string;
}

const ligneVide = (): Ligne => ({ designation: "", quantite: "1", prixUnitaire: "" });

const nombre = (s: string) => {
  const n = parseFloat((s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function ComptoirPage() {
  const { t } = useTranslation(["comptoir", "commandes", "common"]);
  const money = useMoney();
  const queryClient = useQueryClient();

  const [lignes, setLignes] = useState<Ligne[]>([ligneVide(), ligneVide(), ligneVide()]);
  const [recu, setRecu] = useState("");
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [vendue, setVendue] = useState<Commande | null>(null);
  const [apercu, setApercu] = useState(false);

  // Navigation au clavier : chaque champ est repéré par « ligne-colonne »,
  // Entrée passe au suivant. Au comptoir, la main ne quitte pas le clavier.
  const champs = useRef(new Map<string, HTMLInputElement | null>());
  const refChamp = (cle: string) => (el: HTMLInputElement | null) => {
    champs.current.set(cle, el);
  };

  const qte = (l: Ligne) => analyserQuantite(l.quantite).valeur;
  const lignesValides = lignes.filter((l) => l.designation.trim() && qte(l) > 0);

  const calc = computeCommande({
    lignes: lignes.map((l) => ({
      nomProduit: l.designation.trim(),
      quantite: qte(l),
      prixUnitaire: nombre(l.prixUnitaire),
    })),
    remiseType: "AUCUNE",
    remiseValeur: 0,
  });
  const total = calc.totalTTC;

  // Monnaie à rendre : le calcul de tête au comptoir est la première source
  // d'erreur de caisse. Négatif = le compte n'y est pas encore.
  const montantRecu = nombre(recu);
  const monnaie = montantRecu > 0 ? Math.round((montantRecu - total) * 100) / 100 : 0;

  const majLigne = (i: number, modif: Partial<Ligne>) =>
    setLignes((prev) => {
      const suivant = prev.map((l, idx) => (idx === i ? { ...l, ...modif } : l));
      // Une ligne remplie en dernière position en appelle une nouvelle :
      // le vendeur ne doit jamais avoir à cliquer « Ajouter ».
      const derniere = suivant[suivant.length - 1];
      if (derniere.designation.trim() !== "") suivant.push(ligneVide());
      return suivant;
    });

  /** Saisir le montant d'une ligne plutôt que le prix unitaire. */
  const surMontant = (i: number, valeur: string) => {
    const q = qte(lignes[i]);
    majLigne(i, {
      montantSaisi: valeur,
      ...(q > 0 ? { prixUnitaire: String(prixUnitaireDepuisTotal(nombre(valeur), q)) } : {}),
    });
  };

  const surEntree = (i: number, colonne: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const suivant =
      colonne < 3 ? `${i}-${colonne + 1}` : `${Math.min(i + 1, lignes.length - 1)}-0`;
    champs.current.get(suivant)?.focus();
  };

  const mutation = useMutation({
    mutationFn: () =>
      createCommande({
        // Vente comptoir : aucune fiche client. Nom et téléphone ne partent
        // que s'ils ont été saisis, jamais une chaîne vide.
        clientNomLibre: nom.trim() || undefined,
        clientTelephoneLibre: telephone.trim() || undefined,
        lignes: lignesValides.map((l) => ({
          nomProduit: l.designation.trim(),
          quantite: qte(l),
          quantiteSaisie: l.quantite.trim() || undefined,
          prixUnitaire: nombre(l.prixUnitaire),
        })),
        remiseType: "AUCUNE",
        remiseValeur: 0,
        // Le ticket de caisse est payé comptant : le total est encaissé.
        // Le « reçu » ne sert qu'à calculer la monnaie, il ne gonfle pas
        // l'encaissement — sinon la recette du jour serait fausse.
        montantPaye: total,
      }),
    onSuccess: (commande) => {
      setVendue(commande);
      setApercu(true);
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => setErreur(t(`common:errors.${errorCode(e)}`)),
  });

  /** Remise à zéro pour le client suivant. */
  const nouvelleVente = () => {
    setLignes([ligneVide(), ligneVide(), ligneVide()]);
    setRecu("");
    setNom("");
    setTelephone("");
    setIdentiteOuverte(false);
    setVendue(null);
    setErreur(null);
    champs.current.get("0-0")?.focus();
  };

  const ticket: FactureData = {
    numero: vendue?.numero,
    clientNom: nom.trim() || t("commandes:walkInCustomer"),
    clientTelephone: telephone.trim() || undefined,
    date: vendue ? new Date(vendue.date) : new Date(),
    lignes: calc.lignes
      .filter((l) => l.nomProduit.trim() && l.quantite > 0)
      .map((l) => ({
        nomProduit: l.nomProduit,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        totalLigne: l.totalLigne,
      })),
    total,
    paye: total,
    reste: 0,
  };

  const champ =
    "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Store size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("comptoir:title")}</h1>
          <p className="text-sm text-slate-400">{t("comptoir:subtitle")}</p>
        </div>
      </div>

      {/* ── Articles ── */}
      <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className="col-span-5">{t("comptoir:columns.item")}</span>
          <span className="col-span-2">{t("comptoir:columns.qty")}</span>
          <span className="col-span-2">{t("comptoir:columns.price")}</span>
          <span className="col-span-2">{t("comptoir:columns.amount")}</span>
        </div>

        {lignes.map((l, i) => {
          const q = analyserQuantite(l.quantite);
          const montant = q.valeur * nombre(l.prixUnitaire);
          return (
            <div key={i} className="mb-2 grid grid-cols-12 items-center gap-2">
              <input
                ref={refChamp(`${i}-0`)}
                className={`${champ} col-span-5`}
                placeholder={t("comptoir:columns.item")}
                value={l.designation}
                onChange={(e) => majLigne(i, { designation: e.target.value })}
                onKeyDown={(e) => surEntree(i, 0, e)}
              />
              <input
                ref={refChamp(`${i}-1`)}
                className={`${champ} col-span-2 ${
                  l.quantite.trim() && !q.valide ? "border-red-400" : ""
                }`}
                placeholder={t("commandes:qtyPlaceholder")}
                value={l.quantite}
                onChange={(e) => majLigne(i, { quantite: e.target.value })}
                onKeyDown={(e) => surEntree(i, 1, e)}
              />
              <input
                ref={refChamp(`${i}-2`)}
                type="number"
                min="0"
                className={`${champ} col-span-2`}
                value={l.prixUnitaire}
                onChange={(e) => majLigne(i, { prixUnitaire: e.target.value })}
                onKeyDown={(e) => surEntree(i, 2, e)}
              />
              <input
                ref={refChamp(`${i}-3`)}
                type="number"
                min="0"
                className={`${champ} col-span-2`}
                value={l.montantSaisi ?? (montant > 0 ? String(Math.round(montant)) : "")}
                onChange={(e) => surMontant(i, e.target.value)}
                onBlur={() => majLigne(i, { montantSaisi: undefined })}
                onKeyDown={(e) => surEntree(i, 3, e)}
              />
              <button
                onClick={() =>
                  setLignes((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))
                }
                className="col-span-1 flex justify-center text-slate-400 hover:text-red-500"
                title={t("comptoir:removeLine")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setLignes((p) => [...p, ligneVide()])}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <Plus size={16} /> {t("comptoir:addLine")}
        </button>
      </div>

      {/* ── Encaissement ── */}
      <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("comptoir:total")}
          </span>
          <span className="text-3xl font-bold tabular-nums">{money(total)}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              {t("comptoir:received")}
            </label>
            <input
              type="number"
              min="0"
              className={`${champ} w-full text-lg`}
              value={recu}
              onChange={(e) => setRecu(e.target.value)}
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              {t("comptoir:change")}
            </span>
            {/* Rouge tant que le compte n'y est pas : l'erreur de caisse se
                voit avant que le client ne soit reparti. */}
            <p
              className={`rounded-lg px-3 py-2 text-lg font-bold tabular-nums ${
                montantRecu <= 0
                  ? "text-slate-400"
                  : monnaie < 0
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              }`}
            >
              {montantRecu > 0 ? money(monnaie) : "—"}
            </p>
          </div>
        </div>

        {/* Identité facultative, repliée : la demander systématiquement
            ralentirait la vente, l'offrir permet de nommer le ticket. */}
        {identiteOuverte ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className={`${champ} w-full`}
              placeholder={t("comptoir:customerName")}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
            <input
              className={`${champ} w-full`}
              placeholder={t("comptoir:customerPhone")}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>
        ) : (
          <button
            onClick={() => setIdentiteOuverte(true)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <UserPlus size={16} /> {t("comptoir:addIdentity")}
          </button>
        )}
      </div>

      {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}

      <div className="flex flex-wrap gap-2">
        {!vendue ? (
          <button
            onClick={() => mutation.mutate()}
            disabled={lignesValides.length === 0 || total <= 0 || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            <Banknote size={18} />
            {mutation.isPending ? t("common:common.loading") : t("comptoir:checkout")}
          </button>
        ) : (
          <>
            <button
              onClick={() => setApercu(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <Printer size={18} /> {t("comptoir:reprint")}
            </button>
            <button
              onClick={nouvelleVente}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus size={18} /> {t("comptoir:nextSale")}
            </button>
          </>
        )}
      </div>

      {vendue && (
        <p className="mt-3 text-sm text-emerald-600">
          {t("comptoir:sold", { numero: vendue.numero })}
        </p>
      )}

      {apercu && (
        <ApercuImpression
          document={{ type: "FACTURE", data: ticket }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
