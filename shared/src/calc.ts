/**
 * Moteur de calcul de commande — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Utilisé côté client pour le calcul temps réel (< 50 ms, en mémoire) ET
 * côté serveur à la validation pour recalculer de manière autoritaire
 * (on ne fait JAMAIS confiance aux montants envoyés par le client).
 *
 * Règles métier — CDC §5.3.
 */

export type RemiseType = "AUCUNE" | "POURCENTAGE" | "MONTANT";

export interface LigneInput {
  nomProduit: string;
  quantite: number;
  prixUnitaire: number;
}

export interface CommandeCalcInput {
  lignes: LigneInput[];
  remiseType: RemiseType;
  remiseValeur: number;
}

export interface LigneCalculee extends LigneInput {
  totalLigne: number;
}

export interface CommandeCalculee {
  lignes: LigneCalculee[];
  sousTotal: number;
  montantRemise: number;
  totalTTC: number;
}

/** Arrondi monétaire à 2 décimales (évite les erreurs de flottant). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Crédit restant dû sur une commande = total TTC − montant déjà payé (>= 0). */
export function creditRestant(totalTTC: number, montantPaye: number): number {
  return round2(Math.max((totalTTC || 0) - (montantPaye || 0), 0));
}

/** Solde d'un compte client = total des commandes − total des paiements (CDC §8).
 *  Positif = le client doit de l'argent. */
export function soldeClient(totalCommandes: number, totalPaiements: number): number {
  return round2((totalCommandes || 0) - (totalPaiements || 0));
}

/** total_ligne = quantite × prix_unitaire (CDC §5.3). */
export function lineTotal(quantite: number, prixUnitaire: number): number {
  const q = Number.isFinite(quantite) ? quantite : 0;
  const p = Number.isFinite(prixUnitaire) ? prixUnitaire : 0;
  return round2(q * p);
}

/**
 * Calcule l'intégralité d'une commande : totaux de lignes, sous-total,
 * montant de la remise et total TTC. Pur, sans effet de bord.
 */
export function computeCommande(input: CommandeCalcInput): CommandeCalculee {
  const lignes: LigneCalculee[] = input.lignes.map((l) => ({
    ...l,
    totalLigne: lineTotal(l.quantite, l.prixUnitaire),
  }));

  const sousTotal = round2(lignes.reduce((s, l) => s + l.totalLigne, 0));

  let montantRemise = 0;
  if (input.remiseType === "POURCENTAGE") {
    montantRemise = round2(sousTotal * (clamp(input.remiseValeur, 0, 100) / 100));
  } else if (input.remiseType === "MONTANT") {
    montantRemise = round2(clamp(input.remiseValeur, 0, sousTotal));
  }

  const totalTTC = round2(Math.max(sousTotal - montantRemise, 0));

  return { lignes, sousTotal, montantRemise, totalTTC };
}
