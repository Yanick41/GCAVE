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
  paid: string;
  remaining: string;
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

  // Lignes
  autoTable(doc, {
    startY: 56,
    head: [[labels.product, labels.qty, labels.unitPrice, labels.lineTotal]],
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

  // @ts-expect-error lastAutoTable est ajouté par le plugin
  const y = doc.lastAutoTable.finalY + 10;
  const totalsBody: string[][] = [[labels.total, pdfMoney(data.total)]];
  if (data.paye !== undefined) {
    totalsBody.push([labels.paid, pdfMoney(data.paye)]);
    totalsBody.push([labels.remaining, pdfMoney(data.reste ?? data.total - data.paye)]);
  }
  autoTable(doc, {
    startY: y,
    body: totalsBody,
    theme: "plain",
    styles: { fontSize: 12, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
  });

  const safeName = data.clientNom.replace(/\s+/g, "_");
  if (action === "download") {
    doc.save(`facture-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
