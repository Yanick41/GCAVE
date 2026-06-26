import { api } from "../../lib/api";

export interface DashboardData {
  chiffreAffaires: number;
  creditPaye: number;
  creditRestant: number;
  nbCommandes: number;
  caJour: number;
  nbCommandesJour: number;
  topClients: { clientId: string; nom: string; paye: number; restant: number }[];
  topProduits: { nom: string; montant: number; quantite: number }[];
  tendance: { date: string; ca: number }[];
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/api/dashboard");
  return data;
}
