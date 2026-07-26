import { formatDate, type Lang } from "@gca/shared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY, drawDocumentHeader } from "./company";

export interface FactureLigne {
  nomProduit: string;
  quantite: number;
  prixUnitaire: number;
  totalLigne: number;
}

export interface FactureData {
  clientNom: string;
  clientTelephone?: string | null;
  clientAdresse?: string | null;
  clientCode?: string | null;
  date: Date;
  lignes: FactureLigne[];
  total: number;
  numero?: string;
  /** Ancien solde du client reporté sur la facture (optionnel). */
  ancienSolde?: number;
  /** paye/reste : optionnels (affichés seulement lors de la saisie initiale). */
  paye?: number;
  reste?: number;
}

// ── Libellés bilingues (le PDF est autonome) ─────────────────────────
const L = {
  fr: {
    invoice: "FACTURE",
    proforma: "FACTURE PROFORMA",
    client: "CLIENT",
    type: "Type",
    number: "N° Facture",
    date: "Date",
    phone: "N° Téléphone",
    code: "Code Client",
    typeInvoice: "Facture",
    typeProforma: "Facture proforma",
    designation: "Référence / Désignation de l'Article",
    qty: "Quantité",
    unitPrice: "Prix unitaire TTC",
    amount: "Montant TTC",
    subtotal: "Total facture",
    previousBalance: "Ancien solde",
    netToPay: "NET À PAYER",
    paid: "Acompte versé",
    remaining: "Reste à payer",
    inWords: "Arrêtée la présente facture à la somme de :",
    francs: "francs CFA",
    clientSignature: "Signature du client",
    stamp: "Cachet & signature",
  },
  en: {
    invoice: "INVOICE",
    proforma: "PROFORMA INVOICE",
    client: "CUSTOMER",
    type: "Type",
    number: "Invoice No.",
    date: "Date",
    phone: "Phone",
    code: "Customer code",
    typeInvoice: "Invoice",
    typeProforma: "Proforma invoice",
    designation: "Item / Description",
    qty: "Quantity",
    unitPrice: "Unit price",
    amount: "Amount",
    subtotal: "Invoice total",
    previousBalance: "Previous balance",
    netToPay: "NET TO PAY",
    paid: "Amount paid",
    remaining: "Balance due",
    inWords: "This invoice is set at the sum of:",
    francs: "CFA francs",
    clientSignature: "Customer signature",
    stamp: "Stamp & signature",
  },
} as const;

/** Entier formaté avec séparateur d'espace (sans devise). */
function nombre(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ── Montant en toutes lettres ────────────────────────────────────────
const FR_UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
  "dix-huit", "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "", "quatre-vingt", ""];

function frUnder100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt";
    return `${base}-${FR_UNITS[10 + u]}`;
  }
  let w = FR_TENS[t];
  if (u === 0) return t === 8 ? `${w}s` : w;
  if (u === 1 && t >= 2 && t <= 6) return `${w}-et-un`;
  return `${w}-${FR_UNITS[u]}`;
}

function frUnder1000(n: number, scaleGroup: boolean): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = "";
  if (h > 0) {
    s = h === 1 ? "cent" : `${FR_UNITS[h]} cent`;
    if (h > 1 && rest === 0 && !scaleGroup) s += "s"; // "deux cents" (mais "cinq cent mille")
  }
  if (rest > 0) s = s ? `${s} ${frUnder100(rest)}` : frUnder100(rest);
  return s;
}

function frWords(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const scales: [number, string, string][] = [
    [1e9, "milliard", "milliards"],
    [1e6, "million", "millions"],
    [1e3, "mille", "mille"],
  ];
  let rem = n;
  for (const [v, single, plural] of scales) {
    const count = Math.floor(rem / v);
    if (count > 0) {
      if (v === 1e3 && count === 1) parts.push("mille");
      else parts.push(`${frUnder1000(count, true)} ${count > 1 ? plural : single}`);
      rem %= v;
    }
  }
  if (rem > 0) parts.push(frUnder1000(rem, false));
  return parts.join(" ");
}

const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enUnder1000(n: number): string {
  let s = "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) s = `${EN_ONES[h]} hundred`;
  if (rest > 0) {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    const part = rest < 20 ? EN_ONES[rest] : u ? `${EN_TENS[t]}-${EN_ONES[u]}` : EN_TENS[t];
    s = s ? `${s} ${part}` : part;
  }
  return s;
}

function enWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const scales: [number, string][] = [
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"],
  ];
  let rem = n;
  for (const [v, name] of scales) {
    const count = Math.floor(rem / v);
    if (count > 0) {
      parts.push(`${enUnder1000(count)} ${name}`);
      rem %= v;
    }
  }
  if (rem > 0) parts.push(enUnder1000(rem));
  return parts.join(" ");
}

