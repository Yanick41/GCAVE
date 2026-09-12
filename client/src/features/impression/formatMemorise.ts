/**
 * Mémorisation du dernier format d'impression choisi, PAR TYPE de document :
 * on imprime souvent les factures en A4 et les reçus en 58 mm, un réglage
 * global forcerait à rebasculer à chaque fois.
 */
import type { FormatImpression, TypeDocument } from "./types";

const CLE = "sgc_format_impression";
const FORMATS: FormatImpression[] = ["58", "80", "A4"];

/** Format par défaut d'un type de document, à défaut de choix mémorisé. */
const DEFAUTS: Record<TypeDocument, FormatImpression> = {
  FACTURE: "A4", // pièce comptable : A4 par défaut
  RECU: "80", // remis au client au comptoir : ticket
  BON: "A4", // document de préparation, souvent annoté à la main
};

function lireTout(): Partial<Record<TypeDocument, FormatImpression>> {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Partial<Record<TypeDocument, FormatImpression>>) : {};
  } catch {
    return {}; // stockage indisponible ou JSON corrompu : on repart des défauts
  }
}

export function formatMemorise(type: TypeDocument): FormatImpression {
  const memorise = lireTout()[type];
  return memorise && FORMATS.includes(memorise) ? memorise : DEFAUTS[type];
}

export function memoriserFormat(type: TypeDocument, format: FormatImpression) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ ...lireTout(), [type]: format }));
  } catch {
    // Mode privé / quota plein : la mémorisation est un confort, pas une nécessité
  }
}
