import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfMoney } from "./bilan";
import { drawDocumentHeader } from "./company";

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
/** Construit le reçu (sans effet de bord : ni impression, ni fichier). */
export function construireRecuPDF(
  data: RecuData,
  lang: Lang,
  labels: RecuLabels,
): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête : logo + coordonnées de la société, identique à la facture
  const lineY = drawDocumentHeader(doc, { pageW, margin: 14, title: labels.title });

  const rows: string[][] = [
    [labels.client, data.clientNom],
    [labels.date, formatDate(data.date, lang)],
    [labels.mode, data.mode],
    [labels.amount, pdfMoney(data.montant)],
  ];
  if (data.observation) rows.push([labels.observation, data.observation]);

  autoTable(doc, {
    startY: lineY + 9,
    body: rows,
    theme: "plain",
    styles: { fontSize: 12 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold", textColor: [90, 90, 90] },
      1: { fontStyle: "bold" },
    },
  });

  return doc;
}

/** Génère le reçu d'un paiement (téléchargement ou impression). */
export function genererRecuPDF(
  data: RecuData,
  lang: Lang,
  labels: RecuLabels,
  action: "download" | "print",
) {
  const doc = construireRecuPDF(data, lang, labels);
  const safeName = data.clientNom.replace(/\s+/g, "_");
  if (action === "download") {
    doc.save(`recu-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }
}
