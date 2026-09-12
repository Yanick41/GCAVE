/**
 * Normalisation des documents vers un modèle de ticket unique.
 *
 * Chaque type de document (facture, reçu, bon) est converti ici, ce qui
 * garantit un rendu cohérent et surtout concentre en UN SEUL endroit la règle
 * métier : un bon de commande ne porte AUCUN prix (`afficherPrix: false`,
 * lignes sans prix unitaire ni total, aucun total monétaire).
 */
import { etatPaiement } from "@gca/shared";
import type { BonData } from "../../lib/bon";
import type { FactureData } from "../../lib/facture";
import type { RecuTicketData, TicketModel, TicketTotal } from "./types";

/** Fonction de traduction (signature compatible avec `t` de react-i18next). */
export type Traduire = (cle: string) => string;

/** Entier formaté avec séparateur d'espace, sans devise (FCFA sans centimes). */
export function montantTicket(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function factureVersTicket(data: FactureData, t: Traduire): TicketModel {
  const net = data.total + (data.ancienSolde ?? 0);
  const paye = data.paiements?.length
    ? data.paiements.reduce((s, p) => s + p.montant, 0)
    : (data.paye ?? 0);
  const etat = etatPaiement(net, paye);

  const totaux: TicketTotal[] = [];
  if (data.ancienSolde) {
    totaux.push({ label: t("impression:ticket.subtotal"), valeur: montantTicket(data.total) });
    totaux.push({
      label: t("impression:ticket.previousBalance"),
      valeur: montantTicket(data.ancienSolde),
    });
  }
  totaux.push({ label: t("impression:ticket.total"), valeur: montantTicket(net), fort: true });
  if (etat.totalPaye > 0) {
    totaux.push({ label: t("impression:ticket.paid"), valeur: montantTicket(etat.totalPaye) });
    totaux.push(
      etat.tropPercu > 0
        ? { label: t("impression:ticket.overpaid"), valeur: montantTicket(etat.tropPercu), fort: true }
        : { label: t("impression:ticket.remaining"), valeur: montantTicket(etat.reste), fort: true },
    );
  }

  return {
    type: "FACTURE",
    titre: t("impression:docTitle.FACTURE"),
    numero: data.numero ?? null,
    date: data.date,
    clientNom: data.clientNom,
    clientTelephone: data.clientTelephone,
    lignes: data.lignes.map((l) => ({
      designation: l.nomProduit,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      total: l.totalLigne,
    })),
    afficherPrix: true,
    totaux,
    note: etat.totalPaye > 0 && etat.reste <= 0 ? t("impression:ticket.settled") : null,
  };
}

export function recuVersTicket(data: RecuTicketData, t: Traduire): TicketModel {
  // Un paiement rattaché à une commande reprend les lignes de celle-ci ; un
  // paiement libre se réduit au montant encaissé (il n'a pas d'articles).
  const cmd = data.commande ?? null;

  const totaux: TicketTotal[] = [];
  if (cmd) {
    totaux.push({ label: t("impression:ticket.total"), valeur: montantTicket(cmd.totalDu) });
  }
  totaux.push({ label: t("impression:ticket.paid"), valeur: montantTicket(data.montant), fort: true });
  totaux.push({ label: t("impression:ticket.mode"), valeur: data.mode });
  if (cmd) {
    totaux.push({
      label: t("impression:ticket.remaining"),
      valeur: montantTicket(cmd.reste),
      fort: cmd.reste > 0,
    });
  }

  return {
    type: "RECU",
    titre: t("impression:docTitle.RECU"),
    numero: cmd?.numero ?? null,
    date: data.date,
    clientNom: data.clientNom,
    lignes: (cmd?.lignes ?? []).map((l) => ({
      designation: l.nomProduit,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      total: l.totalLigne,
    })),
    afficherPrix: true,
    totaux,
    note: cmd && cmd.reste <= 0 ? t("impression:ticket.settled") : (data.observation ?? null),
  };
}

export function bonVersTicket(data: BonData, t: Traduire): TicketModel {
  // AUCUN prix : ni prix unitaire, ni montant de ligne, ni total monétaire.
  // Seul un cumul de QUANTITÉS est affiché, comme sur le bon A4.
  return {
    type: "BON",
    titre: t("impression:docTitle.BON"),
    numero: data.numero,
    date: data.date,
    clientNom: data.clientNom,
    clientTelephone: data.telephone,
    lignes: data.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite })),
    afficherPrix: false,
    totaux: [
      {
        label: t("impression:ticket.totalQty"),
        valeur: montantTicket(data.totalQuantite),
        fort: true,
      },
    ],
    note: data.notes ?? null,
  };
}
