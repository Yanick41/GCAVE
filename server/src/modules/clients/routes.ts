import {
  clientSchema,
  clientsImportSchema,
  paiementSchema,
  rappelSchema,
  soldeClient,
  type ClientInput,
} from "@gca/shared";
import { Router } from "express";
import { ah } from "../../lib/async.js";
import {
  etatCommande,
  resyncMontantPaye,
  toPaiementResume,
} from "../../lib/commande-paiements.js";
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
    const [cmdSums, paySums, bonSums] = await Promise.all([
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
      // Créances des bons livrés (non encore payés), en attente de paiement
      prisma.bonCommande.groupBy({
        by: ["clientId"],
        where: { clientId: { in: ids }, statut: "LIVRE" },
        _sum: { montant: true },
      }),
    ]);
    const cmdMap = new Map(cmdSums.map((s) => [s.clientId, Number(s._sum.totalTTC ?? 0)]));
    const payMap = new Map(paySums.map((s) => [s.clientId, Number(s._sum.montant ?? 0)]));
    const bonMap = new Map(bonSums.map((s) => [s.clientId, Number(s._sum.montant ?? 0)]));

    let result = clients.map((c) => {
      const soldeInitial = Number(c.soldeInitial);
      const totalCommandes = cmdMap.get(c.id) ?? 0;
      const totalPaiements = payMap.get(c.id) ?? 0;
      const creancesLivrees = bonMap.get(c.id) ?? 0;
      return {
        id: c.id,
        nom: c.nom,
        telephone: c.telephone,
        email: c.email,
        adresse: c.adresse,
        createdAt: c.createdAt,
        nbCommandes: c._count.commandes,
        soldeInitial,
        totalCommandes,
        totalPaiements,
        // Solde = commandes − paiements + créances aller-retour livrées non payées
        solde: soldeClient(soldeInitial, totalCommandes, totalPaiements) + creancesLivrees,
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
        commandes: {
          include: { lignes: true, paiements: { orderBy: { date: "asc" } } },
          orderBy: { date: "asc" },
        },
        paiements: {
          orderBy: { date: "asc" },
          include: { commande: { select: { id: true, numero: true } } },
        },
        rappels: { orderBy: [{ statut: "asc" }, { echeance: "asc" }] },
        bonsCommande: {
          include: { lignes: { orderBy: { ordre: "asc" } } },
          orderBy: { date: "desc" },
        },
      },
    });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);

    const soldeInitial = Number(client.soldeInitial);
    const commandesActives = client.commandes.filter((c) => c.statut !== "ANNULEE");
    const totalCommandes = commandesActives.reduce((s, c) => s + Number(c.totalTTC), 0);
    const totalPaiements = client.paiements.reduce((s, p) => s + Number(p.montant), 0);
    // Bons LIVRÉS (créance en attente de paiement) : comptent comme débit
    const bonsLivres = client.bonsCommande.filter((b) => b.statut === "LIVRE");
    const totalCreancesLivrees = bonsLivres.reduce((s, b) => s + Number(b.montant), 0);
    const solde =
      soldeClient(soldeInitial, totalCommandes, totalPaiements) + totalCreancesLivrees;

    // Historique chronologique avec solde courant après chaque opération.
    // Un PAIEMENT rattaché à une commande porte la référence de celle-ci
    // (`commandeId` / `ref`) : l'historique et la facture racontent la même chose.
    type Op = {
      id: string;
      type: "COMMANDE" | "PAIEMENT" | "BON";
      date: Date;
      montant: number;
      ref: string | null;
      mode: string | null;
      observation: string | null;
      commandeId: string | null;
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
        commandeId: c.id,
      })),
      // Un bon sans créance (montant 0) ne déplace pas le solde : l'inscrire
      // dans l'historique des mouvements n'apporterait qu'une ligne à 0 F.
      // C'est le cas des bons générés depuis une facture, dont la créance est
      // déjà portée par la commande.
      ...bonsLivres
        .filter((b) => Number(b.montant) > 0)
        .map((b) => ({
          id: b.id,
          type: "BON" as const,
          date: b.date,
          montant: Number(b.montant),
          ref: b.numero,
          mode: null,
          observation: null,
          commandeId: null,
        })),
      ...client.paiements.map((p) => ({
        id: p.id,
        type: "PAIEMENT" as const,
        date: p.date,
        montant: Number(p.montant),
        ref: p.commande?.numero ?? null,
        mode: p.mode,
        observation: p.observation,
        commandeId: p.commandeId,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = soldeInitial; // le solde courant part du solde d'ouverture
    const historiqueAsc = ops.map((op) => {
      // COMMANDE et BON (livraison aller-retour) sont des débits ; PAIEMENT un crédit
      running += op.type === "PAIEMENT" ? -op.montant : op.montant;
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
      soldeInitial,
      totalCommandes,
      totalPaiements,
      solde,
      // Chaque commande porte son état de règlement (payé / reste / statut) :
      // même calcul que la facture, fait une seule fois côté serveur.
      commandes: client.commandes.map((c) => {
        const paiements = c.paiements.map(toPaiementResume);
        return { ...c, paiements, reglement: etatCommande(c, paiements) };
      }),
      paiements: client.paiements,
      rappels: client.rappels,
      bonsCommande: client.bonsCommande,
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
      soldeInitial?: number;
    };
    const client = await prisma.client.create({
      data: {
        ...data,
        email: data.email || null,
        soldeInitial: data.soldeInitial ?? 0,
      },
    });
    res.status(201).json(client);
  }),
);

// Import en masse depuis un fichier (CSV du tableur du commerçant).
//
// Le serveur revalide TOUT : le navigateur a préparé et prévisualisé la liste,
// mais rien de ce qu'il envoie n'est cru sur parole.
//
// Les clients déjà en base sont IGNORÉS, jamais écrasés : un import relancé
// deux fois ne duplique rien et n'efface aucune correction faite entre-temps.
// La comparaison se fait sur le téléphone réduit à ses chiffres, la même fiche
// pouvant être écrite « 07 00 00 00 01 » ici et « 0700000001 » là.
clientsRouter.post(
  "/import",
  validate(clientsImportSchema),
  ah(async (req, res) => {
    const { clients } = req.body as { clients: ClientInput[] };

    const cle = (t: string) => t.replace(/[^0-9+]/g, "");
    const existants = new Set(
      (await prisma.client.findMany({ select: { telephone: true } })).map((c) => cle(c.telephone)),
    );

    const aCreer: ClientInput[] = [];
    const ignores: { nom: string; telephone: string }[] = [];
    for (const c of clients) {
      if (existants.has(cle(c.telephone))) {
        ignores.push({ nom: c.nom, telephone: c.telephone });
        continue;
      }
      // Le lot lui-même peut contenir deux fois la même fiche.
      existants.add(cle(c.telephone));
      aCreer.push(c);
    }

    const resultat = await prisma.client.createMany({
      data: aCreer.map((c) => ({
        nom: c.nom,
        telephone: c.telephone,
        email: c.email || null,
        adresse: c.adresse || null,
        soldeInitial: c.soldeInitial ?? 0,
      })),
    });

    res.status(201).json({ crees: resultat.count, ignores });
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
      soldeInitial?: number;
    };
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.archived) throw new AppError("NOT_FOUND", 404);
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...data,
        email: data.email || null,
        soldeInitial: data.soldeInitial ?? Number(existing.soldeInitial),
      },
    });
    res.json(client);
  }),
);

