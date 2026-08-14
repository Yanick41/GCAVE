import type { ClientInput, EtatPaiement, PaiementInput } from "@gca/shared";
import { api } from "../../lib/api";
import type { Rappel } from "../rappels/api";

export type ModePaiement = "ESPECES" | "MOBILE_MONEY" | "VIREMENT";

export interface ClientListItem {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  createdAt: string;
  nbCommandes: number;
  soldeInitial: number;
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
  ancienSolde: string;
  montantPaye: string;
  statut: "BROUILLON" | "VALIDEE" | "ANNULEE";
  lignes: LigneResume[];
  /** Optionnels : absents d'une réponse servie par une API antérieure. */
  paiements?: Paiement[];
  /** false ou absent = commande de l'ancien suivi (montantPaye figé). */
  utiliseNouveauSuiviPaiement?: boolean;
  /** État de règlement calculé par le serveur — lire via `reglementDe()`. */
  reglement?: EtatPaiement;
}

export interface Paiement {
  id: string;
  montant: string;
  mode: ModePaiement;
  date: string;
  observation: string | null;
  /** Commande réglée par ce paiement (null = paiement sur le solde global). */
  commandeId: string | null;
}

export interface BonResume {
  id: string;
  numero: string;
  date: string;
  statut: "LIVRE" | "PAYE" | "CONVERTI";
  montant: string;
  lignes: { id: string }[];
}

export interface HistoriqueOp {
  id: string;
  type: "COMMANDE" | "PAIEMENT" | "BON";
  date: string;
  montant: number;
  /** N° de la commande : la sienne (COMMANDE/BON) ou celle réglée (PAIEMENT). */
  ref: string | null;
  mode: ModePaiement | null;
  observation: string | null;
  soldeApres: number;
  /** Commande liée à l'opération (null pour un paiement non rattaché). */
  commandeId: string | null;
}

export interface ClientDetail {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  createdAt: string;
  nbCommandes: number;
  soldeInitial: number;
  totalCommandes: number;
  totalPaiements: number;
  solde: number;
  commandes: CommandeResume[];
  paiements: Paiement[];
  rappels: Rappel[];
  bonsCommande: BonResume[];
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
