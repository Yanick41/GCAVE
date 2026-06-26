import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@gca/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { errorCode } from "../../lib/errors";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@gca.local", password: "admin1234" },
  });

  if (isAuthenticated) return <Navigate to="/clients" replace />;

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate("/clients", { replace: true });
    } catch (err) {
      setServerError(t(`common:errors.${errorCode(err)}`));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            {t("common:app.name")}
          </h1>
          <LanguageSwitcher />
        </div>

        <h2 className="text-lg font-semibold text-slate-800">
          {t("auth:login.title")}
        </h2>
        <p className="mb-6 text-sm text-slate-500">{t("auth:login.subtitle")}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth:login.email")}
            </label>
            <input
              type="email"
              autoComplete="username"
              {...register("email")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth:login.password")}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-800 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {isSubmitting ? t("auth:login.submitting") : t("auth:login.submit")}
          </button>

          <p className="text-center text-xs text-slate-400">
            {t("auth:login.hint")}
          </p>
        </form>
      </div>
    </div>
  );
}