export function montantEnLettres(n: number, lang: Lang): string {
  const words = lang === "en" ? enWords(Math.round(n)) : frWords(Math.round(n));
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Entier formaté avec séparateur d'espace (sans devise) — réutilisable. */
export function pdfNombre(n: number): string {
  return nombre(n);
}

/** Génère la facture d'une commande au format « relevé de prix » (sans TVA). */
export function genererFacturePDF(data: FactureData, lang: Lang, action: "download" | "print") {
  const t = L[lang === "en" ? "en" : "fr"];
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14; // marge

  // ── En-tête : logo + identité (gauche) + titre FACTURE (droite) ──
  const isProforma = !data.numero;
  const title = isProforma ? t.proforma : t.invoice;
  const lineY = drawDocumentHeader(doc, { pageW, margin: M, title });

  // ── Encadré client (droite) ──
  const boxX = 116;
  const boxW = pageW - M - boxX;
  const boxY = lineY + 5;
  const boxH = 26;
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
  if (data.clientTelephone) {
    doc.text(String(data.clientTelephone), boxX + 3, cy);
    cy += 5;
  }
  if (data.clientAdresse) {
    doc.text(String(data.clientAdresse), boxX + 3, cy, { maxWidth: boxW - 6 });
  }

  // ── Table méta : Type | N° Facture | Date | Téléphone ──
  autoTable(doc, {
    startY: boxY + boxH + 5,
    head: [[t.type, t.number, t.date, t.phone]],
    body: [
      [
        isProforma ? t.typeProforma : t.typeInvoice,
        data.numero ?? "—",
        formatDate(data.date, lang),
        data.clientTelephone ?? "—",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: 40, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: 20 },
    styles: { cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.2 },
  });

  // ── Table produits : Désignation | Quantité | Prix unitaire TTC | Montant TTC ──
  // Police/espacement réduits automatiquement quand la facture est longue,
  // pour faire tenir un maximum de lignes sur la page.
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
        { content: t.unitPrice, styles: { halign: "right" } },
        { content: t.amount, styles: { halign: "right" } },
      ],
    ],
    body: data.lignes.map((l) => [
      l.nomProduit,
      nombre(l.quantite),
      nombre(l.prixUnitaire),
      nombre(l.totalLigne),
    ]),
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: Math.max(fs, 7) },
    styles: { fontSize: fs, cellPadding: pad, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: 20 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 26 },
      2: { halign: "right", cellWidth: 34 },
      3: { halign: "right", cellWidth: 38 },
    },
  });

  // ── Totaux (droite) ──
  // @ts-expect-error lastAutoTable ajouté par le plugin
  let y = doc.lastAutoTable.finalY + 8;
  // Place suffisante pour totaux + NET + lettres + signatures ? sinon nouvelle page
  if (y > pageH - 75) {
    doc.addPage();
    y = 20;
  }
  const hasAncien = data.ancienSolde !== undefined && data.ancienSolde !== 0;
  const net = data.total + (data.ancienSolde ?? 0);

  const totalsBody: [string, string][] = [];
  if (hasAncien) {
    totalsBody.push([t.subtotal, `${nombre(data.total)}`]);
    totalsBody.push([t.previousBalance, `${nombre(data.ancienSolde ?? 0)}`]);
  }
  if (data.paye !== undefined && data.paye > 0) {
    totalsBody.push([t.paid, `${nombre(data.paye)}`]);
    totalsBody.push([t.remaining, `${nombre(data.reste ?? net - data.paye)}`]);
  }

  if (totalsBody.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: pageW - M - 90 },
      body: totalsBody,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 55, textColor: 90 }, 1: { halign: "right", cellWidth: 35 } },
    });
    // @ts-expect-error lastAutoTable ajouté par le plugin
    y = doc.lastAutoTable.finalY + 2;
  }

  // NET À PAYER — encadré, mis en évidence
  const netBoxX = pageW - M - 90;
  const netBoxW = 90;
  doc.setFillColor(30, 41, 59);
  doc.rect(netBoxX, y, netBoxW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255);
  doc.text(t.netToPay, netBoxX + 3, y + 8);
  doc.text(`${nombre(net)} F CFA`, netBoxX + netBoxW - 3, y + 8, { align: "right" });
  y += 12;

  // ── Montant en toutes lettres ──
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(t.inWords, M, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(20);
  const lettres = `${montantEnLettres(net, lang)} ${t.francs}.`;
  doc.text(doc.splitTextToSize(lettres, pageW - 2 * M), M, y + 6);

  // ── Cachet & signatures (bas de page) ──
  const sigY = Math.max(y + 26, pageH - 34);
  const sigW = 72;
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.line(M, sigY, M + sigW, sigY);
  const rx = pageW - M - sigW;
  doc.line(rx, sigY, rx + sigW, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(t.clientSignature, M, sigY + 5);
  doc.text(t.stamp, rx, sigY + 5);

  // ── Pied de page ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${COMPANY.name} — ${COMPANY.tagline}`, pageW / 2, pageH - 10, {
    align: "center",
    maxWidth: pageW - 2 * M,
  });

  const safeName = (data.numero ?? data.clientNom).replace(/\s+/g, "_");
  if (action === "download") {
    doc.save(`facture-${safeName}.pdf`);
  } else {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
