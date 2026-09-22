import { describe, expect, it } from "vitest";
import {
  catalogs,
  missingTranslationKeys,
  resolveLocale,
  translate,
  type Locale,
} from "./i18n";

describe("i18n", () => {
  it("keeps every shipped catalog complete", () => {
    expect(missingTranslationKeys("en")).toEqual([]);
    expect(missingTranslationKeys("zh-CN")).toEqual([]);
  });

  it("falls back to English when a localized key is missing", () => {
    const incomplete = {
      ...catalogs,
      "zh-CN": {},
    } satisfies Record<Locale, (typeof catalogs)[Locale]>;
    expect(translate("zh-CN", "menu.file", {}, incomplete)).toBe("File");
  });

  it("resolves supported Simplified Chinese system locales", () => {
    expect(resolveLocale("system", ["zh-CN"])).toBe("zh-CN");
    expect(resolveLocale("system", ["zh-Hans-SG"])).toBe("zh-CN");
    expect(resolveLocale("system", ["zh-TW"])).toBe("en");
    expect(resolveLocale("system", ["en-US", "zh-CN"])).toBe("en");
    expect(resolveLocale("system", ["fr-FR", "zh-CN"])).toBe("zh-CN");
    expect(resolveLocale("system", ["fr-FR"])).toBe("en");
  });

  it("honors an explicit language preference", () => {
    expect(resolveLocale("en", ["zh-CN"])).toBe("en");
    expect(resolveLocale("zh-CN", ["en-US"])).toBe("zh-CN");
  });
});
