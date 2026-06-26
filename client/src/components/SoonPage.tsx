import { useTranslation } from "react-i18next";

export function SoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t(titleKey)}</h1>
      <p className="rounded-lg border border-dashed bg-white p-8 text-center text-slate-400">
        🚧 {t("common.soon")}
      </p>
    </div>
  );
}
