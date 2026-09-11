import type { EtatPaiement, PaiementInput } from "@gca/shared";
import type { CommandeInput } from "@gca/shared";
import { api } from "../../lib/api";
import type { BonCommande } from "../bons/api";
import type { ModePaiement } from "../clients/api";

export interface LigneCommande {
  id: string;
  nomProduit: string;
  quantite: string;
  prixUnitaire: string;
  totalLigne: string;
}

/** Paiement rattaché à une commande (montants déjà convertis en nombres). */
export interface PaiementCommande {
  id: string;
  montant: number;
  mode: ModePaiement;
  date: string;
  observation: string | null;
}

export interface Commande {
  id: string;
  numero: string;
  clientId: string | null;
  clientNomLibre: string | null;
  // Le détail renvoie la fiche client complète, la liste seulement id + nom
  client: { id: string; nom: string; telephone?: string | null; adresse?: string | null } | null;
  remiseType: "AUCUNE" | "POURCENTAGE" | "MONTANT";
  remiseValeur: string;
  sousTotal: string;
  montantRemise: string;
  totalTTC: string;
  ancienSolde: string;
  /**
   * Ancien suivi : acompte figé saisi à la validation.
   * Nouveau suivi : total encaissé (= somme de `paiements`), maintenu par le serveur.
   */
  montantPaye: string;
  /**
   * Régime de suivi des paiements, posé à la création de la commande.
   * false ou absent = commande antérieure au déploiement du rattachement
   * paiement ↔ commande (comportement historique conservé).
   */
  utiliseNouveauSuiviPaiement?: boolean;
  statut: "BROUILLON" | "VALIDEE" | "ANNULEE";
  date: string;
  lignes: LigneCommande[];
  /**
   * Paiements partiels/total rattachés à la commande, du plus ancien au plus
   * récent. Optionnel : absent d'une réponse servie par une API antérieure.
   */
  paiements?: PaiementCommande[];
  /**
   * État de règlement calculé par le serveur (total dû, payé, reste, statut).
   * Optionnel pour la même raison — passer par `reglementDe()` plutôt que d'y
   * accéder directement, ce qui garantit une valeur dans tous les cas.
   */
  reglement?: EtatPaiement;
}

export async function fetchCommandes(clientId?: string): Promise<Commande[]> {
  const { data } = await api.get<Commande[]>("/api/commandes", {
    params: clientId ? { clientId } : {},
  });
  return data;
}

export async function fetchCommande(id: string): Promise<Commande> {
  const { data } = await api.get<Commande>(`/api/commandes/${id}`);
  return data;
}

export async function createCommande(input: CommandeInput): Promise<Commande> {
  const { data } = await api.post<Commande>("/api/commandes", input);
  return data;
}

export async function updateCommande(id: string, input: CommandeInput): Promise<Commande> {
  const { data } = await api.patch<Commande>(`/api/commandes/${id}`, input);
  return data;
}

/** Enregistre un paiement (partiel ou total) rattaché à une commande. */
export async function createPaiementCommande(
  commandeId: string,
  input: PaiementInput,
): Promise<PaiementCommande & { reglement: EtatPaiement }> {
  const { data } = await api.post<PaiementCommande & { reglement: EtatPaiement }>(
    `/api/commandes/${commandeId}/paiements`,
    input,
  );
  return data;
}

/**
 * Convertit une commande en bon de commande : crée un DOCUMENT SÉPARÉ, sans
 * prix, reprenant client / date / désignations / quantités. La commande
 * d'origine n'est ni modifiée ni supprimée.
 */
export async function convertirEnBon(commandeId: string): Promise<BonCommande> {
  const { data } = await api.post<BonCommande>(`/api/commandes/${commandeId}/bon`);
  return data;
}
