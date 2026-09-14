/**
 * Règlement d'une commande — logique partagée entre les modules
 * commandes / clients / paiements.
 *
 * Une commande peut recevoir PLUSIEURS paiements partiels : `Commande.montantPaye`
 * est une colonne DÉRIVÉE (= somme des paiements rattachés), resynchronisée ici
 * après chaque création / suppression / rattachement de paiement.
 */
import { reglementCommande, round2, type EtatPaiement } from "@gca/shared";
import type { Paiement } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Vue « paiement » exposée par l'API (montants en nombres). */
export interface PaiementResume {
  id: string;
  montant: number;
  mode: Paiement["mode"];
  date: Date;
  observation: string | null;
}

export function toPaiementResume(p: Paiement): PaiementResume {
  return {
    id: p.id,
    montant: Number(p.montant),
    mode: p.mode,
    date: p.date,
    observation: p.observation,
  };
}

/**
 * Recalcule `Commande.montantPaye` = somme des paiements rattachés.
 * À appeler après toute modification de l'ensemble des paiements d'une commande.
 *
 * NE TOUCHE JAMAIS aux commandes de l'ancien suivi
 * (`utiliseNouveauSuiviPaiement = false`) : leur `montantPaye` est un acompte
 * figé qui doit rester tel quel, même si un paiement leur est rattaché
 * manuellement. Sans effet non plus si `commandeId` est nul (paiement libre).
 */
export async function resyncMontantPaye(commandeId: string | null | undefined) {
  if (!commandeId) return;
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: { id: true, utiliseNouveauSuiviPaiement: true },
  });
  // Commande supprimée entre-temps, ou commande de l'ancien suivi : on sort.
  if (!commande || !commande.utiliseNouveauSuiviPaiement) return;
  const agg = await prisma.paiement.aggregate({
    where: { commandeId },
    _sum: { montant: true },
  });
  await prisma.commande.update({
    where: { id: commandeId },
    data: { montantPaye: agg._sum.montant ?? 0 },
  });
}

/**
 * État de règlement d'une commande (conversion des Decimal Prisma + délégation
 * au moteur partagé). CHAQUE FACTURE EST INDÉPENDANTE : le total dû est le
 * total de la commande elle-même — c'est le « NET À PAYER » imprimé, donc la
 * référence pour « soldé / reste à payer ». Aucun report d'une autre commande.
 *
 * Le choix ancien / nouveau suivi revient entièrement à
 * `reglementCommande` (shared), sur la base du drapeau de la commande.
 */
export function etatCommande(
  commande: {
    totalTTC: unknown;
    montantPaye: unknown;
    utiliseNouveauSuiviPaiement: boolean;
  },
  paiements: { montant: number }[],
): EtatPaiement {
  return reglementCommande(
    {
      totalTTC: Number(commande.totalTTC),
      montantPaye: Number(commande.montantPaye),
      utiliseNouveauSuiviPaiement: commande.utiliseNouveauSuiviPaiement,
    },
    paiements,
  );
}

/** Opération d'ajustement à appliquer aux règlements d'une commande. */
export type OperationReglement =
  | { type: "CREER"; montant: number }
  | { type: "REDUIRE"; id: string; montant: number }
  | { type: "SUPPRIMER"; id: string };

/**
 * Calcule le plan d'ajustement des règlements pour atteindre un total saisi.
 * Fonction PURE, sans accès base : c'est la règle métier, testable telle quelle.
 *
 *  • total demandé supérieur → un règlement d'appoint couvre l'écart ;
 *  • total demandé inférieur → les règlements les plus RÉCENTS sont rognés,
 *    puis supprimés s'ils tombent à zéro (correction d'une saisie erronée) ;
 *  • écart nul → aucune opération.
 *
 * Les règlements les plus anciens sont préservés en priorité : ce sont les plus
 * susceptibles d'avoir été réellement encaissés et déjà justifiés au client.
 */
export function planifierReconciliation(
  paiements: { id: string; montant: number }[],
  totalVise: number,
): OperationReglement[] {
  const somme = paiements.reduce((s, p) => s + p.montant, 0);
  const ecart = round2(totalVise - somme);

  // Tolérance au centime : en FCFA un écart inférieur n'a aucun sens.
  if (Math.abs(ecart) < 0.01) return [];
  if (ecart > 0) return [{ type: "CREER", montant: ecart }];

  const operations: OperationReglement[] = [];
  let aRetirer = -ecart;
  for (const p of [...paiements].reverse()) {
    if (aRetirer < 0.01) break;
    if (p.montant <= aRetirer + 1e-9) {
      operations.push({ type: "SUPPRIMER", id: p.id });
      aRetirer = round2(aRetirer - p.montant);
    } else {
      operations.push({ type: "REDUIRE", id: p.id, montant: round2(p.montant - aRetirer) });
      aRetirer = 0;
    }
  }
  return operations;
}

/**
 * Aligne les règlements rattachés à une commande sur un total saisi à la main.
 *
 * Sur une commande du nouveau suivi, `montantPaye` est DÉRIVÉ des règlements :
 * y écrire un nombre directement produirait une facture en désaccord avec le
 * solde du client (calculé, lui, sur les règlements réels) et serait écrasé au
 * prochain encaissement. On ajuste donc les écritures elles-mêmes, selon le
 * plan établi par `planifierReconciliation`.
 */
export async function reconcilierPaiements(
  commandeId: string,
  clientId: string,
  totalVise: number,
  observationAppoint: string,
) {
  const paiements = await prisma.paiement.findMany({
    where: { commandeId },
    orderBy: { date: "asc" },
    select: { id: true, montant: true },
  });

  const plan = planifierReconciliation(
    paiements.map((p) => ({ id: p.id, montant: Number(p.montant) })),
    totalVise,
  );

  for (const op of plan) {
    if (op.type === "CREER") {
      await prisma.paiement.create({
        data: {
          clientId,
          commandeId,
          montant: op.montant,
          mode: "ESPECES",
          observation: observationAppoint,
        },
      });
    } else if (op.type === "REDUIRE") {
      await prisma.paiement.update({ where: { id: op.id }, data: { montant: op.montant } });
    } else {
      await prisma.paiement.delete({ where: { id: op.id } });
    }
  }
}
