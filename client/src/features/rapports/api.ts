import { api } from "../../lib/api";
import type { ModePaiement } from "../clients/api";

export interface RapportJour {
  date: string;
  nbCommandes: number;
  totalCommandes: number;
  nbPaiements: number;
  totalPaiements: number;
  commandes: { id: string; numero: string; clientNom: string; totalTTC: number; date: string }[];
  paiements: {
    id: string;
    clientNom: string;
    montant: number;
    mode: ModePaiement;
    date: string;
  }[];
  topProduits: { nom: string; quantite: number; montant: number }[];
}

export async function fetchRapportJour(date: string): Promise<RapportJour> {
  const { data } = await api.get<RapportJour>("/api/rapports/jour", { params: { date } });
  return data;
}
