import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAuth from "../locales/en/auth.json";
import enClients from "../locales/en/clients.json";
import enCommandes from "../locales/en/commandes.json";
import enCommon from "../locales/en/common.json";
import enDashboard from "../locales/en/dashboard.json";
import enPaiements from "../locales/en/paiements.json";
import enRappels from "../locales/en/rappels.json";
import enRapports from "../locales/en/rapports.json";
import frAuth from "../locales/fr/auth.json";
import frClients from "../locales/fr/clients.json";
import frCommandes from "../locales/fr/commandes.json";
import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frPaiements from "../locales/fr/paiements.json";
import frRappels from "../locales/fr/rappels.json";
import frRapports from "../locales/fr/rapports.json";

export const resources = {
  fr: {
    common: frCommon,
    auth: frAuth,
    clients: frClients,
    commandes: frCommandes,
    dashboard: frDashboard,
    paiements: frPaiements,
    rappels: frRappels,
    rapports: frRapports,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    clients: enClients,
    commandes: enCommandes,
    dashboard: enDashboard,
    paiements: enPaiements,
    rappels: enRappels,
    rapports: enRapports,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    ns: [
      "common",
      "auth",
      "clients",
      "commandes",
      "dashboard",
      "paiements",
      "rappels",
      "rapports",
    ],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
