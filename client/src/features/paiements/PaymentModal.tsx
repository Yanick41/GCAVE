import type { ModePaiement } from "@gca/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode } from "../../lib/errors";
import { createPaiement } from "../clients/api";

const MODES: ModePaiement[] = ["ESPECES", "MOBILE_MONEY", "VIREMENT"];

export function PaymentModal({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["paiements", "common"]);
  const queryClient = useQueryClient();

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ModePaiement>("ESPECES");
  const [date, setDate] = useState("");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Le FCFA n'a pas de centimes → montant en chiffres entiers uniquement.
  // On ne garde que les chiffres (robuste aux espaces/virgules/collages).
  const amount = parseInt(montant || "0", 10);
  const amountDisplay = montant.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const mutation = useMutation({
    mutationFn: () =>
      createPaiement(clientId, {
        montant: amount,
        mode,
        date: date || undefined,
        observation: observation || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (err) => setError(t(`common:errors.${errorCode(err)}`)),
  });

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";
  const valid = amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{t("paiements:newFor", { name: clientName })}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("paiements:amount")}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={amountDisplay}
                onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className={`${field} pr-14 text-right tabular-nums`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                FCFA
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("paiements:mode")}
            </label>
            <select value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} className={field}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`paiements:modes.${m}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("paiements:date")}
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("paiements:observation")}
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder={t("paiements:observationPlaceholder")}
              className={field}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              onClick={() => valid && mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="rounded-lg bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {mutation.isPending ? t("paiements:saving") : t("paiements:save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
