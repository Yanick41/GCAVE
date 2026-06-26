import { api } from "../../lib/api";
import type { ModePaiement } from "../clients/api";

export interface PaiementListItem {
  id: string;
  montant: string;
  mode: ModePaiement;
  date: string;
  observation: string | null;
  client: { id: string; nom: string } | null;
}

export async function fetchPaiements(): Promise<PaiementListItem[]> {
  const { data } = await api.get<PaiementListItem[]>("/api/paiements");
  return data;
}
