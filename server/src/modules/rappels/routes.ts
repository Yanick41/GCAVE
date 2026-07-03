import { reporterRappelSchema } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const rappelsRouter = Router();

rappelsRouter.use(requireAuth);

// Liste des rappels (en cours d'abord, par échéance croissante)
rappelsRouter.get(
  "/",
  ah(async (req, res) => {
    const statut =
      req.query.statut === "TERMINE"
        ? "TERMINE"
        : req.query.statut === "EN_COURS"
          ? "EN_COURS"
          : undefined;
    const rappels = await prisma.rappel.findMany({
      where: statut ? { statut } : {},
      orderBy: [{ statut: "asc" }, { echeance: "asc" }],
      include: { client: { select: { id: true, nom: true } } },
      take: 300,
    });
    res.json(rappels);
  }),
);

// Alertes : rappels en retard + à venir (<= 3 jours) — pour le tableau de bord / la connexion
rappelsRouter.get(
  "/alertes",
  ah(async (_req, res) => {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 3);
    soon.setHours(23, 59, 59, 999);

    const enCours = await prisma.rappel.findMany({
      where: { statut: "EN_COURS", echeance: { lte: soon } },
      orderBy: { echeance: "asc" },
      include: { client: { select: { id: true, nom: true } } },
    });
    const enRetard = enCours.filter((r) => r.echeance < now);
    const aVenir = enCours.filter((r) => r.echeance >= now);
    res.json({ enRetard, aVenir, total: enCours.length });
  }),
);

// Marquer comme terminé
rappelsRouter.patch(
  "/:id/terminer",
  ah(async (req, res) => {
    const existing = await prisma.rappel.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    const r = await prisma.rappel.update({
      where: { id: req.params.id },
      data: { statut: "TERMINE" },
    });
    res.json(r);
  }),
);

// Reporter (nouvelle échéance, repasse en cours)
rappelsRouter.patch(
  "/:id/reporter",
  validate(reporterRappelSchema),
  ah(async (req, res) => {
    const { echeance } = req.body as { echeance: string };
    const existing = await prisma.rappel.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    const r = await prisma.rappel.update({
      where: { id: req.params.id },
      data: { echeance: new Date(echeance), statut: "EN_COURS" },
    });
    res.json(r);
  }),
);

// Supprimer
rappelsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.rappel.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.rappel.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
