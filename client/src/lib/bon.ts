import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COMPANY = "LA GRANDE CAVE";

export interface BonLigne {
  designation: string;
  quantite: number;
  servi: string | null;
}

export interface BonData {
  numero: string;
  clientNom: string;
  date: Date;
  telephone?: string | null;
  adresseLivraison?: string | null;
  lignes: BonLigne[];
  totalQuantite: number;
  notes?: string | null;
}

export interface BonLabels {
  title: string; // "Bon de commande"
  client: string;
  date: string;
  phone: string;
  deliveryAddress: string;
  designation: string;
  qty: string;
  served: string;
  totalQty: string;
  notes: string;
  clientSignature: string;
  managerSignature: string;
}

/** Génère le PDF d'un bon de commande (téléchargement ou impression). */
export function genererBonPDF(
  data: BonData,
  lang: Lang,
  labels: BonLabels,
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
  doc.text(`${labels.title} N° ${data.numero}`, 14, 33);

  // Infos client / livraison
  doc.setFontSize(11);
  doc.setTextColor(20);
  let y = 43;
  doc.text(`${labels.client}: ${data.clientNom}`, 14, y);
  y += 6;
  doc.text(`${labels.date}: ${formatDate(data.date, lang)}`, 14, y);
  if (data.telephone) {
    y += 6;
    doc.text(`${labels.phone}: ${data.telephone}`, 14, y);
  }
  if (data.adresseLivraison) {
    y += 6;
    doc.text(`${labels.deliveryAddress}: ${data.adresseLivraison}`, 14, y);
  }

  // Tableau produits — Désignation, Quantité, Servi
  autoTable(doc, {
    startY: y + 7,
    head: [
      [
        labels.designation,
        { content: labels.qty, styles: { halign: "right" } },
        { content: labels.served, styles: { halign: "right" } },
      ],
    ],
    body: data.lignes.map((l) => [
      l.designation,
      String(l.quantite),
      l.servi ?? "",
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 },
    columnStyles: {
      1: { halign: "right", cellWidth: 30 },
      2: { halign: "right", cellWidth: 40 },
    },
  });

  // Total quantité
  // @ts-expect-error lastAutoTable est ajouté par le plugin
  let ty = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  const totalLabel = `${labels.totalQty}: ${data.totalQuantite}`;
  doc.text(totalLabel, pageW - 14 - doc.getTextWidth(totalLabel), ty);

  // Notes
  if (data.notes && data.notes.trim()) {
    ty += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${labels.notes}:`, 14, ty);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(data.notes, pageW - 28);
    doc.text(wrapped, 14, ty + 6);
  }

  // Zones de signature (bas de page)
  const sy = pageH - 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.setDrawColor(120);
  doc.setLineWidth(0.4);
  doc.line(20, sy, 85, sy);
  doc.line(pageW - 85, sy, pageW - 20, sy);
  doc.text(labels.clientSignature, 20, sy + 6);
  doc.text(labels.managerSignature, pageW - 85, sy + 6);

  const safeName = `${data.numero}-${data.clientNom.replace(/\s+/g, "_")}`;
  if (action === "download") {
    doc.save(`bon-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
