import { formatDate, formatMoney, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClientDetail } from "../features/clients/api";

interface Labels {
  title: string;
  client: string;
  phone: string;
  address: string;
  since: string;
  orders: string;
  payments: string;
  number: string;
  date: string;
  amount: string;
  mode: string;
  totalOrders: string;
  totalPayments: string;
  balance: string;
  modes: Record<string, string>;
}

/** Génère et télécharge le bilan PDF d'un client (CDC §7). */
export function genererBilanPDF(client: ClientDetail, lang: Lang, labels: Labels) {
  const doc = new jsPDF();
  const money = (n: number) => formatMoney(n, lang);

  // En-tête
  doc.setFontSize(18);
  doc.text(labels.title, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${labels.client}: ${client.nom}`, 14, 30);
  doc.text(`${labels.phone}: ${client.telephone}`, 14, 36);
  if (client.adresse) doc.text(`${labels.address}: ${client.adresse}`, 14, 42);
  doc.text(`${labels.since}: ${formatDate(client.createdAt, lang)}`, 14, client.adresse ? 48 : 42);

  let y = (client.adresse ? 48 : 42) + 10;

  // Commandes
  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.text(labels.orders, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [[labels.number, labels.date, labels.amount]],
    body: client.commandes.map((c) => [
      c.numero,
      formatDate(c.date, lang),
      money(Number(c.totalTTC)),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  y = doc.lastAutoTable.finalY + 12;

  // Paiements
  doc.setFontSize(13);
  doc.text(labels.payments, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [[labels.date, labels.amount, labels.mode]],
    body: client.paiements.map((p) => [
      formatDate(p.date, lang),
      money(Number(p.montant)),
      labels.modes[p.mode] ?? p.mode,
    ]),
    theme: "striped",
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  y = doc.lastAutoTable.finalY + 12;

  // Totaux
  autoTable(doc, {
    startY: y,
    body: [
      [labels.totalOrders, money(client.totalCommandes)],
      [labels.totalPayments, money(client.totalPaiements)],
      [labels.balance, money(client.solde)],
    ],
    theme: "plain",
    styles: { fontSize: 11, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
  });

  doc.save(`bilan-${client.nom.replace(/\s+/g, "_")}.pdf`);
}
