import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfMoney } from "./bilan";

const COMPANY = "LA GRANDE CAVE";

export interface FactureLigne {
  nomProduit: string;
  quantite: number;
  prixUnitaire: number;
  totalLigne: number;
}

export interface FactureData {
  clientNom: string;
  date: Date;
  lignes: FactureLigne[];
  total: number;
  numero?: string;
  /** Ancien solde du client reporté sur la facture (optionnel). */
  ancienSolde?: number;
  /** paye/reste : optionnels (affichés seulement lors de la saisie initiale) */
  paye?: number;
  reste?: number;
}

export interface FactureLabels {
  title: string;
  client: string;
  date: string;
  product: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  total: string;
  subtotal: string;
  previousBalance: string;
  grandTotal: string;
  paid: string;
  remaining: string;
  stamp: string;
}

/** Génère la facture d'une commande (téléchargement ou impression). */
export function genererFacturePDF(
  data: FactureData,
  lang: Lang,
  labels: FactureLabels,
  action: "download" | "print",
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

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
  doc.text(data.numero ? `${labels.title} N° ${data.numero}` : labels.title, 14, 33);

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`${labels.client}: ${data.clientNom}`, 14, 43);
  doc.text(`${labels.date}: ${formatDate(data.date, lang)}`, 14, 49);

  // Lignes — en-têtes alignés à droite au-dessus des nombres
  autoTable(doc, {
    startY: 56,
    head: [
      [
        labels.product,
        { content: labels.qty, styles: { halign: "right" } },
        { content: labels.unitPrice, styles: { halign: "right" } },
        { content: labels.lineTotal, styles: { halign: "right" } },
      ],
    ],
    body: data.lignes.map((l) => [
      l.nomProduit,
      String(l.quantite),
      pdfMoney(l.prixUnitaire),
      pdfMoney(l.totalLigne),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  // Totaux
  // @ts-expect-error lastAutoTable est ajouté par le plugin
  const y = doc.lastAutoTable.finalY + 10;
  const hasAncien = data.ancienSolde !== undefined && data.ancienSolde !== 0;
  const grandTotal = data.total + (data.ancienSolde ?? 0);

  const totalsBody: string[][] = [];
  if (hasAncien) {
    totalsBody.push([labels.subtotal, pdfMoney(data.total)]);
    totalsBody.push([labels.previousBalance, pdfMoney(data.ancienSolde ?? 0)]);
    totalsBody.push([labels.grandTotal, pdfMoney(grandTotal)]);
  } else {
    totalsBody.push([labels.total, pdfMoney(data.total)]);
  }
  if (data.paye !== undefined) {
    totalsBody.push([labels.paid, pdfMoney(data.paye)]);
    totalsBody.push([labels.remaining, pdfMoney(data.reste ?? grandTotal - data.paye)]);
  }

  autoTable(doc, {
    startY: y,
    body: totalsBody,
    theme: "plain",
    styles: { fontSize: 12, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
  });

  // Zone signature & cachet (bas de page)
  // @ts-expect-error lastAutoTable est ajouté par le plugin
  const sy = Math.max(doc.lastAutoTable.finalY + 24, pageH - 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setDrawColor(80);
  doc.setLineWidth(0.4);
  const w = doc.getTextWidth(labels.stamp);
  const sx = pageW - 14 - w;
  doc.text(labels.stamp, sx, sy);
  doc.line(sx, sy + 2, sx + w, sy + 2);

  const safeName = data.clientNom.replace(/\s+/g, "_");
  if (action === "download") {
    doc.save(`facture-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
