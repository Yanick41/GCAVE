/**
 * Import en masse de fiches clients depuis un fichier du tableur.
 *
 * Rien n'est envoyé au serveur avant que l'utilisateur ait VU ce qui sera
 * importé : le fichier est analysé dans le navigateur, et l'aperçu montre les
 * fiches retenues comme les lignes écartées, chacune avec son motif. Une ligne
 * perdue en silence serait un client perdu sans que personne ne le sache.
 */
import { analyserImportClients, type ImportAnalyse } from "@gca/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode } from "../../lib/errors";
import { importerClients, type ImportResultat } from "./api";

export function ImportClientsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(["clients", "common"]);
  const queryClient = useQueryClient();
  const champFichier = useRef<HTMLInputElement>(null);

  const [nomFichier, setNomFichier] = useState("");
  const [analyse, setAnalyse] = useState<ImportAnalyse | null>(null);
  const [resultat, setResultat] = useState<ImportResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    setResultat(null);
    setNomFichier(fichier.name);
    setAnalyse(analyserImportClients(await fichier.text()));
  }

  const mutation = useMutation({
    mutationFn: () => importerClients(analyse!.clients),
    onSuccess: (r) => {
      setResultat(r);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => setErreur(t(`common:errors.${errorCode(e)}`)),
  });

  const colonnesManquantes =
    analyse && (analyse.colonnes.nom === undefined || analyse.colonnes.telephone === undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{t("clients:import.title")}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
            <X size={20} />
          </button>
        </div>

        {!resultat && (
          <>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {t("clients:import.hint")}
            </p>

            <input
              ref={champFichier}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => choisir(e.target.files?.[0])}
            />
            <button
              onClick={() => champFichier.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileSpreadsheet size={20} />
              {nomFichier || t("clients:import.choose")}
            </button>
          </>
        )}

        {analyse && !resultat && (
          <div className="mt-5 space-y-4">
            {colonnesManquantes ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertTriangle size={16} className="mr-1 inline" />
                {t("clients:import.missingColumns")}
              </p>
            ) : (
              <>
                <div className="flex gap-4 text-sm">
                  <span className="font-semibold text-emerald-600">
                    {t("clients:import.ready", { count: analyse.clients.length })}
                  </span>
                  {analyse.rejets.length > 0 && (
                    <span className="font-semibold text-amber-600">
                      {t("clients:import.skipped", { count: analyse.rejets.length })}
                    </span>
                  )}
                </div>

                {analyse.clients.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border dark:border-slate-700">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-2">{t("clients:columns.name")}</th>
                          <th className="px-3 py-2">{t("clients:columns.phone")}</th>
                          <th className="px-3 py-2">{t("clients:detail.openingBalance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyse.clients.map((c, i) => (
                          <tr key={i} className="border-t dark:border-slate-700">
                            <td className="px-3 py-1.5 font-medium">{c.nom}</td>
                            <td className="px-3 py-1.5 text-slate-500">{c.telephone}</td>
                            <td className="px-3 py-1.5 text-slate-500">
                              {(c.soldeInitial ?? 0).toLocaleString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Les lignes écartées sont montrées AVANT l'import, pas après :
                    c'est encore le moment de corriger le fichier. */}
                {analyse.rejets.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    {analyse.rejets.map((r) => (
                      <div key={r.ligne}>
                        {t("clients:import.line", { n: r.ligne })} —{" "}
                        {t(`clients:import.reason.${r.motif}`)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {resultat && (
          <div className="mt-2 space-y-3 text-sm">
            <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              {t("clients:import.done", { count: resultat.crees })}
            </p>
            {resultat.ignores.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <p className="mb-1 font-semibold">
                  {t("clients:import.alreadyThere", { count: resultat.ignores.length })}
                </p>
                {resultat.ignores.map((c, i) => (
                  <div key={i}>
                    {c.nom} — {c.telephone}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {resultat ? t("common:actions.cancel") : t("common:actions.cancel")}
          </button>
          {!resultat && (
            <button
              onClick={() => mutation.mutate()}
              disabled={!analyse || analyse.clients.length === 0 || mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Upload size={16} />
              {mutation.isPending
                ? t("common:common.loading")
                : t("clients:import.submit", { count: analyse?.clients.length ?? 0 })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
