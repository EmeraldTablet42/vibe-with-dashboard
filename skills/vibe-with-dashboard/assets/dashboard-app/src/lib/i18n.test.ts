import { describe, expect, it } from "vitest";

import { resolveContentLocale, resolveLocale } from "@/lib/i18n";
import { pickLocalizedText } from "@/lib/localized-text";

describe("locale matching", () => {
  it("matches English browser locales", () => {
    expect(resolveLocale(["en-US"])).toBe("en");
  });

  it("matches Korean browser locales", () => {
    expect(resolveLocale(["ko-KR"])).toBe("ko");
  });

  it("falls back to English for unsupported locales", () => {
    expect(resolveLocale(["fr-FR", "de-DE"])).toBe("en");
  });

  it("keeps the native content locale even when the shell falls back", () => {
    expect(resolveContentLocale(["fr-FR", "de-DE"])).toBe("fr");
    expect(resolveContentLocale([])).toBe("en");
  });

  it("falls localized content back from native locale to English to source text", () => {
    const entity = {
      title: "Source title",
      translations: {
        en: { title: "English title" },
        ko: { title: "한국어 제목" },
      },
    };

    expect(pickLocalizedText(entity, "ko", "title", entity.title)).toBe(
      "한국어 제목"
    );
    expect(pickLocalizedText(entity, "fr", "title", entity.title)).toBe(
      "English title"
    );
    expect(pickLocalizedText({ translations: {} }, "fr", "title", "Source")).toBe(
      "Source"
    );
  });
});
