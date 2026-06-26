import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const langs = ["fr", "en"] as const;
  return (
    <div className="flex items-center gap-1">
      {langs.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded px-2 py-1 text-xs font-semibold uppercase transition ${
            i18n.resolvedLanguage === lng
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