// F-A04 — suppression DÉFINITIVE du client et de toutes ses données.
// Les commandes et bons (clientId optionnel) n'ont pas de cascade → on les
// supprime d'abord (leurs lignes cascadent). Paiements et rappels cascadent
// à la suppression du client.
clientsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", 404);
    await prisma.$transaction([
      prisma.commande.deleteMany({ where: { clientId: id } }),
      prisma.bonCommande.deleteMany({ where: { clientId: id } }),
      prisma.client.delete({ where: { id } }),
    ]);
    res.status(204).end();
  }),
);

// §5 — enregistrer un paiement pour le client (met à jour le solde automatiquement).
// `commandeId` (optionnel) rattache le paiement à une commande précise : la
// facture de cette commande affichera alors le payé et le reste à payer.
clientsRouter.post(
  "/:id/paiements",
  validate(paiementSchema),
  ah(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);
    const { montant, mode, date, observation, commandeId } = req.body as {
      montant: number;
      mode: "ESPECES" | "MOBILE_MONEY" | "VIREMENT";
      date?: string;
      observation?: string;
      commandeId?: string | null;
    };

    // La commande visée doit exister ET appartenir à ce client
    if (commandeId) {
      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        select: { clientId: true, statut: true },
      });
      if (!commande || commande.clientId !== req.params.id)
        throw new AppError("COMMANDE_INTROUVABLE", 404);
      if (commande.statut === "ANNULEE") throw new AppError("COMMANDE_ANNULEE", 400);
    }

    const paiement = await prisma.paiement.create({
      data: {
        clientId: req.params.id,
        commandeId: commandeId || null,
        montant,
        mode,
        date: date ? new Date(date) : undefined,
        observation: observation || null,
      },
    });
    await resyncMontantPaye(paiement.commandeId);
    res.status(201).json(paiement);
  }),
);

// Rappels — créer un rappel pour le client
clientsRouter.post(
  "/:id/rappels",
  validate(rappelSchema),
  ah(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client || client.archived) throw new AppError("NOT_FOUND", 404);
    const { note, echeance, priorite } = req.body as {
      note: string;
      echeance: string;
      priorite: "FAIBLE" | "NORMALE" | "URGENTE";
    };
    const rappel = await prisma.rappel.create({
      data: { clientId: req.params.id, note, echeance: new Date(echeance), priorite },
    });
    res.status(201).json(rappel);
  }),
);
