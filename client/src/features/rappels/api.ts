import type { PrioriteRappel, RappelInput, StatutRappel } from "@gca/shared";
import { api } from "../../lib/api";

export interface Rappel {
  id: string;
  clientId: string;
  note: string;
  echeance: string;
  priorite: PrioriteRappel;
  statut: StatutRappel;
  createdAt: string;
  client?: { id: string; nom: string };
}

export interface Alertes {
  enRetard: Rappel[];
  aVenir: Rappel[];
  total: number;
}

export async function fetchRappels(statut?: StatutRappel): Promise<Rappel[]> {
  const { data } = await api.get<Rappel[]>("/api/rappels", {
    params: statut ? { statut } : {},
  });
  return data;
}

export async function fetchAlertes(): Promise<Alertes> {
  const { data } = await api.get<Alertes>("/api/rappels/alertes");
  return data;
}

export async function createRappel(clientId: string, input: RappelInput): Promise<Rappel> {
  const { data } = await api.post<Rappel>(`/api/clients/${clientId}/rappels`, input);
  return data;
}

export async function terminerRappel(id: string): Promise<Rappel> {
  const { data } = await api.patch<Rappel>(`/api/rappels/${id}/terminer`);
  return data;
}

export async function reporterRappel(id: string, echeance: string): Promise<Rappel> {
  const { data } = await api.patch<Rappel>(`/api/rappels/${id}/reporter`, { echeance });
  return data;
}

export async function deleteRappel(id: string): Promise<void> {
  await api.delete(`/api/rappels/${id}`);
}

/** Un rappel en cours dont l'échéance est passée est "en retard". */
export function estEnRetard(r: Rappel): boolean {
  return r.statut === "EN_COURS" && new Date(r.echeance).getTime() < Date.now();
}
