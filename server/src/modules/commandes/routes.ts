import { commandeSchema, computeCommande, paiementSchema } from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import {
  etatCommande,
  reconcilierPaiements,
  resyncMontantPaye,
  toPaiementResume,
} from "../../lib/commande-paiements.js";
import { prochainNumeroBon } from "../../lib/numerotation.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const commandesRouter = Router();

commandesRouter.use(requireAuth);

// F-C01 — liste (récentes d'abord), avec client et état de règlement
commandesRouter.get(
  "/",
  ah(async (req, res) => {
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    const commandes = await prisma.commande.findMany({
      where: { ...(clientId ? { clientId } : {}) },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, nom: true } },
        lignes: true,
        paiements: { orderBy: { date: "asc" } },
      },
    });
    res.json(
      commandes.map(({ paiements, ...c }) => {
        const resumes = paiements.map(toPaiementResume);
        return { ...c, paiements: resumes, reglement: etatCommande(c, resumes) };
      }),
    );
  }),
);

// F-C02 — détail : commande + paiements rattachés + état de règlement
commandesRouter.get(
  "/:id",
  ah(async (req, res) => {
    const commande = await prisma.commande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: true, paiements: { orderBy: { date: "asc" } } },
    });
    if (!commande) throw new AppError("NOT_FOUND", 404);
    const paiements = commande.paiements.map(toPaiementResume);
    res.json({ ...commande, paiements, reglement: etatCommande(commande, paiements) });
  }),
);

