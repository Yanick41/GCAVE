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

// ── État de règlement d'une commande ─────────────────────────────────
// Une commande peut recevoir PLUSIEURS paiements partiels (relation
// Commande 1—N Paiement). L'état ci-dessous est la SOURCE DE VÉRITÉ
// UNIQUE utilisée par l'API, l'interface et la facture PDF.

export type StatutPaiement = "NON_PAYEE" | "PARTIELLE" | "PAYEE";

export interface EtatPaiement {
  /** Montant réclamé sur CETTE facture = son propre total TTC, sans aucun report. */
  totalDu: number;
  /** Somme des paiements rattachés à la commande. */
  totalPaye: number;
  /** Reste à payer (jamais négatif). */
  reste: number;
  /** Excédent encaissé au-delà du total dû (avoir client), sinon 0. */
  tropPercu: number;
  statut: StatutPaiement;
}

/**
 * Calcule l'état de règlement d'une commande à partir du total dû et de la
 * somme des paiements rattachés. Tolère les centimes d'arrondi : un reste
 * inférieur à 0,01 F est considéré comme soldé.
 */
export function etatPaiement(totalDu: number, totalPaye: number): EtatPaiement {
  const du = round2(Math.max(totalDu || 0, 0));
  const paye = round2(Math.max(totalPaye || 0, 0));
  const delta = round2(du - paye);
  const reste = delta > 0 ? delta : 0;
  const tropPercu = delta < 0 ? round2(-delta) : 0;
  const statut: StatutPaiement =
    paye <= 0 ? "NON_PAYEE" : reste <= 0 ? "PAYEE" : "PARTIELLE";
  return { totalDu: du, totalPaye: paye, reste, tropPercu, statut };
}

/**
 * Raccourci : état de règlement d'une commande.
 *
 * CHAQUE FACTURE EST INDÉPENDANTE : le montant dû est le total de la commande
 * elle-même. Aucun solde antérieur, aucune autre commande du client n'entre
 * dans ce calcul — seuls comptent ses propres lignes et ses propres règlements.
 */
export function etatPaiementCommande(totalTTC: number, totalPaye: number): EtatPaiement {
  return etatPaiement(round2(totalTTC), totalPaye);
}

/** Champs d'une commande nécessaires au calcul de son règlement. */
export interface CommandeReglement {
  totalTTC: number;
  /** Acompte figé (ancien suivi) ou somme resynchronisée (nouveau suivi). */
  montantPaye: number;
  /** Régime de suivi, posé à la création de la commande. */
  utiliseNouveauSuiviPaiement: boolean;
}

/**
 * État de règlement d'une commande — POINT D'ENTRÉE UNIQUE (API, interface, PDF).
 *
 * Le régime de suivi est déterminé par le SEUL drapeau
 * `utiliseNouveauSuiviPaiement`, jamais par la présence ou l'absence de
 * paiements rattachés : une commande de l'ancien système sans paiement
 * rattaché n'est pas une commande légitimement à zéro.
 *
 * • Drapeau à false (commandes antérieures au déploiement) : le montant payé
 *   reste `montantPaye`, exactement comme avant. Un éventuel paiement rattaché
 *   à la main est ignoré dans ce calcul.
 * • Drapeau à true (commandes créées depuis) : le montant payé est la somme
 *   des paiements rattachés.
 */
export function reglementCommande(
  commande: CommandeReglement,
  paiementsRattaches: { montant: number }[],
): EtatPaiement {
  const totalPaye = commande.utiliseNouveauSuiviPaiement
    ? paiementsRattaches.reduce((s, p) => s + (p.montant || 0), 0)
    : commande.montantPaye;
  return etatPaiementCommande(commande.totalTTC, totalPaye);
}

/** Solde d'un compte client = solde initial (repris du papier) + total des
 *  commandes − total des paiements. Positif = le client doit de l'argent.
 *  SOURCE DE VÉRITÉ UNIQUE : utilisée partout (fiche, liste, dashboard). */
