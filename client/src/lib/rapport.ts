import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RapportJour } from "../features/rapports/api";
import { pdfMoney } from "./bilan";
import { drawDocumentHeader } from "./company";

export interface RapportLabels {
  title: string;
  date: string;
  orders: string;
  revenue: string;
  collected: string;
  number: string;
  client: string;
  amount: string;
  mode: string;
  payments: string;
  modes: Record<string, string>;
}

/** Construit le rapport (sans effet de bord : ni impression, ni fichier). */
export function construireRapportPDF(data: RapportJour, labels: RapportLabels): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête : logo + coordonnées de la société, identique à la facture
  const lineY = drawDocumentHeader(doc, { pageW, margin: 14, title: `${labels.title} — ${data.date}` });

  // Synthèse
  autoTable(doc, {
    startY: lineY + 9,
    body: [
      [labels.orders, String(data.nbCommandes)],
      [labels.revenue, pdfMoney(data.totalCommandes)],
      [labels.collected, pdfMoney(data.totalPaiements)],
    ],
    theme: "plain",
    styles: { fontSize: 11, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  let y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(labels.orders, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [[labels.number, labels.client, labels.amount]],
    body: data.commandes.map((c) => [c.numero, c.clientNom, pdfMoney(c.totalTTC)]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "right" } },
  });

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(13);
  doc.text(labels.payments, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [[labels.client, labels.amount, labels.mode]],
    body: data.paiements.map((p) => [
      p.clientNom,
      pdfMoney(p.montant),
      labels.modes[p.mode] ?? p.mode,
    ]),
    theme: "striped",
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  return doc;
}

/** Génère le rapport du jour (téléchargement ou impression). */
export function genererRapportPDF(
  data: RapportJour,
  labels: RapportLabels,
  action: "download" | "print",
) {
  const doc = construireRapportPDF(data, labels);
  if (action === "download") {
    doc.save(`rapport-${data.date}.pdf`);
  } else {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }
}