// Paiement rattaché à une commande (acompte, versement partiel ou solde).
// Une commande peut en recevoir plusieurs ; `montantPaye` est resynchronisé.
commandesRouter.post(
  "/:id/paiements",
  validate(paiementSchema),
  ah(async (req, res) => {
    const commande = await prisma.commande.findUnique({
      where: { id: req.params.id },
      include: { paiements: true },
    });
    if (!commande) throw new AppError("NOT_FOUND", 404);
    // Un encaissement peut n'avoir aucun client (vente comptoir) : seule la
    // commande le rattache. La contrainte a été levée en base.
    if (commande.statut === "ANNULEE") throw new AppError("COMMANDE_ANNULEE", 400);
    // Commande de l'ancien suivi : son « payé » reste l'acompte figé. Encaisser
    // ici n'aurait aucun effet sur sa facture → on refuse plutôt que d'induire
    // en erreur. Le rattachement au cas par cas passe par
    // PATCH /api/paiements/:id/commande, qui ne bascule aucun régime.
    if (!commande.utiliseNouveauSuiviPaiement)
      throw new AppError("COMMANDE_ANCIEN_SUIVI", 400);

    const { montant, mode, date, observation } = req.body as {
      montant: number;
      mode: "ESPECES" | "MOBILE_MONEY" | "VIREMENT";
      date?: string;
      observation?: string;
    };

    const paiement = await prisma.paiement.create({
      data: {
        clientId: commande.clientId,
        commandeId: commande.id,
        montant,
        mode,
        date: date ? new Date(date) : undefined,
        observation: observation || null,
      },
    });
    await resyncMontantPaye(commande.id);

    // Le trop-perçu n'est PAS refusé (le client peut payer d'avance) :
    // il est signalé dans la réponse et reste porté par le solde global.
    const paiements = [...commande.paiements, paiement].map(toPaiementResume);
    res
      .status(201)
      .json({ ...toPaiementResume(paiement), reglement: etatCommande(commande, paiements) });
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
      clientTelephoneLibre?: string;
      lignes: {
        nomProduit: string;
        quantite: number;
        quantiteSaisie?: string;
        prixUnitaire: number;
      }[];
      remiseType: "AUCUNE" | "POURCENTAGE" | "MONTANT";
      remiseValeur: number;
      montantPaye?: number;
      statut?: "BROUILLON" | "VALIDEE" | "ANNULEE";
    };

    // Le serveur recalcule TOUJOURS les totaux (ne jamais croire le client)
    const calc = computeCommande({
      lignes: body.lignes,
      remiseType: body.remiseType,
      remiseValeur: body.remiseValeur,
    });

    // CHAQUE FACTURE EST INDÉPENDANTE : aucun solde d'une autre commande n'est
    // reporté. Le montant réclamé est le total de cette commande, et l'acompte
    // éventuel s'y borne.
    const montantPaye = Math.min(Math.max(body.montantPaye ?? 0, 0), calc.totalTTC);

    // Numéro séquentiel basé sur le MAX existant + 1 (robuste aux suppressions ;
    // un count+1 collisionnerait avec un numéro déjà attribué). Zéro-padding 6
    // chiffres => l'ordre lexical = l'ordre numérique.
    const year = new Date().getFullYear();
    const last = await prisma.commande.findFirst({
      where: { numero: { startsWith: `CMD-${year}-` } },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const lastSeq = last ? parseInt(last.numero.slice(-6), 10) : 0;
    const numero = `CMD-${year}-${String(lastSeq + 1).padStart(6, "0")}`;

    // L'acompte saisi à la validation est créé comme un PAIEMENT RATTACHÉ à la
    // commande (écriture imbriquée : le lien est posé dès la création, sans
    // transaction séparée). Vente comptoir comprise : sans écriture, la recette
    // n'apparaîtrait ni dans les paiements, ni dans le rapport du jour.
    const acompte = montantPaye > 0 ? montantPaye : 0;

    const commande = await prisma.commande.create({
      data: {
        numero,
        clientId: body.clientId ?? null,
        clientNomLibre: body.clientNomLibre ?? null,
        // Vente comptoir : ni fiche client, ni nom, ni numéro obligatoires.
        clientTelephoneLibre: body.clientTelephoneLibre ?? null,
        remiseType: body.remiseType,
        remiseValeur: body.remiseValeur,
        sousTotal: calc.sousTotal,
        montantRemise: calc.montantRemise,
        totalTTC: calc.totalTTC,
        ancienSolde: 0, // plus aucun report : la facture ne réclame que son propre total
        montantPaye,
        // Commande créée depuis le déploiement du rattachement
        // paiement ↔ commande : elle suit le nouveau régime dès sa naissance.
        utiliseNouveauSuiviPaiement: true,
        statut: body.statut ?? "VALIDEE",
        lignes: {
          create: calc.lignes.map((l, i) => ({
            nomProduit: l.nomProduit,
            quantite: l.quantite,
            // Écriture d'origine : le moteur de calcul ne manipule que des
            // nombres, on réapparie par position.
            quantiteSaisie: body.lignes[i]?.quantiteSaisie || null,
            prixUnitaire: l.prixUnitaire,
            totalLigne: l.totalLigne,
          })),
        },
        ...(acompte > 0
          ? {
              paiements: {
                create: {
                  clientId: body.clientId ?? null,
                  montant: acompte,
                  mode: "ESPECES",
                  observation: `Paiement à la commande ${numero}`,
                },
              },
            }
          : {}),
      },
      include: { client: true, lignes: true, paiements: { orderBy: { date: "asc" } } },
    });

    const paiements = commande.paiements.map(toPaiementResume);
    res
      .status(201)
      .json({ ...commande, paiements, reglement: etatCommande(commande, paiements) });
  }),
);

// F-C04 — modifier une commande (lignes) ; totaux recalculés côté serveur.
// L'ancien solde et le paiement initial ne sont pas modifiés (snapshots).
commandesRouter.patch(
  "/:id",
  validate(commandeSchema),
  ah(async (req, res) => {
    const existing = await prisma.commande.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);

    const body = req.body as {
      lignes: {
        nomProduit: string;
        quantite: number;
        quantiteSaisie?: string;
        prixUnitaire: number;
      }[];
      remiseType: "AUCUNE" | "POURCENTAGE" | "MONTANT";
      remiseValeur: number;
      montantPaye?: number;
    };
    const calc = computeCommande({
      lignes: body.lignes,
      remiseType: body.remiseType,
      remiseValeur: body.remiseValeur,
    });

    // Montant payé saisi à la main, borné au total dû (ni négatif, ni aberrant).
    const montantPayeVise =
      body.montantPaye !== undefined
        ? Math.min(Math.max(body.montantPaye, 0), calc.totalTTC)
        : undefined;

    // Une commande du nouveau suivi rattachée à un client tient son « payé » de
    // ses règlements : la saisie est répercutée sur EUX (voir reconcilierPaiements),
    // sinon la facture afficherait un montant que le solde du client ignore.
    // Dans les autres cas — ancien suivi, ou client occasionnel sans fiche donc
    // sans écriture de paiement possible — le montant est la seule trace et
    // s'écrit directement sur la commande.
    const viaReglements =
      montantPayeVise !== undefined && existing.utiliseNouveauSuiviPaiement;

    // Transaction batch (compatible pooler) : remplace les lignes + met à jour les totaux
    await prisma.$transaction([
      prisma.ligneCommande.deleteMany({ where: { commandeId: req.params.id } }),
      prisma.ligneCommande.createMany({
        data: calc.lignes.map((l, i) => ({
          commandeId: req.params.id,
          nomProduit: l.nomProduit,
          quantite: l.quantite,
          quantiteSaisie: body.lignes[i]?.quantiteSaisie || null,
          prixUnitaire: l.prixUnitaire,
          totalLigne: l.totalLigne,
        })),
      }),
      prisma.commande.update({
        where: { id: req.params.id },
        data: {
          sousTotal: calc.sousTotal,
          montantRemise: calc.montantRemise,
          totalTTC: calc.totalTTC,
          ...(montantPayeVise !== undefined && !viaReglements
            ? { montantPaye: montantPayeVise }
            : {}),
        },
      }),
    ]);

    if (viaReglements) {
      await reconcilierPaiements(
        req.params.id,
        existing.clientId,
        montantPayeVise as number,
        `Règlement saisi sur la commande ${existing.numero}`,
      );
      // montantPaye redevient la somme exacte des règlements rattachés
      await resyncMontantPaye(req.params.id);
    }

    const updated = await prisma.commande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: true, paiements: { orderBy: { date: "asc" } } },
    });
    if (!updated) throw new AppError("NOT_FOUND", 404);
    const paiements = updated.paiements.map(toPaiementResume);
    res.json({ ...updated, paiements, reglement: etatCommande(updated, paiements) });
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

