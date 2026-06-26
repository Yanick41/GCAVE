import { clientSchema } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// F-A03 — liste + recherche (nom ou téléphone), exclut les archivés
clientsRouter.get(
  "/",
  ah(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
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
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(clients);
  }),
);

// F-A05 — fiche client : infos + commandes + total cumulé
clientsRouter.get(
  "/:id",
  ah(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { commandes: { orderBy: { date: "desc" } } },
    });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);
    const totalCumule = client.commandes
      .filter((c) => c.statut !== "ANNULEE")
      .reduce((s, c) => s + Number(c.totalTTC), 0);
    res.json({ ...client, totalCumule });
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

// F-A02 — modifier (sans perte d'historique)
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

// F-A04 — suppression logique (archivage)
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
