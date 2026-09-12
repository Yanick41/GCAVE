/**
 * Rendu HTML d'un ticket thermique.
 *
 * Le MÊME markup sert l'aperçu à l'écran et l'impression : le contenu du
 * conteneur est recopié tel quel dans l'iframe d'impression, avec la feuille
 * de style ci-dessous. Aperçu et papier ne peuvent donc pas diverger.
 *
 * Composition : chaque bloc (en-tête, références, articles, totaux, pied) est
 * séparé par un filet et respire. Les libellés sont alignés en colonne plutôt
 * qu'écartés aux deux bords, ce qui reste lisible sur 58 mm comme sur 80 mm.
 *
 * Les classes sont préfixées `tk-` et les styles volontairement autonomes
 * (pas de Tailwind) : l'iframe d'impression n'a pas accès aux styles de l'app.
 */
import type { Lang } from "@gca/shared";
import { useTranslation } from "react-i18next";
import { COMPANY } from "../../lib/company";
import { LOGO_DATA_URI } from "../../lib/logo";
import { montantTicket } from "./ticketModel";
import type { TicketModel } from "./types";

/** Largeur utile du papier (mm), corps de texte et colonne des libellés. */
export const LARGEURS = {
  "58": { mm: 58, police: 8.5, libelle: 14 },
  "80": { mm: 80, police: 10, libelle: 19 },
} as const;

export type LargeurTicket = keyof typeof LARGEURS;

