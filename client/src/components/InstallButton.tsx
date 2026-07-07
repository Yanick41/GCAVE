import { Download, X } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getInstallPrompt,
  isStandalone,
  subscribeInstall,
  triggerInstall,
} from "../lib/pwaInstall";

/** Bouton "Installer l'application" (PWA). Toujours visible tant que l'app n'est
 *  pas déjà installée : déclenche l'invite native si dispo, sinon affiche l'aide. */
export function InstallButton() {
  const { t } = useTranslation();
  const [, force] = useReducer((x) => x + 1, 0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => subscribeInstall(force), []);

  if (isStandalone()) return null; // déjà installée

  const onClick = async () => {
    const ok = await triggerInstall();
    if (!ok && !getInstallPrompt()) setShowHelp(true); // pas d'invite -> aide
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
      >
        <Download size={16} /> {t("install.button")}
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold">{t("install.title")}</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              {t("install.help")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                💻 {t("install.helpChrome")}
              </li>
              <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                🍏 {t("install.helpSafari")}
              </li>
              <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                📱 {t("install.helpAndroid")}
              </li>
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="rounded-lg bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-700"
              >
                {t("install.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
