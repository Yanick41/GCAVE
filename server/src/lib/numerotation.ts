/**
 * Numérotation des documents — séquence annuelle par type de document.
 *
 * Le numéro est basé sur le MAX existant + 1 (robuste aux suppressions : un
 * count+1 collisionnerait avec un numéro déjà attribué). Le zéro-padding sur
 * 6 chiffres garantit que l'ordre lexical = l'ordre numérique, ce qui permet
 * de retrouver le dernier avec un simple `orderBy: { numero: "desc" }`.
 */
import { prisma } from "./prisma.js";

/** Prochain numéro de bon de commande : BC-<année>-<séquence>. */
export async function prochainNumeroBon(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `BC-${annee}-`;
  const dernier = await prisma.bonCommande.findFirst({
    where: { numero: { startsWith: prefixe } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const seq = dernier ? parseInt(dernier.numero.slice(-6), 10) : 0;
  return `${prefixe}${String(seq + 1).padStart(6, "0")}`;
}
