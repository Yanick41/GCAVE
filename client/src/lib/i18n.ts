import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAuth from "../locales/en/auth.json";
import enClients from "../locales/en/clients.json";
import enCommon from "../locales/en/common.json";
import frAuth from "../locales/fr/auth.json";
import frClients from "../locales/fr/clients.json";
import frCommon from "../locales/fr/common.json";

export const resources = {
  fr: { common: frCommon, auth: frAuth, clients: frClients },
  en: { common: enCommon, auth: enAuth, clients: enClients },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    ns: ["common", "auth", "clients"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
