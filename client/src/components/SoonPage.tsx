import { useTranslation } from "react-i18next";

export function SoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold">{t(titleKey)}</h1>
      <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-12 text-center text-slate-400">
        🚧 {t("common.soon")}
      </p>
    </div>
  );
}
