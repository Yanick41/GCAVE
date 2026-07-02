import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfMoney } from "./bilan";

const COMPANY = "LA GRANDE CAVE";

export interface RecuData {
  clientNom: string;
  date: Date;
  montant: number;
  mode: string;
  observation?: string | null;
}

export interface RecuLabels {
  title: string;
  client: string;
  date: string;
  amount: string;
  mode: string;
  observation: string;
}

/** Génère le reçu d'un paiement (téléchargement ou impression). */
export function genererRecuPDF(
  data: RecuData,
  lang: Lang,
  labels: RecuLabels,
  action: "download" | "print",
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête
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
  doc.text(labels.title, 14, 33);

  const rows: string[][] = [
    [labels.client, data.clientNom],
    [labels.date, formatDate(data.date, lang)],
    [labels.mode, data.mode],
    [labels.amount, pdfMoney(data.montant)],
  ];
  if (data.observation) rows.push([labels.observation, data.observation]);

  autoTable(doc, {
    startY: 42,
    body: rows,
    theme: "plain",
    styles: { fontSize: 12 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold", textColor: [90, 90, 90] },
      1: { fontStyle: "bold" },
    },
  });

  const safeName = data.clientNom.replace(/\s+/g, "_");
  if (action === "download") {
    doc.save(`recu-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }
}
