import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/",
  ah(async (_req, res) => {
    // On ignore les commandes annulées dans les agrégats
    const actives = { statut: { not: "ANNULEE" as const } };

    // KPIs globaux
    const agg = await prisma.commande.aggregate({
      where: actives,
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
    });
    const chiffreAffaires = Number(agg._sum.totalTTC ?? 0);
    const creditPaye = Number(agg._sum.montantPaye ?? 0);
    const creditRestant = Math.max(chiffreAffaires - creditPaye, 0);
    const nbCommandes = agg._count;

    // CA du jour
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const jour = await prisma.commande.aggregate({
      where: { ...actives, date: { gte: startOfDay } },
      _sum: { totalTTC: true },
      _count: true,
    });

    // Meilleurs clients payeurs (par montant payé)
    const grouped = await prisma.commande.groupBy({
      by: ["clientId"],
      where: { ...actives, clientId: { not: null } },
      _sum: { montantPaye: true, totalTTC: true },
    });
    const sorted = grouped
      .map((g) => ({
        clientId: g.clientId as string,
        paye: Number(g._sum.montantPaye ?? 0),
        total: Number(g._sum.totalTTC ?? 0),
      }))
      .sort((a, b) => b.paye - a.paye)
      .slice(0, 5);

    const clientsMap = new Map(
      (
        await prisma.client.findMany({
          where: { id: { in: sorted.map((s) => s.clientId) } },
          select: { id: true, nom: true },
        })
      ).map((c) => [c.id, c.nom]),
    );
    const topClients = sorted.map((s) => ({
      clientId: s.clientId,
      nom: clientsMap.get(s.clientId) ?? "—",
      paye: s.paye,
      restant: Math.max(s.total - s.paye, 0),
    }));

    // Performance de vente — CA des 30 derniers jours, par jour
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const recent = await prisma.commande.findMany({
      where: { ...actives, date: { gte: since } },
      select: { date: true, totalTTC: true },
    });
    const buckets = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of recent) {
      const key = c.date.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(c.totalTTC));
    }
    const tendance = Array.from(buckets.entries()).map(([date, ca]) => ({ date, ca }));

    // Top produits (par nom)
    const lignes = await prisma.ligneCommande.groupBy({
      by: ["nomProduit"],
      _sum: { totalLigne: true, quantite: true },
    });
    const topProduits = lignes
      .map((l) => ({
        nom: l.nomProduit,
        montant: Number(l._sum.totalLigne ?? 0),
        quantite: Number(l._sum.quantite ?? 0),
      }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 5);

    res.json({
      chiffreAffaires,
      creditPaye,
      creditRestant,
      nbCommandes,
      caJour: Number(jour._sum.totalTTC ?? 0),
      nbCommandesJour: jour._count,
      topClients,
      topProduits,
      tendance,
    });
  }),
);
