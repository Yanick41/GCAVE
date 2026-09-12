/**
 * Rendu HTML d'un ticket thermique.
 *
 * Le MÊME markup sert l'aperçu à l'écran et l'impression : le contenu du
 * conteneur est recopié tel quel dans l'iframe d'impression, avec la feuille
 * de style ci-dessous. Aperçu et papier ne peuvent donc pas diverger.
 *
 * Les classes sont préfixées `tk-` et les styles volontairement autonomes
 * (pas de Tailwind) : l'iframe d'impression n'a pas accès aux styles de l'app.
 */
import { formatDate, type Lang } from "@gca/shared";
import { useTranslation } from "react-i18next";
import { COMPANY, companyContactLines } from "../../lib/company";
import { LOGO_DATA_URI } from "../../lib/logo";
import { montantTicket } from "./ticketModel";
import type { TicketModel } from "./types";

/** Largeur utile du papier (mm) et corps de texte associé. */
export const LARGEURS = { "58": { mm: 58, police: 8.5 }, "80": { mm: 80, police: 10 } } as const;

export type LargeurTicket = keyof typeof LARGEURS;

/** Feuille de style du ticket — injectée à l'identique à l'écran et au papier. */
export function ticketCss(largeur: LargeurTicket): string {
  const { mm, police } = LARGEURS[largeur];
  // Logo large et lisible : l'identité de l'entreprise est le premier élément
  // du ticket, elle n'est pas rognée pour gagner du papier.
  const logoMm = Math.round(mm * 0.55);
  return `
.tk-root {
  width: ${mm}mm;
  box-sizing: border-box;
  padding: 3mm 2.5mm;
  margin: 0 auto;
  background: #fff;
  color: #000;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: ${police}pt;
  line-height: 1.35;
}
.tk-center { text-align: center; }
.tk-bold { font-weight: 700; }
.tk-logo { display: block; margin: 0 auto 1.5mm; width: ${logoMm}mm; height: auto; }
.tk-enseigne { font-size: ${police + 2.5}pt; font-weight: 700; letter-spacing: .5px; }
.tk-coordonnees { margin-top: 1mm; }
.tk-sep { border-top: 1px dashed #000; margin: 2mm 0; }
.tk-titre { font-size: ${police + 1}pt; font-weight: 700; letter-spacing: 1px; }
.tk-meta { display: flex; justify-content: space-between; gap: 2mm; }
.tk-meta > span:last-child { text-align: right; word-break: break-word; }
.tk-article { margin-bottom: 1.2mm; }
.tk-article-nom { word-break: break-word; }
.tk-article-detail { display: flex; justify-content: space-between; gap: 2mm; padding-left: 2mm; }
.tk-total { display: flex; justify-content: space-between; gap: 2mm; }
.tk-total-fort { font-weight: 700; font-size: ${police + 1}pt; }
.tk-note { margin-top: 2mm; text-align: center; font-weight: 700; }
.tk-merci { margin-top: 2mm; text-align: center; }
`.trim();
}

export function Ticket({ modele }: { modele: TicketModel }) {
  const { t, i18n } = useTranslation(["impression"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const prix = modele.afficherPrix;

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
        <div className="tk-coordonnees">
          {companyContactLines().map((ligne, i) => (
            <div key={i}>{ligne}</div>
          ))}
        </div>
      </div>

      <div className="tk-sep" />

      {/* Nature et références du document */}
      <div className="tk-center tk-titre">{modele.titre}</div>
      <div style={{ marginTop: "1.5mm" }}>
        {modele.numero && (
          <div className="tk-meta">
            <span>N°</span>
            <span className="tk-bold">{modele.numero}</span>
          </div>
        )}
        <div className="tk-meta">
          <span>Date</span>
          <span>{formatDate(modele.date, lang)}</span>
        </div>
        <div className="tk-meta">
          <span>{t("impression:ticket.client")}</span>
          <span>{modele.clientNom}</span>
        </div>
        {modele.clientTelephone && (
          <div className="tk-meta">
            <span>{t("impression:ticket.phone")}</span>
            <span>{modele.clientTelephone}</span>
          </div>
        )}
      </div>

      {/* Articles */}
      {modele.lignes.length > 0 && (
        <>
          <div className="tk-sep" />
          {modele.lignes.map((l, i) => (
            <div className="tk-article" key={i}>
              <div className="tk-article-nom">{l.designation}</div>
              <div className="tk-article-detail">
                {/* Bon de commande : la quantité seule, jamais de prix */}
                <span>
                  {prix
                    ? `${montantTicket(l.quantite)} x ${montantTicket(l.prixUnitaire ?? 0)}`
                    : `${t("impression:ticket.qty")} : ${montantTicket(l.quantite)}`}
                </span>
                {prix && <span className="tk-bold">{montantTicket(l.total ?? 0)}</span>}
              </div>
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

      <div className="tk-sep" />

      <div className="tk-merci">
        {prix ? t("impression:ticket.thanks") : t("impression:ticket.noPrice")}
      </div>
    </div>
  );
}
