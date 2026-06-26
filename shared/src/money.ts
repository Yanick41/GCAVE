/**
 * Formatage monétaire FCFA (XOF par défaut) et dates, localisé EN/FR.
 * Le FCFA ne possède pas de sous-unité -> 0 décimale à l'affichage.
 */
export type Lang = "fr" | "en";

export function formatMoney(
  amount: number,
  lang: Lang = "fr",
  currency = "XOF",
): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(date: string | Date, lang: Lang = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
