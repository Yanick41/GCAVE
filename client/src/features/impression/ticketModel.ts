/**
 * Normalisation des documents vers un modèle de ticket unique.
 *
 * Chaque type de document est converti ici, ce qui garantit un rendu cohérent
 * et surtout concentre en UN SEUL endroit la règle métier : un bon de commande
 * ne porte AUCUN prix (`afficherPrix: false`, lignes sans prix unitaire ni
 * total, aucun total monétaire).
 */
import { etatPaiement, type Lang } from "@gca/shared";
import type { BonData } from "../../lib/bon";
import type { FactureData } from "../../lib/facture";
import type {
  BilanTicketData,
  RapportTicketData,
  RecuTicketData,
  TicketModel,
  TicketTotal,
} from "./types";

/** Fonction de traduction (signature compatible avec `t` de react-i18next). */
export type Traduire = (cle: string) => string;

/** Entier formaté avec séparateur d'espace, sans devise (FCFA sans centimes). */
export function montantTicket(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Date courte pour les lignes d'un relevé ou d'un rapport. */
function jour(date: Date | string, lang: Lang): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "fr-FR", {
    dateStyle: "short",
  }).format(d);
}

export function factureVersTicket(data: FactureData, t: Traduire): TicketModel {
  // Facture indépendante : son propre total, sans report.
  const net = data.total;
  const paye = data.paiements?.length
    ? data.paiements.reduce((s, p) => s + p.montant, 0)
    : (data.paye ?? 0);
  const etat = etatPaiement(net, paye);

  const totaux: TicketTotal[] = [
    { label: t("impression:ticket.total"), valeur: montantTicket(net), fort: true },
  ];
  // Sans acompte, la facture se résume à son net à payer.
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
    groupes: [
      {
        lignes: data.lignes.map((l) => ({
          designation: l.nomProduit,
          quantite: l.quantite,
          quantiteAffichee: l.quantiteAffichee,
          prixUnitaire: l.prixUnitaire,
          total: l.totalLigne,
        })),
      },
    ],
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
  if (cmd) totaux.push({ label: t("impression:ticket.total"), valeur: montantTicket(cmd.totalDu) });
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
    groupes: [
      {
        lignes: (cmd?.lignes ?? []).map((l) => ({
          designation: l.nomProduit,
          quantite: l.quantite,
          quantiteAffichee: l.quantiteAffichee,
          prixUnitaire: l.prixUnitaire,
          total: l.totalLigne,
        })),
      },
    ],
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
    groupes: [
      {
        lignes: data.lignes.map((l) => ({
          designation: l.designation,
          quantite: l.quantite,
          quantiteAffichee: l.quantiteAffichee,
          servi: l.servi,
        })),
      },
    ],
    afficherPrix: false,
    totaux: [
      { label: t("impression:ticket.totalQty"), valeur: montantTicket(data.totalQuantite), fort: true },
    ],
    note: data.notes ?? null,
  };
}

export function bilanVersTicket(
  { client, labels }: BilanTicketData,
  t: Traduire,
  lang: Lang,
): TicketModel {
  // Relevé de compte : chaque opération porte sa date en détail, et son
  // montant à droite. Le signe distingue un débit d'un encaissement.
  return {
    type: "BILAN",
    titre: t("impression:docTitle.BILAN"),
    date: new Date(),
    clientNom: client.nom,
    clientTelephone: client.telephone,
    groupes: [
      {
        lignes: client.historique.map((op) => ({
          designation: `${op.type === "PAIEMENT" ? "−" : "+"} ${op.ref ?? t(`impression:ticket.op.${op.type}`)}`,
          detail: jour(op.date, lang),
          total: op.montant,
        })),
      },
    ],
    afficherPrix: true,
    totaux: [
      { label: labels.totalOrders, valeur: montantTicket(client.totalCommandes) },
      { label: labels.totalPayments, valeur: montantTicket(client.totalPaiements) },
      { label: labels.balance, valeur: montantTicket(client.solde), fort: true },
    ],
    note: null,
  };
}

export function rapportVersTicket(
  { rapport, labels }: RapportTicketData,
  t: Traduire,
  lang: Lang,
): TicketModel {
  // Deux blocs distincts : les commandes du jour, puis les encaissements.
  return {
    type: "RAPPORT",
    titre: t("impression:docTitle.RAPPORT"),
    date: new Date(rapport.date),
    groupes: [
      {
        titre: labels.orders,
        lignes: rapport.commandes.map((c) => ({
          designation: c.numero,
          detail: c.clientNom,
          total: Number(c.totalTTC),
        })),
      },
      {
        titre: labels.payments,
        lignes: rapport.paiements.map((p) => ({
          designation: labels.modes[p.mode] ?? p.mode,
          detail: `${p.clientNom} · ${jour(p.date, lang)}`,
          total: Number(p.montant),
        })),
      },
    ],
    afficherPrix: true,
    totaux: [
      { label: labels.revenue, valeur: montantTicket(rapport.totalCommandes) },
      { label: labels.collected, valeur: montantTicket(rapport.totalPaiements), fort: true },
    ],
    note: null,
  };
}
