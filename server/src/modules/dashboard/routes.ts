import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/",
  ah(async (_req, res) => {
    const actives = { statut: { not: "ANNULEE" as const } };

    // Chiffre d'affaires (commandes) + total encaissé (paiements)
    const [cmdAgg, payAgg] = await Promise.all([
      prisma.commande.aggregate({ where: actives, _sum: { totalTTC: true }, _count: true }),
      prisma.paiement.aggregate({ _sum: { montant: true } }),
    ]);
    const chiffreAffaires = Number(cmdAgg._sum.totalTTC ?? 0);
    const totalEncaisse = Number(payAgg._sum.montant ?? 0);
    const soldeGlobal = Math.max(chiffreAffaires - totalEncaisse, 0); // créances totales
    const nbCommandes = cmdAgg._count;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const jour = await prisma.commande.aggregate({
      where: { ...actives, date: { gte: startOfDay } },
      _sum: { totalTTC: true },
      _count: true,
    });

    // Meilleurs clients payeurs (par total payé) + leur solde
    const [payGroup, cmdGroup] = await Promise.all([
      prisma.paiement.groupBy({ by: ["clientId"], _sum: { montant: true } }),
      prisma.commande.groupBy({
        by: ["clientId"],
        where: { ...actives, clientId: { not: null } },
        _sum: { totalTTC: true },
      }),
    ]);
    const cmdByClient = new Map(
      cmdGroup.map((g) => [g.clientId as string, Number(g._sum.totalTTC ?? 0)]),
    );
    const ranked = payGroup
      .map((g) => ({
        clientId: g.clientId,
        paye: Number(g._sum.montant ?? 0),
        solde: Math.max((cmdByClient.get(g.clientId) ?? 0) - Number(g._sum.montant ?? 0), 0),
      }))
      .sort((a, b) => b.paye - a.paye)
      .slice(0, 5);

    const clientsMap = new Map(
      (
        await prisma.client.findMany({
          where: { id: { in: ranked.map((r) => r.clientId) } },
          select: { id: true, nom: true },
        })
      ).map((c) => [c.id, c.nom]),
    );
    const topClients = ranked.map((r) => ({
      clientId: r.clientId,
      nom: clientsMap.get(r.clientId) ?? "—",
      paye: r.paye,
      restant: r.solde,
    }));

    // Performance de vente (CA 30 jours)
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
      creditPaye: totalEncaisse, // total encaissé (paiements)
      creditRestant: soldeGlobal, // solde global (créances)
      nbCommandes,
      caJour: Number(jour._sum.totalTTC ?? 0),
      nbCommandesJour: jour._count,
      topClients,
      topProduits,
      tendance,
    });
  }),
);
