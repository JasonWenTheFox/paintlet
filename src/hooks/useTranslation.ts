import { useMemo } from "react";
import { translator } from "../i18n";
import { usePaintStore } from "../state/store";

export function useTranslation() {
  const locale = usePaintStore((state) => state.locale);
  return useMemo(() => translator(locale), [locale]);
}
