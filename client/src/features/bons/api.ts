import type { BonCommandeInput } from "@gca/shared";
import { api } from "../../lib/api";

export type StatutBon = "BROUILLON" | "ENVOYE" | "VALIDE" | "LIVRE" | "PAYE" | "CONVERTI";

export interface LigneBon {
  id: string;
  designation: string;
  quantite: string;
  servi: string | null;
  ordre: number;
}

export interface BonCommande {
  id: string;
  numero: string;
  clientId: string | null;
  clientNomLibre: string | null;
  client: { id: string; nom: string } | null;
  telephone: string | null;
  adresseLivraison: string | null;
  notes: string | null;
  statut: StatutBon;
  allerRetour: boolean;
  montant: string;
  commandeId: string | null;
  date: string;
  lignes: LigneBon[];
}

export async function fetchBons(clientId?: string): Promise<BonCommande[]> {
  const { data } = await api.get<BonCommande[]>("/api/bons", {
    params: clientId ? { clientId } : {},
  });
  return data;
}

export async function fetchBon(id: string): Promise<BonCommande> {
  const { data } = await api.get<BonCommande>(`/api/bons/${id}`);
  return data;
}

export async function createBon(input: BonCommandeInput): Promise<BonCommande> {
  const { data } = await api.post<BonCommande>("/api/bons", input);
  return data;
}

export async function updateBon(id: string, input: BonCommandeInput): Promise<BonCommande> {
  const { data } = await api.patch<BonCommande>(`/api/bons/${id}`, input);
  return data;
}

export async function deleteBon(id: string): Promise<void> {
  await api.delete(`/api/bons/${id}`);
}

export async function marquerConverti(id: string, commandeId?: string): Promise<BonCommande> {
  const { data } = await api.post<BonCommande>(`/api/bons/${id}/converti`, { commandeId });
  return data;
}

export async function setBonStatut(id: string, statut: StatutBon): Promise<BonCommande> {
  const { data } = await api.post<BonCommande>(`/api/bons/${id}/statut`, { statut });
  return data;
}
