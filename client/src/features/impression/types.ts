/**
 * Aperçu et impression des documents — types partagés.
 *
 * Un même modal sert la facture, le reçu et le bon de commande. Chaque
 * document est d'abord normalisé en `TicketModel` (ci-dessous), ce qui
 * concentre en un seul endroit les règles d'affichage — notamment
 * l'interdiction des prix sur un bon de commande.
 */
import type { FactureLigne } from "../../lib/facture";

/** Largeur de papier thermique, ou mise en page A4 classique. */
export type FormatImpression = "58" | "80" | "A4";

export type TypeDocument = "FACTURE" | "RECU" | "BON";

/** Reçu de paiement enrichi des lignes de la commande réglée, si elle existe. */
export interface RecuTicketData {
  clientNom: string;
  date: Date;
  montant: number;
  mode: string;
  observation?: string | null;
  /** Commande réglée par ce paiement — absente pour un paiement libre. */
  commande?: {
    numero: string;
    lignes: FactureLigne[];
    totalDu: number;
    totalPaye: number;
    reste: number;
  } | null;
}

export interface TicketLigne {
  designation: string;
  quantite: number;
  /** Omis sur un bon de commande : aucun prix ne doit y figurer. */
  prixUnitaire?: number;
  total?: number;
  /**
   * Quantité réellement servie (bon de commande). Vide = emplacement laissé
   * libre pour l'annotation manuelle, comme sur le bon A4.
   */
  servi?: string | null;
}

export interface TicketTotal {
  label: string;
  valeur: string;
  /** Mis en avant (gras, corps plus grand) : le total, le solde. */
  fort?: boolean;
}

/** Représentation neutre d'un document, prête à être rendue en ticket. */
export interface TicketModel {
  type: TypeDocument;
  titre: string;
  numero?: string | null;
  date: Date;
  clientNom: string;
  clientTelephone?: string | null;
  lignes: TicketLigne[];
  /** false ⇒ ni prix unitaire, ni montant, ni total (bon de commande). */
  afficherPrix: boolean;
  totaux: TicketTotal[];
  note?: string | null;
}
