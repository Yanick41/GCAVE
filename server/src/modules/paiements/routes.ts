import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";

export const paiementsRouter = Router();

paiementsRouter.use(requireAuth);

// Liste globale des paiements (page Paiements)
paiementsRouter.get(
  "/",
  ah(async (_req, res) => {
    const paiements = await prisma.paiement.findMany({
      orderBy: { date: "desc" },
      take: 200,
      include: { client: { select: { id: true, nom: true } } },
    });
    res.json(paiements);
  }),
);

paiementsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.paiement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.paiement.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
