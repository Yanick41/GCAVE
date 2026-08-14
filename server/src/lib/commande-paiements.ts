/**
 * Règlement d'une commande — logique partagée entre les modules
 * commandes / clients / paiements.
 *
 * Une commande peut recevoir PLUSIEURS paiements partiels : `Commande.montantPaye`
 * est une colonne DÉRIVÉE (= somme des paiements rattachés), resynchronisée ici
 * après chaque création / suppression / rattachement de paiement.
 */
import { reglementCommande, type EtatPaiement } from "@gca/shared";
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
 * au moteur partagé). Le total dû inclut l'ancien solde reporté : c'est le
 * « NET À PAYER » imprimé sur la facture, donc la référence pour
 * « soldé / reste à payer ».
 *
 * Le choix ancien / nouveau suivi revient entièrement à
 * `reglementCommande` (shared), sur la base du drapeau de la commande.
 */
export function etatCommande(
  commande: {
    totalTTC: unknown;
    ancienSolde: unknown;
    montantPaye: unknown;
    utiliseNouveauSuiviPaiement: boolean;
  },
  paiements: { montant: number }[],
): EtatPaiement {
  return reglementCommande(
    {
      totalTTC: Number(commande.totalTTC),
      ancienSolde: Number(commande.ancienSolde),
      montantPaye: Number(commande.montantPaye),
      utiliseNouveauSuiviPaiement: commande.utiliseNouveauSuiviPaiement,
    },
    paiements,
  );
}
