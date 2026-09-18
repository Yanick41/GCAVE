import { formatDate, type Lang, type ModePaiement } from "@gca/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorCode } from "../../lib/errors";
import { createPaiement } from "../clients/api";
import { createPaiementCommande } from "../commandes/api";
import { useMoney } from "../privacy/mask";

const MODES: ModePaiement[] = ["ESPECES", "MOBILE_MONEY", "VIREMENT"];

/** Commande proposée au rattachement du paiement. */
export interface CommandeOption {
  id: string;
  numero: string;
  date: string;
  /** Reste à payer sur la commande (0 = soldée). */
  reste: number;
}

export function PaymentModal({
  clientId,
  clientName,
  commandes = [],
  defaultCommandeId,
  lockCommande = false,
  onClose,
}: {
  /** NULL pour une vente comptoir : le paiement ne tient qu'à la commande. */
  clientId: string | null;
  clientName: string;
  /** Commandes du client auxquelles le paiement peut être rattaché. */
  commandes?: CommandeOption[];
  /** Commande pré-sélectionnée (paiement enregistré depuis une commande). */
  defaultCommandeId?: string;
  /** Masque le sélecteur : la commande est imposée par le contexte. */
  lockCommande?: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(["paiements", "commandes", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const money = useMoney();
  const queryClient = useQueryClient();

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ModePaiement>("ESPECES");
  const [date, setDate] = useState("");
  const [observation, setObservation] = useState("");
  const [commandeId, setCommandeId] = useState(defaultCommandeId ?? "");
  const [error, setError] = useState<string | null>(null);

  // Le FCFA n'a pas de centimes → montant en chiffres entiers uniquement.
  // On ne garde que les chiffres (robuste aux espaces/virgules/collages).
  const amount = parseInt(montant || "0", 10);
  const amountDisplay = montant.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const selected = commandes.find((c) => c.id === commandeId);
  // Payer plus que le reste dû est autorisé (avance) mais signalé.
  const tropPercu = selected ? Math.max(amount - selected.reste, 0) : 0;

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const input = {
        montant: amount,
        mode,
        date: date || undefined,
        observation: observation || undefined,
      };
      // Rattaché à une commande → la facture de cette commande affichera le
      // paiement et le reste à payer. Sinon : paiement sur le solde global.
      if (commandeId) await createPaiementCommande(commandeId, input);
      // Sans commande ET sans client, l'encaissement ne se rattacherait à
      // rien : la vente comptoir impose donc toujours une commande.
      else if (clientId) await createPaiement(clientId, input);
      else throw new Error("COMMANDE_REQUISE");
    },
    onSuccess: () => {
      if (clientId) queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      if (commandeId) queryClient.invalidateQueries({ queryKey: ["commande", commandeId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (err) => setError(t(`common:errors.${errorCode(err)}`)),
  });

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";
  const valid = amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{t("paiements:newFor", { name: clientName })}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Commande réglée — c'est ce lien qui alimente la facture */}
          {!lockCommande && commandes.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("paiements:order")}{" "}
                <span className="text-xs font-normal text-slate-400">
                  ({t("paiements:orderOptional")})
                </span>
              </label>
              <select
                value={commandeId}
                onChange={(e) => setCommandeId(e.target.value)}
                className={field}
              >
                <option value="">{t("paiements:noOrder")}</option>
                {commandes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {formatDate(c.date, lang)}
                    {c.reste > 0
                      ? ` · ${t("paiements:remainingShort")} ${money(c.reste)}`
                      : ` · ${t("paiements:settledShort")}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {lockCommande && selected && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t("paiements:order")} : <span className="font-semibold">{selected.numero}</span>
            </p>
          )}

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
            {/* Reste dû sur la commande + raccourci « solder » */}
            {selected && selected.reste > 0 && (
              <button
                type="button"
                onClick={() => setMontant(String(Math.round(selected.reste)))}
                className="mt-1.5 text-xs font-medium text-emerald-600 hover:underline"
              >
                {t("paiements:payRemaining", { amount: money(selected.reste) })}
              </button>
            )}
            {selected && selected.reste <= 0 && (
              <p className="mt-1.5 text-xs text-emerald-600">{t("paiements:orderSettled")}</p>
            )}
            {tropPercu > 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                {t("paiements:overpayWarning", { amount: money(tropPercu) })}
              </p>
            )}
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
