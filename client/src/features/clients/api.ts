import type { ClientInput, PaiementInput } from "@gca/shared";
import { api } from "../../lib/api";

export type ModePaiement = "ESPECES" | "MOBILE_MONEY" | "VIREMENT";

export interface ClientListItem {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  createdAt: string;
  nbCommandes: number;
  totalCommandes: number;
  totalPaiements: number;
  solde: number;
}

export interface LigneResume {
  id: string;
  nomProduit: string;
  quantite: string;
  prixUnitaire: string;
  totalLigne: string;
}

export interface CommandeResume {
  id: string;
  numero: string;
  date: string;
  totalTTC: string;
  statut: "BROUILLON" | "VALIDEE" | "ANNULEE";
  lignes: LigneResume[];
}

export interface Paiement {
  id: string;
  montant: string;
  mode: ModePaiement;
  date: string;
  observation: string | null;
}

export interface HistoriqueOp {
  id: string;
  type: "COMMANDE" | "PAIEMENT";
  date: string;
  montant: number;
  ref: string | null;
  mode: ModePaiement | null;
  observation: string | null;
  soldeApres: number;
}

export interface ClientDetail {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  createdAt: string;
  nbCommandes: number;
  totalCommandes: number;
  totalPaiements: number;
  solde: number;
  commandes: CommandeResume[];
  paiements: Paiement[];
  historique: HistoriqueOp[];
}

export type SortKey = "recent" | "nom" | "solde";

export async function fetchClients(q: string, sort: SortKey = "recent"): Promise<ClientListItem[]> {
  const { data } = await api.get<ClientListItem[]>("/api/clients", { params: { q, sort } });
  return data;
}

export async function fetchClient(id: string): Promise<ClientDetail> {
  const { data } = await api.get<ClientDetail>(`/api/clients/${id}`);
  return data;
}

export async function createClient(input: ClientInput): Promise<ClientListItem> {
  const { data } = await api.post<ClientListItem>("/api/clients", input);
  return data;
}

export async function updateClient(id: string, input: ClientInput): Promise<ClientListItem> {
  const { data } = await api.patch<ClientListItem>(`/api/clients/${id}`, input);
  return data;
}

export async function archiveClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`);
}

export async function createPaiement(clientId: string, input: PaiementInput): Promise<Paiement> {
  const { data } = await api.post<Paiement>(`/api/clients/${clientId}/paiements`, input);
  return data;
}