export function soldeClient(
  soldeInitial: number,
  totalCommandes: number,
  totalPaiements: number,
): number {
  return round2((soldeInitial || 0) + (totalCommandes || 0) - (totalPaiements || 0));
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

/**
 * Prix unitaire déduit d'un montant de ligne saisi à la main.
 *
 * Saisir directement le « Montant » d'une ligne est plus rapide que de calculer
 * le prix unitaire de tête ; on remonte donc au prix unitaire, qui reste la
 * donnée stockée (total_ligne = quantité × prix_unitaire, CDC §5.3).
 * Quantité nulle ou invalide → 0, plutôt qu'une division par zéro.
 */
export function prixUnitaireDepuisTotal(totalLigne: number, quantite: number): number {
  const t = Number.isFinite(totalLigne) ? Math.max(totalLigne, 0) : 0;
  const q = Number.isFinite(quantite) ? quantite : 0;
  if (q <= 0) return 0;
  return round2(t / q);
}

// ── Quantités fractionnées ───────────────────────────────────────────
// Certains articles se vendent en demi ou en quart. La saisie accepte donc
// « 1/2 » autant que « 0.5 » ou « 3 ». Le CALCUL se fait toujours sur la
// valeur décimale ; le texte saisi n'est conservé que pour l'AFFICHAGE, afin
// que le client relise sur sa facture exactement ce qui a été tapé.
//
// Analyseur PARTAGÉ client/serveur : le navigateur guide la saisie, mais c'est
// le serveur qui refuse pour de bon une division par zéro ou une quantité nulle.

export type MotifQuantiteInvalide = "VIDE" | "FORMAT" | "DIVISION_ZERO" | "NON_POSITIF";

export interface QuantiteAnalysee {
  /** Valeur pour le calcul ; 0 si la saisie est invalide. */
  valeur: number;
  valide: boolean;
  motif?: MotifQuantiteInvalide;
}

const NOMBRE = String.raw`\d+(?:[.,]\d+)?`;
// String.raw impératif : dans un gabarit ordinaire, `\s` se réduirait à « s »
// et le motif exigerait des lettres s autour de la barre de fraction.
const RE_FRACTION = new RegExp(String.raw`^(${NOMBRE})\s*/\s*(${NOMBRE})$`);
// Nombre mixte : « 2 1/2 » vaut deux et demi. Éprouvé AVANT la fraction
// simple, qui ne reconnaîtrait pas la partie entière et rejetterait la saisie.
const RE_MIXTE = new RegExp(String.raw`^(\d+)\s+(${NOMBRE})\s*/\s*(${NOMBRE})$`);
const RE_NOMBRE = new RegExp(`^${NOMBRE}$`);

const versNombre = (s: string) => parseFloat(s.replace(",", "."));

/**
 * Analyse une quantité saisie : entier, décimal ou fraction « a/b ».
 * Les signes et le texte libre sont refusés — une quantité est positive.
 */
export function analyserQuantite(texte: string): QuantiteAnalysee {
  const t = (texte ?? "").trim().replace(/\s+/g, " ");
  if (t === "") return { valeur: 0, valide: false, motif: "VIDE" };

  const mixte = RE_MIXTE.exec(t);
  if (mixte) {
    const entier = versNombre(mixte[1]);
    const denominateur = versNombre(mixte[3]);
    if (denominateur === 0) return { valeur: 0, valide: false, motif: "DIVISION_ZERO" };
    const valeur = Math.round((entier + versNombre(mixte[2]) / denominateur) * 1000) / 1000;
    if (valeur <= 0) return { valeur: 0, valide: false, motif: "NON_POSITIF" };
    return { valeur, valide: true };
  }

  const fraction = RE_FRACTION.exec(t);
  if (fraction) {
    const numerateur = versNombre(fraction[1]);
    const denominateur = versNombre(fraction[2]);
    // Refus explicite : une division par zéro donnerait Infinity et
    // contaminerait silencieusement tous les totaux.
    if (denominateur === 0) return { valeur: 0, valide: false, motif: "DIVISION_ZERO" };
    const valeur = round2(numerateur / denominateur);
    if (valeur <= 0) return { valeur: 0, valide: false, motif: "NON_POSITIF" };
    return { valeur: Math.round((numerateur / denominateur) * 1000) / 1000, valide: true };
  }

  if (RE_NOMBRE.test(t)) {
    const valeur = versNombre(t);
    if (valeur <= 0) return { valeur: 0, valide: false, motif: "NON_POSITIF" };
    return { valeur, valide: true };
  }

  return { valeur: 0, valide: false, motif: "FORMAT" };
}

/**
 * Quantité telle qu'elle doit être imprimée ou affichée.
 *
 * On réaffiche le texte saisi (« 1/2 ») quand il correspond bien à la valeur
 * stockée ; sinon on formate le décimal, sans JAMAIS arrondir à l'entier —
 * une quantité de 0,25 affichée « 0 » rendrait le document incohérent.
 */
export function formatterQuantite(valeur: number, saisie?: string | null): string {
  if (saisie && saisie.trim() !== "") {
    const analyse = analyserQuantite(saisie);
    // Le texte ne prime que s'il désigne bien la valeur enregistrée : une
    // ligne modifiée depuis sa saisie ne doit pas afficher l'ancienne écriture.
    if (analyse.valide && Math.abs(analyse.valeur - valeur) < 0.0005) return saisie.trim();
  }
  const n = Number.isFinite(valeur) ? valeur : 0;
  return String(Math.round(n * 1000) / 1000);
}
