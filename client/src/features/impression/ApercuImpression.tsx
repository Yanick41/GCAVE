/**
 * Modal d'aperçu et d'impression, commun à la facture, au reçu et au bon.
 *
 * Deux rendus cohabitent :
 *  • thermique (58/80 mm) — HTML, l'aperçu affiché EST ce qui sera imprimé ;
 *  • A4 — les générateurs jsPDF existants, prévisualisés en PDF.
 * Le format retenu est mémorisé par type de document.
 */
import type { Lang } from "@gca/shared";
import { Printer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { construireBonPDF, genererBonPDF, type BonData } from "../../lib/bon";
import { construireFacturePDF, genererFacturePDF, type FactureData } from "../../lib/facture";
import { construireRecuPDF, genererRecuPDF, type RecuLabels } from "../../lib/recu";
import { Ticket, ticketCss, type LargeurTicket } from "./Ticket";
import { formatMemorise, memoriserFormat } from "./formatMemorise";
import { bonVersTicket, factureVersTicket, recuVersTicket } from "./ticketModel";
import type { FormatImpression, RecuTicketData } from "./types";

/** Document à imprimer — union discriminée : le type commande les données. */
export type DocumentImprimable =
  | { type: "FACTURE"; data: FactureData }
  | { type: "RECU"; data: RecuTicketData }
  | { type: "BON"; data: BonData };

export function ApercuImpression({
  document: doc,
  onClose,
}: {
  document: DocumentImprimable;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(["impression", "paiements", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const type = doc.type;

  const [format, setFormat] = useState<FormatImpression>(() => formatMemorise(type));
  // Dernière largeur thermique retenue : permet de revenir du A4 au ticket sur
  // le format que l'utilisateur avait choisi, pas sur un défaut arbitraire.
  const [thermique, setThermique] = useState<LargeurTicket>(() => {
    const memo = formatMemorise(type);
    return memo === "A4" ? "80" : memo;
  });
  const [enCours, setEnCours] = useState(false);
  const [a4Url, setA4Url] = useState<string | null>(null);
  const apercuRef = useRef<HTMLDivElement>(null);

  const tr = useMemo(() => (cle: string) => t(cle), [t]);

  const labelsRecu: RecuLabels = useMemo(
    () => ({
      title: t("paiements:receipt"),
      client: t("paiements:columns.client"),
      date: t("paiements:date"),
      amount: t("paiements:amount"),
      mode: t("paiements:mode"),
      observation: t("paiements:observation"),
    }),
    [t],
  );

  const modele = useMemo(() => {
    if (doc.type === "FACTURE") return factureVersTicket(doc.data, tr);
    if (doc.type === "BON") return bonVersTicket(doc.data, tr);
    return recuVersTicket(doc.data, tr);
  }, [doc, tr]);

  const choisir = (f: FormatImpression) => {
    setFormat(f);
    if (f !== "A4") setThermique(f);
    memoriserFormat(type, f);
  };

  // Aperçu A4 : PDF généré à la demande, exposé en blob le temps de l'affichage
  useEffect(() => {
    if (format !== "A4") return;
    const pdf =
      doc.type === "FACTURE"
        ? construireFacturePDF(doc.data, lang)
        : doc.type === "BON"
          ? construireBonPDF(doc.data, lang)
          : construireRecuPDF(doc.data, lang, labelsRecu);
    const url = pdf.output("bloburl") as unknown as string;
    setA4Url(url);
    return () => {
      URL.revokeObjectURL(url);
      setA4Url(null);
    };
  }, [format, doc, lang, labelsRecu]);

  const imprimer = async () => {
    setEnCours(true);
    try {
      if (format === "A4") {
        if (doc.type === "FACTURE") genererFacturePDF(doc.data, lang, "print");
        else if (doc.type === "BON") genererBonPDF(doc.data, lang, "print");
        else genererRecuPDF(doc.data, lang, labelsRecu, "print");
      } else {
        const { imprimerTicket } = await import("./imprimerTicket");
        await imprimerTicket(apercuRef.current?.innerHTML ?? "", format);
      }
    } finally {
      setEnCours(false);
    }
  };

  const libelleImprimer = t("impression:print", {
    doc: t(`impression:docName.${type}`),
    format: t(`impression:widths.${format}`),
  });

  const onglet = (f: LargeurTicket) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
      format === f
        ? "bg-white text-slate-900 shadow"
        : "text-slate-300 hover:bg-slate-700 hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-slate-900 text-slate-100 shadow-2xl">
        {/* En-tête : titre + fermeture */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 p-4">
          <h2 className="text-lg font-bold">{t(`impression:previewOf.${type}`)}</h2>
          <button
            onClick={onClose}
            title={t("common:actions.cancel")}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sélecteur de largeur thermique */}
        <div className="border-b border-slate-700 px-4 py-3">
          <div className="flex gap-2 rounded-xl bg-slate-800 p-1">
            <button onClick={() => choisir("80")} className={onglet("80")}>
              {t("impression:widths.80")}
            </button>
            <button onClick={() => choisir("58")} className={onglet("58")}>
              {t("impression:widths.58")}
            </button>
          </div>
        </div>

        {/* Aperçu */}
        <div className="flex-1 overflow-auto bg-slate-800 p-4">
          {format === "A4" ? (
            a4Url ? (
              <iframe
                src={a4Url}
                title={t(`impression:previewOf.${type}`)}
                className="h-[60vh] w-full rounded-lg border-0 bg-white"
              />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">
                {t("common:common.loading")}
              </p>
            )
          ) : (
            <div className="flex justify-center">
              {/* Feuille de style identique à celle de l'impression :
                  l'aperçu ne peut pas diverger du papier. */}
              <style>{ticketCss(thermique)}</style>
              <div ref={apercuRef} className="rounded-lg bg-white shadow-lg">
                <Ticket modele={modele} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-700 p-4">
          <button
            onClick={() => choisir(format === "A4" ? thermique : "A4")}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {format === "A4" ? t("impression:backToTicket") : t(`impression:a4Button.${type}`)}
          </button>
          <button
            onClick={imprimer}
            disabled={enCours}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Printer size={16} />
            {enCours ? t("impression:printing") : libelleImprimer}
          </button>
        </div>
      </div>
    </div>
  );
}
