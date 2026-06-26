import type { CommandeInput } from "@gca/shared";
import { api } from "../../lib/api";

export interface LigneCommande {
  id: string;
  nomProduit: string;
  quantite: string;
  prixUnitaire: string;
  totalLigne: string;
}

export interface Commande {
  id: string;
  numero: string;
  clientId: string | null;
  clientNomLibre: string | null;
  client: { id: string; nom: string } | null;
  remiseType: "AUCUNE" | "POURCENTAGE" | "MONTANT";
  remiseValeur: string;
  sousTotal: string;
  montantRemise: string;
  totalTTC: string;
  montantPaye: string;
  statut: "BROUILLON" | "VALIDEE" | "ANNULEE";
  date: string;
  lignes: LigneCommande[];
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

export async function addPaiement(id: string, montant: number): Promise<Commande> {
  const { data } = await api.post<Commande>(`/api/commandes/${id}/paiement`, {
    montant,
  });
  return data;
}
