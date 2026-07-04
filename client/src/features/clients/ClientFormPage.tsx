import { clientSchema, type ClientInput } from "@gca/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { errorCode } from "../../lib/errors";
import { createClient, fetchClient, updateClient } from "./api";

export function ClientFormPage() {
  const { t } = useTranslation(["clients", "common"]);
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { nom: "", telephone: "", email: "", adresse: "", soldeInitial: 0 },
  });

  // En édition : charger le client puis pré-remplir
  const { data: existing } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      reset({
        nom: existing.nom,
        telephone: existing.telephone,
        email: existing.email ?? "",
        adresse: existing.adresse ?? "",
        soldeInitial: existing.soldeInitial ?? 0,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: ClientInput) =>
      isEdit ? updateClient(id!, values) : createClient(values),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      navigate(`/clients/${client.id}`, { replace: true });
    },
    onError: (err) => setServerError(t(`common:errors.${errorCode(err)}`)),
  });

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500";
  const requiredMsg = t("clients:form.required");

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <BackButton />
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        {isEdit ? t("clients:form.editTitle") : t("clients:form.newTitle")}
      </h1>

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4 rounded-lg border bg-white dark:bg-slate-900 p-6"
        noValidate
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("clients:form.name")}
          </label>
          <input {...register("nom")} className={field} />
          {errors.nom && (
            <p className="mt-1 text-xs text-red-600">{requiredMsg}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("clients:form.phone")}
          </label>
          <input {...register("telephone")} className={field} />
          {errors.telephone && (
            <p className="mt-1 text-xs text-red-600">{requiredMsg}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("clients:form.email")}
          </label>
          <input type="email" {...register("email")} className={field} />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">
              {t("clients:form.invalidEmail")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("clients:form.address")}
          </label>
          <textarea {...register("adresse")} rows={2} className={field} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("clients:form.openingBalance")}
          </label>
          <input
            type="number"
            step="any"
            {...register("soldeInitial", {
              setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)),
            })}
            className={field}
          />
          <p className="mt-1 text-xs text-slate-400">{t("clients:form.openingBalanceHint")}</p>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-lg bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {mutation.isPending
              ? t("clients:form.saving")
              : t("common:actions.save")}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-5 py-2 font-medium text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {t("common:actions.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
