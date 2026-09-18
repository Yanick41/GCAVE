import { api } from "../../lib/api";
import type { ModePaiement } from "../clients/api";

export interface PaiementListItem {
  id: string;
  montant: string;
  mode: ModePaiement;
  date: string;
  observation: string | null;
  client: { id: string; nom: string } | null;
  commandeId: string | null;
  /** Commande réglée par ce paiement (null = paiement sur le solde global). */
  commande: { id: string; numero: string; clientNomLibre: string | null } | null;
}

export async function fetchPaiements(): Promise<PaiementListItem[]> {
  const { data } = await api.get<PaiementListItem[]>("/api/paiements");
  return data;
}

/** Rattache un paiement existant à une commande (ou le détache avec null). */
export async function lierPaiementCommande(
  paiementId: string,
  commandeId: string | null,
): Promise<void> {
  await api.patch(`/api/paiements/${paiementId}/commande`, { commandeId });
}

export async function deletePaiement(id: string): Promise<void> {
  await api.delete(`/api/paiements/${id}`);
}
