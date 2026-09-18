import { paiementLienSchema } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { resyncMontantPaye } from "../../lib/commande-paiements.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const paiementsRouter = Router();

paiementsRouter.use(requireAuth);

// Liste globale des paiements (page Paiements)
paiementsRouter.get(
  "/",
  ah(async (_req, res) => {
    const paiements = await prisma.paiement.findMany({
      orderBy: { date: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, nom: true } },
        // clientNomLibre : nom du payeur d'une vente comptoir, qui n'a pas
        // de fiche client — sans lui la ligne n'aurait aucun libellé.
        commande: { select: { id: true, numero: true, clientNomLibre: true } },
      },
    });
    res.json(paiements);
  }),
);

// Rattacher un paiement existant à une commande (ou le détacher : commandeId
// null). Sert à corriger les paiements saisis avant la mise en place du lien
// commande ↔ paiement, sans avoir à les ressaisir.
paiementsRouter.patch(
  "/:id/commande",
  validate(paiementLienSchema),
  ah(async (req, res) => {
    const paiement = await prisma.paiement.findUnique({ where: { id: req.params.id } });
    if (!paiement) throw new AppError("NOT_FOUND", 404);
    const { commandeId } = req.body as { commandeId: string | null };

    if (commandeId) {
      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        select: { clientId: true, statut: true },
      });
      // La commande doit exister et appartenir au même client que le paiement
      if (!commande || commande.clientId !== paiement.clientId)
        throw new AppError("COMMANDE_INTROUVABLE", 404);
      if (commande.statut === "ANNULEE") throw new AppError("COMMANDE_ANNULEE", 400);
    }

    const updated = await prisma.paiement.update({
      where: { id: req.params.id },
      data: { commandeId: commandeId || null },
    });
    // Resynchroniser l'ancienne ET la nouvelle commande
    await resyncMontantPaye(paiement.commandeId);
    if (updated.commandeId !== paiement.commandeId)
      await resyncMontantPaye(updated.commandeId);

    res.json(updated);
  }),
);

paiementsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.paiement.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.paiement.delete({ where: { id: req.params.id } });
    // La commande réglée retrouve son reste à payer
    await resyncMontantPaye(existing.commandeId);
    res.status(204).end();
  }),
);
