/**
 * Aperçu et impression des documents — types partagés.
 *
 * Un même modal sert TOUS les documents imprimables de l'application. Chaque
 * document est d'abord normalisé en `TicketModel` (ci-dessous), ce qui
 * concentre en un seul endroit les règles d'affichage — notamment
 * l'interdiction des prix sur un bon de commande.
 */
import type { BilanLabels } from "../../lib/bilan";
import type { FactureLigne } from "../../lib/facture";
import type { RapportLabels } from "../../lib/rapport";
import type { ClientDetail } from "../clients/api";
import type { RapportJour } from "../rapports/api";

/** Largeur de papier thermique, ou mise en page A4 classique. */
export type FormatImpression = "58" | "80" | "A4";

export type TypeDocument = "FACTURE" | "RECU" | "BON" | "BILAN" | "RAPPORT";

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

/** Relevé de compte d'un client : ses opérations et son solde. */
export interface BilanTicketData {
  client: ClientDetail;
  labels: BilanLabels;
}

/** Rapport d'activité d'une journée : commandes puis encaissements. */
export interface RapportTicketData {
  rapport: RapportJour;
  labels: RapportLabels;
}

export interface TicketLigne {
  designation: string;
  /**
   * Ligne de détail sous la désignation. Renseignée, elle remplace le
   * « quantité × prix unitaire » : c'est ainsi qu'un relevé affiche une date
   * là où une facture affiche un calcul.
   */
  detail?: string;
  /** Omis sur un bon de commande : aucun prix ne doit y figurer. */
  quantite?: number;
  /** Quantité telle qu'elle doit être imprimée (« 1/2 »), sinon déduite. */
  quantiteAffichee?: string;
  prixUnitaire?: number;
  total?: number;
  /**
   * Quantité réellement servie (bon de commande). Vide = emplacement laissé
   * libre pour l'annotation manuelle, comme sur le bon A4.
   */
  servi?: string | null;
}

/**
 * Bloc de lignes. Un seul groupe sans titre pour une facture ; plusieurs
 * groupes titrés pour un rapport (commandes, puis encaissements).
 */
export interface TicketGroupe {
  titre?: string;
  lignes: TicketLigne[];
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
  clientNom?: string | null;
  clientTelephone?: string | null;
  groupes: TicketGroupe[];
  /** false ⇒ ni prix unitaire, ni montant, ni total (bon de commande). */
  afficherPrix: boolean;
  totaux: TicketTotal[];
  note?: string | null;
}
