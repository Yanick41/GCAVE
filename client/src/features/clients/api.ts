import type { ClientInput } from "@gca/shared";
import { api } from "../../lib/api";

export interface Client {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  adresse: string | null;
  archived: boolean;
  createdAt: string;
}

export interface CommandeResume {
  id: string;
  numero: string;
  date: string;
  totalTTC: string;
  statut: "BROUILLON" | "VALIDEE" | "ANNULEE";
}

export interface ClientDetail extends Client {
  commandes: CommandeResume[];
  totalCumule: number;
}

export async function fetchClients(q: string): Promise<Client[]> {
  const { data } = await api.get<Client[]>("/api/clients", { params: { q } });
  return data;
}

export async function fetchClient(id: string): Promise<ClientDetail> {
  const { data } = await api.get<ClientDetail>(`/api/clients/${id}`);
  return data;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data } = await api.post<Client>("/api/clients", input);
  return data;
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<Client> {
  const { data } = await api.patch<Client>(`/api/clients/${id}`, input);
  return data;
}

export async function archiveClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`);
}