/** Date compacte : sur un ticket, le format long mangerait deux lignes. */
function dateTicket(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Coordonnées de l'entreprise, une information par ligne.
 * Les numéros de téléphone sont éclatés : les trois numéros sur une seule
 * ligne se replient en pavé illisible sur papier étroit.
 */
function lignesEntreprise(): { etiquette?: string; valeur: string }[] {
  const lignes: { etiquette?: string; valeur: string }[] = [];
  if (COMPANY.address) lignes.push({ valeur: COMPANY.address });
  if (COMPANY.email) lignes.push({ etiquette: "Email", valeur: COMPANY.email });

  const numeros = (COMPANY.phone || "")
    .split(/[·•]/)
    .map((n) => n.trim())
    .filter(Boolean);
  numeros.forEach((n, i) => lignes.push({ etiquette: i === 0 ? "Tél" : "", valeur: n }));

  const legal = [
    COMPANY.rccm ? `RCCM : ${COMPANY.rccm}` : "",
    COMPANY.cc ? `N° CC : ${COMPANY.cc}` : "",
    COMPANY.ifu ? `IFU : ${COMPANY.ifu}` : "",
  ].filter(Boolean);
  for (const l of legal) lignes.push({ valeur: l });

  return lignes;
}

/** Feuille de style du ticket — injectée à l'identique à l'écran et au papier. */
export function ticketCss(largeur: LargeurTicket): string {
  const { mm, police, libelle } = LARGEURS[largeur];
  // Logo large et lisible : l'identité de l'entreprise est le premier élément
  // du ticket, elle n'est pas rognée pour gagner du papier.
  const logoMm = Math.round(mm * 0.55);
  return `
.tk-root {
  width: ${mm}mm;
  box-sizing: border-box;
  padding: 4mm 3mm;
  margin: 0 auto;
  background: #fff;
  color: #000;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: ${police}pt;
  line-height: 1.45;
}
.tk-center { text-align: center; }
.tk-bold { font-weight: 700; }

/* En-tête entreprise */
.tk-logo { display: block; margin: 0 auto 2mm; width: ${logoMm}mm; height: auto; }
.tk-enseigne { font-size: ${police + 2.5}pt; font-weight: 700; letter-spacing: .5px; }
.tk-coord { margin-top: 1.5mm; }
.tk-coord-ligne { display: flex; justify-content: center; gap: 1.5mm; }
.tk-coord-et { flex: none; min-width: ${Math.round(libelle * 0.5)}mm; text-align: right; }
.tk-coord-val { flex: none; text-align: left; word-break: break-word; }

/* Séparateurs : double filet entre grandes sections, pointillé à l'intérieur */
.tk-regle { border-top: 3px double #000; margin: 3mm 0; }
.tk-sep { border-top: 1px dashed #000; margin: 2.5mm 0; }

/* Titre du document */
.tk-titre { font-size: ${police + 2}pt; font-weight: 700; letter-spacing: 1.5px; }

/* Références : libellés alignés en colonne, valeurs sur une même verticale */
.tk-champ { display: flex; gap: 2mm; margin-bottom: .6mm; }
/* Colonne de libellés, partagée par les références et les attributs d'article */
.tk-et { flex: none; width: ${libelle}mm; }
.tk-champ-val { flex: 1; word-break: break-word; }

/* Articles */
.tk-article { margin-bottom: 2.5mm; }
.tk-article-nom { font-weight: 700; word-break: break-word; }
.tk-article-ligne {
  display: flex;
  flex-wrap: wrap;
  gap: 0 2mm;
  padding-left: 2.5mm;
}
.tk-article-montant { margin-left: auto; font-weight: 700; }
.tk-servi-trait {
  flex: 1;
  min-width: ${Math.round(mm * 0.35)}mm;
  border-bottom: 1px dotted #000;
  height: ${police}pt;
}

/* Totaux */
.tk-total { display: flex; justify-content: space-between; gap: 2mm; margin-bottom: .6mm; }
.tk-total-fort { font-weight: 700; font-size: ${police + 1}pt; margin-top: 1mm; }

.tk-note { margin-top: 2.5mm; text-align: center; font-weight: 700; letter-spacing: .5px; }
.tk-merci { text-align: center; }
`.trim();
}

export function Ticket({ modele }: { modele: TicketModel }) {
  const { t, i18n } = useTranslation(["impression"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const prix = modele.afficherPrix;
  const estBon = modele.type === "BON";

  return (
    <div className="tk-root">
      {/* En-tête entreprise : logo et coordonnées, identiques au document A4.
          Le nom figure déjà dans le logo ; il n'est répété en texte qu'en repli
          si le logo est indisponible. */}
      <div className="tk-center">
        {LOGO_DATA_URI ? (
          <img className="tk-logo" src={LOGO_DATA_URI} alt={COMPANY.name} />
        ) : (
          <div className="tk-enseigne">{COMPANY.name}</div>
        )}
        <div className="tk-coord">
          {lignesEntreprise().map((l, i) =>
            l.etiquette === undefined ? (
              <div key={i}>{l.valeur}</div>
            ) : (
              <div className="tk-coord-ligne" key={i}>
                <span className="tk-coord-et">{l.etiquette ? `${l.etiquette} :` : ""}</span>
                <span className="tk-coord-val">{l.valeur}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="tk-regle" />

      {/* Nature du document */}
      <div className="tk-center tk-titre">{modele.titre}</div>

      <div className="tk-regle" />

      {/* Références */}
      <div>
        {modele.numero && (
          <Champ label={t("impression:ticket.number")} valeur={modele.numero} fort />
        )}
        <Champ label={t("impression:ticket.date")} valeur={dateTicket(modele.date, lang)} />
        <Champ label={t("impression:ticket.client")} valeur={modele.clientNom} />
        {modele.clientTelephone && (
          <Champ label={t("impression:ticket.phone")} valeur={modele.clientTelephone} />
        )}
      </div>

      {/* Articles */}
      {modele.lignes.length > 0 && (
        <>
          <div className="tk-sep" />
          {modele.lignes.map((l, i) => (
            <div className="tk-article" key={i}>
              <div className="tk-article-nom">{l.designation}</div>

              {prix ? (
                <div className="tk-article-ligne">
                  <span>
                    {montantTicket(l.quantite)} × {montantTicket(l.prixUnitaire ?? 0)}
                  </span>
                  <span className="tk-article-montant">{montantTicket(l.total ?? 0)}</span>
                </div>
              ) : (
                /* Bon de commande : la quantité seule, jamais de prix */
                <div className="tk-article-ligne">
                  <span className="tk-et">{t("impression:ticket.qty")} :</span>
                  <span className="tk-bold">{montantTicket(l.quantite)}</span>
                </div>
              )}

              {/* Bon de commande : emplacement « Servi », renseigné ou laissé
                  libre pour l'annotation à la main, comme sur le bon A4. */}
              {estBon && (
                <div className="tk-article-ligne">
                  <span className="tk-et">{t("impression:ticket.served")} :</span>
                  {l.servi ? (
                    <span className="tk-bold">{l.servi}</span>
                  ) : (
                    <span className="tk-servi-trait" />
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Totaux */}
      {modele.totaux.length > 0 && (
        <>
          <div className="tk-sep" />
          {modele.totaux.map((tot, i) => (
            <div className={`tk-total${tot.fort ? " tk-total-fort" : ""}`} key={i}>
              <span>{tot.label}</span>
              <span>{tot.valeur}</span>
            </div>
          ))}
        </>
      )}

      {modele.note && <div className="tk-note">{modele.note}</div>}

      <div className="tk-regle" />

      <div className="tk-merci">
        {prix ? t("impression:ticket.thanks") : t("impression:ticket.noPrice")}
      </div>
    </div>
  );
}

/** Ligne « libellé : valeur » du bloc de références, libellés alignés. */
function Champ({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className="tk-champ">
      <span className="tk-et">{label}</span>
      <span className={`tk-champ-val${fort ? " tk-bold" : ""}`}>{valeur}</span>
    </div>
  );
}
