import { clientSchema, paiementSchema, soldeClient } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// F-A03 — liste + recherche, avec solde (= total commandes − total paiements)
clientsRouter.get(
  "/",
  ah(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const sort = String(req.query.sort ?? "recent"); // recent | nom | solde

    const clients = await prisma.client.findMany({
      where: {
        archived: false,
        ...(q
          ? {
              OR: [
                { nom: { contains: q, mode: "insensitive" } },
                { telephone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: sort === "nom" ? { nom: "asc" } : { createdAt: "desc" },
      include: { _count: { select: { commandes: true } } },
    });

    const ids = clients.map((c) => c.id);
    const [cmdSums, paySums] = await Promise.all([
      prisma.commande.groupBy({
        by: ["clientId"],
        where: { clientId: { in: ids }, statut: { not: "ANNULEE" } },
        _sum: { totalTTC: true },
      }),
      prisma.paiement.groupBy({
        by: ["clientId"],
        where: { clientId: { in: ids } },
        _sum: { montant: true },
      }),
    ]);
    const cmdMap = new Map(cmdSums.map((s) => [s.clientId, Number(s._sum.totalTTC ?? 0)]));
    const payMap = new Map(paySums.map((s) => [s.clientId, Number(s._sum.montant ?? 0)]));

    let result = clients.map((c) => {
      const totalCommandes = cmdMap.get(c.id) ?? 0;
      const totalPaiements = payMap.get(c.id) ?? 0;
      return {
        id: c.id,
        nom: c.nom,
        telephone: c.telephone,
        email: c.email,
        adresse: c.adresse,
        createdAt: c.createdAt,
        nbCommandes: c._count.commandes,
        totalCommandes,
        totalPaiements,
        solde: soldeClient(totalCommandes, totalPaiements),
      };
    });
    if (sort === "solde") result = result.sort((a, b) => b.solde - a.solde);

    res.json(result);
  }),
);

// F-A05 — fiche client : infos + solde + stats + historique (commandes + paiements)
clientsRouter.get(
  "/:id",
  ah(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        commandes: { include: { lignes: true }, orderBy: { date: "asc" } },
        paiements: { orderBy: { date: "asc" } },
      },
    });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);

    const commandesActives = client.commandes.filter((c) => c.statut !== "ANNULEE");
    const totalCommandes = commandesActives.reduce((s, c) => s + Number(c.totalTTC), 0);
    const totalPaiements = client.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const solde = soldeClient(totalCommandes, totalPaiements);

    // Historique chronologique avec solde courant après chaque opération
    type Op = {
      id: string;
      type: "COMMANDE" | "PAIEMENT";
      date: Date;
      montant: number;
      ref: string | null;
      mode: string | null;
      observation: string | null;
    };
    const ops: Op[] = [
      ...commandesActives.map((c) => ({
        id: c.id,
        type: "COMMANDE" as const,
        date: c.date,
        montant: Number(c.totalTTC),
        ref: c.numero,
        mode: null,
        observation: null,
      })),
      ...client.paiements.map((p) => ({
        id: p.id,
        type: "PAIEMENT" as const,
        date: p.date,
        montant: Number(p.montant),
        ref: null,
        mode: p.mode,
        observation: p.observation,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const historiqueAsc = ops.map((op) => {
      running += op.type === "COMMANDE" ? op.montant : -op.montant;
      return { ...op, soldeApres: Math.round(running * 100) / 100 };
    });

    res.json({
      id: client.id,
      nom: client.nom,
      telephone: client.telephone,
      email: client.email,
      adresse: client.adresse,
      createdAt: client.createdAt,
      nbCommandes: commandesActives.length,
      totalCommandes,
      totalPaiements,
      solde,
      commandes: client.commandes,
      paiements: client.paiements,
      historique: historiqueAsc.reverse(), // plus récent en premier
    });
  }),
);

// F-A01 — créer
clientsRouter.post(
  "/",
  validate(clientSchema),
  ah(async (req, res) => {
    const data = req.body as {
      nom: string;
      telephone: string;
      email?: string;
      adresse?: string;
    };
    const client = await prisma.client.create({
      data: { ...data, email: data.email || null },
    });
    res.status(201).json(client);
  }),
);

// F-A02 — modifier
clientsRouter.patch(
  "/:id",
  validate(clientSchema),
  ah(async (req, res) => {
    const data = req.body as {
      nom: string;
      telephone: string;
      email?: string;
      adresse?: string;
    };
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.archived) throw new AppError("NOT_FOUND", 404);
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { ...data, email: data.email || null },
    });
    res.json(client);
  }),
);

// F-A04 — suppression logique
clientsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.client.update({
      where: { id: req.params.id },
      data: { archived: true },
    });
    res.status(204).end();
  }),
);

// §5 — enregistrer un paiement pour le client (met à jour le solde automatiquement)
clientsRouter.post(
  "/:id/paiements",
  validate(paiementSchema),
  ah(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);
    const { montant, mode, date, observation } = req.body as {
      montant: number;
      mode: "ESPECES" | "MOBILE_MONEY" | "VIREMENT";
      date?: string;
      observation?: string;
    };
    const paiement = await prisma.paiement.create({
      data: {
        clientId: req.params.id,
        montant,
        mode,
        date: date ? new Date(date) : undefined,
        observation: observation || null,
      },
    });
    res.status(201).json(paiement);
  }),
);
