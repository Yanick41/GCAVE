import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const rapportsRouter = Router();

rapportsRouter.use(requireAuth);

// Rapport journalier automatique basé sur les commandes/paiements du jour
rapportsRouter.get(
  "/jour",
  ah(async (req, res) => {
    const dateStr =
      typeof req.query.date === "string" && req.query.date
        ? req.query.date
        : new Date().toISOString().slice(0, 10);

    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [commandes, paiements] = await Promise.all([
      prisma.commande.findMany({
        where: { date: { gte: start, lt: end }, statut: { not: "ANNULEE" } },
        include: { client: { select: { nom: true } }, lignes: true },
        orderBy: { date: "asc" },
      }),
      prisma.paiement.findMany({
        where: { date: { gte: start, lt: end } },
        include: { client: { select: { nom: true } } },
        orderBy: { date: "asc" },
      }),
    ]);

    const totalCommandes = commandes.reduce((s, c) => s + Number(c.totalTTC), 0);
    const totalPaiements = paiements.reduce((s, p) => s + Number(p.montant), 0);

    // Top produits du jour
    const prodMap = new Map<string, { quantite: number; montant: number }>();
    for (const c of commandes) {
      for (const l of c.lignes) {
        const cur = prodMap.get(l.nomProduit) ?? { quantite: 0, montant: 0 };
        cur.quantite += Number(l.quantite);
        cur.montant += Number(l.totalLigne);
        prodMap.set(l.nomProduit, cur);
      }
    }
    const topProduits = Array.from(prodMap.entries())
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 10);

    res.json({
      date: dateStr,
      nbCommandes: commandes.length,
      totalCommandes,
      nbPaiements: paiements.length,
      totalPaiements,
      commandes: commandes.map((c) => ({
        id: c.id,
        numero: c.numero,
        clientNom: c.client?.nom ?? c.clientNomLibre ?? "—",
        totalTTC: Number(c.totalTTC),
        date: c.date,
      })),
      paiements: paiements.map((p) => ({
        id: p.id,
        clientNom: p.client?.nom ?? "—",
        montant: Number(p.montant),
        mode: p.mode,
        date: p.date,
      })),
      topProduits,
    });
  }),
);
