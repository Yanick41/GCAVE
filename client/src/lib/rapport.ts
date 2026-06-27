import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RapportJour } from "../features/rapports/api";
import { pdfMoney } from "./bilan";

const COMPANY = "LA GRANDE CAVE";

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

export function genererRapportPDF(
  data: RapportJour,
  labels: RapportLabels,
  action: "download" | "print",
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(COMPANY, 14, 20);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(14, 24, pageW - 14, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(90);
  doc.text(`${labels.title} — ${data.date}`, 14, 33);

  // Synthèse
  autoTable(doc, {
    startY: 40,
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

  if (action === "download") {
    doc.save(`rapport-${data.date}.pdf`);
  } else {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }
}
