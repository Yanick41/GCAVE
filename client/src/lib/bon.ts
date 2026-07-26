import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY, drawDocumentHeader } from "./company";
import { pdfNombre } from "./facture";

export type StatutBon = "LIVRE" | "PAYE" | "CONVERTI";

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
  montant?: number;
  statut?: StatutBon;
  notes?: string | null;
}

// ── Libellés bilingues (le PDF est autonome) ─────────────────────────
const L = {
  fr: {
    title: "BON DE COMMANDE",
    client: "CLIENT",
    type: "Type",
    typeValue: "Bon de commande",
    number: "N° Bon",
    date: "Date",
    phone: "N° Téléphone",
    status: "Statut",
    deliveryAddress: "Adresse de livraison",
    designation: "Référence / Désignation de l'Article",
    qty: "Quantité",
    served: "Servi",
    totalQty: "Total quantité",
    amountToPay: "MONTANT À PAYER",
    inWords: "Arrêté le présent bon à la somme de :",
    francs: "francs CFA",
    notes: "Notes",
    clientSignature: "Signature du client",
    stamp: "Cachet & signature",
    statuses: { LIVRE: "Livré", PAYE: "Payé", CONVERTI: "Converti" },
  },
  en: {
    title: "PURCHASE ORDER",
    client: "CUSTOMER",
    type: "Type",
    typeValue: "Purchase order",
    number: "Order No.",
    date: "Date",
    phone: "Phone",
    status: "Status",
    deliveryAddress: "Delivery address",
    designation: "Item / Description",
    qty: "Quantity",
    served: "Served",
    totalQty: "Total quantity",
    amountToPay: "AMOUNT DUE",
    inWords: "This order is set at the sum of:",
    francs: "CFA francs",
    notes: "Notes",
    clientSignature: "Customer signature",
    stamp: "Stamp & signature",
    statuses: { LIVRE: "Delivered", PAYE: "Paid", CONVERTI: "Converted" },
  },
} as const;

/** Génère le PDF d'un bon de commande, même format que la facture (sans prix). */
export function genererBonPDF(data: BonData, lang: Lang, action: "download" | "print") {
  const t = L[lang === "en" ? "en" : "fr"];
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;

  // ── En-tête : logo + identité (gauche) + titre (droite) ──
  const lineY = drawDocumentHeader(doc, { pageW, margin: M, title: t.title });

  // ── Encadré client (droite) ──
  const boxX = 116;
  const boxW = pageW - M - boxX;
  const boxY = lineY + 5;
  const boxH = 30;
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.rect(boxX, boxY, boxW, boxH);
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text(t.client, boxX + 3, boxY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(data.clientNom, boxX + 3, boxY + 12, { maxWidth: boxW - 6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  let cy = boxY + 18;
  if (data.telephone) {
    doc.text(String(data.telephone), boxX + 3, cy);
    cy += 5;
  }
  if (data.adresseLivraison) {
    doc.text(`${t.deliveryAddress}: ${data.adresseLivraison}`, boxX + 3, cy, {
      maxWidth: boxW - 6,
    });
  }

  // ── Table méta : Type | N° Bon | Date | Téléphone ──
  autoTable(doc, {
    startY: boxY + boxH + 5,
    head: [[t.type, t.number, t.date, t.phone]],
    body: [[t.typeValue, data.numero, formatDate(data.date, lang), data.telephone ?? "—"]],
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: 40, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 20 },
    styles: { cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.2 },
  });

  // ── Table produits : Désignation | Quantité | Servi ──
  const n = data.lignes.length;
  const fs = n > 34 ? 6 : n > 26 ? 6.5 : n > 20 ? 7 : n > 14 ? 8 : 9;
  const pad = n > 34 ? 0.9 : n > 26 ? 1.1 : n > 20 ? 1.4 : n > 14 ? 1.8 : 2.5;

  // @ts-expect-error lastAutoTable ajouté par le plugin
  const metaY = doc.lastAutoTable.finalY + 3;
  autoTable(doc, {
    startY: metaY,
    head: [
      [
        t.designation,
        { content: t.qty, styles: { halign: "right" } },
        { content: t.served, styles: { halign: "right" } },
      ],
    ],
    body: data.lignes.map((l) => [l.designation, pdfNombre(l.quantite), l.servi ?? ""]),
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: Math.max(fs, 7) },
    styles: { fontSize: fs, cellPadding: pad, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: 20 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 34 },
      2: { halign: "right", cellWidth: 44 },
    },
  });

  // ── Total quantité ──
  // @ts-expect-error lastAutoTable ajouté par le plugin
  let y = doc.lastAutoTable.finalY + 8;
  if (y > pageH - 28) {
    doc.addPage();
    y = 20;
  }

  // Total quantité (droite)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  const totalLbl = `${t.totalQty}: ${pdfNombre(data.totalQuantite)}`;
  doc.text(totalLbl, pageW - M, y, { align: "right" });
  y += 6;

  // ── Notes ──
  if (data.notes && data.notes.trim()) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`${t.notes}:`, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(doc.splitTextToSize(data.notes, pageW - 2 * M), M, y + 5);
  }

  // ── Pied de page ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${COMPANY.name} — ${COMPANY.tagline}`, pageW / 2, pageH - 10, {
    align: "center",
    maxWidth: pageW - 2 * M,
  });

  const safeName = `${data.numero}-${data.clientNom.replace(/\s+/g, "_")}`;
  if (action === "download") {
    doc.save(`bon-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
