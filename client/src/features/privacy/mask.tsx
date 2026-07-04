import { formatMoney, type Lang } from "@gca/shared";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

interface MaskContextValue {
  masked: boolean;
  toggle: () => void;
}

const MaskContext = createContext<MaskContextValue | null>(null);
const KEY = "sgc_mask_amounts";
const HIDDEN = "••••••";

export function MaskProvider({ children }: { children: ReactNode }) {
  const [masked, setMasked] = useState(() => localStorage.getItem(KEY) === "1");

  const toggle = useCallback(() => {
    setMasked((m) => {
      const next = !m;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(() => ({ masked, toggle }), [masked, toggle]);
  return <MaskContext.Provider value={value}>{children}</MaskContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMask() {
  const ctx = useContext(MaskContext);
  if (!ctx) throw new Error("useMask must be used within MaskProvider");
  return ctx;
}

/** Formateur monétaire qui masque le montant si le mode confidentialité est actif. */
// eslint-disable-next-line react-refresh/only-export-components
export function useMoney() {
  const { masked } = useMask();
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  return useCallback(
    (n: number) => (masked ? HIDDEN : formatMoney(n, lang)),
    [masked, lang],
  );
}
