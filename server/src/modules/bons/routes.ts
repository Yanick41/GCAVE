import { bonCommandeSchema } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const bonsRouter = Router();

bonsRouter.use(requireAuth);

type StatutBonValue = "BROUILLON" | "ENVOYE" | "VALIDE" | "LIVRE" | "PAYE" | "CONVERTI";

type BonBody = {
  clientId?: string | null;
  clientNomLibre?: string;
  telephone?: string;
  adresseLivraison?: string;
  lignes: { designation: string; quantite: number; servi?: string }[];
  notes?: string;
  statut?: StatutBonValue;
  allerRetour?: boolean;
  montant?: number;
  commandeId?: string | null;
};

// Liste (récents d'abord), avec client — filtre optionnel par clientId
bonsRouter.get(
  "/",
  ah(async (req, res) => {
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    const bons = await prisma.bonCommande.findMany({
      where: { ...(clientId ? { clientId } : {}) },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, nom: true } },
        lignes: { orderBy: { ordre: "asc" } },
      },
    });
    res.json(bons);
  }),
);

// Détail
bonsRouter.get(
  "/:id",
  ah(async (req, res) => {
    const bon = await prisma.bonCommande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    if (!bon) throw new AppError("NOT_FOUND", 404);
    res.json(bon);
  }),
);

// Créer — génère le numéro BC-<année>-<seq>
bonsRouter.post(
  "/",
  validate(bonCommandeSchema),
  ah(async (req, res) => {
    const body = req.body as BonBody;

    const year = new Date().getFullYear();
    const last = await prisma.bonCommande.findFirst({
      where: { numero: { startsWith: `BC-${year}-` } },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const lastSeq = last ? parseInt(last.numero.slice(-6), 10) : 0;
    const numero = `BC-${year}-${String(lastSeq + 1).padStart(6, "0")}`;

    const bon = await prisma.bonCommande.create({
      data: {
        numero,
        clientId: body.clientId || null,
        clientNomLibre: body.clientNomLibre || null,
        telephone: body.telephone || null,
        adresseLivraison: body.adresseLivraison || null,
        notes: body.notes || null,
        statut: body.statut ?? "BROUILLON",
        allerRetour: body.allerRetour ?? false,
        montant: body.montant ?? 0,
        lignes: {
          create: body.lignes.map((l, i) => ({
            designation: l.designation,
            quantite: l.quantite,
            servi: l.servi || null,
            ordre: i,
          })),
        },
      },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });

    res.status(201).json(bon);
  }),
);

// Modifier — remplace les lignes + met à jour l'en-tête / statut / notes
bonsRouter.patch(
  "/:id",
  validate(bonCommandeSchema),
  ah(async (req, res) => {
    const existing = await prisma.bonCommande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);

    const body = req.body as BonBody;

    await prisma.$transaction([
      prisma.ligneBon.deleteMany({ where: { bonId: req.params.id } }),
      prisma.ligneBon.createMany({
        data: body.lignes.map((l, i) => ({
          bonId: req.params.id,
          designation: l.designation,
          quantite: l.quantite,
          servi: l.servi || null,
          ordre: i,
        })),
      }),
      prisma.bonCommande.update({
        where: { id: req.params.id },
        data: {
          clientId: body.clientId || null,
          clientNomLibre: body.clientNomLibre || null,
          telephone: body.telephone || null,
          adresseLivraison: body.adresseLivraison || null,
          notes: body.notes || null,
          ...(body.statut ? { statut: body.statut } : {}),
          ...(body.allerRetour !== undefined ? { allerRetour: body.allerRetour } : {}),
          ...(body.montant !== undefined ? { montant: body.montant } : {}),
          ...(body.commandeId !== undefined ? { commandeId: body.commandeId || null } : {}),
        },
      }),
    ]);

    const updated = await prisma.bonCommande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    res.json(updated);
  }),
);

// Changer le statut (transition rapide : Envoyé / Livré / Payé…)
const STATUTS_VALIDES: StatutBonValue[] = [
  "BROUILLON",
  "ENVOYE",
  "VALIDE",
  "LIVRE",
  "PAYE",
  "CONVERTI",
];
bonsRouter.post(
  "/:id/statut",
  ah(async (req, res) => {
    const existing = await prisma.bonCommande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    const { statut } = req.body as { statut?: StatutBonValue };
    if (!statut || !STATUTS_VALIDES.includes(statut)) throw new AppError("VALIDATION_ERROR", 400);
    const updated = await prisma.bonCommande.update({
      where: { id: req.params.id },
      data: { statut },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    res.json(updated);
  }),
);

// Marquer converti (statut CONVERTI + référence commande) — appelé après création commande
bonsRouter.post(
  "/:id/converti",
  ah(async (req, res) => {
    const existing = await prisma.bonCommande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    const { commandeId } = req.body as { commandeId?: string };
    const updated = await prisma.bonCommande.update({
      where: { id: req.params.id },
      data: { statut: "CONVERTI", commandeId: commandeId || null },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    res.json(updated);
  }),
);

// Supprimer
bonsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.bonCommande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.bonCommande.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
