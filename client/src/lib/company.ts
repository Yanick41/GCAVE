import type { jsPDF } from "jspdf";
import { LOGO_DATA_URI, LOGO_FORMAT, LOGO_RATIO } from "./logo";

/**
 * Identité de l'entreprise — SOURCE UNIQUE pour les documents (facture, bon).
 * Les champs de coordonnées vides ne sont pas affichés sur les PDF.
 */
export const COMPANY = {
  name: "GRANDE CAVE ANDOKOI",
  tagline: "Spécialiste des vins, spiritueux, champagnes, bières et boissons premium",

  // Coordonnées (laisser "" = non affiché sur les documents).
  address: "Yopougon Andokoi, Château",
  phone: "07 47 29 59 53 · 07 07 67 96 02 · 05 76 68 86 38",
  email: "",
  rccm: "", // Registre du Commerce
  cc: "1292455 Y", // Numéro Compte Contribuable
  ifu: "", // IFU / NIF (si disponible)

  /**
   * Logo en data URI base64 (ex: "data:image/png;base64,...").
   * Rempli une fois le fichier logo fourni dans le projet.
   * Vide = pas de logo (l'en-tête retombe proprement sur le nom seul).
   */
  logo: "" as string,
};

/** Lignes de coordonnées à afficher (celles renseignées uniquement). */
export function companyContactLines(): string[] {
  const c = COMPANY;
  const lines: string[] = [];
  if (c.address) lines.push(c.address);
  if (c.email) lines.push(`Email : ${c.email}`);
  const rccm = c.rccm ? `RCCM : ${c.rccm}` : "";
  const cc = c.cc ? `N° CC : ${c.cc}` : "";
  const ifu = c.ifu ? `IFU : ${c.ifu}` : "";
  const legal = [rccm, cc, ifu].filter(Boolean).join("   •   ");
  if (legal) lines.push(legal);
  // Téléphones en dernière position
  if (c.phone) lines.push(`Tél : ${c.phone}`);
  return lines;
}

/**
 * Dessine l'en-tête commun des documents : logo (haut-gauche) + nom + slogan
 * + coordonnées éventuelles, titre à droite, filet de séparation.
 * Retourne l'ordonnée Y du filet (pour positionner le contenu en dessous).
 */
export function drawDocumentHeader(
  doc: jsPDF,
  opts: { pageW: number; margin: number; title: string },
): number {
  const { pageW, margin: M, title } = opts;

  // Logo seul (haut-gauche) — le nom de l'entreprise est déjà dans le logo.
  // Ratio conservé, sans déformation.
  const logoW = 34;
  const logoH = logoW * LOGO_RATIO;
  const logoY = 6;
  let hasLogo = false;
  try {
    if (LOGO_DATA_URI) {
      doc.addImage(LOGO_DATA_URI, LOGO_FORMAT, M, logoY, logoW, logoH);
      hasLogo = true;
    }
  } catch {
    hasLogo = false;
  }

  // Repli si le logo est indisponible : afficher le nom en texte
  if (!hasLogo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text(COMPANY.name, M, 18);
  }

  // Titre du document (droite), aligné sur le haut du logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, pageW - M, 16, { align: "right" });

  // Coordonnées JUSTE SOUS le logo (gauche)
  let cy = (hasLogo ? logoY + logoH : 22) + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  for (const line of companyContactLines()) {
    doc.text(line, M, cy, { maxWidth: pageW - 2 * M });
    cy += 4;
  }

  // Filet de séparation, sous l'élément le plus bas
  const lineY = Math.max(cy - 1, hasLogo ? logoY + logoH + 3 : 30, 32);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(M, lineY, pageW - M, lineY);
  return lineY;
}
