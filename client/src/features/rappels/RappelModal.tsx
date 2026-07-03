import type { PrioriteRappel } from "@gca/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode } from "../../lib/errors";
import { createRappel } from "./api";

const PRIORITES: PrioriteRappel[] = ["FAIBLE", "NORMALE", "URGENTE"];

function inSevenDays() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function RappelModal({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["rappels", "common"]);
  const queryClient = useQueryClient();

  const [note, setNote] = useState("");
  const [echeance, setEcheance] = useState(inSevenDays());
  const [priorite, setPriorite] = useState<PrioriteRappel>("NORMALE");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createRappel(clientId, { note: note.trim(), echeance, priorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["rappels"] });
      queryClient.invalidateQueries({ queryKey: ["rappels-alertes"] });
      onClose();
    },
    onError: (err) => setError(t(`common:errors.${errorCode(err)}`)),
  });

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";
  const valid = note.trim().length > 0 && echeance.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{t("rappels:newFor", { name: clientName })}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("rappels:note")}
            </label>
            <textarea
              rows={3}
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("rappels:notePlaceholder")}
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("rappels:echeance")}
              </label>
              <input
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("rappels:priorite")}
              </label>
              <select
                value={priorite}
                onChange={(e) => setPriorite(e.target.value as PrioriteRappel)}
                className={field}
              >
                {PRIORITES.map((p) => (
                  <option key={p} value={p}>
                    {t(`rappels:priorities.${p}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              onClick={() => valid && mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="rounded-lg bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {mutation.isPending ? t("rappels:saving") : t("rappels:save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
