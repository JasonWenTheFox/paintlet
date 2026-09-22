import { usePaintStore } from "../../state/store";
import type { Theme } from "../../engine/types";
import { DialogFrame } from "./DialogFrame";
import { SegmentedControl } from "../SegmentedControl";
import type { LanguagePreference } from "../../i18n";
import { useTranslation } from "../../hooks/useTranslation";

const THEME_IDS: Theme[] = ["system", "light", "dark"];
const LANGUAGE_IDS: LanguagePreference[] = ["system", "en", "zh-CN"];

// App preferences (Paintlet → Settings…, ⌘,). Appearance only, and persisted
// across launches (see state/settings). Paint has no preferences window at all,
// so anything here is already a departure — theme earns its place because macOS
// apps are expected to offer it, and nothing else has.
export function SettingsDialog() {
  const t = useTranslation();
  const open = usePaintStore((s) => s.settingsDialogOpen);
  const setOpen = usePaintStore((s) => s.setSettingsDialogOpen);
  const theme = usePaintStore((s) => s.theme);
  const setTheme = usePaintStore((s) => s.setTheme);
  const language = usePaintStore((s) => s.language);
  const setLanguage = usePaintStore((s) => s.setLanguage);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <DialogFrame title={t("settings.title")} onClose={close} className="w-80">
      <p className="text-xs font-medium text-ink">{t("settings.appearance")}</p>
      <SegmentedControl
        className="mt-2"
        ariaLabel={t("settings.appearance")}
        value={theme}
        options={THEME_IDS.map((id) => ({
          id,
          label: t(`settings.theme.${id}`),
        }))}
        onChange={setTheme}
      />
      <p className="mt-1 text-[10px] text-ink-muted">
        {t("settings.appearanceHelp")}
      </p>

      <p className="mt-5 text-xs font-medium text-ink">{t("settings.language")}</p>
      <SegmentedControl
        className="mt-2"
        ariaLabel={t("settings.language")}
        value={language}
        options={LANGUAGE_IDS.map((id) => ({
          id,
          label: t(
            id === "zh-CN"
              ? "settings.language.zhCN"
              : `settings.language.${id}`,
          ),
        }))}
        onChange={setLanguage}
      />
      <p className="mt-1 text-[10px] text-ink-muted">
        {t("settings.languageHelp")}
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={close}
          className="rounded-md bg-[var(--vp-accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {t("common.done")}
        </button>
      </div>
    </DialogFrame>
  );
}
