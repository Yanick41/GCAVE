import { commandeSchema, computeCommande } from "@gca/shared";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const commandesRouter = Router();

commandesRouter.use(requireAuth);

// F-C01 — liste (récentes d'abord), avec client
commandesRouter.get(
  "/",
  ah(async (req, res) => {
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    const commandes = await prisma.commande.findMany({
      where: { ...(clientId ? { clientId } : {}) },
      orderBy: { date: "desc" },
      take: 200,
      include: { client: { select: { id: true, nom: true } }, lignes: true },
    });
    res.json(commandes);
  }),
);

// F-C02 — détail
commandesRouter.get(
  "/:id",
  ah(async (req, res) => {
    const commande = await prisma.commande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: true },
    });
    if (!commande) throw new AppError("NOT_FOUND", 404);
    res.json(commande);
  }),
);

// F-B09 — valider/créer une commande (recalcul autoritaire côté serveur)
commandesRouter.post(
  "/",
  validate(commandeSchema),
  ah(async (req, res) => {
    const body = req.body as {
      clientId?: string;
      clientNomLibre?: string;
      lignes: { nomProduit: string; quantite: number; prixUnitaire: number }[];
      remiseType: "AUCUNE" | "POURCENTAGE" | "MONTANT";
      remiseValeur: number;
      ancienSolde?: number;
      montantPaye?: number;
      statut?: "BROUILLON" | "VALIDEE" | "ANNULEE";
    };

    // Le serveur recalcule TOUJOURS les totaux (ne jamais croire le client)
    const calc = computeCommande({
      lignes: body.lignes,
      remiseType: body.remiseType,
      remiseValeur: body.remiseValeur,
    });

    // Ancien solde reporté (info facture) + paiement initial éventuel, bornés
    const ancienSolde = Math.max(body.ancienSolde ?? 0, 0);
    const grandTotal = calc.totalTTC + ancienSolde;
    const montantPaye = Math.min(Math.max(body.montantPaye ?? 0, 0), grandTotal);

    // Numéro séquentiel (lecture hors transaction — le pooler Neon ne supporte
    // pas les transactions interactives, on utilise une transaction "batch").
    const year = new Date().getFullYear();
    const count = await prisma.commande.count({
      where: { numero: { startsWith: `CMD-${year}-` } },
    });
    const numero = `CMD-${year}-${String(count + 1).padStart(6, "0")}`;

    const createCommande = prisma.commande.create({
      data: {
        numero,
        clientId: body.clientId ?? null,
        clientNomLibre: body.clientNomLibre ?? null,
        remiseType: body.remiseType,
        remiseValeur: body.remiseValeur,
        sousTotal: calc.sousTotal,
        montantRemise: calc.montantRemise,
        totalTTC: calc.totalTTC,
        ancienSolde,
        montantPaye,
        statut: body.statut ?? "VALIDEE",
        lignes: {
          create: calc.lignes.map((l) => ({
            nomProduit: l.nomProduit,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            totalLigne: l.totalLigne,
          })),
        },
      },
      include: { client: true, lignes: true },
    });

    // Transaction batch (compatible pooler) : commande (+ paiement initial si fourni)
    const ops: Prisma.PrismaPromise<unknown>[] = [createCommande];
    if (montantPaye > 0 && body.clientId) {
      ops.push(
        prisma.paiement.create({
          data: {
            clientId: body.clientId,
            montant: montantPaye,
            mode: "ESPECES",
            observation: `Paiement à la commande ${numero}`,
          },
        }),
      );
    }
    const [commande] = await prisma.$transaction(ops);

    res.status(201).json(commande);
  }),
);

// F-C05 — supprimer
commandesRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const existing = await prisma.commande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.commande.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
