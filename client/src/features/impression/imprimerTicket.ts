/**
 * Impression d'un ticket thermique.
 *
 * On recopie le markup DE L'APERÇU dans un iframe isolé, avec la même feuille
 * de style et une règle `@page` à la largeur du papier : ce qui sort de
 * l'imprimante est exactement ce qui était affiché. Passer par un second
 * moteur de rendu (PDF) ferait diverger les deux à la première retouche.
 */
import { ticketCss, type LargeurTicket } from "./Ticket";

/** Laisse au navigateur le temps de charger les images (logo) avant d'imprimer. */
function attendreImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  ).then(() => undefined);
}

/**
 * Imprime le contenu HTML fourni au format thermique demandé.
 * Résout une fois la boîte d'impression refermée (ou l'iframe nettoyé).
 */
export async function imprimerTicket(html: string, largeur: LargeurTicket): Promise<void> {
  const mm = largeur === "58" ? 58 : 80;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Hors écran plutôt que display:none : certains navigateurs n'impriment pas
  // le contenu d'un iframe sans mise en page.
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("IFRAME_INDISPONIBLE");
  }

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>ticket</title><style>` +
      `@page { size: ${mm}mm auto; margin: 0; }` +
      `html,body { margin:0; padding:0; background:#fff; }` +
      ticketCss(largeur) +
      `</style></head><body>${html}</body></html>`,
  );
  doc.close();

  await attendreImages(doc);
  win.focus();
  win.print();

  // Le retrait immédiat annulerait l'impression sur certains navigateurs :
  // on laisse l'iframe vivre le temps que la boîte de dialogue soit traitée.
  await new Promise((r) => setTimeout(r, 1000));
  iframe.remove();
}
