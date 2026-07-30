import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@gca/shared";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { api } from "../../lib/api";
import { errorCode } from "../../lib/errors";
import { useAuth } from "./AuthContext";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Erreur « le serveur démarre / injoignable un instant » → on peut réessayer.
// (Un vrai refus d'identifiants renvoie une réponse HTTP 401 → on n'insiste pas.)
function isWaking(err: unknown): boolean {
  if (err instanceof AxiosError) {
    if (!err.response) return true; // réseau ou timeout (cold start Render)
    return [502, 503, 504].includes(err.response.status); // passerelle en réveil
  }
  return false;
}

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  // Réveille l'API dès l'ouverture de la page (Render free peut être en pause),
  // pour qu'elle soit prête au moment où l'utilisateur valide ses identifiants.
  useEffect(() => {
    api.get("/api/health").catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "LEGRE", password: "123456" },
  });

  if (isAuthenticated) return <Navigate to="/clients" replace />;

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await login(values.email, values.password);
        setWaking(false);
        navigate("/clients", { replace: true });
        return;
      } catch (err) {
        // Erreur réelle (identifiants, validation…) → on arrête et on affiche.
        if (!isWaking(err) || attempt === maxAttempts) {
          setWaking(false);
          setServerError(t(`common:errors.${errorCode(err)}`));
          return;
        }
        // Serveur en réveil → on patiente et on réessaie automatiquement.
        setWaking(true);
        await sleep(4000);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("common:app.name")}
          </h1>
          <LanguageSwitcher />
        </div>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t("auth:login.title")}
        </h2>
        <p className="mb-6 text-sm text-slate-500">{t("auth:login.subtitle")}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("auth:login.email")}
            </label>
            <input
              type="text"
              autoComplete="username"
              {...register("email")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
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

          {waking && !serverError && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {t("auth:login.waking")}
            </p>
          )}

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
            {isSubmitting
              ? waking
                ? t("auth:login.waking")
                : t("auth:login.submitting")
              : t("auth:login.submit")}
          </button>

          <p className="text-center text-xs text-slate-400">
            {t("auth:login.hint")}
          </p>
        </form>
      </div>
    </div>
  );
}