// Conversion facture → bon de commande : génère un DOCUMENT SÉPARÉ reprenant
// client, date et lignes (désignation + quantité), SANS aucun prix.
// La commande d'origine n'est ni modifiée ni supprimée : elle reste la pièce
// comptable, le bon n'est qu'un document de préparation/livraison.
commandesRouter.post(
  "/:id/bon",
  ah(async (req, res) => {
    const commande = await prisma.commande.findUnique({
      where: { id: req.params.id },
      include: { client: true, lignes: true },
    });
    if (!commande) throw new AppError("NOT_FOUND", 404);
    if (commande.lignes.length === 0) throw new AppError("COMMANDE_SANS_LIGNE", 400);

    const numero = await prochainNumeroBon();

    const bon = await prisma.bonCommande.create({
      data: {
        numero,
        // Même client et même date que la facture d'origine
        clientId: commande.clientId,
        clientNomLibre: commande.clientNomLibre,
        telephone: commande.client?.telephone ?? null,
        adresseLivraison: commande.client?.adresse ?? null,
        date: commande.date,
        // Traçabilité : le bon référence la commande dont il est issu
        commandeId: commande.id,
        notes: `Établi d'après la facture ${commande.numero}`,
        statut: "LIVRE",
        allerRetour: false,
        // 0 impératif : la créance est déjà portée par la commande. Un montant
        // ici la compterait une seconde fois dans le solde du client.
        montant: 0,
        lignes: {
          create: commande.lignes.map((l, i) => ({
            designation: l.nomProduit,
            quantite: l.quantite,
            quantiteSaisie: l.quantiteSaisie,
            servi: null,
            ordre: i,
          })),
        },
      },
      include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
    });

    res.status(201).json(bon);
  }),
);
