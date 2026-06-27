import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClientDetail } from "../features/clients/api";

const COMPANY = "LA GRANDE CAVE";

interface Labels {
  subtitle: string;
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
  clientSignature: string;
  managerSignature: string;
  modes: Record<string, string>;
}

/** Montant lisible dans le PDF : espaces normaux (pas d'insécable fin) + FCFA. */
export function pdfMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.round(Math.abs(n));
  return sign + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

/** Génère et télécharge le bilan PDF d'un client (CDC §7). */
export function genererBilanPDF(client: ClientDetail, lang: Lang, labels: Labels) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // En-tête : nom de l'entreprise
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(COMPANY, 14, 20);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(14, 24, pageW - 14, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(90);
  doc.text(labels.subtitle, 14, 33);

  // Infos client
  doc.setFontSize(11);
  doc.text(`${labels.client}: ${client.nom}`, 14, 43);
  doc.text(`${labels.phone}: ${client.telephone}`, 14, 49);
  let infoY = 55;
  if (client.adresse) {
    doc.text(`${labels.address}: ${client.adresse}`, 14, infoY);
    infoY += 6;
  }

  let y = infoY + 8;

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
      pdfMoney(Number(c.totalTTC)),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "right" } },
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
      pdfMoney(Number(p.montant)),
      labels.modes[p.mode] ?? p.mode,
    ]),
    theme: "striped",
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  y = doc.lastAutoTable.finalY + 12;

  // Totaux
  autoTable(doc, {
    startY: y,
    body: [
      [labels.totalPayments, pdfMoney(client.totalPaiements)],
      [labels.balance, pdfMoney(client.solde)],
    ],
    theme: "plain",
    styles: { fontSize: 11, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
  });

  // Signatures + cachet (bas de page)
  // @ts-expect-error lastAutoTable est ajouté par le plugin
  const afterTotals = doc.lastAutoTable.finalY + 20;
  const sy = Math.max(afterTotals, pageH - 45);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20);
  doc.setDrawColor(80);
  doc.setLineWidth(0.4);

  // Colonne gauche : signature client (libellé souligné, sans cadre)
  doc.text(labels.clientSignature, 16, sy);
  doc.line(16, sy + 2, 16 + doc.getTextWidth(labels.clientSignature), sy + 2);

  // Colonne droite : signature + cachet gérant — aligné sur la marge droite
  const mw = doc.getTextWidth(labels.managerSignature);
  const mx = pageW - 14 - mw;
  doc.text(labels.managerSignature, mx, sy);
  doc.line(mx, sy + 2, mx + mw, sy + 2);

  doc.save(`bilan-${client.nom.replace(/\s+/g, "_")}.pdf`);
}
